import { describe, it, expect } from 'vitest';
import { CURATED_CORPUS_BUDGET_CHARS, corpusFootprint, curatedCharsPerStep, withPageSelection } from '../corpusFootprint';
import { selectForPrompt, type CorpusChunk } from '../../corpus/selectCorpusChunks';

const indice = (hojas: number, chars: number) =>
    Array.from({ length: hojas }, (_, i) => ({ sheet: i + 1, chunkIndices: [i], section: null, firstLine: '', charCount: chars }) as never);
const conPaginas = (id: string, start: number, end: number, pinned: Array<{ start: number; end: number }> = []) =>
    ({ id, excerpts: [], excerptRecipe: { sheetRanges: [{ start, end }], proposedRanges: [], pinnedRanges: pinned, passageFingerprint: '' } }) as never;
const conFragmentos = (id: string, chars: number) =>
    ({ id, excerpts: [{ text: 'x'.repeat(chars) }], excerptRecipe: null }) as never;

/**
 * El medidor modela a OTRO código: lo que `selectForPrompt` deja entrar a un
 * paso. Esta prueba no describe la cuenta del medidor; la compara con la
 * selección real, para que no puedan separarse sin que algo falle.
 *
 * En #730 el medidor sumaba todas las hojas elegidas y nadie lo comparaba con
 * lo que viaja: Jonás 4:5-11 marcaba 129% con ~130.000 caracteres por versículo.
 */
describe('curatedCharsPerStep — lo mismo que deja entrar selectForPrompt', () => {
    const trozos = (fuente: string, n: number, largo: number, desde = 0): CorpusChunk[] =>
        Array.from({ length: n }, (_, i) => ({
            resourceId: fuente, chunkIndex: desde + i, text: 'x'.repeat(largo), sheet: null, section: null, score: 1 - i / 1000,
        }));

    const casos: Array<[string, number, number, number]> = [
        // [nombre, trozos admitidos, de ellos fijados, largo de cada trozo]
        ['corpus chico: entra entero', 20, 0, 1000],
        ['corpus grande: llega al tope', 300, 0, 1000],
        ['lo fijado entra aunque pase el tope', 300, 150, 1000],
        ['fijado chico y corpus grande', 300, 10, 1000],
    ];

    it.each(casos)('%s', (_n, admitidos, fijados, largo) => {
        const todos = [...trozos('a', admitidos / 2, largo), ...trozos('b', admitidos / 2, largo, 10_000)];
        const fijadosTrozos = todos.slice(0, fijados);
        const real = selectForPrompt({ ranked: todos, pinned: fijadosTrozos, budgetChars: CURATED_CORPUS_BUDGET_CHARS });
        const enviado = real.pinnedChars + real.rankedChars;

        const estimado = curatedCharsPerStep(admitidos * largo, fijados * largo);
        // Cota superior, y a menos de un trozo: un trozo que no cabe entero se salta.
        expect(enviado).toBeLessThanOrEqual(estimado);
        expect(estimado - enviado).toBeLessThan(largo);
    });
});

describe('corpusFootprint', () => {
    it('Jonás 4:5-11: las hojas elegidas se consultan, no viajan enteras', () => {
        // Números medidos en el trabajo real (2026-10-02).
        const fuentes = [
            conFragmentos('gelston', 8741),
            conFragmentos('bruce', 21_775),
            conPaginas('burt', 79, 91),
            conPaginas('calvino', 56, 69),
        ];
        const r = corpusFootprint(fuentes, new Map([['burt', indice(98, 3538)], ['calvino', indice(120, 5000)]]));

        expect(r.excerptChars).toBe(8741 + 21_775);
        expect(r.admittedChars).toBe(13 * 3538 + 14 * 5000);
        expect(r.perStepChars).toBe(8741 + 21_775 + CURATED_CORPUS_BUDGET_CHARS);
        expect(r.pending).toBe(false);
    });

    it('con pocas hojas elegidas viajan todas', () => {
        const r = corpusFootprint([conPaginas('burt', 1, 10)], new Map([['burt', indice(98, 1000)]]));
        expect(r.perStepChars).toBe(10_000);
    });

    it('lo fijado viaja completo aunque pase el tope', () => {
        const r = corpusFootprint([conPaginas('lex', 1, 200, [{ start: 1, end: 150 }])], new Map([['lex', indice(300, 1000)]]));
        expect(r.pinnedChars).toBe(150_000);
        expect(r.perStepChars).toBe(150_000);
    });

    it('sin el índice todavía, avisa que falta medir en vez de decir cero', () => {
        const r = corpusFootprint([conPaginas('lex', 1, 77), conFragmentos('g', 8741)], new Map());
        expect(r.pending).toBe(true);
        expect(r.perStepChars).toBe(8741);
    });
});

describe('withPageSelection', () => {
    it('la selección en curso se suma a las hojas de las otras, no a los fragmentos', () => {
        const otras = corpusFootprint([conFragmentos('g', 30_000), conPaginas('burt', 1, 40)], new Map([['burt', indice(98, 1000)]]));
        const conEsta = withPageSelection(otras, 77_000, 0);
        expect(conEsta.admittedChars).toBe(117_000);
        expect(conEsta.perStepChars).toBe(30_000 + CURATED_CORPUS_BUDGET_CHARS);
    });
});
