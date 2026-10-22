import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/** Etapa 0: el hook pasaba al caso de uso todo menos el tipo. */
const execute = vi.fn().mockResolvedValue({ id: 'p1' });
vi.mock('@dosfilos/application', () => ({
    facultyService: {
        createProject: { execute },
        getProjects: { execute: vi.fn().mockResolvedValue([]) },
    },
}));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'es' } }) }));
const { useFacultyProjects } = await import('../useFacultyProjects');

describe('useFacultyProjects.createProject', () => {
    it('pasa el tipo elegido al caso de uso', async () => {
        const qc = new QueryClient();
        const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
        const { result } = renderHook(() => useFacultyProjects(), { wrapper });
        await result.current.createProject.mutateAsync({ title: 'Teología II', color: 'amber', type: 'study' });
        await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', title: 'Teología II', type: 'study' })));
    });
});
