import { describe, expect, it } from 'vitest';
import { barrasDePertinencia, grupoDeFecha, inicialDe, paginaDeCita, seccionCorta } from '../presentacion';

describe('seccionCorta', () => {
    it('quita repeticiones, el título del libro y las mayúsculas sostenidas; deja los dos últimos niveles', () => {
        expect(seccionCorta('JAMES › JAMES › JAMES')).toBe('James');
        expect(seccionCorta('ANALYSIS OF JAMES FIVE › The Book of James—A New Perspective › 22. Paragraph 22 (James 5:13-18)', 'The Book of James—A New Perspective'))
            .toBe('Analysis of james five › 22. Paragraph 22 (James 5:13-18)');
        expect(seccionCorta('VII. Fourth Discourse › C. Part 2: Faith and Prayer (5:13–18) › Exegesis and Exposition'))
            .toBe('C. Part 2: Faith and Prayer (5:13–18) › Exegesis and Exposition');
        expect(seccionCorta('')).toBe('');
    });
});

describe('grupoDeFecha', () => {
    const ahora = new Date(2026, 9, 17, 10);
    it('hoy, ayer, esta semana, antes', () => {
        expect(grupoDeFecha(new Date(2026, 9, 17, 1), ahora)).toBe('hoy');
        expect(grupoDeFecha(new Date(2026, 9, 16, 23), ahora)).toBe('ayer');
        expect(grupoDeFecha(new Date(2026, 9, 12), ahora)).toBe('semana');
        expect(grupoDeFecha(new Date(2026, 9, 1), ahora)).toBe('antes');
    });
});

describe('barrasDePertinencia, inicialDe, paginaDeCita', () => {
    it('pertinencia a barras', () => {
        expect([null, 6, 7, 8, 9, 10].map(barrasDePertinencia)).toEqual([0, 1, 2, 2, 3, 3]);
    });
    it('inicial del lomo', () => {
        expect(inicialDe('McCartney', 'James')).toBe('Mc');
        expect(inicialDe('Varner', 'x')).toBe('V');
        expect(inicialDe('', 'Diccionario')).toBe('D');
    });
    it('página de una cita armada', () => {
        expect(paginaDeCita('(Varner, p. 187)')).toBe('p. 187');
        expect(paginaDeCita('(Moo, hoja 30)')).toBe('hoja 30');
    });
});
