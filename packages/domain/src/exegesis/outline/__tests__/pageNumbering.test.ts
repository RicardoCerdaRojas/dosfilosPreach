import { describe, expect, it } from 'vitest';

import {
    calibrationSheets,
    citationAnchorFor,
    detectNumberingSegments,
    numberingFromCalibrationPoints,
    printedPageIn,
    singleSegmentNumbering,
    type PageNumbering,
} from '../pageNumbering';
import type { PageTextSample } from '../printedPageOffset';

/**
 * Hojas de un libro cuyo folio va al pie. `offsetFor` devuelve el desfase
 * vigente en esa hoja, o `null` cuando la hoja no lleva número arábigo.
 */
function book(
    lastSheet: number,
    offsetFor: (sheet: number) => number | null,
): PageTextSample[] {
    const out: PageTextSample[] = [];
    for (let sheet = 1; sheet <= lastSheet; sheet++) {
        const offset = offsetFor(sheet);
        const printed = offset === null ? null : sheet + offset;
        // Sin más cifras que el folio: cualquier otro número del cuerpo
        // sería un candidato a desfase y ensuciaría lo que se está midiendo.
        out.push({
            page: sheet,
            text: printed !== null && printed >= 1
                ? `Texto corrido de la pagina, suficiente para el analisis.\n${printed}`
                : 'Texto corrido de la pagina, sin folio arabigo al pie.',
        });
    }
    return out;
}

describe('detectNumberingSegments', () => {
    it('devuelve un solo tramo cuando el desfase es constante', () => {
        // Adamson, NICNT: −4 de punta a punta, verificado contra el ejemplar.
        const numbering = detectNumberingSegments(book(224, () => -4));
        expect(numbering?.segments).toEqual([{ fromSheet: 1, toSheet: 224, offset: -4 }]);
        expect(numbering?.origin).toBe('detected');
    });

    it('parte el libro cuando la cuenta se corre a mitad de camino', () => {
        // Teología Sistemática, tomo II: −1 hasta la hoja 413, −3 hasta la
        // 575 y −4 hasta el final. Un solo desfase deja mal casi la mitad.
        //
        // Entre tramo y tramo queda un `null`: es la banda que cruza la
        // frontera, donde conviven las dos cuentas y ninguna gana. No es
        // ruido, es la señal de que ahí cambia algo — y quedarse callado en
        // esa franja es preferible a snapear la frontera a un número que no
        // se midió. La pantalla de calibración pide ubicarla.
        const numbering = detectNumberingSegments(
            book(651, sheet => (sheet <= 413 ? -1 : sheet <= 575 ? -3 : -4)),
        );
        const offsets = numbering?.segments.map(s => s.offset);
        expect(offsets).toEqual([-1, null, -3, null, -4]);
        expect(numbering?.segments[0]?.fromSheet).toBe(1);
        expect(numbering?.segments.at(-1)?.toSheet).toBe(651);

        // Las franjas inciertas son angostas y encierran la frontera real.
        const primeraTransicion = numbering!.segments[1]!;
        expect(primeraTransicion.fromSheet).toBeLessThanOrEqual(413);
        expect(primeraTransicion.toSheet).toBeGreaterThanOrEqual(413);
    });

    it('no promete numero impreso en la franja donde cambia la cuenta', () => {
        const numbering = detectNumberingSegments(
            book(651, sheet => (sheet <= 413 ? -1 : sheet <= 575 ? -3 : -4)),
        );
        expect(printedPageIn(numbering, 100)).toBe(99);
        expect(printedPageIn(numbering, 640)).toBe(636);
        const transicion = numbering!.segments[1]!;
        expect(printedPageIn(numbering, transicion.fromSheet)).toBeNull();
    });

    it('reconoce una region inicial sin numeracion arabiga', () => {
        // Mayor: 271 hojas de introducción en romanos, y recién desde la 272
        // empieza la cuenta arábiga que da −278.
        const numbering = detectNumberingSegments(
            book(528, sheet => (sheet <= 271 ? null : -278)),
        );
        expect(numbering?.segments).toHaveLength(2);
        expect(numbering?.segments[0]?.offset).toBeNull();
        expect(numbering?.segments[1]?.offset).toBe(-278);
        expect(printedPageIn(numbering, 100)).toBeNull();
        expect(printedPageIn(numbering, 328)).toBe(50);
    });

    it('absorbe una banda sin folio entre dos que coinciden', () => {
        // La extracción pierde folios en tramos enteros. Eso no convierte al
        // libro en uno de numeración partida.
        const numbering = detectNumberingSegments(
            book(360, sheet => (sheet > 120 && sheet <= 240 ? null : -6)),
        );
        expect(numbering?.segments).toEqual([{ fromSheet: 1, toSheet: 360, offset: -6 }]);
    });

    it('devuelve null cuando ninguna hoja lleva folio', () => {
        // Wallace: el 42% de sus hojas tiene algún número, pero son
        // referencias bíblicas, no folios. Sin folio no hay desfase que dar.
        expect(detectNumberingSegments(book(300, () => null))).toBeNull();
    });

    it('devuelve null sin muestras', () => {
        expect(detectNumberingSegments([])).toBeNull();
    });

    it('no segmenta un libro corto', () => {
        const numbering = detectNumberingSegments(book(35, () => -2));
        expect(numbering?.segments).toHaveLength(1);
    });
});

