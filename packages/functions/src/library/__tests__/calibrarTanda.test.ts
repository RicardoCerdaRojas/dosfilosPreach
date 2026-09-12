import { describe, it, expect } from 'vitest';
import {
    calibrarPaginasPorTanda,
    densidadDe,
    densidadDeReferencia,
    tamanoParaDensidad,
    PRESUPUESTO_SALIDA,
    MIN_TANDA,
    MAX_TANDA,
    TANDA_INICIAL,
} from '../calibrarTanda';

/**
 * Los pares de este archivo NO son inventados: son lecturas reales, medidas el
 * 11-09-2026 con el prompt de producción contra `gemini-2.5-flash` y el
 * razonamiento apagado. Si alguien cambia el resguardo o el presupuesto, estas
 * pruebas dicen qué le pasa a cada libro concreto de la biblioteca.
 */
const MEDIDO = {
    /** Barrick, gramática hebrea: 33 566 tokens por 30 páginas. */
    barrick: { tokens: 33566, paginas: 30 },
    /** Sasson, comentario de Jonás: 24 882 tokens por 16 páginas. */
    sasson: { tokens: 24882, paginas: 16 },
    /** Manual del Consejero, prosa española: 21 264 tokens por 16 páginas. */
    consejero: { tokens: 21264, paginas: 16 },
};

describe('calibrarPaginasPorTanda', () => {
    it('da a cada obra medida un tamaño distinto, porque su densidad lo es', () => {
        expect(calibrarPaginasPorTanda(MEDIDO.barrick.tokens, MEDIDO.barrick.paginas)).toBe(43);
        expect(calibrarPaginasPorTanda(MEDIDO.consejero.tokens, MEDIDO.consejero.paginas)).toBe(36);
        expect(calibrarPaginasPorTanda(MEDIDO.sasson.tokens, MEDIDO.sasson.paginas)).toBe(31);
    });

    /**
     * La regresión que motivó todo esto. `CHUNK_SIZE_PAGES = 60` excedía el
     * techo de las TRES obras medidas, y por eso en treinta días de registros
     * ninguna extracción batcheada terminó un libro.
     */
    it('nunca devuelve el 60 fijo que hacía fallar a las tres obras medidas', () => {
        for (const obra of Object.values(MEDIDO)) {
            const tamano = calibrarPaginasPorTanda(obra.tokens, obra.paginas)!;
            const tokensPorPagina = obra.tokens / obra.paginas;
            expect(tamano).toBeLessThan(60);
            // Y lo que sí devuelve cabe de verdad en el presupuesto.
            expect(tamano * tokensPorPagina).toBeLessThan(PRESUPUESTO_SALIDA);
        }
    });

    /**
     * Barrick a 60 páginas devolvió 65 521 tokens contra un tope de 65 536:
     * falló por quince. Es el caso límite que prueba que el resguardo no es
     * decorativo — sin él, la calibración habría devuelto justo ese número.
     */
    it('deja margen sobre el punto exacto donde Barrick falló', () => {
        const tamano = calibrarPaginasPorTanda(MEDIDO.barrick.tokens, MEDIDO.barrick.paginas)!;
        const proyectado = tamano * (MEDIDO.barrick.tokens / MEDIDO.barrick.paginas);
        expect(proyectado).toBeLessThan(PRESUPUESTO_SALIDA * 0.8);
    });

    it('una muestra inutilizable no calibra, en vez de inventar un número', () => {
        // Devolver un tamaño aquí sería peor que no calibrar: se aplicaría al
        // resto del libro con cara de medida.
        expect(calibrarPaginasPorTanda(1000, 0)).toBeNull();
        expect(calibrarPaginasPorTanda(0, 10)).toBeNull();
        expect(calibrarPaginasPorTanda(-5, 10)).toBeNull();
        expect(calibrarPaginasPorTanda(NaN, 10)).toBeNull();
        expect(calibrarPaginasPorTanda(1000, Infinity)).toBeNull();
    });

    it('no deja que una muestra extrema mande sola', () => {
        // Un tramo de páginas casi vacías —láminas, un índice— no autoriza una
        // tanda que el cuerpo del libro no va a sostener.
        expect(calibrarPaginasPorTanda(100, 50)).toBe(MAX_TANDA);
        // Y una página absurdamente pesada no reduce la tanda a una sola página,
        // donde el costo de subir el recorte dominaría la llamada.
        expect(calibrarPaginasPorTanda(PRESUPUESTO_SALIDA * 4, 1)).toBe(MIN_TANDA);
    });

    it('la primera tanda entra incluso con la densidad más alta medida', () => {
        const masDensa = MEDIDO.sasson.tokens / MEDIDO.sasson.paginas;
        expect(TANDA_INICIAL * masDensa).toBeLessThan(PRESUPUESTO_SALIDA * 0.75);
    });
});

