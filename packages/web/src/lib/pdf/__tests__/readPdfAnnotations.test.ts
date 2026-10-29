import { describe, it, expect, vi } from 'vitest';
import {
    anchorQuote,
    capQuote,
    collectNotes,
    groupLines,
    isPageNumberText,
    nearestLine,
    pageNumberInBand,
    printedPage,
    quadBoxes,
    usablePageLabels,
    type PdfAnnotationLike,
    type PdfTextItemLike,
} from '../readPdfAnnotations';

/**
 * La lectura de los comentarios del PDF corregido, con objetos con la forma
 * de pdf.js. Los números vienen del TI #1 del Salmo 23 (hoja carta, 612 ×
 * 792 pt; renglón doble de 27,6 pt; letra de 12 pt): el ícono de Canvas
 * mide 22 pt y su centro es donde hizo clic el profesor.
 */

const item = (str: string, x: number, y: number, width: number, height = 12): PdfTextItemLike => ({ str, transform: [1, 0, 0, 1, x, y], width, height });
const VIEW = [0, 0, 612, 792];
/** Un ícono de nota de 22 pt centrado en (cx, cy). */
const icono = (cx: number, cy: number) => [cx - 11, cy - 11, cx + 11, cy + 11];

describe('las líneas de una hoja', () => {
    it('la llamada de nota volada queda en su línea («hebreo⁴», 4 pt más arriba), no forma una aparte', () => {
        const lineas = groupLines([
            item('pastor» con un verbo, «me pastorea», es una decisión', 72, 352.6, 430),
            item('texto hebreo', 72, 325, 70),
            item('4', 142, 329, 4, 7.92),
            item('.', 146, 325, 3),
        ]);
        expect(lineas.map(l => l.text)).toEqual(['pastor» con un verbo, «me pastorea», es una decisión', 'texto hebreo4.']);
        // La línea base es la del texto, no la de la llamada.
        expect(lineas[1]!.y).toBe(325);
    });

    it('conserva el orden del contenido (el hebreo no sale al revés) y pone espacio donde hay hueco', () => {
        const [l] = groupLines([
            item('En cuanto a', 72, 322, 60),
            // Tres trozos hebreos de derecha a izquierda, en orden lógico.
            item('נֶ', 140, 322, 6), item('פֶ', 134, 322, 6), item('שׁ', 128, 322, 6),
            item(', su campo', 146, 322, 50),
        ]);
        expect(l!.text).toBe('En cuanto a נֶפֶשׁ, su campo');
    });

    it('un espacio suelto (alto 0) va con su línea y no crea otra', () => {
        const lineas = groupLines([item('Análisis', 196, 684.7, 60), item(' ', 256, 684.7, 3, 0), item('sintáctico', 259, 684.7, 60)]);
        expect(lineas).toHaveLength(1);
        expect(lineas[0]!.text).toBe('Análisis sintáctico');
    });
});

describe('el ancla de una nota al margen (solo rect)', () => {
    const lineas = groupLines([
        item('animal que se recuesta a reposar en el campo, es decir', 72, 627.8, 430),
        item("un solo participante. Waltke y O'Connor explican que", 72, 600.2, 425),
        item('intransitiva tienden a formar hifiles transitivos', 72, 572.6, 430),
    ]);

    it('la línea más cercana en vertical al centro del ícono (el apóstrofe de «O\'Connor», hoja 8)', () => {
        expect(nearestLine(lineas, icono(232, 608.6))!.text).toBe("un solo participante. Waltke y O'Connor explican que");
    });

    it('un ícono en el margen derecho, fuera del ancho de la línea, igual encuentra la suya', () => {
        expect(nearestLine(lineas, icono(564, 631))!.text).toBe('animal que se recuesta a reposar en el campo, es decir');
    });

    it('dentro de la tolerancia, entre dos igual de cerca gana la más cercana en horizontal', () => {
        // Una arriba y otra abajo, a 10 pt del centro del ícono cada una; solo la de abajo llega hasta x 500.
        const dos = groupLines([item('arriba, corta', 72, 400, 200), item('abajo, hasta el margen', 340, 380, 200)]);
        expect(nearestLine(dos, icono(500, 394))!.text).toBe('abajo, hasta el margen');
        expect(nearestLine(dos, icono(100, 394))!.text).toBe('arriba, corta');
    });

    it('sin línea a 20 pt (una nota en el hueco antes de las notas al pie), la más cercana de la hoja', () => {
        const hoja12 = groupLines([
            item('oveja a casa, y son caminos justos, porque Dios nunca conduce a nadie', 72, 296.6, 430),
            item('40Ibid., 437.', 108, 188.6, 60, 10),
        ]);
        // «Sólido.», hoja 12: el ícono a 37 pt del párrafo y a 70 de las notas.
        expect(nearestLine(hoja12, icono(525, 263))!.text).toMatch(/^oveja a casa/);
    });

    it('la tolerancia es de 20 pt: a 19 pt en vertical gana a otra más cercana en distancia pero a 26', () => {
        const ls = groupLines([item('a 19 pt, lejos en horizontal', 72, 500, 100), item('a 26 pt, debajo del ícono', 400, 455, 150)]);
        // Centros: 504 y 459. Ícono en (450, 485).
        expect(nearestLine(ls, icono(450, 485))!.text).toBe('a 19 pt, lejos en horizontal');
    });

    it('anchorQuote: una nota `Text` se ancla en la línea, aunque el rect toque texto', () => {
        const items = [item('matiz de estado ya alcanzado que la conjugación permite afimar.', 72, 322.3, 370)];
        expect(anchorQuote({ subtype: 'Text', rect: icono(363, 325.4) }, items)).toBe('matiz de estado ya alcanzado que la conjugación permite afimar.');
    });

    it('el número de página no es una frase del trabajo: una nota arriba no se ancla en «2»', () => {
        const items = [item('2', 534, 745, 6), item('Arnold y Choi, y de Andersen, que permiten decidir', 72, 690, 430)];
        const ls = groupLines(items);
        const numero = pageNumberInBand(ls, VIEW)!.line;
        const exclude = (l: typeof numero) => l.text === numero.text && l.y === numero.y;
        expect(anchorQuote({ subtype: 'Text', rect: icono(540, 735) }, items, ls, exclude)).toBe('Arnold y Choi, y de Andersen, que permiten decidir');
    });
});

