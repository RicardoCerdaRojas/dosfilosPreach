import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LibraryResourceEntity } from '@dosfilos/domain';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
const { AvisosDeLaBiblioteca } = await import('../components/AvisosDeLaBiblioteca');
const { HistorialDeConsultas } = await import('../consultar/HistorialDeConsultas');

const base = { resources: [] as LibraryResourceEntity[], pendingCount: 0, extractingCount: 0, indexFailed: [] as LibraryResourceEntity[], failedCount: 0, isProcessing: false, onProcessAll: vi.fn(), onRetryIndexing: vi.fn() };

describe('avisos de la biblioteca en la barra', () => {
    it('sin avisos no aparece', () => {
        const { container } = render(<AvisosDeLaBiblioteca {...base} />);
        expect(container.innerHTML).toBe('');
    });
    it('cuenta los avisos activos (no los libros), y «por procesar» no cuenta mientras se procesa', () => {
        render(<AvisosDeLaBiblioteca {...base} pendingCount={5} extractingCount={2} failedCount={1} />);
        expect(screen.getByText('notices.pill:{"count":3}')).toBeTruthy();
    });
    it('mientras se procesa todo, el aviso de pendientes no suma', () => {
        render(<AvisosDeLaBiblioteca {...base} pendingCount={5} isProcessing />);
        expect(screen.queryByText(/notices\.pill/)).toBeNull();
    });
});

describe('historial plegable', () => {
    const props = { consultas: [], cargando: false, error: false, actualId: null, rotuloDeAlcance: () => '', onAbrir: vi.fn(), onBorrar: vi.fn() };
    it('desplegado: «Nueva» chico y el botón para plegarlo', () => {
        const plegar = vi.fn();
        const nueva = vi.fn();
        render(<HistorialDeConsultas {...props} onNueva={nueva} onPlegar={plegar} />);
        fireEvent.click(screen.getByText('consult.newShort'));
        expect(nueva).toHaveBeenCalled();
        fireEvent.click(screen.getByLabelText('consult.historyClose'));
        expect(plegar).toHaveBeenCalledWith(true);
    });
    it('plegado: en pantalla ancha un riel con abrir y nueva; en una angosta la lista sigue completa', () => {
        const plegar = vi.fn();
        render(<HistorialDeConsultas {...props} onNueva={vi.fn()} plegado onPlegar={plegar} />);
        // La lista completa existe, pero sólo se ve bajo `lg` (un iPad que gira no se queda sin historial).
        expect(screen.getByText('consult.historyEmpty').closest('.lg\\:hidden')).not.toBeNull();
        expect(screen.getByLabelText('consult.historyOpen').closest('nav')!.className).toMatch(/\bhidden\b.*\blg:flex\b/);
        fireEvent.click(screen.getByLabelText('consult.historyOpen'));
        expect(plegar).toHaveBeenCalledWith(false);
        expect(screen.getByLabelText('consult.new')).toBeTruthy();
    });
});
