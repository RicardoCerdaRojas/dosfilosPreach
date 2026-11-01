import { describe, expect, it } from 'vitest';
import { findPandocNotes, pandocNotesAsGfmFootnotes, pandocNotesAsParentheses } from '../notasPandoc';

describe('la nota `^[…]` (etapa 3.5)', () => {
    it('cuenta corchetes: «[ed. 1997]» dentro de la nota no la corta', () => {
        const t = 'Método.^[La BHS [ed. 1997]; traducción propia] Sigue.';
        expect(findPandocNotes(t)).toEqual([{ start: 7, end: t.indexOf(' Sigue'), body: 'La BHS [ed. 1997]; traducción propia' }]);
    });

    it('una nota sin cerrar queda como texto; una vacía no es nota', () => {
        expect(findPandocNotes('Método.^[sin cerrar')).toEqual([]);
        expect(findPandocNotes('A ^[ ] B')).toEqual([]);
    });

    it('varias notas en el mismo párrafo', () => {
        expect(findPandocNotes('A^[uno] B^[dos [x]] C').map(n => n.body)).toEqual(['uno', 'dos [x]']);
    });

    it('entre paréntesis, pegada a la palabra', () => {
        expect(pandocNotesAsParentheses('Método ^[la BHS] sigue.')).toBe('Método (la BHS) sigue.');
        expect(pandocNotesAsParentheses('Sin notas.')).toBe('Sin notas.');
    });

    it('en pantalla, como nota al pie de GFM con su definición al final', () => {
        const md = pandocNotesAsGfmFootnotes('Método ^[la BHS\n[ed. 1997]] sigue.');
        expect(md).toContain('Método[^nota-1] sigue.');
        expect(md).toContain('[^nota-1]: la BHS [ed. 1997]');
    });
});