/**
 * EL DEFECTO QUE ESTO CORRIGE, visto en producción el 12-09-2026 al subir el
 * comentario de Sasson (392 págs).
 *
 * Calibrar UNA sola vez supone que el primer tramo representa al libro. No lo
 * representa: el principio de un libro son portadilla, créditos e índice.
 *
 *     📐 611 tokens/página medidos; el resto va de a 48 páginas
 *     ...
 *     ✂️ 3 (67-114) no entra en una respuesta; se parte en 67-90 y 91-114
 *
 * El cuerpo del libro mide 1 555 tokens/página —medido aparte sobre las páginas
 * 100-115—, o sea 2,5 veces más que su portada. El tamaño calibrado sobre el
 * arranque no lo sostenía.
 */
describe('densidadDeReferencia — la calibración se remide, no se fija', () => {
    /** Densidades reales de Sasson: su arranque y su cuerpo. */
    const PORTADA = 611;
    const CUERPO = 1555;

    it('el arranque liviano deja de fijar el tamaño de todo el libro', () => {
        const trasElPrimero = densidadDeReferencia(null, PORTADA);
        expect(tamanoParaDensidad(trasElPrimero!)).toBe(48);

        // Al ver el cuerpo, la referencia sube y la tanda se achica.
        const trasElSegundo = densidadDeReferencia(trasElPrimero, CUERPO);
        expect(trasElSegundo).toBe(CUERPO);
        expect(tamanoParaDensidad(trasElSegundo!)).toBeLessThan(48);
    });

    it('se queda con el tramo MÁS denso, no con el último', () => {
        // Un capítulo liviano después de uno denso no debe volver a agrandar la
        // tanda: el costo es asimétrico. Quedarse corto son unas llamadas de
        // más; pasarse son ~200 s tirados y un partido, en cada rango siguiente.
        const traselDenso = densidadDeReferencia(null, CUERPO);
        expect(densidadDeReferencia(traselDenso, PORTADA)).toBe(CUERPO);
    });

    it('el tamaño nunca crece a mitad de libro', () => {
        let referencia: number | null = null;
        let anterior = Infinity;
        // Un recorrido con tramos que alternan liviano y denso.
        for (const densidad of [PORTADA, 900, CUERPO, 700, 1200, 400]) {
            referencia = densidadDeReferencia(referencia, densidad);
            const tamano = tamanoParaDensidad(referencia!);
            expect(tamano).toBeLessThanOrEqual(anterior);
            anterior = tamano;
        }
    });

    it('una muestra inservible no mueve la referencia', () => {
        expect(densidadDeReferencia(CUERPO, null)).toBe(CUERPO);
        expect(densidadDeReferencia(null, null)).toBeNull();
    });

    it('densidadDe rechaza lo que no se puede medir', () => {
        expect(densidadDe(0, 10)).toBeNull();
        expect(densidadDe(1000, 0)).toBeNull();
        expect(densidadDe(NaN, 10)).toBeNull();
        expect(densidadDe(24882, 16)).toBeCloseTo(1555.1, 1);
    });
});
