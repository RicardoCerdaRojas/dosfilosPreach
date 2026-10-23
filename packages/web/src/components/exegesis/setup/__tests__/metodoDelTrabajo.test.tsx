import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Etapa 2, capa 3: el método de un trabajo ya creado (el TP #9 nació sin él). */
const execute = vi.fn().mockResolvedValue({});
vi.mock('@dosfilos/application', () => ({ exegesisService: { updatePaperMethod: { execute } } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { PaperMethodSelect } = await import('../PaperMethodSelect');

describe('PaperMethodSelect', () => {
    it('cambiar el método del trabajo lo guarda; «como siempre» manda null', async () => {
        render(<QueryClientProvider client={new QueryClient()}><PaperMethodSelect paper={{ id: 'tp9', exegeticalMethod: null } as never} /></QueryClientProvider>);
        const select = screen.getByLabelText('method.label') as HTMLSelectElement;
        expect(select.value).toBe('');
        fireEvent.change(select, { target: { value: 'mixed' } });
        await waitFor(() => expect(execute).toHaveBeenCalledWith({ ownerId: 'u1', paperId: 'tp9', method: 'mixed' }));
        fireEvent.change(select, { target: { value: '' } });
        await waitFor(() => expect(execute).toHaveBeenLastCalledWith({ ownerId: 'u1', paperId: 'tp9', method: null }));
    });
});