describe('el ancla de un resaltado (quadPoints)', () => {
    // Word da la línea entera en un trozo: el corte se estima por el ancho, a palabras enteras.
    const linea = item('un solo participante. Waltke y O\'Connor explican que', 72, 600.2, 416);

    it('el texto cubierto, en el formato plano de pdf.js (8 números por cuadrilátero)', () => {
        // Cubre aproximadamente «Waltke y O'Connor» (caracteres 22 a 39 de 52).
        const x0 = 72 + (22 / 52) * 416, x1 = 72 + (39 / 52) * 416;
        const quad = [x0, 614, x1, 614, x0, 598, x1, 598];
        expect(anchorQuote({ subtype: 'Highlight', quadPoints: quad, rect: [x0, 598, x1, 614] }, [linea])).toBe("Waltke y O'Connor");
    });

    it('también en el formato viejo ([{x, y}×4] por cuadrilátero) y con varias líneas', () => {
        const otra = item('intransitiva tienden a formar hifiles', 72, 572.6, 300);
        const caja = (y0: number, y1: number, xa: number, xb: number) => [{ x: xa, y: y1 }, { x: xb, y: y1 }, { x: xa, y: y0 }, { x: xb, y: y0 }];
        const quads = [caja(598, 614, 72, 488), caja(570, 586, 72, 372)];
        expect(quadBoxes(quads)).toHaveLength(2);
        expect(anchorQuote({ subtype: 'Underline', quadPoints: quads }, [linea, otra])).toBe("un solo participante. Waltke y O'Connor explican que intransitiva tienden a formar hifiles");
    });

    it('un recuadro (Square) se ancla en lo que encierra; si no encierra nada, en la línea más cercana', () => {
        const items = [linea, item('intransitiva tienden a formar hifiles', 72, 572.6, 300)];
        expect(anchorQuote({ subtype: 'Square', rect: [60, 565, 500, 615] }, items)).toBe("un solo participante. Waltke y O'Connor explican que intransitiva tienden a formar hifiles");
        expect(anchorQuote({ subtype: 'Square', rect: [520, 596, 560, 612] }, items)).toBe("un solo participante. Waltke y O'Connor explican que");
    });

    it('la frase se corta a 300 caracteres, en una palabra, con «…»', () => {
        const larga = 'palabra '.repeat(60).trim();
        const q = capQuote(larga);
        expect(q.length).toBeLessThanOrEqual(300);
        expect(q.endsWith('palabra…')).toBe(true);
        expect(capQuote('corta')).toBe('corta');
    });
});

