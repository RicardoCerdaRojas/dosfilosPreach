import { describe, it, expect } from 'vitest';

import { buildReadingBlocks } from '../sermonReading';
import { groupUnbreakableBlocks } from '../pageGrouping';

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
