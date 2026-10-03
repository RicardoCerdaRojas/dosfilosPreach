import { describe, it, expect } from 'vitest';
import { filterLinkableSermons, linkableSermonsFor, passageMatch } from '../linkableSermons';

/**
 * Vincular un sermón existente a su perícopa (#3 del ejercicio de Jonás): el
 * de Jonás 1:1-3 se escribió antes de la serie, con «Jonas» sin tilde, y se
 * vinculó a mano en Firestore.
 */
const d = (n: number) => new Date(2026, 8, n);
const s = (o: Partial<Parameters<typeof linkableSermonsFor>[0][number]> & { id: string }) => ({
    title: o.id, status: 'draft' as const, updatedAt: d(1), bibleReferences: [], ...o,
});

describe('passageMatch', () => {
    it('superposición, mismo libro o nada', () => {
        expect(passageMatch('Jonas 1:1-3', 'Jonás 1:1-3')).toBe('overlap');
        expect(passageMatch('Jonás 1', 'Jonás 1:4-16')).toBe('overlap');
        expect(passageMatch('Jonás 3:1-10', 'Jonás 1:1-3')).toBe('same-book');
        expect(passageMatch('Rut 1:1', 'Jonás 1:1-3')).toBe('none');
        expect(passageMatch('', 'Jonás 1:1-3')).toBe('none');
    });
});

describe('linkableSermonsFor', () => {
    it('el que coincide con el pasaje va primero aunque sea más viejo', () => {
        const out = linkableSermonsFor([
            s({ id: 'rut', updatedAt: d(20), wizardProgress: { passage: 'Rut 1:1-5' } }),
            s({ id: 'jon3', updatedAt: d(15), wizardProgress: { passage: 'Jonás 3:1-10' } }),
            s({ id: 'jon1', updatedAt: d(2), wizardProgress: { passage: 'Jonas 1:1-3' } }),
        ], 'Jonás 1:1-3', 'serie', new Set());
        expect(out.map(x => [x.id, x.match])).toEqual([['jon1', 'overlap'], ['jon3', 'same-book'], ['rut', 'none']]);
    });

    it('la copia publicada vale por su borrador, una sola vez', () => {
        const out = linkableSermonsFor([
            s({ id: 'copia', status: 'published', sourceSermonId: 'borrador', bibleReferences: ['Jonás 1:1-3'] }),
            s({ id: 'borrador', wizardProgress: { passage: 'Jonás 1:1-3' } }),
        ], 'Jonás 1:1-3', 'serie', new Set());
        expect(out.map(x => x.id)).toEqual(['borrador']);
    });

    it('si el borrador ya no está, se ofrece la copia', () => {
        const out = linkableSermonsFor([
            s({ id: 'copia', status: 'published', sourceSermonId: 'borrado', bibleReferences: ['Jonás 1:1-3'] }),
        ], 'Jonás 1:1-3', 'serie', new Set());
        expect(out.map(x => [x.id, x.passage])).toEqual([['copia', 'Jonás 1:1-3']]);
    });

    it('excluye los ya vinculados (también por su copia) y los archivados; marca los de otra serie', () => {
        const out = linkableSermonsFor([
            s({ id: 'vinculado' }),
            s({ id: 'copia', sourceSermonId: 'vinculado', status: 'published' }),
            s({ id: 'archivado', status: 'archived' }),
            s({ id: 'ajeno', seriesId: 'otra' }),
            s({ id: 'propio', seriesId: 'serie' }),
        ], 'Jonás 1:1-3', 'serie', new Set(['vinculado']));
        expect(out.map(x => [x.id, x.inOtherSeries])).toEqual([['ajeno', true], ['propio', false]]);
    });
});

describe('filterLinkableSermons', () => {
    it('busca por título o pasaje sin tildes', () => {
        const list = linkableSermonsFor([
            s({ id: 'a', title: 'La huida', wizardProgress: { passage: 'Jonás 1:1-3' } }),
            s({ id: 'b', title: 'El arrepentimiento', wizardProgress: { passage: 'Jonás 3:1-10' } }),
        ], 'Jonás 1:1-3', 'serie', new Set());
        expect(filterLinkableSermons(list, 'jonas 3').map(x => x.id)).toEqual(['b']);
        expect(filterLinkableSermons(list, 'HUIDA').map(x => x.id)).toEqual(['a']);
        expect(filterLinkableSermons(list, '  ')).toHaveLength(2);
    });
});

describe('linkableSermonsFor — borrador archivado (revisión adversarial)', () => {
    it('la copia de un borrador archivado se ofrece como sí misma, no como el archivado', () => {
        const out = linkableSermonsFor([
            s({ id: 'copia', status: 'published', sourceSermonId: 'archivado', bibleReferences: ['Jonás 1:1-3'] }),
            s({ id: 'archivado', status: 'archived' }),
        ], 'Jonás 1:1-3', 'serie', new Set());
        expect(out.map(x => x.id)).toEqual(['copia']);
    });
});
