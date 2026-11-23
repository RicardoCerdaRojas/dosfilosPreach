import { describe, expect, it } from 'vitest';
import { cleanAcquisitionMarks, compareEdition, corpusNeeds, corpusNeedsCoverage, editionYearOf, type NeedLibraryBook } from '../corpusNeeds';
import type { SourceRecommendation } from '../../recommendations/types';

const rec = (over: Partial<SourceRecommendation>): SourceRecommendation => ({
    author: 'Joseph B. Mayor', title: 'The Epistle of St. James', series: null, publisher: 'Macmillan', year: 1910,
    isbn: null, tier: 'essential', languages: ['en'], ...over,
});
const catalogo: Record<string, SourceRecommendation[]> = {
    'commentary-critical': [
        rec({}),
        rec({ author: 'Ralph P. Martin', title: 'James', series: 'Word Biblical Commentary 48', publisher: 'Word', year: 1988 }),
        rec({ author: 'Martin Dibelius', title: 'James', series: 'Hermeneia', publisher: 'Fortress', year: 1976, tier: 'recommended' }),
    ],
    'lexicon-technical': [rec({ author: 'Walter Bauer', title: 'A Greek-English Lexicon of the New Testament', series: 'BDAG', publisher: 'Chicago', year: 2000 })],
};
const biblioteca: NeedLibraryBook[] = [
    { id: 'mayor', title: 'The Epistle of St. James', author: 'Joseph B. Mayor', sourceType: 'commentary-critical', year: '1910', inCorpus: true },
    { id: 'martin', title: 'James (Word Biblical Commentary 48)', author: 'Ralph P. Martin', sourceType: 'commentary-critical', year: '1988', noFolios: false },
    { id: 'ropes', title: 'A Critical and Exegetical Commentary on the Epistle of St. James', author: 'James Hardy Ropes', sourceType: 'commentary-critical', year: '1916', excludedBy: 'TP #9' },
    { id: 'gardner', title: '1 Corinthians', author: 'Paul Gardner', sourceType: 'commentary-critical', otherBook: true },
    { id: 'bdag-copia', title: 'A Greek-English Lexicon of the New Testament and Other Early Christian Literature', author: 'Walter Bauer', sourceType: 'lexicon-technical', year: '1979', noFolios: true },
];
const rubric = {
    sourceRequirements: [
        { sourceType: 'commentary-critical' as const, minimum: 2, maximum: null, justification: '' },
        { sourceType: 'lexicon-technical' as const, minimum: 1, maximum: null, justification: '' },
        { sourceType: 'commentary-expository' as const, minimum: 0, maximum: null, justification: '' },
    ],
    courseBibliography: [
        { title: 'Comentario a Santiago', author: 'Peter Davids', requirement: 'required' as const },
        { title: 'Opcional', requirement: 'recommended' as const },
    ],
};
const input = (over = {}) => ({
    rubric, corpusTypes: ['commentary-critical' as const], library: biblioteca, recommendationsFor: (t: string) => catalogo[t] ?? [], ...over,
});

