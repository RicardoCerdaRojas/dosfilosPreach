import { describe, it, expect } from 'vitest';
import { computeExtractionFingerprint, isExcerptSetStale } from '../ProjectSource';

/**
 * TP #7 (#21): agregar «(Stg. 3:15)» a una pregunta del encuadre marcó
 * desactualizadas las siete fuentes. Las de páginas elegidas no dependen del
 * encuadre, y «Re-extraer» sobre ellas reemplazaría las páginas.
 */
const PASAJE = 'Santiago 3:13-18';
const viejo = '3. ¿Cuál es el sujeto del versículo 15?';
const nuevo = '3. ¿Cuál es el sujeto del versículo 15 (Stg. 3:15)?';
const receta = { sheetRanges: [{ start: 230, end: 236 }], proposedRanges: [], pinnedRanges: [], passageFingerprint: '' };

describe('isExcerptSetStale', () => {
    const conPaginas = {
        mode: 'extracted-excerpts' as const, excerpts: [], excerptRecipe: receta,
        extractionFingerprint: computeExtractionFingerprint(PASAJE, viejo),
    };
    const porPasaje = { ...conPaginas, excerptRecipe: null, excerpts: [{ text: 'x' }] as never };

    it('con páginas elegidas, un cambio del encuadre no la vuelve vieja', () => {
        expect(isExcerptSetStale(conPaginas, { passageRef: PASAJE, assignmentBrief: nuevo })).toBe(false);
    });
    it('con páginas elegidas, un cambio de pasaje sí', () => {
        expect(isExcerptSetStale(conPaginas, { passageRef: 'Santiago 3:13-4:3', assignmentBrief: viejo })).toBe(true);
    });
    it('REGRESIÓN B68a: una huella guardada con «salmos 23:4-6» sigue vigente con «Salmo 23:4-6»', () => {
        const vieja = computeExtractionFingerprint('Salmos 23:4-6', viejo);
        for (const fuente of [{ ...conPaginas, extractionFingerprint: vieja }, { ...porPasaje, extractionFingerprint: vieja }]) {
            expect(isExcerptSetStale(fuente, { passageRef: 'Salmo 23:4-6', assignmentBrief: viejo })).toBe(false);
            // Otro salmo sí la vuelve vieja.
            expect(isExcerptSetStale(fuente, { passageRef: 'Salmo 24:4-6', assignmentBrief: viejo })).toBe(true);
        }
    });
    it('extraída por el pasaje, el encuadre sigue contando: cambia la consulta', () => {
        expect(isExcerptSetStale(porPasaje, { passageRef: PASAJE, assignmentBrief: nuevo })).toBe(true);
        expect(isExcerptSetStale(porPasaje, { passageRef: PASAJE, assignmentBrief: viejo })).toBe(false);
    });
});
