import { describe, it, expect } from 'vitest';
import { selectionInside } from '../selectionInside';

/** TP #8 (#38; 8b, D6): la selección tiene que empezar y terminar en la hoja. */
describe('selectionInside', () => {
    const hoja = document.createElement('div');
    const dentro = document.createTextNode('the active may include');
    hoja.appendChild(dentro);
    const fuera = document.createTextNode('Citar');
    const sel = (anchor: Node | null, focus: Node | null, collapsed = false) =>
        ({ anchorNode: anchor, focusNode: focus, isCollapsed: collapsed }) as unknown as Selection;

    it('empieza y termina en la hoja: vale', () => {
        expect(selectionInside(sel(dentro, dentro), hoja)).toBe(true);
    });
    it('empieza en la hoja y termina afuera: no vale', () => {
        expect(selectionInside(sel(dentro, fuera), hoja)).toBe(false);
    });
    it('empieza afuera: no vale', () => {
        expect(selectionInside(sel(fuera, dentro), hoja)).toBe(false);
    });
    it('vacía o sin hoja: no vale', () => {
        expect(selectionInside(sel(dentro, dentro, true), hoja)).toBe(false);
        expect(selectionInside(null, hoja)).toBe(false);
        expect(selectionInside(sel(dentro, dentro), null)).toBe(false);
    });
});