describe('corpusNeeds', () => {
    it('TP #10: la rúbrica pide 2 comentarios críticos y el corpus tiene 1; el segundo está al alcance en la biblioteca', () => {
        const [criticos] = corpusNeeds(input());
        expect(criticos).toMatchObject({ id: 'tipo:commentary-critical', required: 2, have: 1, covered: false, withinReach: 1 });
        const estado = Object.fromEntries(criticos!.candidates.map(c => [c.key, c.status]));
        expect(estado).toMatchObject({ 'rec:josephbmayor__theepistleofstjames': 'en-corpus', 'lib:ropes': 'excluida' });
        // Martin: lo tiene y es la misma edición (1988).
        const martin = criticos!.candidates.find(c => c.resourceId === 'martin')!;
        expect(martin).toMatchObject({ status: 'tengo', editionMatch: 'misma', origin: 'catalogo' });
        // Dibelius: el catálogo lo sugiere y no lo tiene. Gardner es de otro libro: no aparece.
        expect(criticos!.candidates.find(c => c.title === 'James' && c.author === 'Martin Dibelius')!.status).toBe('sugerida');
        expect(criticos!.candidates.some(c => c.resourceId === 'gardner')).toBe(false);
        // Orden: lo que está, lo que se tiene, lo sugerido, lo excluido al final.
        expect(criticos!.candidates.map(c => c.status)).toEqual(['en-corpus', 'tengo', 'sugerida', 'excluida']);
    });

    it('lo que se tiene sube antes que lo sugerido, aunque el catálogo no lo nombre', () => {
        const conMcCartney = [...biblioteca, { id: 'mccartney', title: 'James (BECNT)', author: 'Dan G. McCartney', sourceType: 'commentary-critical' as const, year: '2009' }];
        const [criticos] = corpusNeeds(input({ library: conMcCartney }));
        expect(criticos!.candidates.map(c => c.status)).toEqual(['en-corpus', 'tengo', 'tengo', 'sugerida', 'excluida']);
        expect(criticos!.candidates[2]).toMatchObject({ key: 'lib:mccartney', origin: 'biblioteca', editionMatch: null });
    });

    it('entre las sugeridas, lo esencial primero aunque el catálogo ponga antes la edición en español; trae su porqué', () => {
        const conDavids = {
            ...catalogo,
            'commentary-critical': [
                rec({ author: 'Peter H. Davids', title: 'Epístola de Santiago', publisher: 'Kregel', year: 2019, tier: 'recommended', languages: ['es'], rationale: ' Traducción del NIGTC. ' }),
                rec({ author: 'Luke Timothy Johnson', title: 'The Letter of James', publisher: 'Doubleday', year: 1995, tier: 'essential' }),
                rec({ author: 'Dale C. Allison', title: 'James', publisher: 'T&T Clark', year: 2013, tier: 'standard' }),
                rec({ author: 'Martin Dibelius', title: 'James', publisher: 'Fortress', year: 1976, tier: 'essential' }),
            ],
        };
        const [criticos] = corpusNeeds(input({ recommendationsFor: (t: string) => conDavids[t as keyof typeof conDavids] ?? [] }));
        const sugeridas = criticos!.candidates.filter(c => c.status === 'sugerida');
        // Johnson y Dibelius (esenciales) en el orden del catálogo; luego Davids; luego Allison.
        expect(sugeridas.map(c => c.author)).toEqual(['Luke Timothy Johnson', 'Martin Dibelius', 'Peter H. Davids', 'Dale C. Allison']);
        expect(sugeridas[2]!.rationale).toBe('Traducción del NIGTC.');
        expect(sugeridas[0]!.rationale).toBeUndefined();
    });

    it('otra edición se avisa (BDAG 2000 contra la copia de 1979) y una copia sin páginas impresas se marca', () => {
        const lexico = corpusNeeds(input()).find(n => n.id === 'tipo:lexicon-technical')!;
        expect(lexico.candidates[0]).toMatchObject({ resourceId: 'bdag-copia', status: 'edicion-distinta', editionMatch: 'distinta', copyYear: '1979', noFolios: true, edition: { year: 2000 } });
        expect(lexico.withinReach).toBe(1);
    });

    it('un mínimo de 0 no es necesidad; el sílabo exigido sí, y el recomendado no', () => {
        const ids = corpusNeeds(input()).map(n => n.id);
        expect(ids).toEqual(['tipo:commentary-critical', 'tipo:lexicon-technical', 'lectura:comentario-a-santiago']);
        const davids = corpusNeeds(input()).at(-1)!;
        expect(davids).toMatchObject({ kind: 'lectura', have: 0, covered: false, candidates: [{ status: 'sugerida', resourceId: null }] });
    });

    it('una lectura del sílabo enlazada a mano usa ese libro, aunque el título no coincida', () => {
        const conEnlace = { ...rubric, courseBibliography: [{ title: 'Davids en español', requirement: 'required' as const, resourceId: 'martin' }] };
        const [, , lectura] = corpusNeeds(input({ rubric: conEnlace }));
        expect(lectura!.candidates[0]).toMatchObject({ resourceId: 'martin', status: 'tengo' });
        expect(lectura!.withinReach).toBe(1);
    });

    it('las marcas del autor: «por conseguir» y «descartada» con razón; tenerla gana sobre «por conseguir»', () => {
        const dibelius = 'rec:martindibelius__james';
        const marcado = corpusNeeds(input({ marks: { [dibelius]: { status: 'por-conseguir', at: 'x' }, 'rec:ralphpmartin__james': { status: 'descartada', reason: 'Muy técnico', at: 'x' } } }))[0]!;
        expect(marcado.candidates.find(c => c.key === dibelius)!.status).toBe('por-conseguir');
        expect(marcado.candidates.find(c => c.resourceId === 'martin')).toMatchObject({ status: 'descartada', reason: 'Muy técnico' });
        // Descartado, ya no está al alcance.
        expect(marcado.withinReach).toBe(0);
        const lexico = corpusNeeds(input({ marks: { 'rec:walterbauer__agreekenglishlexiconofthenewtestament': { status: 'por-conseguir', at: 'x' } } }))[1]!;
        expect(lexico.candidates[0]!.status).toBe('edicion-distinta');
    });

    it('la cobertura antes de redactar: cubiertas, y al alcance con lo que ya se tiene', () => {
        const needs = corpusNeeds(input());
        expect(corpusNeedsCoverage(needs)).toEqual({ total: 3, covered: 0, reachable: 2 });
        const completo = corpusNeeds(input({ corpusTypes: ['commentary-critical', 'commentary-critical', 'lexicon-technical'] }));
        expect(corpusNeedsCoverage(completo)).toEqual({ total: 3, covered: 2, reachable: 2 });
    });
});

