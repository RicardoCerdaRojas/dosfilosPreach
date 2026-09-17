import type {
    CitationCorrection,
    CitationEdit,
    ExegeticalStepVersion,
    ICitationVerifier,
    ICuratedCorpusReader,
    IExegeticalPaperRepository,
    IPageNumberingReader,
    IResourceContentReader,
    PageNumbering,
    VerifiedCitation,
    VerifierSource,
} from '@dosfilos/domain';
import {
    analysisClaimsToCitations,
    collectAnalysisClaims,
    editCitationAt,
    realignCitationMarks,
} from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';
import { VerifierSourcesBuilder } from '../../services/exegesis/VerifierSourcesBuilder';
import { buildSummary, pageInEvidenceUnit } from './VerifyStepCitationsUseCase';

export interface CorrectCitationInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    versionId: string;
    /** Ruta de la cita en el análisis, p. ej. `commentatorEngagement[1]`. */
    path: string;
    edit: CitationEdit;
}

export interface CorrectCitationOutput {
    version: ExegeticalStepVersion;
    /** El veredicto nuevo de la cita corregida. `null` al quitarla. */
    verdict: VerifiedCitation | null;
}

/**
 * Corrige UNA cita del análisis y vuelve a verificar SOLO esa.
 *
 * El caso que lo motiva: la afirmación sobre el Polel era correcta y
 * estaba en la página 436; la cita decía 440. Hasta aquí las salidas eran
 * regenerar el verso —que reescribe lo que estaba bien— o marcar la cita
 * como revisada y dejar en el trabajo una página falsa.
 *
 * Verificar solo la cita tocada no es un atajo de rendimiento: es lo que
 * hace que corregir no altere el resto del veredicto. Volver a correr el
 * paso entero cambiaría veredictos que nadie pidió revisar, y con ellos
 * las revisiones manuales que ya se hicieron.
 */
export class CorrectCitationUseCase {
    private readonly sourcesBuilder: VerifierSourcesBuilder;

    constructor(
        private paperRepository: IExegeticalPaperRepository,
        contentReader: IResourceContentReader,
        private verifier: ICitationVerifier,
        corpusReader?: ICuratedCorpusReader,
        pageNumbering?: IPageNumberingReader,
    ) {
        this.sourcesBuilder = new VerifierSourcesBuilder(contentReader, corpusReader, pageNumbering);
    }

