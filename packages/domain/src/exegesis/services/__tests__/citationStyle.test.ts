import { describe, expect, it } from 'vitest';
import { buildCitationFormBlock } from '../citationStyle';

describe('buildCitationFormBlock', () => {
    it('la entrega con notas al pie exige el título entre comillas', () => {
        // Es la única forma que el exportador convierte en nota al pie; sin el
        // título la cita se queda varada en el cuerpo.
        const es = buildCitationFormBlock('footnote', 'es');
        expect(es).toContain('(Apellido, "Título", p. N)');
        expect(buildCitationFormBlock('footnote', 'en')).toContain('(Author, "Title", p. N)');
    });

    it('la entrega parentética manda el título a la bibliografía', () => {
        const es = buildCitationFormBlock('parenthetical', 'es');
        expect(es).toContain('(Clave, p. N)');
        expect(es).toContain('NUNCA');
        expect(buildCitationFormBlock('parenthetical', 'en')).toContain('(Key, p. N)');
    });

    it('sin formato declarado, la maquetación de la casa: nota al pie', () => {
        expect(buildCitationFormBlock(null, 'es')).toBe(buildCitationFormBlock('footnote', 'es'));
    });

    it('las dos formas conservan la regla del rótulo de página', () => {
        // «hoja N» significa que la página impresa se desconoce; convertirla a
        // «p. N» manda al lector a otra página.
        for (const forma of ['footnote', 'parenthetical'] as const) {
            expect(buildCitationFormBlock(forma, 'es')).toContain('hoja 87');
            expect(buildCitationFormBlock(forma, 'en')).toContain('sheet 87');
        }
    });

    it('las dos prohíben el número suelto', () => {
        // Medido en Santiago 2:1: el mismo párrafo salió con «(Mayor, 77)»,
        // «(Adamson, 103)» y «(Porter, p. 262)». El bloque enseñaba la forma
        // con rótulo y no decía que el rótulo fuera obligatorio.
        for (const forma of ['footnote', 'parenthetical'] as const) {
            expect(buildCitationFormBlock(forma, 'es')).toContain('Mayor');
            expect(buildCitationFormBlock(forma, 'es')).toContain('SIEMPRE');
            expect(buildCitationFormBlock(forma, 'en')).toContain('ALWAYS');
        }
    });

    it('ninguna de las dos admite mezclar formas', () => {
        for (const forma of ['footnote', 'parenthetical'] as const) {
            expect(buildCitationFormBlock(forma, 'es')).toContain('Una sola forma');
        }
    });
});

/** TP #8 (8b, E1, #39): la prosa citó «(Nestle y Aland, 692)» con el autor de la ficha. */
describe('buildCitationFormBlock — la clave, no el autor', () => {
    it('pide la clave tal cual la da la lista de fuentes', () => {
        expect(buildCitationFormBlock('parenthetical', 'es')).toContain('«NA28», nunca «Nestle y Aland»');
        expect(buildCitationFormBlock('parenthetical', 'en')).toContain('«NA28», never «Nestle and Aland»');
    });
});
