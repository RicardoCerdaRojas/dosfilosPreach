import { describe, it, expect, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, unreviewedBlockingCitations } from '@dosfilos/domain';
import type { ExegeticalPaper, ICitationVerifier, VerifiedCitation } from '@dosfilos/domain';

vi.mock('../../../services/ExegesisCreditReservation', () => ({
    ExegesisCreditReservation: {
        open: vi.fn().mockResolvedValue({
            markLlmContacted: vi.fn(),
            refundIfPreLlm: vi.fn().mockResolvedValue(undefined),
        }),
    },
}));

const { VerifyStepCitationsUseCase } = await import('../VerifyStepCitationsUseCase');

/**
 * Un versículo con análisis tiene dos textos citados: el análisis y la prosa
 * que se entrega. Sólo se verificaba el análisis, y en Santiago 2:14-26 dos
 * citas de la prosa entregada apuntaban a la página vecina (Ropes 204 → 203).
 */
const NOW = new Date('2026-09-30T00:00:00Z');
const REF = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 21, verseEnd: 21 } as const;

const analisis = {
    ...buildEmptyCanonicalVerseAnalysis(REF),
    commentatorEngagement: [
        { sourceKey: 'Ropes', page: 204, pageKind: 'printed', role: 'anchor', position: 'Pasiva divina', verbatimQuote: null },
    ],
} as never;

function trabajo(markdown: string): ExegeticalPaper {
    const version = { id: 'v1', markdown, canonicalAnalysis: analisis, createdAt: NOW } as never;
    return {
        id: 'p1', ownerId: 'u1', displayLanguage: 'es', sources: [],
        steps: [{ id: 's1', kind: 'verse', verseRef: REF, order: 1, state: 'accepted', current: version, accepted: version, versions: [version] }],
    } as unknown as ExegeticalPaper;
}

/** Verifica todo lo del análisis y reprueba todo lo de la prosa. */
const verificador: ICitationVerifier = {
    verify: async ({ citations, markdown }) => {
        if (citations) {
            return { citations: citations.map(c => ({ ...c, status: 'verified' }) as VerifiedCitation) };
        }
        // Offset 0 a propósito: coincide con el ÍNDICE de la primera cita del
        // análisis, que es exactamente el choque que la marca `origin` evita.
        const offset = 0;
        return {
            citations: !markdown.includes('(Ropes') ? [] : [{
                raw: '(Ropes, p. 203)', author: 'Ropes', title: '', pages: '203', offset,
                evidence: 'La fe se perfecciona', evidenceIsQuoted: false,
                status: 'not-found', matchedCorpusId: null, matchedSourceLabel: null,
                similarityScore: null, matchedPage: null, note: null,
            } as VerifiedCitation],
        };
    },
};

function casoDeUso(paper: ExegeticalPaper) {
    const guardados: VerifiedCitation[][] = [];
    const repo = {
        getPaper: async () => paper,
        setStepVersionVerifications: async (_o: string, _p: string, _s: string, _v: string, _sum: unknown, cits: VerifiedCitation[]) => {
            guardados.push(cits);
        },
    };
    const lector = { readResourceContent: async () => null };
    return { uc: new VerifyStepCitationsUseCase(repo as never, lector as never, verificador), guardados };
}

describe('verificar un versículo con análisis y prosa', () => {
    it('verifica también la prosa que se entrega, marcada como tal', async () => {
        const { uc } = casoDeUso(trabajo('Es pasiva divina (Ropes, p. 203).'));
        const { citations, summary } = await uc.execute({ ownerId: 'u1', paperId: 'p1', stepId: 's1' });

        const prosa = citations.filter(c => c.origin === 'prose');
        expect(prosa).toHaveLength(1);
        expect(prosa[0]!.status).toBe('not-found');
        expect(summary.proseCitations).toBe(1);
        expect(summary.proseCitationsWithIssues).toBe(1);
    });

    it('los contadores —y el bloqueo— siguen siendo los del análisis', async () => {
        const { uc } = casoDeUso(trabajo('Es pasiva divina (Ropes, p. 203).'));
        const { citations, summary } = await uc.execute({ ownerId: 'u1', paperId: 'p1', stepId: 's1' });

        expect(summary.counts.notFound).toBe(0);
        expect(summary.counts.verified).toBe(1);
        // La cita de la prosa no tiene ruta en el análisis: no bloquea, y su
        // offset de texto no se confunde con el índice de otra cita.
        expect(unreviewedBlockingCitations(analisis, citations, [])).toEqual([]);
    });

    it('sin prosa compuesta, queda como antes', async () => {
        const { uc } = casoDeUso(trabajo(''));
        const { citations, summary } = await uc.execute({ ownerId: 'u1', paperId: 'p1', stepId: 's1' });
        expect(citations.every(c => c.origin !== 'prose')).toBe(true);
        expect(summary.proseCitations).toBeUndefined();
    });
});
