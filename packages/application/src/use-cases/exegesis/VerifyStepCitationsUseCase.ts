import type {
    CitationStatus,
    ExegeticalPaper,
    ExegeticalStep,
    ExegeticalStepVersion,
    ICitationVerifier,
    ICuratedCorpusReader,
    IExegeticalPaperRepository,
    IResourceContentReader,
    ProjectSource,
    VerifiedCitation,
    VerificationSummary,
    VerifierSource,
    VerifierSourceChunk,
    IPageNumberingReader,
    PageNumbering,
} from '@dosfilos/domain';
import { citationAnchorFor } from '@dosfilos/domain';
import { findUnsupportedWitnessClaims, isCitableSourceType } from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

export interface VerifyStepCitationsInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /**
     * Which version of the step to verify. Optional — when omitted the
     * use case picks `accepted ?? current`, matching the version the
     * UI displays.
     */
    versionId?: string;
}

export interface VerifyStepCitationsOutput {
    /** The persisted summary (also written to the version's `verifications`). */
    summary: VerificationSummary;
    /** Per-citation verdicts for the UI dialog. NOT persisted. */
    citations: VerifiedCitation[];
    /** The version that was verified, for the UI to highlight. */
    versionId: string;
}

/**
 * Runs the configured `ICitationVerifier` over a step version's
 * markdown and persists the resulting summary on that version.
 *
 * Per-citation results are returned to the caller (the UI surfaces
 * them in a dialog) but NOT persisted — they're cheap to recompute
 * on next click and would inflate the Firestore doc unnecessarily.
 *
 * Source resolution mirrors `GenerateStepUseCase.loadSourceContexts`:
 *   - `mode: 'extracted-excerpts'` → one chunk per excerpt with the
 *     excerpt's `sourceLocation` as the page hint.
 *   - `mode: 'full-document'`     → one chunk with the whole text and
 *                                   no page hint (page-mismatch
 *                                   detection is skipped for these).
 *
 * Style-template sources (and any other non-citable type) are excluded
 * up front — the formatter never inlines them, and the verifier
 * shouldn't either.
 */
