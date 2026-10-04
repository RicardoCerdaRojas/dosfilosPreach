import { describe, it, expect } from 'vitest';
import { parseInline, parseSermonDocument, runsText, type InlineRun } from '../sermonDocument';
import { LINE_BREAK_FIXTURES } from '../../services/lineBreakFixtures';

/**
 * El modelo que dibujan el Word y el PDF. Las formas salen del sermón 6 de
 * Jonás publicado (2026-10-03): el Word dejaba `<br />`, `>` y `*` literales.
 */
const SERMON = [
    '### Ilustración de Apertura',
    '',
    'El 14 de julio de 1789, el pueblo de *París* asaltó la **Bastilla**.',
    'Sigue la misma oración.',
    '',
    '**Puntos:**',
    '',
    '* I. La inclinación egocéntrica (vv. 5-8)',
    '* II. El apego desmedido por lo temporal (vv. 9-10)',
    '',
    '<br />',
    '',
    '## I. La inclinación egocéntrica (vv. 5-8)',
    '',
    '> **Jonás 4:5-8** — 5 Y salió Jonás de la ciudad.',
    '',
    '"Dios dice, ¿Tanto te enojas? \\[…] Dios no meramente reprendió." — Juan Calvino, Comentario Jonas, p. 66',
    '',
    '1. Primera acción',
    '2. Segunda acción',
].join('\n');

describe('parseSermonDocument', () => {
    const b = parseSermonDocument(SERMON);

    it('reconoce títulos, párrafos, listas y citas en bloque, sin HTML', () => {
        expect(b.map(x => x.kind)).toEqual(['heading', 'paragraph', 'paragraph', 'list', 'heading', 'quote', 'paragraph', 'list']);
        expect(JSON.stringify(b)).not.toMatch(/<br|\\\[|^>/);
    });

    it('las líneas seguidas son un solo párrafo, con el salto que puso el pastor (LINE_BREAK_RULE)', () => {
        expect(runsText((b[1] as { runs: InlineRun[] }).runs)).toBe('El 14 de julio de 1789, el pueblo de París asaltó la Bastilla.\nSigue la misma oración.');
    });

    it('viñetas y numeradas, cada una con su tipo', () => {
        const [vin, num] = b.filter((x): x is Extract<typeof x, { kind: 'list' }> => x.kind === 'list');
        expect(vin!.ordered).toBe(false);
        expect(vin!.items.map(i => runsText(i))).toEqual(['I. La inclinación egocéntrica (vv. 5-8)', 'II. El apego desmedido por lo temporal (vv. 9-10)']);
        expect(num!.ordered).toBe(true);
    });

    it('la cita en bloque conserva la negrita de la referencia', () => {
        const q = b.find(x => x.kind === 'quote') as { paragraphs: Array<Array<{ text: string; bold?: boolean }>> };
        expect(q.paragraphs[0]![0]).toEqual({ text: 'Jonás 4:5-8', bold: true });
    });

    it('el escape «\\[…]» llega como «[…]»', () => {
        expect(runsText((b[6] as { runs: InlineRun[] }).runs)).toContain('¿Tanto te enojas? […] Dios');
    });
});

describe('parseInline', () => {
    it('negrita, cursiva y la combinación', () => {
        expect(parseInline('a **b *c* d** e _f_')).toEqual([
            { text: 'a ' }, { text: 'b ', bold: true }, { text: 'c', bold: true, italic: true },
            { text: ' d', bold: true }, { text: ' e ' }, { text: 'f', italic: true },
        ]);
    });
    it('un asterisco suelto o un producto no son cursiva', () => {
        expect(runsText(parseInline('3 * 4 = 12'))).toBe('3 * 4 = 12');
        expect(parseInline('3 * 4 = 12')).toHaveLength(1);
    });
});

describe('parseSermonDocument — revisión adversarial de R2', () => {
    const texto = (b: ReturnType<typeof parseSermonDocument>[number]) =>
        b.kind === 'list' ? b.items.map(runsText).join('|') : b.kind === 'quote' ? b.paragraphs.map(runsText).join('|') : runsText(b.runs);

    it('`<br>` dentro de la línea es salto: dos separan párrafos, uno es salto de renglón (como en la web)', () => {
        const b = parseSermonDocument('Párrafo uno.<br/><br/>Párrafo dos.<br/>sigue.');
        expect(b.map(texto)).toEqual(['Párrafo uno.', 'Párrafo dos.\nsigue.']);
    });

    it('la cita sigue en la línea perezosa que deja un `<br>`', () => {
        const [q] = parseSermonDocument('> **Jonás 4:6**<br/>6 Y preparó Jehová Dios una calabacera.');
        expect(texto(q!)).toBe('Jonás 4:6\n6 Y preparó Jehová Dios una calabacera.');
    });

    it('una numerada cortada por un párrafo sigue en su número', () => {
        const b = parseSermonDocument('1. **Primero**\n\nUn párrafo.\n\n2. **Segundo**');
        const listas = b.filter((x): x is Extract<typeof x, { kind: 'list' }> => x.kind === 'list');
        expect(listas.map(l => l.start)).toEqual([1, 2]);
    });

    it('los títulos se nivelan: `#`/`##` y `##`/`###` dan 1 y 2', () => {
        const nivel = (md: string) => parseSermonDocument(md).filter(x => x.kind === 'heading').map(x => (x as { level: number }).level);
        expect(nivel('# A\n\n## B')).toEqual([1, 2]);
        expect(nivel('## A\n\n### B')).toEqual([1, 2]);
    });

    it('`***a***` es negrita y cursiva, sin asteriscos sueltos', () => {
        expect(parseInline('***a***')).toEqual([{ text: 'a', bold: true, italic: true }]);
    });
});

describe('saltos de línea en Word y PDF (LINE_BREAK_RULE)', () => {
    /** Lo que se ve, bloque por bloque y renglón por renglón. */
    const lines = (markdown: string) =>
        parseSermonDocument(markdown).flatMap((block) => {
            if (block.kind === 'list') return block.items.map((item) => runsText(item).split('\n'));
            if (block.kind === 'quote') return block.paragraphs.map((p) => runsText(p).split('\n'));
            return [runsText(block.runs).split('\n')];
        });

    it.each(LINE_BREAK_FIXTURES)('$name', ({ markdown, lines: expected }) => {
        expect(lines(markdown)).toEqual(expected);
    });

    it('el salto es un tramo propio, sin texto (para que Word y PDF corten la línea)', () => {
        const [p] = parseSermonDocument('**A nivel institucional**\nHace muchos años.');
        const runs = (p as { runs: InlineRun[] }).runs;
        expect(runs.map((r) => (r.lineBreak ? 'SALTO' : r.text))).toEqual(['A nivel institucional', 'SALTO', 'Hace muchos años.']);
        expect(runs[0]!.bold).toBe(true);
    });

    it('REGRESIÓN: «&#x20;» del editor no sale literal en el Word', () => {
        const [p] = parseSermonDocument('Una inclinación precaminosa.&#x20;');
        expect(runsText((p as { runs: InlineRun[] }).runs).trim()).toBe('Una inclinación precaminosa.');
    });
});