describe('edición', () => {
    it('el año de la copia es la primera cifra de cuatro dígitos', () => {
        expect(editionYearOf('1975 [1897]')).toBe(1975);
        expect(editionYearOf('c. 2019')).toBe(2019);
        expect(editionYearOf('s. f.')).toBeNull();
        // «2.ª ed.» no es un año.
        expect(editionYearOf('2.ª ed., 2019')).toBe(2019);
        expect(editionYearOf(0)).toBeNull();
        expect(editionYearOf(1994)).toBe(1994);
    });
    it('misma, distinta o sin dato', () => {
        expect(compareEdition(1994, '1994')).toBe('misma');
        expect(compareEdition(1994, '1975')).toBe('distinta');
        expect(compareEdition(0, '1975')).toBe('sin-dato');
        expect(compareEdition(1994, null)).toBe('sin-dato');
    });
});

describe('cleanAcquisitionMarks', () => {
    it('descartar exige razón; estados desconocidos fuera; razón recortada', () => {
        const m = cleanAcquisitionMarks({
            a: { status: 'descartada' }, b: { status: 'descartada', reason: ` ${'x'.repeat(400)} ` }, c: { status: 'por-conseguir' }, d: { status: 'quizas' },
        });
        expect(Object.keys(m)).toEqual(['b', 'c']);
        expect(m.b!.reason).toHaveLength(300);
        expect(cleanAcquisitionMarks(null)).toEqual({});
    });

    it('una sola copia no cubre dos obras del catálogo (revisión final de la fase A)', () => {
        // Dos obras de Martin en el catálogo, una sola copia en la biblioteca.
        const dos = { 'commentary-critical': [
            rec({ author: 'Ralph P. Martin', title: 'James', series: 'Word Biblical Commentary 48', publisher: 'Word', year: 1988 }),
            rec({ author: 'Ralph P. Martin', title: 'James', series: 'Word Biblical Commentary 48', publisher: 'Thomas Nelson', year: 2018 }),
        ] } as Record<string, SourceRecommendation[]>;
        const [criticos] = corpusNeeds(input({ corpusTypes: [], recommendationsFor: (t: string) => dos[t] ?? [] }));
        expect(criticos!.candidates.filter(c => c.resourceId === 'martin')).toHaveLength(1);
        expect(criticos!.withinReach).toBe(1);
    });
});