export class VerifyStepCitationsUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private contentReader: IResourceContentReader,
        private verifier: ICitationVerifier,
        /**
         * Cuando está cableado, las fuentes con receta aportan como evidencia
         * las hojas que el trabajo admitió, con su página. Sin él la
         * verificación sigue siendo correcta —el texto completo entra como
         * respaldo— pero deja de detectar que una cita apunta a la página
         * equivocada, que es justo lo que este verificador aporta de más.
         */
        private corpusReader?: ICuratedCorpusReader,
        /**
         * Numeración impresa de cada fuente. Es lo que pone al verificador a
         * comparar en la misma unidad que la cita: el análisis cita la página
         * impresa, y un `pageHint` en hojas haría saltar «página equivocada»
         * en cada cita correcta de todo libro con preliminares.
         */
        private pageNumbering?: IPageNumberingReader,
    ) { }

    async execute(input: VerifyStepCitationsInput): Promise<VerifyStepCitationsOutput> {
        const { ownerId, paperId, stepId } = input;
        if (!ownerId || !paperId || !stepId) {
            throw new Error('VerifyStepCitationsUseCase: ownerId, paperId, stepId required');
        }

        const paper = await this.paperRepository.getPaper(ownerId, paperId);
        if (!paper) throw new Error(`Paper ${paperId} not found`);
        const step = paper.steps.find(s => s.id === stepId);
        if (!step) throw new Error(`Step ${stepId} not found`);

        const target = pickVersion(step, input.versionId);
        if (!target) throw new Error(`No version available to verify on step ${stepId}`);

        const reservation = await ExegesisCreditReservation.open(
            ownerId,
            'verifyStepCitations',
        );

        try {
            const sources = await this.buildVerifierSources(paper);
            reservation.markLlmContacted();
            const { citations } = await this.verifier.verify({
                markdown: target.markdown,
                sources,
                userId: ownerId,
            });

            // Las afirmaciones sobre manuscritos se cuentan aparte de las
            // citas: no fallan por estar mal atribuidas, sino por no
            // estar atribuidas en absoluto.
            const witnessClaims = findUnsupportedWitnessClaims(target.markdown, citations);
            if (witnessClaims.length > 0) {
                console.warn('[exegesis] afirmaciones sobre manuscritos sin cita', {
                    stepId,
                    total: witnessClaims.length,
                    ejemplo: witnessClaims[0]?.sentence.slice(0, 120),
                });
            }

            const summary = buildSummary(
                citations,
                countSourcesNamedWithoutCitation(target.markdown, sources, citations),
                witnessClaims.length,
            );
            await this.paperRepository.setStepVersionVerifications(
                ownerId,
                paperId,
                stepId,
                target.id,
                summary,
            );

            return { summary, citations, versionId: target.id };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }

    private async buildVerifierSources(paper: ExegeticalPaper): Promise<VerifierSource[]> {
        const out: VerifierSource[] = [];
        for (const source of paper.sources) {
            if (!isCitableSourceType(source.sourceType)) continue;
            const chunks = await this.buildChunks(source);
            if (chunks.length === 0) continue;
            out.push({
                corpusId: source.corpusId,
                citationKey: source.citationKey,
                fullAuthor: source.citationKey,
                displayLabel: source.displayLabel,
                chunks,
            });
        }
        return out;
    }

    /**
     * Evidencia de una fuente con receta: las hojas admitidas, con su página,
     * más el texto completo como respaldo sin pista.
     *
     * Devuelve `null` cuando la fuente no tiene receta o no hay lector
     * cableado, para que el llamador siga por el camino anterior. Un fallo de
     * lectura también devuelve `null`: verificar con evidencia vieja es mejor
     * que no verificar.
     */
    /** `null` sin lector o cuando el recurso no declara numeración utilizable. */
    private async numberingFor(resourceId: string): Promise<PageNumbering | null> {
        if (!this.pageNumbering) return null;
        try {
            return await this.pageNumbering.numberingFor(resourceId);
        } catch (err) {
            console.warn('[VerifyStepCitations] sin numeración para', resourceId, err);
            return null;
        }
    }

    private async readAdmitted(source: ProjectSource): Promise<VerifierSourceChunk[] | null> {
        const ranges = source.excerptRecipe?.sheetRanges;
        if (!this.corpusReader || !ranges || ranges.length === 0) return null;
        const resourceId = source.sourceLibraryResourceId ?? source.corpusId;

        try {
            const chunks = await this.corpusReader.readAdmitted({ resourceId, sheetRanges: ranges });
            if (chunks.length === 0) return null;

            const numbering = await this.numberingFor(resourceId);
            const out = chunks
                .filter(c => c.text.trim().length > 0)
                .map<VerifierSourceChunk>(c => ({
                    text: c.text,
                    // El mismo criterio que el ancla del corpus, y por la
                    // misma razón: si el fragmento se rotula con la hoja y la
                    // cita habla de la página impresa, el cotejo compara dos
                    // unidades distintas y reprueba lo que está bien.
                    pageHint: citationAnchorFor({ sheet: c.sheet ?? null, section: null }, numbering) || null,
                }));

            // Mismo respaldo que el camino anterior: una cita a material fuera
            // de lo curado no debe volver como "no encontrada" solo porque el
            // usuario no eligió esa página para escribir.
            const fullText = await this.contentReader.getTextContent(resourceId);
            if (fullText && fullText.trim().length > 0) {
                out.push({ text: fullText, pageHint: null });
            }
            return out;
        } catch (err) {
            console.warn('[VerifyStepCitations] no se pudo leer lo admitido; se usa lo guardado', {
                resourceId,
                error: (err as Error).message,
            });
            return null;
        }
    }

    private async buildChunks(source: ProjectSource): Promise<VerifierSourceChunk[]> {
        // Fuentes con receta: la evidencia con página son las hojas admitidas,
        // no los `excerpts` —que a partir del corpus consultable ya no son lo
        // que el paso recibió, y en algún momento dejan de guardarse.
        const admitted = await this.readAdmitted(source);
        if (admitted) return admitted;

        if (source.mode === 'extracted-excerpts') {
            const excerptChunks = source.excerpts
                .map<VerifierSourceChunk>(excerpt => ({
                    text: excerpt.text,
                    pageHint: excerpt.sourceLocation || null,
                }))
                .filter(c => c.text.trim().length > 0);

            // Fallback chunk: also pull the full library-resource text
            // when available. The user's curated excerpts are the
            // primary evidence (preserving page-mismatch detection),
            // but a citation may reference content elsewhere in the
            // resource — the verifier should not return "not found"
            // just because the cited passage wasn't curated for paper
            // writing. The fallback chunk has no `pageHint` so any
            // match against it doesn't trigger page-mismatch.
            if (source.sourceLibraryResourceId) {
                const fullText = await this.contentReader.getTextContent(
                    source.sourceLibraryResourceId,
                );
                if (fullText && fullText.trim().length > 0) {
                    excerptChunks.push({ text: fullText, pageHint: null });
                }
            }
            return excerptChunks;
        }
        // 'full-document' (or legacy sources without `mode`): pull the
        // whole corpus text. Page-mismatch detection is impossible
        // here — the verifier handles a null `pageHint` gracefully.
        const text = await this.contentReader.getTextContent(source.corpusId);
        if (!text) return [];
        return [{ text, pageHint: null }];
    }
}

