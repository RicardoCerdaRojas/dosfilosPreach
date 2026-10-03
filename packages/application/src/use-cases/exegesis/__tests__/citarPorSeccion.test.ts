import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '@dosfilos/domain';
import { stampCitationPageKind } from '../stampCitationPageKind';
import { pageInEvidenceUnit } from '../VerifyStepCitationsUseCase';

/** Un libro que declara no tener páginas impresas se cita por sección. */
const SIN_FOLIOS = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 711, offset: null }] } as never;
const REF = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 14 } as never;
const FUENTE = { id: 's', citationKey: 'Wallace', excerptRecipe: null } as never;

function analisis(c: Record<string, unknown>) {
    return { ...buildEmptyCanonicalVerseAnalysis(REF), commentatorEngagement: [{ sourceKey: 'Wallace', role: 'technical', position: 'x', verbatimQuote: null, ...c }] } as never;
}

describe('stampCitationPageKind — sección', () => {
    it('con su sección, la cita queda «section»', () => {
        const r = stampCitationPageKind(analisis({ page: 0, locator: '2.3' }), [FUENTE], new Map([['s', SIN_FOLIOS]])) as { commentatorEngagement: Array<{ pageKind: string }> };
        expect(r.commentatorEngagement[0]!.pageKind).toBe('section');
    });
    it('sin sección, hoja: lo que el número dice', () => {
        const r = stampCitationPageKind(analisis({ page: 87 }), [FUENTE], new Map([['s', SIN_FOLIOS]])) as { commentatorEngagement: Array<{ pageKind: string }> };
        expect(r.commentatorEngagement[0]!.pageKind).toBe('sheet');
    });
});

describe('pageInEvidenceUnit — una cita por sección no se coteja por página', () => {
    it('devuelve null: se verifica por el texto', () => {
        expect(pageInEvidenceUnit({ site: 'commentator', path: '', sourceKey: 'W', page: 0, pageKind: 'section', locator: '2.3', claim: '', verbatimQuote: null }, SIN_FOLIOS)).toBeNull();
    });
});
