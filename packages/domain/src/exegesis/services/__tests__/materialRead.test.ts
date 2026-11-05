import { describe, expect, it } from 'vitest';
import { summarizeReadAnchors } from '../materialRead';

describe('summarizeReadAnchors', () => {
    it('agrupa tramos consecutivos por tipo de ancla', () => {
        const t = ['--- p. 157 ---', 'a', '--- p. 155 ---', 'b', '--- p. 156 ---', 'c', '--- p. 160 ---', 'd', '--- hoja 12 ---', 'e'].join('\n');
        expect(summarizeReadAnchors(t)).toBe('p. 155–157, 160; hoja 12');
    });

    it('las secciones y las páginas romanas van tal cual, sin repetir', () => {
        const t = ['--- § 2.3 ---', 'a', '--- p. ccxxii ---', 'b', '--- § 2.3 ---', 'c'].join('\n');
        expect(summarizeReadAnchors(t)).toBe('§ 2.3; p. ccxxii');
    });

    it('REGRESIÓN (Wallace, TP #10): la sección pegada a la página no se repite', () => {
        const t = ['--- p. 580, § 2. Semantics ---', 'a', '--- p. 580, § 3. Illustrations ---', 'b', '--- p. 581, § 1. Definition ---', 'c',
            '--- p. 144, § 1) Disadvantage (*Incommodi*) ---', 'd', '--- p. xii, § Prefacio ---', 'e'].join('\n');
        expect(summarizeReadAnchors(t)).toBe('p. 144, 580–581; p. xii');
    });

    it('un ancla cortada a la mitad no cuenta', () => {
        expect(summarizeReadAnchors('--- p. 155 ---\ntexto\n--- p. 1')).toBe('p. 155');
    });

    it('sin anclas, nulo', () => {
        expect(summarizeReadAnchors('texto corrido de un documento entero')).toBeNull();
    });
});
