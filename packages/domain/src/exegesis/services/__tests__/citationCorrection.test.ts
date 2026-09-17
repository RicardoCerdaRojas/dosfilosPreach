import { describe, expect, it } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CitationReview, VerifiedCitation } from '../../entities/CitationVerification';
import { collectAnalysisClaims } from '../analysisClaims';
import { editCitationAt, parseCitationPath, realignCitationMarks } from '../citationCorrection';

/** Un análisis con los siete sitios citables poblados. */
const analisis = (): CanonicalVerseAnalysis => ({
    ...buildEmptyCanonicalVerseAnalysis({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 3, verseEnd: 3 }),
    commentatorEngagement: [
        { sourceKey: 'Ross', page: 562, pageKind: 'printed', role: 'anchor', position: 'El pastor restaura', verbatimQuote: 'he restores' },
        { sourceKey: "Waltke-O'Connor", page: 440, pageKind: 'printed', role: 'technical', position: 'El Polel funciona como Piel' },
    ],
    translationCruxes: [{
        phrase: 'נַפְשִׁי', description: 'crux', options: [{ translation: 'mi ser', characterization: 'x' }],
        commentatorPositions: [{ sourceKey: 'Craigie', page: 206, pageKind: 'printed', summary: 'prefiere «vida»', supports: 0 }],
        resolution: { chosen: 'mi ser', rationale: 'x' },
    }],
    lexicalAnalyses: [{
        term: 'שׁוב', generalSemanticRange: { glosses: ['volver'], sources: [{ sourceKey: 'Ortiz', page: 430, pageKind: 'printed' }] },
        verseSpecificLoading: 'restaurar', loadingSources: [{ sourceKey: 'Ross', page: 563, pageKind: 'printed' }],
    }],
    footnoteExtensions: [{ anchorPhrase: 'p', text: 'nota', sources: [
        { sourceKey: "Waltke-O'Connor", page: 440, pageKind: 'printed' },
        { sourceKey: 'Arnold', page: 60, pageKind: 'printed' },
    ] }],
    oldTestamentLinks: [{ reference: 'Ez 34', interpretiveBearing: 'pastor', sources: [{ sourceKey: 'Ross', page: 564, pageKind: 'printed' }] }],
    historicalContext: [{ fact: 'pastoreo', relevance: 'contexto', sources: [{ sourceKey: 'Craigie', page: 208, pageKind: 'printed' }] }],
} as unknown as CanonicalVerseAnalysis);

describe('parseCitationPath', () => {
    it('toda ruta que produce el recolector se puede recorrer', () => {
        for (const claim of collectAnalysisClaims(analisis())) {
            expect(parseCitationPath(claim.path), claim.path).not.toBeNull();
        }
    });

    it('rechaza rutas inventadas o hacia campos ajenos', () => {
        expect(parseCitationPath('translationSteps[0]')).toBeNull();
        expect(parseCitationPath('commentatorEngagement[x]')).toBeNull();
        expect(parseCitationPath('')).toBeNull();
    });
});

describe('editCitationAt — página', () => {
    it('corrige la página de la cita señalada y no toca las demás', () => {
        const antes = analisis();
        const despues = editCitationAt(antes, 'commentatorEngagement[1]', { kind: 'page', page: 436, pageKind: 'printed' });
        expect(despues.commentatorEngagement[1]!.page).toBe(436);
        expect(despues.commentatorEngagement[0]!.page).toBe(562);
        expect(antes.commentatorEngagement[1]!.page).toBe(440); // el original no se muta
    });

    it('llega a una cita anidada en una nota al pie', () => {
        const d = editCitationAt(analisis(), 'footnoteExtensions[0].sources[1]', { kind: 'page', page: 61, pageKind: 'printed' });
        expect(d.footnoteExtensions[0]!.sources[1]!.page).toBe(61);
        expect(d.footnoteExtensions[0]!.sources[0]!.page).toBe(440);
    });

    it('llega al rango semántico de un análisis léxico', () => {
        const d = editCitationAt(analisis(), 'lexicalAnalyses[0].generalSemanticRange.sources[0]', { kind: 'page', page: 431, pageKind: 'printed' });
        expect(d.lexicalAnalyses[0]!.generalSemanticRange!.sources[0]!.page).toBe(431);
    });

    it('rechaza una página que no es un número de página', () => {
        expect(() => editCitationAt(analisis(), 'commentatorEngagement[0]', { kind: 'page', page: 0, pageKind: 'printed' })).toThrow();
    });
});