describe('la página impresa', () => {
    it('número árabe en la banda de arriba («2», hoja 4) o de abajo («1», hoja 3)', () => {
        expect(printedPage({ sheet: 4, lines: groupLines([item('2', 534, 745, 6), item('texto', 72, 690, 30)]), view: VIEW })).toBe('2');
        expect(printedPage({ sheet: 3, lines: groupLines([item('Análisis', 196, 684, 60), item('1', 303, 39, 6)]), view: VIEW })).toBe('1');
    });

    it('número romano en la banda («i», el índice)', () => {
        expect(printedPage({ sheet: 2, lines: groupLines([item('CONTENIDO', 260, 700, 80), item('i', 304, 39, 3)]), view: VIEW })).toBe('i');
        expect(isPageNumberText('xiv')).toBe(true);
        expect(isPageNumberText('ivx')).toBe(false);
        expect(isPageNumberText('')).toBe(false);
    });

    it('la llamada de una nota al pie no es la página: tiene texto al lado, o está fuera de la banda', () => {
        // «10 Pedro Ortiz…» a 84 pt del borde (TI #1); la banda es el 8 % (63 pt).
        const lineas = groupLines([item('10', 108, 84, 6, 6.48), item('Pedro Ortiz V., Lexicón', 117, 80, 200, 10), item('texto', 72, 690, 30)]);
        expect(printedPage({ sheet: 5, lines: lineas, view: VIEW })).toBe('h. 5');
        const enBanda = groupLines([item('7', 108, 30, 6, 6.48), item('Craigie, Psalms', 117, 30, 100, 10)]);
        expect(pageNumberInBand(enBanda, VIEW)).toBeNull();
        // Un número solo a 84 pt del borde está fuera de la banda; a 60, dentro.
        expect(pageNumberInBand(groupLines([item('10', 300, 84, 6)]), VIEW)).toBeNull();
        expect(pageNumberInBand(groupLines([item('10', 300, 60, 6)]), VIEW)?.number).toBe('10');
        // Entre dos, el más cercano al borde.
        expect(pageNumberInBand(groupLines([item('3', 300, 20, 6), item('4', 300, 740, 6)]), VIEW)?.number).toBe('3');
    });

    it('sin número: «h. N» (neutral: la pantalla lo traduce), o el rótulo que se pida', () => {
        expect(printedPage({ sheet: 1, lines: groupLines([item("THE MASTER'S SEMINARY", 200, 700, 200)]), view: VIEW })).toBe('h. 1');
        expect(printedPage({ sheet: 1, lines: [], view: VIEW, sheetLabel: n => `sheet ${n}` })).toBe('sheet 1');
    });

    it('un árabe que pasa de lejos el total de hojas no es página («2026» en la portada)', () => {
        const portada = groupLines([item('2026', 290, 40, 24)]);
        expect(printedPage({ sheet: 1, lines: portada, view: VIEW, numPages: 15 })).toBe('h. 1');
        expect(printedPage({ sheet: 1, lines: groupLines([item('115', 290, 40, 18)]), view: VIEW, numPages: 15 })).toBe('115');
        expect(printedPage({ sheet: 1, lines: groupLines([item('116', 290, 40, 18)]), view: VIEW, numPages: 15 })).toBe('h. 1');
        expect(printedPage({ sheet: 1, lines: groupLines([item('0', 290, 40, 6)]), view: VIEW, numPages: 15 })).toBe('h. 1');
    });

    it('encabezado APA: el número al extremo de la línea, separado del título, es la página', () => {
        const apa = groupLines([item('ANÁLISIS SINTÁCTICO DE SALMO 23', 72, 745, 220), item('3', 534, 745, 6), item('texto', 72, 690, 30)]);
        expect(printedPage({ sheet: 5, lines: apa, view: VIEW, numPages: 15 })).toBe('3');
        // Y la línea del encabezado no es una frase del trabajo.
        expect(pageNumberInBand(apa, VIEW, 15)!.line.text).toBe('ANÁLISIS SINTÁCTICO DE SALMO 23 3');
        const izquierda = groupLines([item('iv', 72, 40, 8), item('Introducción', 260, 40, 80)]);
        expect(printedPage({ sheet: 4, lines: izquierda, view: VIEW })).toBe('iv');
        // Pegado al texto no cuenta (la llamada de una nota al pie en la banda).
        const pegado = groupLines([item('3', 108, 40, 6, 12), item('Craigie, Psalms', 117, 40, 100, 12)]);
        expect(printedPage({ sheet: 4, lines: pegado, view: VIEW })).toBe('h. 4');
        const pegadoDerecha = groupLines([item('Análisis de Salmo', 72, 745, 100), item('23', 175, 745, 12)]);
        expect(printedPage({ sheet: 4, lines: pegadoDerecha, view: VIEW, numPages: 15 })).toBe('h. 4');
    });

    it('la etiqueta de página del PDF manda; unas etiquetas iguales a las hojas no dicen nada', () => {
        expect(printedPage({ sheet: 3, label: 'iii', lines: groupLines([item('9', 300, 39, 6)]), view: VIEW })).toBe('iii');
        expect(usablePageLabels(['i', 'ii', '1', '2'], 4)).toEqual(['i', 'ii', '1', '2']);
        expect(usablePageLabels(['1', '2', '3'], 3)).toBeNull();
        expect(usablePageLabels(null, 3)).toBeNull();
        expect(usablePageLabels(['a', 'b'], 3)).toBeNull();
    });
});

