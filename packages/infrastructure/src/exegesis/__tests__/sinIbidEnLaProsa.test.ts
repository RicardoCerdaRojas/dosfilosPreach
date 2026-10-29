import { describe, it, expect } from 'vitest';
import type { StyleGuideManifest } from '@dosfilos/domain';
import { DeterministicStyleFormatter } from '../DeterministicStyleFormatter';

/**
 * TI #2 del Salmo 23: la prosa salía con «(Ibid., 567)», que el verificador
 * no resuelve (una alarma por cada uno). El «Ibid.» lo pone el exportador
 * sobre el orden final de las notas; la prosa cita siempre con el autor.
 */
const manifest = {
    footnotes: {
        firstMentionTemplate: '{author}, "{title}", {pages}',
        subsequentMentionTemplate: '{authorShort}, {pages}',
        examples: [],
        ibid: { enabled: true, label: 'Ibid.', allowPageOverride: true },
    },
} as unknown as StyleGuideManifest;

const ross = {
    corpusId: 'r', citationKey: 'Ross', fullAuthor: 'Allen P. Ross', authorSurnameFirst: 'Ross, Allen P.',
    fullTitle: 'A Commentary on the Psalms', shortTitle: 'Commentary on the Psalms', publisher: null, city: null, year: null, volume: null,
};

describe('el formateador de la prosa', () => {
    it('REGRESIÓN: dos citas seguidas a Ross no producen «Ibid.», aunque la guía lo admita', () => {
        const out = new DeterministicStyleFormatter().format({
            markdown: 'Uno (Ross, "A Commentary on the Psalms", p. 566). Dos (Ross, "A Commentary on the Psalms", p. 567).',
            manifest, citableSources: [ross], priorFootnoteAnchors: [],
        } as never);
        expect(out.markdown, out.markdown).not.toMatch(/Ibid/);
        // La segunda va con la forma abreviada, con su autor y su página.
        expect(out.markdown.split('Dos ')[1]).toMatch(/^\(Ross[^)]*567\)/);
    });
});
