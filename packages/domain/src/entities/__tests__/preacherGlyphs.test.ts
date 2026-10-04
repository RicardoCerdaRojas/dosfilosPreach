import { describe, expect, it } from 'vitest';

import { PREACHER_GLYPHS, glyphAction } from '../SermonAnnotation';

describe('marcas de predicador', () => {
    it('sobre una palabra sin glifo, lo pone', () => {
        expect(glyphAction(null, 'pause')).toBe('create');
    });

    it('el mismo glifo otra vez lo quita: es un interruptor', () => {
        expect(glyphAction('pause', 'pause')).toBe('remove');
    });

    it('otro glifo reemplaza al que había: una palabra lleva uno', () => {
        expect(glyphAction('pause', 'look')).toBe('update');
    });

    it('son las cinco del lápiz del púlpito', () => {
        expect([...PREACHER_GLYPHS]).toEqual(['pause', 'emphasis', 'soft', 'look', 'illustration']);
    });
});