describe('printedPageIn', () => {
    const numbering: PageNumbering = {
        origin: 'confirmed',
        segments: [
            { fromSheet: 1, toSheet: 271, offset: null },
            { fromSheet: 272, toSheet: 528, offset: -278 },
        ],
    };

    it('aplica el desfase del tramo que contiene la hoja', () => {
        expect(printedPageIn(numbering, 326)).toBe(48);
        expect(printedPageIn(numbering, 330)).toBe(52);
    });

    it('devuelve null en un tramo sin numeracion arabiga', () => {
        expect(printedPageIn(numbering, 1)).toBeNull();
        expect(printedPageIn(numbering, 271)).toBeNull();
    });

    it('devuelve null fuera de todo tramo', () => {
        expect(printedPageIn(numbering, 999)).toBeNull();
    });

    it('devuelve null sin numeracion', () => {
        expect(printedPageIn(null, 42)).toBeNull();
        expect(printedPageIn(undefined, 42)).toBeNull();
    });

    it('devuelve null cuando la cuenta cae antes de la primera pagina', () => {
        const preliminares = singleSegmentNumbering(-40, 800, 'confirmed');
        expect(printedPageIn(preliminares, 12)).toBeNull();
    });

    it('rechaza hojas no finitas o menores a uno', () => {
        const n = singleSegmentNumbering(0, 100, 'confirmed');
        expect(printedPageIn(n, 0)).toBeNull();
        expect(printedPageIn(n, Number.NaN)).toBeNull();
    });
});

describe('calibrationSheets', () => {
    it('propone un punto interior por tramo', () => {
        const numbering: PageNumbering = {
            origin: 'detected',
            segments: [
                { fromSheet: 1, toSheet: 271, offset: null },
                { fromSheet: 272, toSheet: 528, offset: -278 },
            ],
        };
        const sheets = calibrationSheets(numbering, 528);
        expect(sheets).toHaveLength(2);
        expect(sheets[0]).toBeGreaterThan(1);
        expect(sheets[0]).toBeLessThan(271);
        expect(sheets[1]).toBeGreaterThan(272);
        expect(sheets[1]).toBeLessThan(528);
    });

    it('reparte tres puntos cuando no hay numeracion propuesta', () => {
        expect(calibrationSheets(null, 500)).toEqual([100, 250, 400]);
    });

    it('nunca propone una hoja menor a uno', () => {
        expect(calibrationSheets(null, 1).every(s => s >= 1)).toBe(true);
    });
});