describe('los comentarios de todas las hojas', () => {
    const items = [item('texto hebreo.', 72, 325, 70), item('Arnold y Choi.', 72, 681, 80)];
    const ann = (over: PdfAnnotationLike): PdfAnnotationLike => ({ subtype: 'Text', titleObj: { str: 'José Luis' }, rect: icono(560, 330), ...over });

    it('excluye enlaces, campos y ventanitas; ordena por hoja y de arriba abajo; una marca sin texto queda', () => {
        const notas = collectNotes([
            { sheet: 4, page: '2', items, annotations: [
                ann({ id: 'a', contentsObj: { str: 'Distinción correcta.' } }),
                ann({ id: 'b', contentsObj: { str: 'Ejemplar.' }, rect: icono(530, 680) }),
                { subtype: 'Link', rect: [0, 0, 10, 10] },
                { subtype: 'Popup', rect: [0, 0, 10, 10], inReplyTo: null },
                { subtype: 'Widget', rect: [0, 0, 10, 10] },
            ] },
            { sheet: 3, page: '1', items, annotations: [ann({ id: 'c', contentsObj: { str: '' } })] },
        ]);
        expect(notas.map(n => [n.sheet, n.page, n.text, n.quote])).toEqual([
            [3, '1', '', 'texto hebreo.'],
            [4, '2', 'Ejemplar.', 'Arnold y Choi.'],
            [4, '2', 'Distinción correcta.', 'texto hebreo.'],
        ]);
        expect(notas[0]!.author).toBe('José Luis');
    });

    it('una respuesta se pega al comentario padre (con su autor si es otro); una huérfana vale sola', () => {
        const notas = collectNotes([{ sheet: 8, page: '6', items, annotations: [
            ann({ id: '149R', contentsObj: { str: 'Este apóstrofe no es de redacción.' } }),
            ann({ id: 'r1', inReplyTo: '149R', contentsObj: { str: 'Es de programación.' } }),
            ann({ id: 'r2', inReplyTo: '149R', titleObj: { str: 'Ayudante' }, contents: 'Confirmo.' }),
            ann({ id: 'r3', inReplyTo: 'no-existe', contentsObj: { str: 'Respuesta suelta.' } }),
        ] }]);
        expect(notas).toHaveLength(2);
        expect(notas[0]!.text).toBe('Este apóstrofe no es de redacción.\nEs de programación.\nAyudante: Confirmo.');
        expect(notas[1]!.text).toBe('Respuesta suelta.');
    });

    it('sin autor: null; el texto viene de contentsObj o, si no, de contents', () => {
        const [n] = collectNotes([{ sheet: 1, page: 'hoja 1', items, annotations: [{ subtype: 'FreeText', contents: '  Ojo aquí  ', rect: icono(300, 326) }] }]);
        expect(n).toMatchObject({ author: null, text: 'Ojo aquí', quote: 'texto hebreo.' });
    });
});

describe('readPdfAnnotations (pdf.js simulado)', () => {
    it('lee hoja a hoja, salta las hojas sin comentarios, usa el número impreso y suelta el documento', async () => {
        const destroy = vi.fn();
        const getTextContent = vi.fn(async () => ({ items: [item('2', 534, 745, 6), item('texto hebreo.', 72, 325, 70), { type: 'beginMarkedContent' }] }));
        const paginas = [
            { view: VIEW, getAnnotations: async () => [{ subtype: 'Link', rect: [0, 0, 1, 1] }], getTextContent },
            { view: VIEW, getAnnotations: async () => [{ id: 'x', subtype: 'Text', contentsObj: { str: 'Correcta.' }, titleObj: { str: 'Profesor' }, rect: icono(560, 330) }], getTextContent },
        ];
        vi.doMock('../../pdfWorker', () => ({
            pdfjsLib: { getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPageLabels: async () => null, getPage: async (n: number) => paginas[n - 1], destroy }) }) },
        }));
        const { readPdfAnnotations } = await import('../readPdfAnnotations');
        const notas = await readPdfAnnotations(new ArrayBuffer(8));
        expect(notas).toEqual([{ sheet: 2, page: '2', author: 'Profesor', text: 'Correcta.', quote: 'texto hebreo.' }]);
        // La hoja 1 solo tenía un enlace: su texto no se lee.
        expect(getTextContent).toHaveBeenCalledTimes(1);
        expect(destroy).toHaveBeenCalled();
        vi.doUnmock('../../pdfWorker');
    });
});
