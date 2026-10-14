import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/**
 * Fase F, F5: en el selector de hojas se busca en el libro y se va a una
 * página impresa. En el TP #7 hubo que calcular «hoja = impresa + 79» a mano.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
const buscados: string[] = [];
vi.mock('@/hooks/exegesis/useDocumentTextSearch', () => ({
    useDocumentTextSearch: (_id: string, term: string) => {
        buscados.push(term);
        return term.trim().length >= 2
            ? { isLoading: false, isError: false, data: { truncated: false, hits: [{ sheet: 617, count: 1, snippet: '2. Dativus Commodi vel Incommodi…', section: 'The Cases' }] } }
            : { isLoading: false, isError: false, data: undefined };
    },
}));
const { BuscarEnElLibro } = await import('../BuscarEnElLibro');

beforeEach(() => cleanup());

const montar = () => {
    const onGo = vi.fn(); const onSearchTerm = vi.fn();
    render(<BuscarEnElLibro resourceId="res-rob" numbering={null} printedPageOffset={-79} currentSheet={570} onGo={onGo} onSearchTerm={onSearchTerm} />);
    return { onGo, onSearchTerm };
};

describe('BuscarEnElLibro', () => {
    it('«Ir a p. 534» lleva a la hoja 613 con el desfase del libro', () => {
        const { onGo } = montar();
        const ir = screen.getByLabelText('citationViewer.goToPage');
        fireEvent.change(ir, { target: { value: '534' } });
        fireEvent.submit(ir.closest('form')!);
        expect(onGo).toHaveBeenCalledWith(613);
    });

    it('algo que no es un número no navega y lo dice', () => {
        const { onGo } = montar();
        const ir = screen.getByLabelText('citationViewer.goToPage');
        fireEvent.change(ir, { target: { value: 'abc' } });
        fireEvent.submit(ir.closest('form')!);
        expect(onGo).not.toHaveBeenCalled();
        expect(screen.getByText('citationViewer.goToPageInvalid')).toBeInTheDocument();
    });

    it('buscar en el libro muestra dónde aparece, con su página impresa, y lleva ahí', () => {
        const { onGo, onSearchTerm } = montar();
        fireEvent.change(screen.getByLabelText('citationViewer.searchBookPlaceholder'), { target: { value: 'dativus commodi' } });
        expect(buscados.at(-1)).toBe('dativus commodi');
        expect(onSearchTerm).toHaveBeenLastCalledWith('dativus commodi');
        const hit = screen.getByText('citationViewer.hitPage {"printed":538,"sheet":617}');
        fireEvent.click(hit.closest('button')!);
        expect(onGo).toHaveBeenCalledWith(617);
    });

    it('con menos de dos letras no busca ni resalta', () => {
        const { onSearchTerm } = montar();
        fireEvent.change(screen.getByLabelText('citationViewer.searchBookPlaceholder'), { target: { value: 'd' } });
        expect(onSearchTerm).toHaveBeenLastCalledWith(null);
        expect(screen.queryByTestId('book-search-results')).toBeNull();
    });
});