describe('citationAnchorFor', () => {
    const adamson: PageNumbering = {
        origin: 'confirmed',
        segments: [{ fromSheet: 1, toSheet: 240, offset: -4 }],
    };
    const mayor: PageNumbering = {
        origin: 'confirmed',
        segments: [
            { fromSheet: 1, toSheet: 271, offset: null },
            { fromSheet: 272, toSheet: 528, offset: -278 },
        ],
    };

    it('rotula la pagina impresa, no la hoja', () => {
        // El defecto que motiva todo esto: la hoja 32 de Adamson imprime 28,
        // y el modelo copia el ancla tal cual dentro del parentesis.
        expect(citationAnchorFor({ sheet: 32, section: null }, adamson)).toBe('p. 28');
        expect(citationAnchorFor({ sheet: 95, section: null }, adamson)).toBe('p. 91');
    });

    it('dice hoja cuando el recurso no declara numeracion', () => {
        expect(citationAnchorFor({ sheet: 55, section: null }, null)).toBe('hoja 55');
    });

    it('cita solo la seccion en un tramo sin folio arabigo', () => {
        // Decir «hoja 100» aqui invitaria a copiarla como si fuera pagina.
        expect(citationAnchorFor({ sheet: 100, section: 'Introduccion' }, mayor)).toBe('§ Introduccion');
        expect(citationAnchorFor({ sheet: 100, section: null }, mayor)).toBe('');
    });

    it('combina pagina y seccion cuando hay ambas', () => {
        expect(citationAnchorFor({ sheet: 32, section: 'II.3' }, adamson)).toBe('p. 28, § II.3');
        expect(citationAnchorFor({ sheet: 55, section: 'II.3' }, null)).toBe('hoja 55, § II.3');
    });

    it('cae en la seccion cuando no hay hoja', () => {
        expect(citationAnchorFor({ sheet: null, section: 'Prefacio' }, adamson)).toBe('§ Prefacio');
        expect(citationAnchorFor({ sheet: null, section: null }, adamson)).toBe('');
    });
});

describe('numberingFromCalibrationPoints', () => {
    it('colapsa en un tramo cuando los tres puntos coinciden', () => {
        const n = numberingFromCalibrationPoints(
            [{ sheet: 32, printed: 28 }, { sheet: 120, printed: 116 }, { sheet: 200, printed: 196 }],
            240,
        );
        expect(n?.segments).toEqual([{ fromSheet: 1, toSheet: 240, offset: -4 }]);
        expect(n?.origin).toBe('confirmed');
    });

    it('parte en tramos cuando los puntos discrepan', () => {
        // Teología Sistemática II: −1, −3 y −4 en tres regiones.
        const n = numberingFromCalibrationPoints(
            [{ sheet: 100, printed: 99 }, { sheet: 500, printed: 497 }, { sheet: 600, printed: 596 }],
            651,
        );
        expect(n?.segments.map(s => s.offset)).toEqual([-1, -3, -4]);
        expect(printedPageIn(n, 100)).toBe(99);
        expect(printedPageIn(n, 500)).toBe(497);
        expect(printedPageIn(n, 600)).toBe(596);
    });

    it('acepta que una hoja no tenga numero arabigo', () => {
        // Mayor: la introducción en romanos, y después la cuenta arábiga.
        const n = numberingFromCalibrationPoints(
            [{ sheet: 100, printed: null }, { sheet: 400, printed: 122 }],
            528,
        );
        expect(n?.segments[0]?.offset).toBeNull();
        expect(n?.segments[1]?.offset).toBe(-278);
        expect(printedPageIn(n, 100)).toBeNull();
        expect(printedPageIn(n, 326)).toBe(48);
    });

    it('guarda un libro entero sin numeracion como tal', () => {
        const n = numberingFromCalibrationPoints(
            [{ sheet: 10, printed: null }, { sheet: 50, printed: null }],
            80,
        );
        expect(n?.segments).toEqual([{ fromSheet: 1, toSheet: 80, offset: null }]);
        expect(n?.origin).toBe('confirmed');
    });

    it('cubre el libro entero de la primera hoja a la ultima', () => {
        const n = numberingFromCalibrationPoints([{ sheet: 50, printed: 44 }], 300);
        expect(n?.segments[0]?.fromSheet).toBe(1);
        expect(n?.segments.at(-1)?.toSheet).toBe(300);
    });

    it('devuelve null sin puntos', () => {
        expect(numberingFromCalibrationPoints([], 100)).toBeNull();
    });
});

describe('detectNumberingSegments — desfases imposibles', () => {
    it('descarta un desfase positivo en vez de proponerlo', () => {
        // La pagina impresa no puede superar a su hoja: las preliminares solo
        // suman hojas. Medido en la Biblia Hebraica Quinta, donde numeros del
        // aparato critico se leian como folios y daban +15.
        const numbering = detectNumberingSegments(book(300, () => +15));
        expect(numbering).toBeNull();
    });

    it('sigue aceptando el desfase cero', () => {
        const numbering = detectNumberingSegments(book(300, () => 0));
        expect(numbering?.segments).toEqual([{ fromSheet: 1, toSheet: 300, offset: 0 }]);
    });
});
