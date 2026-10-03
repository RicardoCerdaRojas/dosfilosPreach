import { describe, it, expect } from 'vitest';
import { publicationChange } from '../publicationChange';

/** Re-publicar sin cambios no crea otra copia (#2 del ejercicio de Jonás). */
const base = {
    title: 'La huida',
    content: 'Jonás huye.\n\nDios lo alcanza.',
    bibliography: [
        { title: 'Jonah', author: 'Sasson', page: '98', usedFor: 'x' },
        { title: 'Hosea–Micah', author: 'Fretheim', page: '194', usedFor: 'y' },
    ],
};

describe('publicationChange', () => {
    it('sin copia anterior es la primera', () => {
        expect(publicationChange(base, null)).toBe('first');
    });

    it('igual, aunque cambien espacios finales, saltos \\r\\n, el orden de la bibliografía o su «usedFor»', () => {
        expect(publicationChange(base, {
            title: 'La huida ',
            content: 'Jonás huye.  \r\n\r\nDios lo alcanza.\n',
            bibliography: [
                { ...base.bibliography[1]!, usedFor: 'otra cosa' },
                base.bibliography[0]!,
            ],
        })).toBe('unchanged');
    });

    it('cambia el título, el contenido o una fuente', () => {
        expect(publicationChange({ ...base, title: 'La huida de Jonás' }, base)).toBe('changed');
        expect(publicationChange({ ...base, content: base.content + '\n\nY la tormenta.' }, base)).toBe('changed');
        expect(publicationChange({ ...base, bibliography: [base.bibliography[0]!] }, base)).toBe('changed');
        expect(publicationChange({ ...base, bibliography: [{ ...base.bibliography[0]!, page: '99' }, base.bibliography[1]!] }, base)).toBe('changed');
    });

    it('sin bibliografía en ninguna de las dos es igual', () => {
        expect(publicationChange({ ...base, bibliography: undefined }, { ...base, bibliography: [] })).toBe('unchanged');
    });
});

describe('publicationChange — datos crudos del modelo (revisión adversarial)', () => {
    it('una página numérica o un título ausente no revientan la comparación', () => {
        const crudo = { ...base, bibliography: [{ title: undefined, author: 'Sasson', page: 98, usedFor: 'x' }] as never };
        expect(() => publicationChange(crudo, crudo)).not.toThrow();
        expect(publicationChange(crudo, { ...base, bibliography: [{ title: '', author: 'Sasson', page: '98', usedFor: 'y' }] })).toBe('unchanged');
    });
});
