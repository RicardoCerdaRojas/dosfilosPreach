import type {
    CitationStatus,
    ExegeticalStep,
    ExegeticalStepVersion,
    ICitationVerifier,
    ICuratedCorpusReader,
    IExegeticalPaperRepository,
    IPageNumberingReader,
    IResourceContentReader,
    VerifiedCitation,
    VerificationSummary,
    VerifierSource,
    PageNumbering,
} from '@dosfilos/domain';
import {
    analysisClaimsToCitations,
    collectAnalysisClaims,
    printedLabelIn,
    type AnalysisClaim,
} from '@dosfilos/domain';
import { findUnsupportedWitnessClaims } from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';
import { VerifierSourcesBuilder } from '../../services/exegesis/VerifierSourcesBuilder';

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
    private readonly sourcesBuilder: VerifierSourcesBuilder;

    constructor(
        private paperRepository: IExegeticalPaperRepository,
        contentReader: IResourceContentReader,
        private verifier: ICitationVerifier,
        /**
         * Cuando está cableado, las fuentes con receta aportan como evidencia
         * las hojas que el trabajo admitió, con su página. Sin él la
         * verificación sigue siendo correcta —el texto completo entra como
         * respaldo— pero deja de detectar que una cita apunta a la página
         * equivocada, que es justo lo que este verificador aporta de más.
         */
        corpusReader?: ICuratedCorpusReader,
        /**
         * Numeración impresa de cada fuente. Es lo que pone al verificador a
         * comparar en la misma unidad que la cita: el análisis cita la página
         * impresa, y un `pageHint` en hojas haría saltar «página equivocada»
         * en cada cita correcta de todo libro con preliminares.
         */
        pageNumbering?: IPageNumberingReader,
    ) {
        this.sourcesBuilder = new VerifierSourcesBuilder(contentReader, corpusReader, pageNumbering);
    }

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
            const sources = await this.sourcesBuilder.build(paper);
            reservation.markLlmContacted();

            const { citations, summary } = target.canonicalAnalysis
                ? await this.verifyAnalysis(target.canonicalAnalysis, sources, paper.displayLanguage, ownerId)
                : await this.verifyMarkdown(target.markdown, sources, ownerId, stepId);

            await this.paperRepository.setStepVersionVerifications(
                ownerId,
                paperId,
                stepId,
                target.id,
                summary,
                citations,
            );

            return { summary, citations, versionId: target.id };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }

    /**
     * El camino de la prosa: las citas se reconocen en el markdown.
     */
    private async verifyMarkdown(
        markdown: string,
        sources: VerifierSource[],
        ownerId: string,
        stepId: string,
    ): Promise<{ citations: VerifiedCitation[]; summary: VerificationSummary }> {
        const { citations } = await this.verifier.verify({ markdown, sources, userId: ownerId });

        // Las afirmaciones sobre manuscritos se cuentan aparte de las
        // citas: no fallan por estar mal atribuidas, sino por no
        // estar atribuidas en absoluto.
        const witnessClaims = findUnsupportedWitnessClaims(markdown, citations);
        if (witnessClaims.length > 0) {
            console.warn('[exegesis] afirmaciones sobre manuscritos sin cita', {
                stepId,
                total: witnessClaims.length,
                ejemplo: witnessClaims[0]?.sentence.slice(0, 120),
            });
        }

        const summary = buildSummary(citations, {
            verifierVersion: 'fuzzy-v1',
            sourcesNamedWithoutCitation: countSourcesNamedWithoutCitation(markdown, sources, citations),
            witnessClaimsWithoutCitation: witnessClaims.length,
        });
        return { citations, summary };
    }

    /**
     * El camino del análisis canónico: las citas ya están estructuradas.
     *
     * Existe porque este camino no se verificaba. El paso guarda su
     * análisis en `canonicalAnalysis` y deja `markdown` vacío; el
     * verificador parseaba ese vacío, encontraba cero citas, y el
     * resultado era indistinguible de «todo verificado». En el trabajo
     * de Sal 23:1–3 ninguno de los cinco pasos llegó a verificarse.
     */
    private async verifyAnalysis(
        analysis: NonNullable<ExegeticalStepVersion['canonicalAnalysis']>,
        sources: VerifierSource[],
        language: 'es' | 'en',
        ownerId: string,
    ): Promise<{ citations: VerifiedCitation[]; summary: VerificationSummary }> {
        const claims = collectAnalysisClaims(analysis);
        const numberingByKey = new Map(
            sources.map(s => [normalizeKey(s.citationKey ?? ''), s.numbering ?? null] as const),
        );
        const citations = analysisClaimsToCitations(
            claims,
            claim => pageInEvidenceUnit(claim, numberingByKey.get(normalizeKey(claim.sourceKey)) ?? null),
        );

        const { citations: verdicts } = await this.verifier.verify({
            markdown: '',
            citations,
            sources,
            userId: ownerId,
            language,
        });

        const summary = buildSummary(verdicts, {
            verifierVersion: 'analysis-v1',
            sourcesNamedWithoutCitation: 0,
            witnessClaimsWithoutCitation: 0,
            citationsWithoutVerbatim: claims.filter(
                c => (c.site === 'commentator' || c.site === 'crux') && c.verbatimQuote === null,
            ).length,
        });
        return { citations: verdicts, summary };
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

/**
 * La página de la cita en la unidad en que el verificador rotula su
 * evidencia, o `null` para no cotejar.
 *
 * La evidencia se rotula con la página impresa cuando el recurso tiene
 * numeración y con la hoja cuando no. Una cita impresa contra evidencia en
 * hojas —o al revés— no es comparable: ahí se devuelve `null`, que apaga el
 * cotejo en vez de reprobar lo que está bien.
 */
export function pageInEvidenceUnit(claim: AnalysisClaim, numbering: PageNumbering | null): string | null {
    const printed = claim.pageKind === 'printed';
    if (numbering) {
        return printed ? String(claim.page) : printedLabelIn(numbering, claim.page);
    }
    return printed ? null : String(claim.page);
}

function normalizeKey(s: string): string {
    return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface SummaryExtras {
    verifierVersion: string;
    sourcesNamedWithoutCitation: number;
    witnessClaimsWithoutCitation: number;
    citationsWithoutVerbatim?: number;
}

export function buildSummary(citations: VerifiedCitation[], extras: SummaryExtras): VerificationSummary {
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
        verifierVersion: extras.verifierVersion,
        counts: {
            verified: counts.verified,
            pageMismatch: counts['page-mismatch'],
            notFound: counts['not-found'],
            fuzzyLow: counts['fuzzy-low'],
            manualPending: counts['manual-pending'],
        },
        totalCitations: citations.length,
        sourcesNamedWithoutCitation: extras.sourcesNamedWithoutCitation,
        witnessClaimsWithoutCitation: extras.witnessClaimsWithoutCitation,
        ...(extras.citationsWithoutVerbatim !== undefined
            ? { citationsWithoutVerbatim: extras.citationsWithoutVerbatim }
            : {}),
    };
}
