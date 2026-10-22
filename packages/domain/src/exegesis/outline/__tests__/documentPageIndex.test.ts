import { describe, expect, it } from 'vitest';
import {
    chunkRangesForSheets,
    clipRangesTo,
    countChars,
    countSheets,
    normalizeSheetRanges,
    pinStateOfRange,
    pinnedSheetCount,
    sheetsForChunkRanges,
    subtractSheetRanges,
    togglePinnedRange,
    togglePinnedSheet,
    type PageIndexEntry,
} from '../documentPageIndex';

function page(sheet: number, chunkIndices: number[], charCount = 1000): PageIndexEntry {
    return { sheet, chunkIndices, section: null, firstLine: '', charCount };
}

const INDEX: PageIndexEntry[] = [
    page(66, [10, 11]),
    page(67, [12]),
    // La hoja 68 no emitió fragmentos: página en blanco o ilegible.
    page(69, [13, 14, 15]),
    page(70, [16]),
    page(71, [17]),
];

describe('chunkRangesForSheets', () => {
    it('traduce un rango de hojas a rangos contiguos de fragmentos', () => {
        expect(chunkRangesForSheets(INDEX, [{ start: 69, end: 71 }]))
            .toEqual([{ start: 13, end: 17 }]);
    });

    it('ignora hojas que el índice no tiene', () => {
        // La 68 no existe; el resultado no la inventa ni se rompe.
        expect(chunkRangesForSheets(INDEX, [{ start: 67, end: 69 }]))
            .toEqual([{ start: 12, end: 15 }]);
    });

    it('parte el resultado cuando los fragmentos no son contiguos', () => {
        expect(chunkRangesForSheets(INDEX, [{ start: 66, end: 66 }, { start: 70, end: 71 }]))
            .toEqual([{ start: 10, end: 11 }, { start: 16, end: 17 }]);
    });

    it('no duplica fragmentos cuando los rangos se superponen', () => {
        expect(chunkRangesForSheets(INDEX, [{ start: 69, end: 70 }, { start: 70, end: 71 }]))
            .toEqual([{ start: 13, end: 17 }]);
    });

    it('tolera un rango dado al revés', () => {
        expect(chunkRangesForSheets(INDEX, [{ start: 71, end: 69 }]))
            .toEqual([{ start: 13, end: 17 }]);
    });

    it('devuelve vacío sin rangos', () => {
        expect(chunkRangesForSheets(INDEX, [])).toEqual([]);
    });
});

describe('normalizeSheetRanges', () => {
    it('ordena tramos armados en cualquier orden', () => {
        // El usuario acepta la propuesta y después agrega la introducción,
        // que está antes.
        expect(normalizeSheetRanges([{ start: 68, end: 71 }, { start: 60, end: 67 }]))
            .toEqual([{ start: 60, end: 71 }]);
    });

    it('funde tramos superpuestos', () => {
        expect(normalizeSheetRanges([{ start: 10, end: 20 }, { start: 15, end: 25 }]))
            .toEqual([{ start: 10, end: 25 }]);
    });

    it('deja separados los tramos con hueco real', () => {
        expect(normalizeSheetRanges([{ start: 10, end: 12 }, { start: 20, end: 22 }]))
            .toEqual([{ start: 10, end: 12 }, { start: 20, end: 22 }]);
    });

    it('endereza un tramo invertido', () => {
        expect(normalizeSheetRanges([{ start: 30, end: 20 }])).toEqual([{ start: 20, end: 30 }]);
    });

    it('descarta hojas por debajo de la primera', () => {
        expect(normalizeSheetRanges([{ start: 0, end: 5 }])).toEqual([]);
    });
});

describe('countSheets y countChars', () => {
    it('cuenta las hojas de un carrito', () => {
        expect(countSheets([{ start: 60, end: 67 }, { start: 70, end: 71 }])).toBe(10);
    });

    it('suma solo el texto de las hojas que existen', () => {
        // 67, 69, 70 y 71 existen; la 68 no.
        expect(countChars(INDEX, [{ start: 67, end: 71 }])).toBe(4000);
    });

    it('no cuenta dos veces una hoja alcanzada por dos rangos', () => {
        expect(countChars(INDEX, [{ start: 70, end: 71 }, { start: 71, end: 71 }])).toBe(2000);
    });
});

