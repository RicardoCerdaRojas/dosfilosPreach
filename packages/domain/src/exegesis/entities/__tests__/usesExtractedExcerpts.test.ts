import { describe, it, expect } from 'vitest';
import { usesExtractedExcerpts } from '../ProjectSource';

/**
 * Jonás 4:5-11 (2026-10-02): fuentes heredadas de la serie nacen
 * `full-document` sin fragmentos, y una extracción sobre ellas dejaba los
 * fragmentos con el modo viejo. Todo lo que decidía por `mode` los ignoraba y
 * el analizador leía el libro truncado desde la primera página.
 */
describe('usesExtractedExcerpts', () => {
    it('una fuente con fragmentos los usa aunque diga «documento completo»', () => {
        expect(usesExtractedExcerpts({ mode: 'full-document', excerpts: [{ text: 'Jonás 4:6…' }] } as never)).toBe(true);
    });

    it('la heredada recién llegada, sin fragmentos, no', () => {
        expect(usesExtractedExcerpts({ mode: 'full-document', excerpts: [] } as never)).toBe(false);
    });

    it('el modo de fragmentos manda aunque estén vacíos (los trae la receta)', () => {
        expect(usesExtractedExcerpts({ mode: 'extracted-excerpts', excerpts: [] } as never)).toBe(true);
    });
});
