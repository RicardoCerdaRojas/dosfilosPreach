import { describe, it, expect } from 'vitest';
import { cartCanSave, cartSaveMode } from '../cartSaveMode';

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

/** TP #9 (Santiago 4:11-17, B20): quitar todo Tuggy no se podía guardar. */
describe('guardar sin páginas', () => {
    it('quitó TODAS las páginas guardadas: «guardar sin páginas», y se puede pulsar', () => {
        const mode = cartSaveMode({ ...base, selectionChanged: true, isEmpty: true });
        expect(mode).toBe('clear');
        expect(cartCanSave(mode, 0)).toBe(true);
    });
    it('una primera selección vacía no tiene nada que guardar', () => {
        const mode = cartSaveMode({ ...base, hadSaved: false, selectionChanged: true, isEmpty: true });
        expect(mode).toBe('add');
        expect(cartCanSave(mode, 0)).toBe(false);
    });
    it('sin hojas, «guardar cambios» y «volver a guardar» siguen apagados', () => {
        expect(cartCanSave('update', 0)).toBe(false);
        expect(cartCanSave('resave', 0)).toBe(false);
        expect(cartCanSave('update', 3)).toBe(true);
    });
    it('guardado o guardando no se pulsa', () => {
        expect(cartCanSave('saved', 3)).toBe(false);
        expect(cartCanSave('saving', 3)).toBe(false);
    });
});
