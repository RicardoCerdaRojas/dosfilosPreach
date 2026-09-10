import { describe, it, expect } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis } from '../../entities/CanonicalVerseAnalysis';
import type { CanonicalVerseAnalysis, PassageReference } from '../../..';
import type { PageNumbering } from '../../outline/pageNumbering';
import { collectAnalysisCitations, summarizeCitationAnchoring } from '../citationAnchoring';

/**
 * Cuánto del trabajo se apoya en fuentes que nadie puede comprobar.
 *
 * Sale de un caso real: en un trabajo de Santiago con cien citas, la ÚNICA
 * fabricada —una afirmación que no está en el libro— fue la del único libro sin
 * numeración confirmada. Donde el sistema no puede traducir la hoja a página
 * impresa, la cita sale como «hoja 55», nadie la contrasta contra el ejemplar, y
 * el error llega a la entrega.
 *
 * Decir «hoja N» es honesto. Lo que faltaba era decirlo FUERTE, y antes de
 * componer, que es cuando todavía se puede calibrar el libro o revisar a mano.
 */
const VERSE: PassageReference = { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 17, verseEnd: 17 };

const ADAMSON: PageNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 240, offset: -4 }] };
const MAYOR: PageNumbering = {
    origin: 'confirmed',
    segments: [
        { fromSheet: 1, toSheet: 18, offset: null },
        { fromSheet: 19, toSheet: 278, offset: -18, style: 'roman' },
        { fromSheet: 279, toSheet: 540, offset: -278 },
    ],
};

function analysisWith(cites: Array<{ key: string; page: number; kind?: 'printed' | 'sheet' }>): CanonicalVerseAnalysis {
    return {
        ...buildEmptyCanonicalVerseAnalysis(VERSE),
        commentatorEngagement: cites.map(c => ({
            sourceKey: c.key,
            page: c.page,
            pageKind: c.kind,
            role: 'anchor' as const,
            position: 'x',
            verbatimQuote: '',
        })),
    } as CanonicalVerseAnalysis;
}

const fuentes = [
    { citationKey: 'Adamson', displayLabel: 'Adamson — James', numbering: ADAMSON },
    { citationKey: 'Mayor', displayLabel: 'Mayor — James', numbering: MAYOR },
    { citationKey: 'Wallace', displayLabel: 'Wallace — Gramática', numbering: null },
];

describe('summarizeCitationAnchoring', () => {
    it('cuenta como sin anclar la cita a una fuente sin numeración', () => {
        const out = summarizeCitationAnchoring([analysisWith([
            { key: 'Adamson', page: 78 },
            { key: 'Wallace', page: 55 },
        ])], fuentes);
        expect(out.total).toBe(2);
        expect(out.unanchored).toBe(1);
        expect(out.sources).toEqual([
            { citationKey: 'Wallace', displayLabel: 'Wallace — Gramática', citations: 1, anchored: false },
        ]);
    });

    it('un tramo romano SÍ está anclado: «p. ccxxii» es una página del libro', () => {
        const out = summarizeCitationAnchoring([analysisWith([{ key: 'Mayor', page: 240 }])], fuentes);
        expect(out.unanchored).toBe(0);
    });

    it('una hoja fuera de todo tramo numerado no está anclada', () => {
        // Cubiertas y portada de Mayor: no llevan folio, y es un hecho del libro.
        const out = summarizeCitationAnchoring([analysisWith([{ key: 'Mayor', page: 5 }])], fuentes);
        expect(out.unanchored).toBe(1);
    });

    it('respeta la cita que ya venía en página impresa', () => {
        // `printed` significa que el recurso declaraba su numeración al
        // analizar el verso. Volver a exigir conversión la marcaría como
        // sospechosa siendo la mejor de todas.
        const out = summarizeCitationAnchoring(
            [analysisWith([{ key: 'Wallace', page: 55, kind: 'printed' }])],
            fuentes,
        );
        expect(out.unanchored).toBe(0);
    });

    it('ordena por peso: primero la fuente que más sostiene el trabajo', () => {
        const out = summarizeCitationAnchoring([
            analysisWith([{ key: 'Wallace', page: 55 }, { key: 'Mayor', page: 5 }]),
            analysisWith([{ key: 'Wallace', page: 60 }]),
        ], fuentes);
        expect(out.sources.map(s => [s.citationKey, s.citations])).toEqual([['Wallace', 2], ['Mayor', 1]]);
    });

    it('ignora una clave que el trabajo no declara como fuente', () => {
        // No es una cita sin anclar sino otra cosa —una fuente inventada— y de
        // eso informa el verificador, no este resumen.
        const out = summarizeCitationAnchoring([analysisWith([{ key: 'Fantasma', page: 1 }])], fuentes);
        expect(out.total).toBe(0);
        expect(out.sources).toHaveLength(0);
    });

    it('un trabajo enteramente anclado no reporta nada', () => {
        const out = summarizeCitationAnchoring([analysisWith([
            { key: 'Adamson', page: 78 },
            { key: 'Mayor', page: 461 },
        ])], fuentes);
        expect(out).toEqual({ total: 2, unanchored: 0, sources: [] });
    });
});

describe('collectAnalysisCitations', () => {
    it('recoge las citas de los seis sitios, no sólo del principal', () => {
        const base = buildEmptyCanonicalVerseAnalysis(VERSE);
        const analysis = {
            ...base,
            commentatorEngagement: [{ sourceKey: 'A', page: 1, role: 'anchor', position: 'x', verbatimQuote: '' }],
            translationCruxes: [{ phrase: 'x', options: [], commentatorPositions: [{ sourceKey: 'B', page: 2 }], decision: '', rationale: '' }],
            lexicalAnalyses: [{
                lemma: 'x', gloss: '', morphology: '',
                generalSemanticRange: { summary: '', sources: [{ sourceKey: 'C', page: 3 }] },
                contextualMeaning: '', loadingSources: [{ sourceKey: 'D', page: 4 }],
            }],
            footnoteExtensions: [{ topic: 'x', body: '', sources: [{ sourceKey: 'E', page: 5 }] }],
            oldTestamentLinks: [{ reference: 'x', relationship: '', significance: '', sources: [{ sourceKey: 'F', page: 6 }] }],
            historicalContext: [{ topic: 'x', body: '', sources: [{ sourceKey: 'G', page: 7 }] }],
        } as unknown as CanonicalVerseAnalysis;
        expect(collectAnalysisCitations(analysis).map(c => c.sourceKey))
            .toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    });

    it('descarta una entrada sin número de página', () => {
        const analysis = {
            ...buildEmptyCanonicalVerseAnalysis(VERSE),
            commentatorEngagement: [{ sourceKey: 'A', role: 'anchor', position: 'x', verbatimQuote: '' }],
        } as unknown as CanonicalVerseAnalysis;
        expect(collectAnalysisCitations(analysis)).toHaveLength(0);
    });
});
