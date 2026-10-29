import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * El escritorio del proyecto volvía al esqueleto después de un rato en otra
 * página (fundador, 2026-10-29): la biblioteca la escribe un escucha, sin
 * observadores, y React Query la borraba a los 5 minutos.
 */
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@dosfilos/application', () => ({
    libraryService: {
        getSystemResources: () => Promise.resolve([]),
        subscribeToUserResources: (_uid: string, onData: (r: unknown[]) => void) => { onData([{ id: 'r1', title: 'Ross' }]); return () => {}; },
    },
}));

const { useLibrarySync } = await import('../useLibrarySync');
const { libraryQueryKey } = await import('../useLibrary');

describe('la biblioteca no caduca de la caché', () => {
    it('REGRESIÓN: la lista que escribe el escucha no se borra a los 5 minutos', () => {
        vi.useFakeTimers();
        const client = new QueryClient();
        const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
        renderHook(() => useLibrarySync(), { wrapper });
        expect(client.getQueryData(libraryQueryKey('u1'))).toHaveLength(1);
        // Sin ningún `useQuery` mirándola, una hora después sigue ahí.
        vi.advanceTimersByTime(60 * 60_000);
        expect(client.getQueryData(libraryQueryKey('u1'))).toHaveLength(1);
        vi.useRealTimers();
    });
});
