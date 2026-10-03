import { describe, it, expect } from 'vitest';
import { cartSaveMode } from '../cartSaveMode';

const base = { isSaving: false, selectionChanged: false, needsResave: false, hadSaved: true };

describe('cartSaveMode', () => {
    it('misma selección con fragmentos viejos: «volver a guardar», no «agregar»', () => {
        expect(cartSaveMode({ ...base, needsResave: true })).toBe('resave');
    });
    it('cambió una selección ya guardada: «guardar cambios»', () => {
        expect(cartSaveMode({ ...base, selectionChanged: true })).toBe('update');
    });
    it('primera selección: «agregar»', () => {
        expect(cartSaveMode({ ...base, hadSaved: false, selectionChanged: true })).toBe('add');
    });
    it('sin cambios ni nada que limpiar: «guardado»', () => {
        expect(cartSaveMode(base)).toBe('saved');
    });
    it('guardando gana a todo', () => {
        expect(cartSaveMode({ ...base, isSaving: true, selectionChanged: true })).toBe('saving');
    });
});
