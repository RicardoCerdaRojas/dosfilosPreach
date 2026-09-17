import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { VerifiedCitation } from '../../entities/CitationVerification';
import { isUnreviewedCitationsError, mapVerdictsByPath, UnreviewedCitationsError, unreviewedNotFound } from '../citationReview';

const analisis = (): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 3, verseEnd: 3 }),
    commentatorEngagement: [
        { sourceKey: 'Ross', page: 562, role: 'anchor', position: 'a', verbatimQuote: 'x y z w' },
        { sourceKey: "Waltke-O'Connor", page: 440, role: 'technical', position: 'b' },
    ],
    footnoteExtensions: [{ anchorPhrase: 'p', text: 'nota', sources: [{ sourceKey: "Waltke-O'Connor", page: 440 }] }],
} as CanonicalVerseAnalysis);

const veredicto = (offset: number, status: VerifiedCitation['status']): VerifiedCitation => ({
    raw: '', author: '', title: '', pages: null, offset, evidence: '', evidenceIsQuoted: false,
    status, matchedCorpusId: null, matchedSourceLabel: null, similarityScore: null, matchedPage: null, note: null,
});

describe('mapVerdictsByPath', () => {
    it('une cada veredicto con la ruta de su cita en el análisis', () => {
        const m = mapVerdictsByPath(analisis(), [veredicto(0, 'verified'), veredicto(2, 'not-found')]);
        expect(m.get('commentatorEngagement[0]')?.status).toBe('verified');
        expect(m.get('footnoteExtensions[0].sources[0]')?.status).toBe('not-found');
    });

    it('un veredicto de un análisis anterior, con offset fuera de rango, se ignora', () => {
        expect(mapVerdictsByPath(analisis(), [veredicto(9, 'not-found')]).size).toBe(0);
    });
});

describe('unreviewedNotFound', () => {
    const verdicts = [veredicto(0, 'verified'), veredicto(1, 'not-found'), veredicto(2, 'not-found')];

    it('bloquea las no encontradas que nadie revisó', () => {
        expect(unreviewedNotFound(analisis(), verdicts, [])).toEqual(['commentatorEngagement[1]', 'footnoteExtensions[0].sources[0]']);
    });

    it('una revisión manual levanta el bloqueo de esa cita', () => {
        expect(unreviewedNotFound(analisis(), verdicts, [{ path: 'commentatorEngagement[1]', note: 'está en p. 436', reviewedAt: new Date() }]))
            .toEqual(['footnoteExtensions[0].sources[0]']);
    });

    it('las dudas no bloquean: coincidencia baja y revisión manual pasan', () => {
        expect(unreviewedNotFound(analisis(), [veredicto(1, 'fuzzy-low'), veredicto(2, 'manual-pending')], [])).toEqual([]);
    });

    it('sin verificación no hay nada que bloquee', () => {
        expect(unreviewedNotFound(analisis(), [], [])).toEqual([]);
    });
});

describe('UnreviewedCitationsError', () => {
    it('se reconoce aunque cruce un límite de módulo', () => {
        const e = new UnreviewedCitationsError(['a']);
        expect(isUnreviewedCitationsError(e)).toBe(true);
        expect(isUnreviewedCitationsError({ name: 'UnreviewedCitationsError' })).toBe(true);
        expect(isUnreviewedCitationsError(new Error('x'))).toBe(false);
    });
});
