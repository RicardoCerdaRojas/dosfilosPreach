import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../lemmaFrequency', () => ({
    loadOtFrequency: async () => ({ '2347': 24, '7451': 667 }),
    loadNtFrequency: async () => ({}),
}));

import { useLexiconSuggestion } from '../useLexiconSuggestion';

/** Revisión adversarial de B2/B3. */
function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useLexiconSuggestion', () => {
    it('encuentra la entrada aunque el análisis escriba el lema sin vocales', async () => {
        const { result } = renderHook(() => useLexiconSuggestion({
            kind: 'lexicon', hebrew: true,
            lemmas: [{ lemma: 'חוּס', term: 'חַסְתָּ', occurrences: 1, firstVerse: '4:10', strong: 2347 }],
            lemmaProposals: [{ lemma: 'חוס', sheets: [{ sheet: 300, hits: 4 }] }] as never,
            sectionProposals: [], pages: [{ sheet: 300, chunkIndices: [0], section: null, firstLine: '', charCount: 4000 }] as never,
        }), { wrapper });
        await waitFor(() => expect(result.current).not.toBeNull());
        expect(result.current!.picked.map(p => p.sheet)).toEqual([300]);
        expect(result.current!.notFound).toEqual([]);
        // Las tablas cuentan un solo testamento; el texto tiene que decir cuál.
        expect(result.current!.frequencyCorpus).toBe('OT');
    });

    it('muchas entradas: ninguna queda fuera por un tope total', async () => {
        // Lemas distintos de verdad: `lemmaKey` sólo mira las consonantes.
        const letras = 'אבגדהוזחטיכלמנסעפצקרשת';
        const lemmas = Array.from({ length: 40 }, (_, i) => {
            const l = `${letras[i % 22]}${letras[Math.floor(i / 22) + 3]}ר`;
            return { lemma: l, term: l, occurrences: 1, firstVerse: '4:6', strong: 9000 + i };
        });
        const { result } = renderHook(() => useLexiconSuggestion({
            kind: 'lexicon', hebrew: true, lemmas,
            lemmaProposals: lemmas.map((l, i) => ({ lemma: l.lemma, sheets: [{ sheet: 100 + i, hits: 1 }] })) as never,
            sectionProposals: [],
            pages: lemmas.map((_, i) => ({ sheet: 100 + i, chunkIndices: [i], section: null, firstLine: '', charCount: 4500 })) as never,
        }), { wrapper });
        await waitFor(() => expect(result.current).not.toBeNull());
        expect(result.current!.picked).toHaveLength(40);
        expect(result.current!.leftOut).toEqual([]);
    });
});
