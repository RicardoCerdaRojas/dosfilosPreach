import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import {
    analysisClaimsToCitations,
    citationDisplayRaw,
    citationSite,
    collectAnalysisClaims,
} from '../analysisClaims';

/**
 * TP Santiago 2:14-26: la nota «McCartney y Ropes ambos prefieren la pasiva»,
 * citada a cada uno, salía «no encontrada» y bloqueaba aceptar el paso: cada
 * fuente se verificaba exigiendo la comparación entera, que ninguna contiene
 * sola.
 */
const REF = { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 21, verseEnd: 21 } as const;
const analisis = {
    ...buildEmptyCanonicalVerseAnalysis(REF),
    commentatorEngagement: [
        { sourceKey: 'McCartney', page: 173, role: 'anchor', position: 'McCartney y Ropes ambos prefieren la pasiva' },
        { sourceKey: 'Varner', page: 110, role: 'contrast', position: 'Lee una voz media' },
    ],
    footnoteExtensions: [
        { text: 'Los dos leen ἐδικαιώθη como pasiva divina.', sources: [{ sourceKey: 'McCartney', page: 173 }, { sourceKey: 'Ropes', page: 204 }] },
    ],
} as never;
const citas = analysisClaimsToCitations(collectAnalysisClaims(analisis), c => String(c.page));

describe('afirmaciones de síntesis', () => {
    it('una nota con varias fuentes: cada una sabe de las otras', () => {
        const nota = citas.filter(c => c.site === 'footnote');
        expect(nota.find(c => c.author === 'McCartney')!.otherSources).toEqual(['Ropes']);
        expect(nota.find(c => c.author === 'Ropes')!.otherSources).toEqual(['McCartney']);
    });

    it('una afirmación que nombra a otra fuente del análisis la lleva', () => {
        expect(citas.find(c => c.site === 'commentator' && c.author === 'McCartney')!.otherSources).toEqual(['Ropes']);
    });

    it('una afirmación de una sola fuente no lleva ninguna', () => {
        expect(citas.find(c => c.author === 'Varner')).not.toHaveProperty('otherSources');
    });
});

describe('el rótulo interno no se muestra', () => {
    it('la cita ya no lleva el sitio en inglés pegado; va aparte', () => {
        const c = citas.find(x => x.site === 'footnote')!;
        expect(c.raw).toBe('McCartney, p. 173');
        expect(c.origin).toBe('analysis');
    });

    it('los veredictos guardados antes del campo se leen igual', () => {
        const viejo = { raw: 'Ropes, p. 204 · lexical-loading' };
        expect(citationSite(viejo)).toBe('lexical-loading');
        expect(citationDisplayRaw(viejo)).toBe('Ropes, p. 204');
        expect(citationDisplayRaw({ raw: '(Mayor, p. 77)' })).toBe('(Mayor, p. 77)');
    });
});
