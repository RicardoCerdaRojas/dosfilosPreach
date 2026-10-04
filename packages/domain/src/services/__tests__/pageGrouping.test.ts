import { describe, it, expect } from 'vitest';

import { buildReadingBlocks } from '../sermonReading';
import { groupUnbreakableBlocks, packPages } from '../pageGrouping';

const groupsOf = (markdown: string) => {
    const blocks = buildReadingBlocks(markdown);
    return groupUnbreakableBlocks(blocks).map((g) => g.map((i) => blocks[i].kind));
};

describe('groupUnbreakableBlocks', () => {
    it('un subtítulo nunca cierra página: arrastra lo que sigue', () => {
        expect(groupsOf('### Título\n\nProsa.')).toEqual([['subheading', 'paragraph']]);
    });

    it('las viñetas van con el bloque que las introduce', () => {
        const md = ['Puntos del Sermón:', '', '- Uno.', '- Dos.', '- Tres.'].join('\n');
        expect(groupsOf(md)).toEqual([['paragraph', 'listitem', 'listitem', 'listitem']]);
    });

    it('el caso del atril: proposición, prosa, lead-in y puntos, todo junto', () => {
        const md = [
            '### Proposición homilética',
            '',
            'En Jonás 1:1-3 veremos dos realidades.',
            '',
            'Puntos del Sermón:',
            '',
            '- I. Dios habla.',
            '- II. El hombre desobedece.',
        ].join('\n');
        const groups = groupsOf(md);
        expect(groups).toHaveLength(2);
        expect(groups[0]).toEqual(['subheading', 'paragraph']);
        expect(groups[1]).toEqual(['paragraph', 'listitem', 'listitem']);
    });

    it('los párrafos sueltos quedan cada uno en su grupo', () => {
        expect(groupsOf('Uno.\n\nDos.\n\nTres.')).toEqual([
            ['paragraph'],
            ['paragraph'],
            ['paragraph'],
        ]);
    });

    it('cada bloque aparece exactamente una vez y en orden', () => {
        const blocks = buildReadingBlocks(
            ['### A', '', 'p1', '', '- x', '- y', '', 'p2', '', '### B', '', 'p3'].join('\n'),
        );
        const flat = groupUnbreakableBlocks(blocks).flat();
        expect(flat).toEqual(blocks.map((_, i) => i));
    });

    it('no explota sin bloques', () => {
        expect(groupUnbreakableBlocks([])).toEqual([]);
    });
});

describe('packPages — las páginas del atril', () => {
    it('empaqueta grupos enteros hasta llenar la página', () => {
        expect(packPages([[0], [1], [2]], [40, 40, 40], 100)).toEqual([[0, 1], [2]]);
    });

    it('REGRESIÓN: la primera página descuenta los títulos', () => {
        // Sin descontar, [0,1] entraban en 100 y la página se pasaba del alto
        // real (los títulos ocupaban 30).
        expect(packPages([[0], [1], [2]], [40, 40, 40], 100, 70)).toEqual([[0], [1, 2]]);
    });

    it('si el primer grupo no entra bajo los títulos, la primera página es sólo de títulos', () => {
        expect(packPages([[0, 1]], [40, 40], 100, 50)).toEqual([[], [0, 1]]);
    });

    it('un grupo que no entra ni en una página vacía se reparte por bloques', () => {
        expect(packPages([[0, 1, 2]], [60, 60, 60], 100)).toEqual([[0], [1], [2]]);
    });

    it('sin bloques no hay páginas (el movimiento se muestra con su título)', () => {
        expect(packPages([], [], 100, 60)).toEqual([]);
    });
});
