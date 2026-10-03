import { describe, it, expect } from 'vitest';
import { buildConsultPrompt, CONSULT_HISTORY_TURNS, CONSULT_SYSTEM } from '../buildConsultPrompt';

/** Chat de consulta del Taller (hallazgo 32 del ejercicio de Jonás). */
describe('buildConsultPrompt', () => {
    it('lleva el pasaje, el punto y la sección donde trabaja', () => {
        const p = buildConsultPrompt({
            question: '¿Qué personajes ilustran la actitud de Jonás y la de Dios?',
            passage: 'Jonás 4:5-11', pointTitle: 'III. La naturaleza de la misericordia genuina', sectionLabel: 'Punto 3 — ilustración',
        });
        expect(p).toContain('Jonás 4:5-11');
        expect(p).toContain('III. La naturaleza de la misericordia genuina');
        expect(p).toContain('Punto 3 — ilustración');
        expect(p.trim().endsWith('¿Qué personajes ilustran la actitud de Jonás y la de Dios?')).toBe(true);
    });

    it('sólo los últimos turnos de la conversación', () => {
        const history = Array.from({ length: 10 }, (_, i) => ({ role: 'pastor' as const, text: `turno ${i}` }));
        const p = buildConsultPrompt({ question: 'otra', passage: 'Jonás 4', history });
        expect(p).toContain(`turno ${10 - CONSULT_HISTORY_TURNS}`);
        expect(p).not.toContain(`turno ${9 - CONSULT_HISTORY_TURNS}`);
    });

    it('prohíbe citar autores y exige la referencia de cada versículo', () => {
        expect(CONSULT_SYSTEM).toMatch(/NO cites autores/);
        expect(CONSULT_SYSTEM).toMatch(/Libro capítulo:versículo/);
        expect(CONSULT_SYSTEM).toMatch(/Buscar citas en mi biblioteca/);
    });
});