function pickVersion(
    step: ExegeticalStep,
    versionId: string | undefined,
): ExegeticalStepVersion | null {
    if (versionId) {
        return step.versions.find(v => v.id === versionId) ?? null;
    }
    return step.accepted ?? step.current;
}

/**
 * Fuentes que el texto nombra y que ninguna cita detectada atribuye.
 *
 * Nace del paper que pasó verificado con CERO citas detectadas: el
 * verificador leía sólo su propio formato, no encontró nada, y no
 * encontrar nada se veía igual que no tener nada que buscar. Con este
 * número la interfaz puede decir «se nombran tres fuentes y ninguna
 * está citada de forma verificable», que es una duda, no un visto.
 *
 * La búsqueda es por clave de cita con límites de palabra: nombrar a
 * Adamson en prosa cuenta, y «Adamsoniano» no.
 */
function countSourcesNamedWithoutCitation(
    markdown: string,
    sources: ReadonlyArray<VerifierSource>,
    citations: ReadonlyArray<VerifiedCitation>,
): number {
    const attributed = new Set(
        citations
            .map(c => c.author.trim().toLowerCase())
            .filter(Boolean),
    );
    let count = 0;
    for (const source of sources) {
        const key = source.citationKey?.trim();
        if (!key) continue;
        if (attributed.has(key.toLowerCase())) continue;
        const named = new RegExp(`(^|[^\\p{L}])${escapeRegExp(key)}([^\\p{L}]|$)`, 'iu')
            .test(markdown);
        if (named) count++;
    }
    return count;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSummary(
    citations: VerifiedCitation[],
    sourcesNamedWithoutCitation: number,
    witnessClaimsWithoutCitation: number,
): VerificationSummary {
    const counts: Record<CitationStatus, number> = {
        verified: 0,
        'page-mismatch': 0,
        'not-found': 0,
        'fuzzy-low': 0,
        'manual-pending': 0,
    };
    for (const c of citations) counts[c.status]++;
    return {
        lastRunAt: new Date(),
        verifierVersion: 'fuzzy-v1',
        counts: {
            verified: counts.verified,
            pageMismatch: counts['page-mismatch'],
            notFound: counts['not-found'],
            fuzzyLow: counts['fuzzy-low'],
            manualPending: counts['manual-pending'],
        },
        totalCitations: citations.length,
        sourcesNamedWithoutCitation,
        witnessClaimsWithoutCitation,
    };
}