    async execute(input: CorrectCitationInput): Promise<CorrectCitationOutput> {
        const { ownerId, paperId, stepId, versionId, path, edit } = input;
        if (!ownerId || !paperId || !stepId || !versionId || !path) {
            throw new Error('CorrectCitationUseCase: ownerId, paperId, stepId, versionId and path required');
        }

        const paper = await this.paperRepository.getPaper(ownerId, paperId);
        if (!paper) throw new Error(`Paper ${paperId} not found`);
        const step = paper.steps.find(s => s.id === stepId);
        if (!step) throw new Error(`Step ${stepId} not found`);
        const version = step.versions.find(v => v.id === versionId);
        if (!version) throw new Error(`Version ${versionId} not found in step ${stepId}`);

        const before = version.canonicalAnalysis;
        if (!before) throw new Error(`Version ${versionId} has no canonical analysis to correct`);

        const claimBefore = collectAnalysisClaims(before).find(c => c.path === path);
        if (!claimBefore) throw new Error(`No hay cita en ${path}`);

        const after = editCitationAt(before, path, edit);
        const marks = realignCitationMarks(before, after, {
            verdicts: version.citationVerdicts ?? [],
            reviews: version.citationReviews ?? [],
        });

        const claimsAfter = collectAnalysisClaims(after);
        const offset = claimsAfter.findIndex(c => c.path === path);

        // Quitar una cita no verifica nada: no hay a qué contrastar. Las
        // otras dos ediciones cambian justo lo que el verificador mira —la
        // página, o la oración cotejada—, así que esa cita vuelve a pasar.
        let verdict: VerifiedCitation | null = null;
        if (edit.kind !== 'remove' && offset >= 0) {
            verdict = await this.reverifyOne(paper, after, offset, ownerId);
        }

        const verdicts = verdict
            ? [...marks.verdicts.filter(v => v.offset !== verdict!.offset), verdict]
            : marks.verdicts;
        verdicts.sort((a, b) => a.offset - b.offset);

        const correction: CitationCorrection = {
            path,
            kind: edit.kind,
            before: {
                page: claimBefore.page,
                ...(claimBefore.pageKind ? { pageKind: claimBefore.pageKind } : {}),
                ...(claimBefore.verbatimQuote !== null ? { verbatimQuote: claimBefore.verbatimQuote } : {}),
            },
            after: edit.kind === 'page'
                ? { page: edit.page, pageKind: edit.pageKind }
                : edit.kind === 'quote'
                    ? { verbatimQuote: edit.quote.trim() || null }
                    : {},
            correctedAt: new Date(),
        };

        // El resumen se recalcula con los veredictos que quedan: los
        // números de la cabecera hablan del análisis que ahora está
        // guardado, no del que había antes de corregir.
        const summary = buildSummary([...verdicts], {
            verifierVersion: version.verifications?.verifierVersion ?? 'analysis-v1',
            sourcesNamedWithoutCitation: version.verifications?.sourcesNamedWithoutCitation ?? 0,
            witnessClaimsWithoutCitation: version.verifications?.witnessClaimsWithoutCitation ?? 0,
            citationsWithoutVerbatim: claimsAfter.filter(
                c => (c.site === 'commentator' || c.site === 'crux') && c.verbatimQuote === null,
            ).length,
        });
        // La fecha de la última verificación no se mueve: no se verificó el
        // paso, se verificó una cita.
        if (version.verifications?.lastRunAt) summary.lastRunAt = version.verifications.lastRunAt;

        const saved = await this.paperRepository.applyCitationCorrection(ownerId, paperId, stepId, versionId, {
            analysis: after,
            verdicts,
            reviews: marks.reviews,
            verifications: summary,
            correction,
        });

        return { version: saved, verdict };
    }

    /**
     * Pasa por el verificador la cita corregida y nada más.
     *
     * La evidencia se arma igual que al verificar el paso entero —mismo
     * constructor de fuentes— para que la cita corregida se juzgue con la
     * misma vara que sus vecinas.
     */
    private async reverifyOne(
        paper: Parameters<VerifierSourcesBuilder['build']>[0],
        analysis: NonNullable<ExegeticalStepVersion['canonicalAnalysis']>,
        offset: number,
        ownerId: string,
    ): Promise<VerifiedCitation | null> {
        const reservation = await ExegesisCreditReservation.open(ownerId, 'verifyStepCitations');
        try {
            const sources = await this.sourcesBuilder.build(paper);
            const numberingByKey = new Map(
                sources.map(s => [normalizeKey(s.citationKey ?? ''), s.numbering ?? null] as const),
            );
            const claims = collectAnalysisClaims(analysis);
            const citations = analysisClaimsToCitations(
                claims,
                claim => pageInEvidenceUnit(claim, numberingByKey.get(normalizeKey(claim.sourceKey)) ?? null),
            );
            const one = citations[offset];
            if (!one) return null;

            reservation.markLlmContacted();
            const { citations: verdicts } = await this.verifier.verify({
                markdown: '',
                citations: [one],
                sources,
                userId: ownerId,
                language: paper.displayLanguage,
            });
            const verdict = verdicts[0];
            // El verificador devuelve el `offset` que recibió; se conserva
            // para que la marca siga anclada a su afirmación.
            return verdict ? { ...verdict, offset } : null;
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}

function normalizeKey(s: string): string {
    return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Tipos que solo usa la firma de arriba; se re-exportan para el llamador. */
export type { PageNumbering, VerifierSource };
