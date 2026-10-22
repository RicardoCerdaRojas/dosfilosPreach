import { describe, it, expect } from 'vitest';
import { bibliotecaDelTipo, faltaParaLaRubrica } from '../faltaParaLaRubrica';

/**
 * TP #7 (Santiago 3:13-18): la rúbrica pedía «Gramática ≥1» y Robertson, la
 * única gramática permitida, no salía en «Recomendado para este pasaje».
 */
const recurso = (id: string, exegeticalType: string, extra: Record<string, unknown> = {}) =>
    ({ id, title: id, author: id, exegeticalType, type: 'other', ...extra }) as never;
const robertson = recurso('robertson', 'grammar-syntax');
const wallace = recurso('wallace', 'grammar-syntax');
const moo = recurso('moo', 'commentary-critical');

const rubrica = {
    sourceRequirements: [
        { sourceType: 'grammar-syntax', minimum: 1, justification: '' },
        { sourceType: 'commentary-critical', minimum: 0, justification: '' },
    ],
};
const trabajo = (sources: unknown[] = [], rubric: unknown = rubrica) =>
    ({ rubric, sources, passage: { bookId: 'JAS' } }) as never;

const fuenteDe = (resourceId: string, extra: Record<string, unknown> = {}) => ({
    id: `s-${resourceId}`, sourceLibraryResourceId: resourceId, corpusId: resourceId,
    sourceType: 'grammar-syntax', mode: 'full-document', excerpts: [], excerptRecipe: null, extractedAt: null, ...extra,
});

const base = {
    resources: [robertson, wallace, moo],
    candidatos: [robertson, wallace, moo],
    yaRecomendados: new Set<string>(),
    esExcluido: () => false,
};

describe('faltaParaLaRubrica — recomendar por TIPO lo que la rúbrica pide', () => {
    it('la gramática que falta trae las gramáticas de la biblioteca, aunque no hablen del pasaje', () => {
        const [falta, ...resto] = faltaParaLaRubrica({ ...base, paper: trabajo() });
        expect(resto).toEqual([]);
        expect(falta).toMatchObject({ sourceType: 'grammar-syntax', missing: 1, porPaginas: true });
        expect(falta!.resources.map(r => r.id)).toEqual(['robertson', 'wallace']);
    });

    it('sin la excluida del trabajo (TP #7: Wallace, citado la semana anterior)', () => {
        const [falta] = faltaParaLaRubrica({ ...base, paper: trabajo(), esExcluido: r => r.id === 'wallace' });
        expect(falta!.resources.map(r => r.id)).toEqual(['robertson']);
    });

    it('lo que ya recomienda el pasaje no se repite', () => {
        const [falta] = faltaParaLaRubrica({ ...base, paper: trabajo(), yaRecomendados: new Set(['wallace']) });
        expect(falta!.resources.map(r => r.id)).toEqual(['robertson']);
    });

    it('respeta la búsqueda del diálogo', () => {
        expect(faltaParaLaRubrica({ ...base, paper: trabajo(), candidatos: [moo] })).toEqual([]);
    });

    it('cumplido el requisito, no hay nada que recomendar', () => {
        expect(faltaParaLaRubrica({ ...base, paper: trabajo([fuenteDe('robertson')]) })).toEqual([]);
    });

    it('una gramática del corpus que no cuenta (vacía) no se vuelve a ofrecer: se arregla en su tarjeta', () => {
        const vacia = fuenteDe('robertson', { mode: 'extracted-excerpts', extractedAt: new Date() });
        const [falta] = faltaParaLaRubrica({ ...base, paper: trabajo([vacia]) });
        expect(falta!.missing).toBe(1);
        expect(falta!.resources.map(r => r.id)).toEqual(['wallace']);
    });

    it('un libro sin tipo guardado se clasifica por su tipo de biblioteca', () => {
        const bdf = recurso('bdf', undefined as never, { type: 'grammar' });
        const [falta] = faltaParaLaRubrica({ ...base, resources: [bdf], candidatos: [bdf], paper: trabajo() });
        expect(falta!.resources.map(r => r.id)).toEqual(['bdf']);
    });

    it('sin rúbrica, nada', () => {
        expect(faltaParaLaRubrica({ ...base, paper: trabajo([], null) })).toEqual([]);
    });
});

describe('un comentario de otro libro no cubre el requisito (revisión adversarial)', () => {
    it('Kistemaker, 1 y 2 Pedro y Judas, no aparece para «Comentario expositivo» en Santiago', () => {
        const kistemaker = recurso('kistemaker', 'commentary-expository', { coversBibleBooks: ['1PE', '2PE', 'JUD'], scope: 'book' });
        const varner = recurso('varner', 'commentary-expository', { coversBibleBooks: ['JAS'], scope: 'book' });
        const paper = trabajo([], { sourceRequirements: [{ sourceType: 'commentary-expository', minimum: 1, justification: '' }] });
        const [falta] = faltaParaLaRubrica({ ...base, resources: [kistemaker, varner], candidatos: [kistemaker, varner], paper });
        expect(falta!.resources.map(r => r.id)).toEqual(['varner']);
    });
});

/**
 * TP #8 (Santiago 4:1-10): la rúbrica pedía dos comentarios crítico-técnicos,
 * Mayor era el único permitido y Ropes y McCartney, los otros de la
 * biblioteca, eran de la semana anterior. La tarjeta decía «falta 1» y nada más.
 */
describe('bibliotecaDelTipo — lo que falta, ¿se cubre o sólo con excluidas?', () => {
    const mayor = recurso('mayor', 'commentary-critical', { coversBibleBooks: ['JAS'] });
    const ropes = recurso('ropes', 'commentary-critical', { author: 'James Hardy Ropes', coversBibleBooks: ['JAS'] });
    const mccartney = recurso('mccartney', 'commentary-critical', { author: 'Dan G. McCartney', coversBibleBooks: ['JAS'] });
    const otroLibro = recurso('moo-romanos', 'commentary-critical', { coversBibleBooks: ['ROM'] });
    const exclusionDe = (r: { author?: string }) => (/Ropes|McCartney/.test(r.author ?? '') ? r.author!.split(' ').pop()! : null);

    it('con Mayor en el corpus, sólo quedan las excluidas', () => {
        const r = bibliotecaDelTipo({
            sourceType: 'commentary-critical',
            paper: trabajo([fuenteDe('mayor', { sourceType: 'commentary-critical' })]),
            resources: [mayor, ropes, mccartney, otroLibro],
            exclusionDe: exclusionDe as never,
        });
        expect(r.permitidas).toEqual([]);
        expect(r.excluidas).toEqual(['McCartney', 'Ropes']);
    });

    it('un comentario permitido que no está en el corpus sí cubre el tipo', () => {
        const r = bibliotecaDelTipo({
            sourceType: 'commentary-critical',
            paper: trabajo([]),
            resources: [mayor, ropes],
            exclusionDe: exclusionDe as never,
        });
        expect(r.permitidas.map(x => x.id)).toEqual(['mayor']);
    });
});
