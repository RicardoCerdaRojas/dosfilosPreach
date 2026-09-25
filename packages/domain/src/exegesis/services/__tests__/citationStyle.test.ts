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
        expect(es).toContain('(Apellido, p. N)');
        expect(es).toContain('NUNCA');
        expect(buildCitationFormBlock('parenthetical', 'en')).toContain('(Author, p. N)');
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

    it('ninguna de las dos admite mezclar formas', () => {
        for (const forma of ['footnote', 'parenthetical'] as const) {
            expect(buildCitationFormBlock(forma, 'es')).toContain('Una sola forma');
        }
    });
});
