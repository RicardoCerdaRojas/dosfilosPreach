import { describe, expect, it } from 'vitest';

import { parseInline } from '../../drafting/sermonDocument';
import { fragmentBlock } from '../pageFragments';
import { buildOutline } from '../preachOutline';
import { buildReadingBlocks, formatRuns } from '../sermonReading';

/**
 * INLINE_FORMAT_RULE: lo que el pastor marca en el editor se ve igual en la
 * web, el atril y Word/PDF. Caso del fundador (Jonás, 2026-10-05): el atril
 * mostraba «<u>Dios es misericordia:</u>» con las etiquetas a la vista.
 */
const JONAS = 'Vean el amor de Dios.\n<u>Dios es misericordia:</u>\n**Éxodo 34:6:** "Y pasando *Jehová*."';

const marked = (text: string, span: { start: number; end: number }) => text.slice(span.start, span.end);

describe('el formato del editor en el atril', () => {
    it('REGRESIÓN: el subrayado no se lee como «<u>»: es formato', () => {
        const [block] = buildReadingBlocks(JONAS);
        expect(block!.text).not.toMatch(/<\/?u>/);
        const unit = block!.units.find((u) => u.text.startsWith('Dios es'))!;
        expect(unit.marks).toEqual([{ start: 0, end: 21, underline: true }]);
    });

    it('la negrita y la cursiva se conservan como formato, sobre las palabras exactas', () => {
        const [block] = buildReadingBlocks(JONAS);
        const unit = block!.units.find((u) => u.text.startsWith('Éxodo'))!;
        const [bold, italic] = unit.marks!;
        expect(marked(unit.text, bold!)).toBe('Éxodo 34:6:');
        expect(bold!.bold).toBe(true);
        expect(marked(unit.text, italic!)).toBe('Jehová');
        expect(italic!.italic).toBe(true);
    });

    it('formatos anidados se suman', () => {
        const [block] = buildReadingBlocks('**<u>Dios</u> es bueno**');
        expect(block!.units[0]!.marks).toEqual([
            { start: 0, end: 4, bold: true, underline: true },
            { start: 4, end: 13, bold: true },
        ]);
    });

    it('el bloque también lleva sus tramos (detalle del sermón), en sus coordenadas', () => {
        const [block] = buildReadingBlocks(JONAS);
        const underline = block!.marks!.find((m) => m.underline)!;
        expect(marked(block!.text, underline)).toBe('Dios es misericordia:');
        expect(formatRuns(block!.text, block!.marks).map((r) => r.text).join('')).toBe(block!.text);
    });

    it('las posiciones en el texto original no se mueven (las marcas del pastor siguen en su lugar)', () => {
        const [block] = buildReadingBlocks(JONAS);
        const unit = block!.units.find((u) => u.text.startsWith('Dios es'))!;
        expect(JONAS.slice(unit.sourceStart, unit.sourceEnd)).toBe('Dios es misericordia:');
    });

    it('una etiqueta escrita a propósito (`&lt;u&gt;`) es texto; una suelta, no se lee', () => {
        expect(buildReadingBlocks('Un &lt;u&gt; escrito.')[0]!.text).toBe('Un <u> escrito.');
        expect(buildReadingBlocks('Sin </u> pareja.')[0]!.text).toBe('Sin  pareja.');
    });

    it('un fragmento de página no arrastra los tramos del bloque entero', () => {
        const [block] = buildReadingBlocks('Jonás huyó a Tarsis. <u>Dios no lo soltó.</u> La tormenta llegó.');
        expect(block!.units).toHaveLength(3);
        const tail = fragmentBlock(block!, { block: 0, from: 1, to: 3 });
        expect(tail.marks).toBeUndefined();
        expect(tail.units[0]!.marks).toEqual([{ start: 0, end: 17, underline: true }]);
    });
});

describe('el formato del editor en Word y PDF', () => {
    it('REGRESIÓN: el subrayado es un tramo subrayado, sin etiquetas', () => {
        expect(parseInline('Lucas — <u>La moneda perdida</u>: 8')).toEqual([
            { text: 'Lucas — ' },
            { text: 'La moneda perdida', underline: true },
            { text: ': 8' },
        ]);
    });

    it('anidado con negrita, en los dos órdenes', () => {
        expect(parseInline('**<u>a</u> b**')).toEqual([{ text: 'a', underline: true, bold: true }, { text: ' b', bold: true }]);
        expect(parseInline('<u>**a** b</u>')).toEqual([{ text: 'a', bold: true, underline: true }, { text: ' b', underline: true }]);
    });

    it('`<b>`/`<strong>` e `<i>`/`<em>` también son formato', () => {
        expect(parseInline('<strong>a</strong> <em>b</em>')).toEqual([{ text: 'a', bold: true }, { text: ' ' }, { text: 'b', italic: true }]);
    });

    it('una etiqueta escrita a propósito es texto; una suelta, no se imprime', () => {
        expect(parseInline('Un &lt;u&gt; escrito')).toEqual([{ text: 'Un <u> escrito' }]);
        expect(parseInline('x </u> y')).toEqual([{ text: 'x  y' }]);
    });
});

describe('el bosquejo es texto plano', () => {
    it('sin etiquetas de formato', () => {
        const outline = buildOutline('Intro.\n\n- Lucas — <u>La moneda perdida</u>: 8');
        expect(JSON.stringify(outline)).not.toMatch(/<\/?u>/);
    });
});
