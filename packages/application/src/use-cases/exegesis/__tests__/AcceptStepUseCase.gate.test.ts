import { describe, it, expect, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, isUnreviewedCitationsError } from '@dosfilos/domain';
import type { PassageReference, VerifiedCitation } from '@dosfilos/domain';
import { AcceptStepUseCase } from '../AcceptStepUseCase';

/**
 * El gate de aceptación. La regla viene del Estudio Madre y se reutiliza
 * tal cual: bloquear lo que está mal, no lo que está incompleto.
 */
const VERSE: PassageReference = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 3, verseEnd: 3 };
const analysis = {
    ...buildEmptyCanonicalVerseAnalysis(VERSE),
    commentatorEngagement: [{ sourceKey: "Waltke-O'Connor", page: 440, role: 'technical', position: 'polel' }],
};
const notFound: VerifiedCitation = {
    raw: '', author: '', title: '', pages: null, offset: 0, evidence: '', evidenceIsQuoted: false,
    status: 'not-found', matchedCorpusId: null, matchedSourceLabel: null, similarityScore: null, matchedPage: null, note: null,
};

function useCaseWith(version: Record<string, unknown>) {
    const step = { id: 's1', kind: 'verse', versions: [{ id: 'v1', markdown: '', ...version }], accepted: null, current: null };
    const repo = {
        getPaper: vi.fn().mockResolvedValue({ id: 'p1', steps: [step] }),
        acceptStepVersion: vi.fn().mockResolvedValue({ ...step, kind: 'verse', accepted: step.versions[0] }),
    };
    return { useCase: new AcceptStepUseCase(repo as never), repo };
}
const input = { ownerId: 'o', paperId: 'p1', stepId: 's1', versionId: 'v1' };

describe('AcceptStepUseCase — gate de citas', () => {
    it('una cita no encontrada y sin revisar bloquea, y dice cuál', async () => {
        const { useCase, repo } = useCaseWith({ canonicalAnalysis: analysis, citationVerdicts: [notFound] });
        await expect(useCase.execute(input)).rejects.toSatisfy((e: unknown) =>
            isUnreviewedCitationsError(e) && e.paths[0] === 'commentatorEngagement[0]');
        expect(repo.acceptStepVersion).not.toHaveBeenCalled();
    });

    it('revisada a mano, la misma cita deja pasar', async () => {
        const { useCase, repo } = useCaseWith({
            canonicalAnalysis: analysis,
            citationVerdicts: [notFound],
            citationReviews: [{ path: 'commentatorEngagement[0]', note: 'el contraste está en p. 436', reviewedAt: new Date() }],
        });
        await useCase.execute(input);
        expect(repo.acceptStepVersion).toHaveBeenCalled();
    });

    it('sin verificación no bloquea: no se sabe que esté mal', async () => {
        const { useCase, repo } = useCaseWith({ canonicalAnalysis: analysis });
        await useCase.execute(input);
        expect(repo.acceptStepVersion).toHaveBeenCalled();
    });

    it('una duda (coincidencia baja) no bloquea', async () => {
        const { useCase, repo } = useCaseWith({ canonicalAnalysis: analysis, citationVerdicts: [{ ...notFound, status: 'fuzzy-low' }] });
        await useCase.execute(input);
        expect(repo.acceptStepVersion).toHaveBeenCalled();
    });

    it('un paso de prosa, sin análisis, no pasa por el gate', async () => {
        const { useCase, repo } = useCaseWith({ markdown: 'prosa', citationVerdicts: [notFound] });
        await useCase.execute(input);
        expect(repo.acceptStepVersion).toHaveBeenCalled();
    });
});
