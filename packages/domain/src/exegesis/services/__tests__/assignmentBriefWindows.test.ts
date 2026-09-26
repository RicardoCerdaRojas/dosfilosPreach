import { describe, expect, it } from 'vitest';
import {
    BRIEF_INSTRUCTION_CHARS,
    BRIEF_QUERY_CHARS,
    briefForInstruction,
    briefForQuery,
} from '../assignmentBriefWindows';

/** El encuadre real de Santiago 2:1-13 tiene 1.567 caracteres. */
const LARGO = 'x'.repeat(1567);

describe('el encuadre como CONSULTA de embeddings', () => {
    it('se recorta, y el motivo está medido desde antes', () => {
        // Un encuadre largo empeora la consulta: el modelo colapsa al término
        // dominante.
        expect(briefForQuery(LARGO)).toHaveLength(BRIEF_QUERY_CHARS);
    });

    it('un encuadre corto pasa entero, sin rellenar', () => {
        expect(briefForQuery('genitivos y participios')).toBe('genitivos y participios');
    });

    it('sin encuadre devuelve cadena vacía, no nulo', () => {
        expect(briefForQuery(null)).toBe('');
        expect(briefForQuery(undefined)).toBe('');
        expect(briefForQuery('   ')).toBe('');
    });
});

describe('el encuadre como INSTRUCCIÓN a un modelo', () => {
    it('llega entero: lo que se corta de una instrucción es una orden', () => {
        // El planificador de corpus lo recortaba a 1.000 y nunca vio
        // «Prohibido citar McCartney, Ropes, Varner», que es una restricción
        // sobre qué fuentes elegir.
        expect(briefForInstruction(LARGO)).toHaveLength(1567);
    });

    it('el tope existe para un pegado accidental, no para acortar', () => {
        expect(BRIEF_INSTRUCTION_CHARS).toBeGreaterThan(1809);
        expect(briefForInstruction('y'.repeat(50_000))).toHaveLength(BRIEF_INSTRUCTION_CHARS);
    });
});

describe('las dos ventanas', () => {
    it('la de instrucción es holgadamente mayor que la de consulta', () => {
        // Si alguien las iguala, o la consulta se vuelve ruidosa o la
        // instrucción vuelve a perder órdenes.
        expect(BRIEF_INSTRUCTION_CHARS).toBeGreaterThan(BRIEF_QUERY_CHARS * 4);
    });

    it('sobre el encuadre real de producción dan resultados distintos', () => {
        expect(briefForQuery(LARGO)).not.toBe(briefForInstruction(LARGO));
    });
});
