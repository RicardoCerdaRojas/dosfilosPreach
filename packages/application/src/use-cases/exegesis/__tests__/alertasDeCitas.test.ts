import { describe, it, expect, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';

vi.mock('../../../services/ExegesisCreditReservation', () => ({ ExegesisCreditReservation: { open: vi.fn() } }));
const { citationAlertsOf } = await import('../ComposeVerseAcademicProseUseCase');

/** TP #8 (8b, E1): la prosa sabe qué citas del análisis no se pudieron respaldar. */
describe('citationAlertsOf', () => {
    const analysis = {
        ...buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 5, verseEnd: 5 }),
        commentatorEngagement: [
            { sourceKey: 'Adamson', page: 171, role: 'contrast' as const, position: 'cataloga' },
            { sourceKey: 'Mayor', page: 139, role: 'anchor' as const, position: 'rechaza' },
            { sourceKey: 'Tuggy', page: 584, role: 'technical' as const, position: 'glosa' },
        ],
    };
    const v = (offset: number, raw: string, status: string, extra: Record<string, unknown> = {}) =>
        ({ raw, offset, status, author: '', title: '', pages: null, evidence: '', evidenceIsQuoted: false, matchedCorpusId: null, matchedSourceLabel: null, similarityScore: null, matchedPage: null, note: null, ...extra });

    it('las del análisis con alarma, sin las revisadas ni las de la prosa, con la página hallada', () => {
        const alertas = citationAlertsOf({
            canonicalAnalysis: analysis,
            citationVerdicts: [
                v(0, 'Adamson, p. 171', 'page-mismatch', { matchedPageLabel: 'p. 170' }),
                v(1, 'Mayor, p. 139', 'not-found'),
                v(2, 'Tuggy, p. 584', 'verified'),
                v(5, '(Mayor, 140)', 'not-found', { origin: 'prose' }),
            ] as never,
            citationReviews: [{ path: 'commentatorEngagement[1]', note: 'revisada', reviewedAt: new Date() }],
        });
        // Con el rótulo del análisis serializado: el libro sin folios dice «hoja».
        expect(alertas).toEqual([{ citation: 'Adamson (hoja 171)', status: 'page-mismatch', foundAt: 'p. 170' }]);
    });

    it('sin análisis, nada', () => {
        expect(citationAlertsOf({ canonicalAnalysis: null, citationVerdicts: [] } as never)).toEqual([]);
    });
});
