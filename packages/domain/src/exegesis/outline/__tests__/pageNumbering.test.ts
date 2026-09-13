import { describe, expect, it } from 'vitest';

import {
    calibrationSheets,
    citationAnchorFor,
    detectNumberingSegments,
    numberingFromCalibrationPoints,
    printedPageIn,
    printedLabelIn,
    toRomanNumeral,
    parseRomanNumeral,
    relabelExcerptAnchor,
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
    it('pide tres puntos aunque el detector vea un solo tramo', () => {
        // Con un punto no se detecta un corrimiento. Si el libro cambia su
        // cuenta a mitad de camino y el detector no lo vio, preguntar una vez
        // confirmaría un desfase falso para media obra — con el aval de una
        // persona, que es peor que sin él.
        const uno: PageNumbering = {
            origin: 'detected',
            segments: [{ fromSheet: 1, toSheet: 240, offset: -4 }],
        };
        const sheets = calibrationSheets(uno, 240);
        expect(sheets.length).toBeGreaterThanOrEqual(3);
        expect(sheets[0]).toBeLessThan(sheets[sheets.length - 1]!);
    });

    it('pregunta dentro de cada tramo detectado', () => {
        const dos: PageNumbering = {
            origin: 'detected',
            segments: [
                { fromSheet: 1, toSheet: 271, offset: null },
                { fromSheet: 272, toSheet: 528, offset: -278 },
            ],
        };
        const sheets = calibrationSheets(dos, 528);
        expect(sheets.some(s => s > 1 && s < 271)).toBe(true);
        expect(sheets.some(s => s > 272 && s < 528)).toBe(true);
    });

    it('reparte tres puntos cuando no hay numeracion propuesta', () => {
        const sheets = calibrationSheets(null, 500);
        expect(sheets).toHaveLength(3);
        expect(sheets).toEqual([...sheets].sort((a, b) => a - b));
    });

    it('no propone dos hojas practicamente iguales', () => {
        const sheets = calibrationSheets(null, 600);
        for (let i = 1; i < sheets.length; i++) {
            expect(sheets[i]! - sheets[i - 1]!).toBeGreaterThan(1);
        }
    });

    it('nunca sale del libro', () => {
        for (const span of [1, 3, 40, 700]) {
            const sheets = calibrationSheets(null, span);
            expect(sheets.every(s => s >= 1 && s <= span)).toBe(true);
        }
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

describe('relabelExcerptAnchor', () => {
    const adamson: PageNumbering = {
        origin: 'confirmed',
        segments: [{ fromSheet: 1, toSheet: 240, offset: -4 }],
    };
    const mayor: PageNumbering = {
        origin: 'confirmed',
        segments: [
            { fromSheet: 1, toSheet: 316, offset: null },
            { fromSheet: 317, toSheet: 540, offset: -278 },
        ],
    };

    it('convierte la hoja guardada en la pagina impresa', () => {
        // El caso real: un extracto de Adamson anclado «p. 32» sobre la hoja
        // 32, que imprime 28. El modelo copiaba ese 32 dentro del parentesis.
        expect(relabelExcerptAnchor('p. 32', adamson)).toBe('p. 28');
        expect(relabelExcerptAnchor('p. 320', mayor)).toBe('p. 42');
    });

    it('conserva la seccion cuando el ancla la trae', () => {
        expect(relabelExcerptAnchor('p. 32, § III.2', adamson)).toBe('p. 28, § III.2');
    });

    it('dice hoja cuando el recurso no declara numeracion', () => {
        expect(relabelExcerptAnchor('p. 55', null)).toBe('hoja 55');
    });

    it('cae en la seccion dentro de un tramo sin folio arabigo', () => {
        // Las 316 primeras hojas de Mayor son su introduccion en romanos.
        expect(relabelExcerptAnchor('p. 100, § Intro', mayor)).toBe('§ Intro');
        expect(relabelExcerptAnchor('p. 100', mayor)).toBe('');
    });

    it('deja intacta un ancla que no reconoce', () => {
        // Mejor devolver algo imperfecto que arriesgar una conversion falsa.
        expect(relabelExcerptAnchor('comm. on v.1', adamson)).toBe('comm. on v.1');
        expect(relabelExcerptAnchor('§ III.2', adamson)).toBe('§ III.2');
        expect(relabelExcerptAnchor('', adamson)).toBe('');
    });

    it('acepta las variantes de formato del extractor', () => {
        expect(relabelExcerptAnchor('pp. 32', adamson)).toBe('p. 28');
        expect(relabelExcerptAnchor('p.32', adamson)).toBe('p. 28');
    });
});

describe('relabelExcerptAnchor — con la hoja guardada aparte', () => {
    const adamson: PageNumbering = {
        origin: 'confirmed',
        segments: [{ fromSheet: 1, toSheet: 240, offset: -4 }],
    };

    it('prefiere el dato explicito sobre el parseo del rotulo', () => {
        // El rotulo guardado puede estar mal; el numero no.
        expect(relabelExcerptAnchor('p. 999', adamson, { sheet: 32 })).toBe('p. 28');
    });

    it('conserva la seccion guardada aparte', () => {
        expect(relabelExcerptAnchor('p. 32', adamson, { sheet: 32, section: 'II.3' }))
            .toBe('p. 28, § II.3');
    });

    it('cae en el parseo cuando el extracto es anterior al campo', () => {
        expect(relabelExcerptAnchor('p. 32', adamson, {})).toBe('p. 28');
        expect(relabelExcerptAnchor('p. 32', adamson, undefined)).toBe('p. 28');
    });
});

/**
 * Tramos en romanos.
 *
 * La introducción de Mayor sobre Santiago tiene 260 páginas numeradas i-cclx.
 * Son páginas: se citan a diario como «p. ccxxii». Antes el modelo sólo sabía
 * decir «arábigo con desfase» o «sin numeración», así que esas 260 caían en la
 * segunda casilla y sus citas terminaban diciendo «hoja 240» —un número del
 * archivo PDF que no existe en ningún ejemplar—.
 *
 * `offset: null` sigue significando «esta hoja no tiene número». Un tramo
 * romano significa «tiene número, y no es arábigo». Son cosas distintas.
 */
describe('numeración en romanos', () => {
    /** Mayor: los romanos empiezan en la hoja 19; la arábiga, en la 279. */
    const MAYOR: PageNumbering = {
        origin: 'confirmed',
        segments: [
            { fromSheet: 1, toSheet: 278, offset: -18, style: 'roman' },
            { fromSheet: 279, toSheet: 540, offset: -278 },
        ],
    };

    it('rotula la página romana como la imprime el libro', () => {
        expect(printedLabelIn(MAYOR, 240)).toBe('ccxxii');
        expect(printedLabelIn(MAYOR, 119)).toBe('ci');
    });

    it('el tramo arábigo del mismo libro no cambia', () => {
        expect(printedLabelIn(MAYOR, 461)).toBe('183');
        expect(printedPageIn(MAYOR, 461)).toBe(183);
    });

    it('el ancla de citación dice «p. ccxxii», no «hoja 240»', () => {
        expect(citationAnchorFor({ sheet: 240, section: null }, MAYOR)).toBe('p. ccxxii');
    });

    it('printedPageIn calla en un tramo romano, para que nadie escriba «p. 222»', () => {
        // Devolver el número acá haría que cualquier llamador no migrado
        // rotulara una página que en ese libro es otra cosa. Callar lo degrada
        // a «hoja N»: falso, pero honesto.
        expect(printedPageIn(MAYOR, 240)).toBeNull();
    });

    it('una hoja sin número sigue sin tenerlo', () => {
        const conLamina: PageNumbering = {
            origin: 'confirmed',
            segments: [{ fromSheet: 1, toSheet: 40, offset: null }],
        };
        expect(printedLabelIn(conLamina, 12)).toBeNull();
        expect(citationAnchorFor({ sheet: 12, section: null }, conLamina)).toBe('');
    });
});

describe('romanos — ida y vuelta', () => {
    it('escribe en minúscula, como los preliminares de un libro', () => {
        expect(toRomanNumeral(222)).toBe('ccxxii');
        expect(toRomanNumeral(101)).toBe('ci');
        expect(toRomanNumeral(4)).toBe('iv');
        expect(toRomanNumeral(1)).toBe('i');
    });

    it('lee lo que escribe, en ambos sentidos', () => {
        for (const n of [1, 4, 9, 14, 40, 90, 101, 222, 260, 1987]) {
            expect(parseRomanNumeral(toRomanNumeral(n))).toBe(n);
        }
    });

    it('acepta mayúsculas, que es como algunas portadas los imprimen', () => {
        expect(parseRomanNumeral('CCXXII')).toBe(222);
    });

    it('rechaza lo que no es un romano canónico', () => {
        // «iiii» e «ic» se leen, pero nadie los imprime. Aceptarlos guardaría
        // un desfase deducido de un número que no existe en el libro.
        expect(parseRomanNumeral('iiii')).toBeNull();
        expect(parseRomanNumeral('ic')).toBeNull();
        expect(parseRomanNumeral('42')).toBeNull();
        expect(parseRomanNumeral('')).toBeNull();
        expect(parseRomanNumeral('hola')).toBeNull();
    });
});

describe('calibración con una respuesta romana', () => {
    it('arma el tramo romano y el arábigo por separado', () => {
        const n = numberingFromCalibrationPoints([
            { sheet: 119, printed: 101, style: 'roman' },
            { sheet: 240, printed: 222, style: 'roman' },
            { sheet: 461, printed: 183 },
        ], 540);
        expect(n).not.toBeNull();
        expect(printedLabelIn(n, 240)).toBe('ccxxii');
        expect(printedLabelIn(n, 461)).toBe('183');
    });

    it('no colapsa dos tramos que comparten desfase pero no cifras', () => {
        // Sin la comprobación de estilo, estos dos serían un solo tramo y medio
        // libro se citaría con las cifras del otro medio.
        const n = numberingFromCalibrationPoints([
            { sheet: 100, printed: 90, style: 'roman' },
            { sheet: 400, printed: 390 },
        ], 500);
        expect(n!.segments).toHaveLength(2);
        expect(printedLabelIn(n, 100)).toBe('xc');
        expect(printedLabelIn(n, 400)).toBe('390');
    });
});

/**
 * NUMERACIÓN QUE DECRECE. Un libro hebreo se encuaderna de derecha a izquierda;
 * escaneado en orden de hoja, sus folios van hacia atrás. Medido sobre el
 * fascículo BHQ de los Doce Profetas, con los folios leídos de su propio texto:
 *
 *     hoja 148 → folio 155      hoja 239 → folio 64
 *     hoja 183 → folio 120      hoja 260 → folio 43
 *     hoja 190 → folio 113
 *
 * Todas suman 303. Con la fórmula `hoja + offset` eso es INEXPRESABLE: ningún
 * desfase fijo produce una serie decreciente, y el libro quedaba calibrado con
 * un número que acierta en una hoja y falla en todas las demás.
 *
 * La dirección se DEDUCE de esa suma constante en vez de preguntarse. Nadie
 * puede marcar mal una casilla que no existe.
 */
describe('numeración que decrece (libro encuadernado al revés)', () => {
    /** Los folios reales de BHQ, leídos de su texto extraído. */
    const BHQ = [
        { sheet: 148, printed: 155 },
        { sheet: 190, printed: 113 },
        { sheet: 260, printed: 43 },
    ];

    it('dos respuestas cuya suma coincide describen un tramo descendente', () => {
        const n = numberingFromCalibrationPoints(BHQ, 315)!;
        expect(n.segments.every(s => s.step === -1)).toBe(true);
        expect(n.segments.every(s => s.offset === 303)).toBe(true);
    });

    it('y entonces cada hoja devuelve su folio REAL', () => {
        const n = numberingFromCalibrationPoints(BHQ, 315);
        for (const { sheet, printed } of BHQ) {
            expect(printedPageIn(n, sheet), `hoja ${sheet}`).toBe(printed);
        }
        // Y en hojas que NO se usaron para calibrar, que es donde se demuestra
        // que la regla vale y no sólo el ancla.
        expect(printedPageIn(n, 213)).toBe(90);
        expect(printedPageIn(n, 214)).toBe(89);
        expect(printedPageIn(n, 216)).toBe(87);
    });

    it('un libro normal no se vuelve descendente por accidente', () => {
        // Folios que CRECEN: la suma no es constante, así que no hay nada que
        // deducir y la fórmula sigue siendo la de siempre.
        const normal = [{ sheet: 10, printed: 2 }, { sheet: 50, printed: 42 }];
        const n = numberingFromCalibrationPoints(normal, 100)!;
        expect(n.segments.every(s => s.step === undefined)).toBe(true);
        expect(printedPageIn(n, 30)).toBe(22);
    });

    it('`step: 1` no se escribe: las numeraciones de antes no cambian', () => {
        const n = numberingFromCalibrationPoints([{ sheet: 5, printed: 1 }], 100)!;
        expect(Object.prototype.hasOwnProperty.call(n.segments[0]!, 'step')).toBe(false);
    });

    it('una numeración vieja, sin `step`, se sigue leyendo igual', () => {
        // Compatibilidad hacia atrás: los 29 libros ya calibrados no migran.
        const vieja = { segments: [{ fromSheet: 1, toSheet: 100, offset: -4 }], origin: 'confirmed' as const };
        expect(printedPageIn(vieja, 50)).toBe(46);
    });

    it('un tramo descendente no produce folios imposibles', () => {
        // Más allá de donde la cuenta llega a cero, la respuesta honesta es
        // «no sé», no un número negativo.
        const n = numberingFromCalibrationPoints(BHQ, 400);
        expect(printedPageIn(n, 303)).toBeNull();
        expect(printedPageIn(n, 350)).toBeNull();
    });
});
