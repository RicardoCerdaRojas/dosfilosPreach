import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import { analysisClaimsToCitations, collectAnalysisClaims } from '../analysisClaims';
import { collectAnalysisCitations } from '../citationAnchoring';

/**
 * El verificador de citas nunca corrió sobre un análisis canónico: leía el
 * markdown del paso, que en ese camino está vacío, y «cero citas» se veía
 * igual que «todo verificado». Estas pruebas fijan la proyección del
 * análisis a citas verificables, que es lo que ese camino no tenía.
 */
function analisis(): CanonicalVerseAnalysis {
    const a = buildEmptyCanonicalVerseAnalysis({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 1, verseEnd: 1 });
    return {
        ...a,
        commentatorEngagement: [
            { sourceKey: 'Ross', page: 559, pageKind: 'printed', role: 'anchor', position: 'Ross lee un participio sustantivado.', verbatimQuote: '“Shepherd” is an active participle used substantively' },
            { sourceKey: 'Craigie', page: 206, pageKind: 'printed', role: 'anchor', position: 'Craigie subraya la personalización.', verbatimQuote: '' },
        ],
        translationCruxes: [{
            phrase: 'לֹא אֶחְסָר', description: 'd', options: [{ translation: 'a', characterization: 'x' }],
            commentatorPositions: [{ sourceKey: 'Waltke-O\'Connor', page: 513, summary: 'Futuro consecuente.', supports: 0, verbatimQuote: '  YHWH is my shepherd, I will (do) not lack (anything).  ' }],
            commitment: { chosen: 'a', rationale: 'r' },
        }],
        lexicalAnalyses: [{
            term: 'רֹעִי', lemma: 'רעה', gloss: 'mi pastor',
            generalSemanticRange: { glosses: ['pacer', 'apacentar'], sources: [{ sourceKey: 'Ortiz', page: 674, pageKind: 'printed', locator: '§7462' }] },
            verseSpecificLoading: 'El sufijo personaliza la metáfora.',
            loadingSources: [{ sourceKey: 'Craigie', page: 206 }],
        }],
        footnoteExtensions: [{ anchorPhrase: 'x', text: 'Nota sobre el lamed.', sources: [{ sourceKey: 'Waltke-O\'Connor', page: 207 }] }],
        oldTestamentLinks: [{ type: 'echo', sourcePassage: 'Gn 49:24', interpretiveBearing: 'Eco del epíteto.', sources: [{ sourceKey: 'Craigie', page: 206 }] }],
        historicalContext: [{ aspect: 'Pastor real', relevance: 'Metáfora del ACO.', sources: [{ sourceKey: 'Craigie', page: 206 }] }],
    } as CanonicalVerseAnalysis;
}

describe('collectAnalysisClaims', () => {
    it('recorre los seis sitios y trae la afirmación de cada uno', () => {
        const claims = collectAnalysisClaims(analisis());
        expect(claims.map(c => c.site)).toEqual([
            'commentator', 'commentator', 'crux', 'lexical-range', 'lexical-loading', 'footnote', 'ot-link', 'historical',
        ]);
        expect(claims[0]).toMatchObject({ sourceKey: 'Ross', page: 559, claim: 'Ross lee un participio sustantivado.', path: 'commentatorEngagement[0]' });
        expect(claims[3]!.claim).toBe('רֹעִי: pacer, apacentar');
        expect(claims[3]!.locator).toBe('§7462');
    });

    it('una oración textual vacía o en blanco es «sin oración», no una oración', () => {
        const claims = collectAnalysisClaims(analisis());
        expect(claims[1]!.verbatimQuote).toBeNull();
        expect(claims[2]!.verbatimQuote).toBe('YHWH is my shepherd, I will (do) not lack (anything).');
    });

    it('collectAnalysisCitations es la misma lista, en el mismo orden, sin la afirmación', () => {
        // Las dos se usan para contar: si divergen, el resumen y el
        // verificador hablan de citas distintas.
        const a = analisis();
        expect(collectAnalysisCitations(a)).toEqual(
            collectAnalysisClaims(a).map(c => ({ sourceKey: c.sourceKey, page: c.page, pageKind: c.pageKind })),
        );
    });

    it('ignora una cita sin fuente o sin página numérica', () => {
        const a = analisis();
        (a.commentatorEngagement as unknown[]).push({ sourceKey: '', page: 1, position: 'x' }, { sourceKey: 'Ross', page: Number.NaN, position: 'y' });
        expect(collectAnalysisClaims(a).filter(c => c.site === 'commentator')).toHaveLength(2);
    });
});

describe('analysisClaimsToCitations', () => {
    it('la evidencia es la oración textual cuando existe, y la paráfrasis cuando no', () => {
        const cites = analysisClaimsToCitations(collectAnalysisClaims(analisis()), c => String(c.page));
        expect(cites[0]).toMatchObject({ author: 'Ross', pages: '559', evidenceIsQuoted: true, evidence: '“Shepherd” is an active participle used substantively' });
        expect(cites[1]).toMatchObject({ author: 'Craigie', pages: '206', evidenceIsQuoted: false, evidence: 'Craigie subraya la personalización.' });
    });

    it('la página la decide el llamador, que sabe la unidad de la evidencia', () => {
        const cites = analysisClaimsToCitations(collectAnalysisClaims(analisis()), c => (c.pageKind === 'printed' ? String(c.page) : null));
        expect(cites[0]!.pages).toBe('559');
        expect(cites[4]!.pages).toBeNull();
        expect(cites[4]!.raw).toContain('hoja 206');
    });

    it('conserva el orden como offset, para que la interfaz pueda volver a la entrada', () => {
        const cites = analysisClaimsToCitations(collectAnalysisClaims(analisis()), () => null);
        expect(cites.map(c => c.offset)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
});