describe('editCitationAt — oración textual', () => {
    it('registra la oración donde el esquema la admite', () => {
        const d = editCitationAt(analisis(), 'commentatorEngagement[1]', { kind: 'quote', quote: '  to restore (Polel for Piel)  ' });
        expect(d.commentatorEngagement[1]!.verbatimQuote).toBe('to restore (Polel for Piel)');
    });

    it('una oración vacía borra el campo, no lo deja en blanco', () => {
        const d = editCitationAt(analisis(), 'commentatorEngagement[0]', { kind: 'quote', quote: '   ' });
        expect('verbatimQuote' in d.commentatorEngagement[0]!).toBe(false);
    });

    it('se niega donde el esquema no guarda oración', () => {
        expect(() => editCitationAt(analisis(), 'footnoteExtensions[0].sources[0]', { kind: 'quote', quote: 'x' }))
            .toThrow(/oración textual/);
    });
});

describe('editCitationAt — quitar', () => {
    it('quita la fuente de la nota y deja las otras', () => {
        const d = editCitationAt(analisis(), 'footnoteExtensions[0].sources[0]', { kind: 'remove' });
        expect(d.footnoteExtensions[0]!.sources).toHaveLength(1);
        expect(d.footnoteExtensions[0]!.sources[0]!.sourceKey).toBe('Arnold');
    });

    it('quitar una postura de comentarista quita su entrada entera', () => {
        const d = editCitationAt(analisis(), 'commentatorEngagement[0]', { kind: 'remove' });
        expect(d.commentatorEngagement).toHaveLength(1);
        expect(d.commentatorEngagement[0]!.sourceKey).toBe("Waltke-O'Connor");
    });

    it('una ruta que no existe falla en vez de no hacer nada', () => {
        expect(() => editCitationAt(analisis(), 'commentatorEngagement[9]', { kind: 'remove' })).toThrow();
    });
});

const veredicto = (offset: number, status: VerifiedCitation['status'] = 'verified'): VerifiedCitation => ({
    raw: '', author: '', title: '', pages: null, offset, evidence: '', evidenceIsQuoted: false,
    status, matchedCorpusId: null, matchedSourceLabel: null, similarityScore: null, matchedPage: null, note: null,
});

describe('realignCitationMarks', () => {
    it('una corrección de página conserva todas las marcas donde estaban', () => {
        const antes = analisis();
        const despues = editCitationAt(antes, 'commentatorEngagement[1]', { kind: 'page', page: 436, pageKind: 'printed' });
        const r = realignCitationMarks(antes, despues, {
            verdicts: [veredicto(0), veredicto(1, 'not-found')],
            reviews: [{ path: 'commentatorEngagement[1]', note: 'está en 436', reviewedAt: new Date() }],
        });
        expect(r.verdicts.map(v => v.offset)).toEqual([0, 1]);
        expect(r.reviews[0]!.path).toBe('commentatorEngagement[1]');
    });

    it('quitar una cita corre las siguientes: el veredicto sigue a SU cita', () => {
        const antes = analisis();
        const claims = collectAnalysisClaims(antes);
        const iArnold = claims.findIndex(c => c.path === 'footnoteExtensions[0].sources[1]');
        const iWO = iArnold - 1;

        const despues = editCitationAt(antes, 'footnoteExtensions[0].sources[0]', { kind: 'remove' });
        const r = realignCitationMarks(antes, despues, {
            verdicts: [veredicto(iWO, 'not-found'), veredicto(iArnold, 'verified')],
            reviews: [{ path: 'footnoteExtensions[0].sources[1]', note: 'ok', reviewedAt: new Date() }],
        });

        // El de la cita quitada desaparece; el de Arnold viaja a su nuevo índice.
        expect(r.verdicts).toHaveLength(1);
        expect(r.verdicts[0]!.status).toBe('verified');
        expect(collectAnalysisClaims(despues)[r.verdicts[0]!.offset]!.sourceKey).toBe('Arnold');
        // Y la revisión sigue a la cita, que ahora vive en sources[0].
        expect(r.reviews[0]!.path).toBe('footnoteExtensions[0].sources[0]');
    });

    it('una marca de una cita que ya no existe se descarta', () => {
        const antes = analisis();
        const despues = editCitationAt(antes, 'commentatorEngagement[0]', { kind: 'remove' });
        const r = realignCitationMarks(antes, despues, {
            verdicts: [veredicto(0, 'not-found')],
            reviews: [{ path: 'commentatorEngagement[0]', note: 'x', reviewedAt: new Date() }],
        });
        expect(r.verdicts).toEqual([]);
        expect(r.reviews).toEqual([]);
    });
});