describe('sheetsForChunkRanges', () => {
    it('traduce fragmentos de vuelta a hojas', () => {
        expect(sheetsForChunkRanges(INDEX, [{ start: 13, end: 17 }]))
            .toEqual([{ start: 69, end: 71 }]);
    });

    it('parte cuando las hojas no son contiguas', () => {
        expect(sheetsForChunkRanges(INDEX, [{ start: 10, end: 10 }, { start: 17, end: 17 }]))
            .toEqual([{ start: 66, end: 66 }, { start: 71, end: 71 }]);
    });

    it('funde huecos chicos cuando se lo permite', () => {
        // La propuesta semántica devuelve aciertos dispersos: sin fundir, el
        // carrito arrancaría con un tramo por hoja.
        expect(sheetsForChunkRanges(INDEX, [{ start: 10, end: 10 }, { start: 13, end: 13 }], 2))
            .toEqual([{ start: 66, end: 69 }]);
    });

    it('no funde huecos mayores a la tolerancia', () => {
        expect(sheetsForChunkRanges(INDEX, [{ start: 10, end: 10 }, { start: 17, end: 17 }], 2))
            .toEqual([{ start: 66, end: 66 }, { start: 71, end: 71 }]);
    });
});

describe('clipRangesTo', () => {
    it('recorta lo fijado a lo elegido', () => {
        expect(clipRangesTo([{ start: 60, end: 90 }], [{ start: 68, end: 72 }]))
            .toEqual([{ start: 68, end: 72 }]);
    });

    it('descarta lo fijado que quedó fuera del carrito', () => {
        // El usuario fijó la introducción y después quitó esas hojas.
        expect(clipRangesTo([{ start: 10, end: 20 }], [{ start: 68, end: 72 }])).toEqual([]);
    });

    it('conserva lo que se solapa parcialmente', () => {
        expect(clipRangesTo([{ start: 65, end: 70 }], [{ start: 68, end: 80 }]))
            .toEqual([{ start: 68, end: 70 }]);
    });

    it('funde el resultado cuando dos recortes quedan contiguos', () => {
        expect(clipRangesTo([{ start: 1, end: 100 }], [{ start: 10, end: 20 }, { start: 21, end: 30 }]))
            .toEqual([{ start: 10, end: 30 }]);
    });

    it('devuelve vacío sin tramos fijados', () => {
        expect(clipRangesTo([], [{ start: 1, end: 9 }])).toEqual([]);
    });
});

/** TP #8 (2026-10-21, fase 8a, A5): fijar la 411 dentro de 407–418. */
describe('lo fijado, hoja por hoja', () => {
    const tramo = { start: 407, end: 418 };

    it('fija una hoja dentro del tramo sin fijar el tramo', () => {
        const fijadas = togglePinnedSheet([], 411);
        expect(fijadas).toEqual([{ start: 411, end: 411 }]);
        expect(pinStateOfRange(tramo, fijadas)).toBe('some');
        expect(pinnedSheetCount(tramo, fijadas)).toBe(1);
    });

    it('desfija una hoja de un tramo fijado y lo parte en dos', () => {
        expect(togglePinnedSheet([tramo], 411)).toEqual([{ start: 407, end: 410 }, { start: 412, end: 418 }]);
    });

    it('el tramo fijado entero sigue fijado cuando el carrito lo agranda', () => {
        // Antes: 407–419 en el carrito no «coincidía» con 407–418 fijado.
        expect(pinStateOfRange({ start: 407, end: 419 }, [tramo])).toBe('some');
        expect(pinStateOfRange(tramo, [tramo])).toBe('all');
    });

    it('el botón del tramo fija todo lo que falta, y desfija sólo si estaba entero', () => {
        expect(togglePinnedRange([{ start: 411, end: 411 }], tramo)).toEqual([tramo]);
        expect(togglePinnedRange([tramo, { start: 500, end: 500 }], tramo)).toEqual([{ start: 500, end: 500 }]);
    });

    it('quita tramos que se pisan en los dos bordes', () => {
        expect(subtractSheetRanges([{ start: 1, end: 10 }, { start: 20, end: 30 }], [{ start: 8, end: 22 }]))
            .toEqual([{ start: 1, end: 7 }, { start: 23, end: 30 }]);
        expect(subtractSheetRanges([{ start: 5, end: 6 }], [{ start: 1, end: 10 }])).toEqual([]);
        // Lo que no se toca queda igual, esté antes o después.
        expect(subtractSheetRanges([{ start: 1, end: 5 }, { start: 30, end: 31 }], [{ start: 10, end: 12 }]))
            .toEqual([{ start: 1, end: 5 }, { start: 30, end: 31 }]);
    });

    it('sin nada fijado, el tramo no tiene hojas fijadas', () => {
        expect(pinStateOfRange(tramo, [])).toBe('none');
    });
});
