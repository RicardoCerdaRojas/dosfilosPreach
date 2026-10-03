import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pedidos: string[][] = [];
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => async (p: { terms: string[] }) => {
        pedidos.push(p.terms);
        return { data: { byTerm: Object.fromEntries(p.terms.map(t => [t, [{ sheet: 1, count: 1, snippet: '', section: null }]])) } };
    },
}));

const { searchLemmasInDocument, LEMMA_TERMS_PER_CALL } = await import('../DocumentPageIndexClient');

/** Revisión adversarial de B2: pasados 150 términos, el resto se perdía en silencio. */
describe('searchLemmasInDocument', () => {
    it('un capítulo entero de lemas llega completo, en tandas', async () => {
        const terms = Array.from({ length: LEMMA_TERMS_PER_CALL + 40 }, (_, i) => `lema${i}`);
        const r = await searchLemmasInDocument('bdb', terms);
        expect(Object.keys(r)).toHaveLength(terms.length);
        expect(pedidos.map(p => p.length)).toEqual([LEMMA_TERMS_PER_CALL, 40]);
    });
});

describe('lemas en tandas — paridad con searchDocumentText', () => {
    it('la tanda no pasa el MAX_TERMS de la callable', () => {
        const src = readFileSync(join(__dirname, '../../../../functions/src/library/documentTextSearch.ts'), 'utf8');
        const tope = Number(src.match(/const MAX_TERMS = (\d+)/)?.[1]);
        expect(tope).toBeGreaterThan(0);
        expect(LEMMA_TERMS_PER_CALL).toBeLessThanOrEqual(tope);
    });
});
