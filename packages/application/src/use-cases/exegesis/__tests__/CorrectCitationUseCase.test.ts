import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, collectAnalysisClaims } from '@dosfilos/domain';
import type { CanonicalVerseAnalysis, PassageReference, VerifiedCitation } from '@dosfilos/domain';
import { CorrectCitationUseCase } from '../CorrectCitationUseCase';

vi.mock('../../../services/ExegesisCreditReservation', () => ({
    ExegesisCreditReservation: {
        open: vi.fn().mockResolvedValue({ markLlmContacted: vi.fn(), refundIfPreLlm: vi.fn() }),
    },
}));

const VERSE: PassageReference = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 3, verseEnd: 3 };

const analysis = (): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis(VERSE),
    commentatorEngagement: [
        { sourceKey: 'Ross', page: 562, pageKind: 'printed', role: 'anchor', position: 'El pastor restaura' },
        { sourceKey: "Waltke-O'Connor", page: 440, pageKind: 'printed', role: 'technical', position: 'El Polel funciona como Piel' },
    ],
} as CanonicalVerseAnalysis);

const verdict = (offset: number, status: VerifiedCitation['status']): VerifiedCitation => ({
    raw: '', author: '', title: '', pages: null, offset, evidence: '', evidenceIsQuoted: false,
    status, matchedCorpusId: null, matchedSourceLabel: null, similarityScore: null, matchedPage: null, note: null,
});

function build(overrides: { verify?: ReturnType<typeof vi.fn> } = {}) {
    const version = {
        id: 'v1',
        markdown: '',
        canonicalAnalysis: analysis(),
        citationVerdicts: [verdict(0, 'verified'), verdict(1, 'not-found')],
        citationReviews: [{ path: 'commentatorEngagement[1]', note: 'mirar la 436', reviewedAt: new Date() }],
        verifications: { lastRunAt: new Date('2026-09-17T10:00:00Z'), verifierVersion: 'analysis-v1', counts: {}, totalCitations: 2, sourcesNamedWithoutCitation: 0, witnessClaimsWithoutCitation: 0 },
    };
    const step = { id: 's1', kind: 'verse', versions: [version], accepted: null, current: version };
    const paper = { id: 'p1', displayLanguage: 'es', steps: [step], sources: [] };
    const repo = {
        getPaper: vi.fn().mockResolvedValue(paper),
        applyCitationCorrection: vi.fn().mockImplementation(async (_o, _p, _s, _v, payload) => ({ ...version, ...payload })),
    };
    const verify = overrides.verify ?? vi.fn().mockResolvedValue({
        citations: [{ ...verdict(0, 'verified'), note: 'hallada en p. 436' }],
    });
    const useCase = new CorrectCitationUseCase(
        repo as never,
        { getTextContent: vi.fn().mockResolvedValue('') } as never,
        { verify } as never,
    );
    return { useCase, repo, verify };
}

const input = { ownerId: 'o', paperId: 'p1', stepId: 's1', versionId: 'v1' };

beforeEach(() => { vi.clearAllMocks(); });

describe('CorrectCitationUseCase', () => {
    it('corregir la página la escribe en el análisis guardado', async () => {
        const { useCase, repo } = build();
        await useCase.execute({ ...input, path: 'commentatorEngagement[1]', edit: { kind: 'page', page: 436, pageKind: 'printed' } });

        const saved = repo.applyCitationCorrection.mock.calls[0]![4].analysis as CanonicalVerseAnalysis;
        expect(saved.commentatorEngagement[1]!.page).toBe(436);
        expect(saved.commentatorEngagement[0]!.page).toBe(562);
    });

    it('vuelve a verificar SOLO la cita corregida', async () => {
        const { useCase, verify } = build();
        await useCase.execute({ ...input, path: 'commentatorEngagement[1]', edit: { kind: 'page', page: 436, pageKind: 'printed' } });

        expect(verify).toHaveBeenCalledTimes(1);
        expect(verify.mock.calls[0]![0].citations).toHaveLength(1);
        expect(verify.mock.calls[0]![0].citations[0].author).toBe("Waltke-O'Connor");
    });

    it('el veredicto de la cita vecina queda como estaba', async () => {
        const { useCase, repo } = build();
        await useCase.execute({ ...input, path: 'commentatorEngagement[1]', edit: { kind: 'page', page: 436, pageKind: 'printed' } });

        const verdicts = repo.applyCitationCorrection.mock.calls[0]![4].verdicts as VerifiedCitation[];
        expect(verdicts).toHaveLength(2);
        expect(verdicts[0]).toMatchObject({ offset: 0, status: 'verified' });
        expect(verdicts[1]).toMatchObject({ offset: 1, note: 'hallada en p. 436' });
    });

    it('quitar una cita no llama al verificador y arrastra sus marcas', async () => {
        const { useCase, repo, verify } = build();
        await useCase.execute({ ...input, path: 'commentatorEngagement[1]', edit: { kind: 'remove' } });

        expect(verify).not.toHaveBeenCalled();
        const payload = repo.applyCitationCorrection.mock.calls[0]![4];
        expect(collectAnalysisClaims(payload.analysis)).toHaveLength(1);
        expect(payload.verdicts).toHaveLength(1);
        expect(payload.reviews).toHaveLength(0);
    });

    it('registra qué se corrigió y desde qué valor', async () => {
        const { useCase, repo } = build();
        await useCase.execute({ ...input, path: 'commentatorEngagement[1]', edit: { kind: 'page', page: 436, pageKind: 'printed' } });

        expect(repo.applyCitationCorrection.mock.calls[0]![4].correction).toMatchObject({
            path: 'commentatorEngagement[1]',
            kind: 'page',
            before: { page: 440, pageKind: 'printed' },
            after: { page: 436, pageKind: 'printed' },
        });
    });

    it('la fecha de la última verificación del paso no se mueve', async () => {
        const { useCase, repo } = build();
        await useCase.execute({ ...input, path: 'commentatorEngagement[1]', edit: { kind: 'page', page: 436, pageKind: 'printed' } });

        const summary = repo.applyCitationCorrection.mock.calls[0]![4].verifications;
        expect(summary.lastRunAt).toEqual(new Date('2026-09-17T10:00:00Z'));
        expect(summary.counts).toMatchObject({ verified: 2 });
    });

    it('una ruta que no existe falla sin escribir nada', async () => {
        const { useCase, repo } = build();
        await expect(useCase.execute({ ...input, path: 'commentatorEngagement[9]', edit: { kind: 'remove' } })).rejects.toThrow();
        expect(repo.applyCitationCorrection).not.toHaveBeenCalled();
    });
});
