import { describe, expect, it } from 'vitest';

import { buildReadingBlocks, type ReadingBlock } from '../sermonReading';
import { fragmentBlock, fragmentHeight, packFragments, type BlockMetrics, type PageFragment } from '../pageFragments';

/**
 * Métricas de juguete: cada oración ocupa `LINE` de alto en su propio renglón
 * (como con colometría), con `GAP` de margen debajo del bloque. Un subtítulo
 * mide `TITLE`.
 */
const LINE = 40;
const GAP = 20;
const TITLE = 50;
function metricsOf(blocks: ReadingBlock[]): BlockMetrics[] {
    return blocks.map((b) => {
        if (b.kind === 'subheading') return { height: TITLE };
        const units = b.units.map((_, i) => ({ top: i * LINE, bottom: (i + 1) * LINE }));
        return { height: b.units.length * LINE + GAP, units };
    });
}
const sentences = (n: number, tag = 'O') => Array.from({ length: n }, (_, i) => `${tag}${i + 1} dice algo.`).join(' ');

/** Lo que muestra cada página, legible: «b:from-to». */
const layout = (pages: PageFragment[][]) => pages.map((p) => p.map((f) => `${f.block}:${f.from}-${f.to}`));

describe('paginación por oración (L-1)', () => {
    it('REGRESIÓN: un párrafo largo llena lo que queda en vez de dejar la página medio vacía', () => {
        const blocks = buildReadingBlocks(`${sentences(3, 'A')}\n\n${sentences(10, 'B')}`);
        const m = metricsOf(blocks);
        // A ocupa 140 de 400: antes B (420) pasaba entero a la página 2.
        const pages = packFragments(blocks, m, 400);
        expect(layout(pages)).toEqual([['0:0-3', '1:0-6'], ['1:6-10']]);
        // La primera página queda llena, sin pasarse.
        expect(pages[0]!.reduce((s, f) => s + fragmentHeight(blocks, m, f), 0)).toBeLessThanOrEqual(400);
    });

    it('nunca corta una oración: el corte cae entre oraciones', () => {
        const blocks = buildReadingBlocks(sentences(10));
        const pages = packFragments(blocks, metricsOf(blocks), 230);
        for (const page of pages) for (const f of page) expect(f.to).toBeGreaterThan(f.from);
        // Todas las oraciones aparecen una vez y en orden.
        const flat = pages.flat().flatMap((f) => Array.from({ length: f.to - f.from }, (_, i) => f.from + i));
        expect(flat).toEqual(Array.from({ length: 10 }, (_, i) => i));
    });

    it('un subtítulo no queda solo al pie: si no entra ni una oración, se van juntos', () => {
        const blocks = buildReadingBlocks(`${sentences(8, 'A')}\n\n### Ilustración\n\n${sentences(4, 'B')}`);
        // A ocupa 340; quedan 60: entra el subtítulo (50) pero no una oración (40).
        const pages = packFragments(blocks, metricsOf(blocks), 400);
        expect(layout(pages)[0]).toEqual(['0:0-8']);
        expect(layout(pages)[1]!.slice(0, 2)).toEqual(['1:0-1', '2:0-4']);
    });

    it('un subtítulo con lugar para su primera oración arrastra lo que entre', () => {
        const blocks = buildReadingBlocks(`${sentences(5, 'A')}\n\n### Ilustración\n\n${sentences(6, 'B')}`);
        // A 220, subtítulo 50, quedan 130: entran 2 oraciones de B (80 + margen 20).
        const pages = packFragments(blocks, metricsOf(blocks), 400);
        expect(layout(pages)).toEqual([['0:0-5', '1:0-1', '2:0-2'], ['2:2-6']]);
    });

    it('la introducción con sus viñetas no se reparte para rellenar: pasa entera', () => {
        const md = `${sentences(7, 'A')}\n\nPuntos del sermón:\n\n- I. Uno. Más.\n- II. Dos. Más.\n- III. Tres. Más.`;
        const blocks = buildReadingBlocks(md);
        const pages = packFragments(blocks, metricsOf(blocks), 400);
        expect(layout(pages)[0]).toEqual(['0:0-7']);
        expect(layout(pages)[1]).toEqual(['1:0-1', '2:0-1', '3:0-1', '4:0-1']);
    });

    it('una introducción de varias oraciones tampoco se corta para rellenar', () => {
        const md = `${sentences(8, 'A')}\n\nVeamos tres cosas. Son claras. Puntos del sermón:\n\n- I. Uno.\n- II. Dos.`;
        const blocks = buildReadingBlocks(md);
        // A ocupa 340; quedan 60: entraría la primera oración de la introducción (40 + 20).
        const pages = packFragments(blocks, metricsOf(blocks), 400);
        expect(layout(pages)[0]).toEqual(['0:0-8']);
        expect(blocks[1]!.units.length).toBeGreaterThan(1);
        expect(layout(pages)[1]![0]).toBe(`1:0-${blocks[1]!.units.length}`);
    });

    it('la primera página descuenta los títulos, y puede quedar sólo con ellos', () => {
        const blocks = buildReadingBlocks(sentences(5));
        // Debajo de los títulos caben 30: ni una oración (40 + margen).
        const pages = packFragments(blocks, metricsOf(blocks), 400, 30);
        expect(layout(pages)).toEqual([[], ['0:0-5']]);
    });

    it('sin métricas de oraciones, el bloque no se parte (como antes)', () => {
        const blocks = buildReadingBlocks(`${sentences(3, 'A')}\n\n${sentences(10, 'B')}`);
        const m = metricsOf(blocks).map((x) => ({ height: x.height }));
        expect(layout(packFragments(blocks, m, 400))).toEqual([['0:0-3'], ['1:0-10']]);
    });

    it('una sola oración más alta que la página va sola (se desplaza) y no se pierde', () => {
        const blocks = buildReadingBlocks('Una oración larguísima.\n\nOtra.');
        const m: BlockMetrics[] = [{ height: 900 }, { height: 60 }];
        expect(layout(packFragments(blocks, m, 400))).toEqual([['0:0-1'], ['1:0-1']]);
    });

    it('sin bloques no hay páginas', () => {
        expect(packFragments([], [], 400)).toEqual([]);
    });
});

describe('altura de un fragmento', () => {
    const blocks = buildReadingBlocks(sentences(4));
    const m = metricsOf(blocks);
    it('el bloque entero mide lo medido; la cabeza, sus renglones más el margen; la cola, desde su renglón', () => {
        expect(fragmentHeight(blocks, m, { block: 0, from: 0, to: 4 })).toBe(4 * LINE + GAP);
        expect(fragmentHeight(blocks, m, { block: 0, from: 0, to: 1 })).toBe(LINE + GAP);
        expect(fragmentHeight(blocks, m, { block: 0, from: 3, to: 4 })).toBe(LINE + GAP);
        expect(fragmentHeight(blocks, m, { block: 0, from: 1, to: 3 })).toBe(2 * LINE + GAP);
    });

    it('el fragmento lleva sólo sus oraciones y sabe si es continuación', () => {
        const head = fragmentBlock(blocks[0]!, { block: 0, from: 0, to: 2 });
        const tail = fragmentBlock(blocks[0]!, { block: 0, from: 2, to: 4 });
        expect(head.units).toHaveLength(2);
        expect(head.continued).toBe(false);
        expect(tail.continued).toBe(true);
        expect(tail.text).toBe('O3 dice algo. O4 dice algo.');
        expect(tail.units[0]!.sourceStart).toBe(blocks[0]!.units[2]!.sourceStart);
    });
});
