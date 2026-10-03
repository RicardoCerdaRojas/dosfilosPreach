import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StepHeaderActions } from '../StepHeaderActions';

beforeEach(() => cleanup());

const conProveedores = (ui: React.ReactElement) => render(<MemoryRouter><TooltipProvider>{ui}</TooltipProvider></MemoryRouter>);

describe('StepHeaderActions — atajos en el encabezado del paso (#26)', () => {
    it('cada acción lleva su nombre como aria-label y se ejecuta', () => {
        const editar = vi.fn();
        conProveedores(<StepHeaderActions actions={[{ key: 'e', label: 'Editar contenido aceptado', icon: <span>e</span>, onClick: editar }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Editar contenido aceptado' }));
        expect(editar).toHaveBeenCalledTimes(1);
    });

    it('el clic no llega al encabezado, que colapsaría el paso', () => {
        const colapsar = vi.fn();
        conProveedores(
            <div onClick={colapsar}>
                <StepHeaderActions actions={[{ key: 'e', label: 'Regenerar', icon: <span>r</span>, onClick: () => undefined }]} />
            </div>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Regenerar' }));
        expect(colapsar).not.toHaveBeenCalled();
    });

    it('una acción deshabilitada no se ejecuta', () => {
        const regenerar = vi.fn();
        conProveedores(<StepHeaderActions actions={[{ key: 'r', label: 'Regenerar', icon: <span>r</span>, onClick: regenerar, disabled: true }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Regenerar' }));
        expect(regenerar).not.toHaveBeenCalled();
    });

    it('«Revisar citas» es un enlace', () => {
        conProveedores(<StepHeaderActions actions={[{ key: 'v', label: 'Revisar citas', icon: <span>v</span>, to: '/x' }]} />);
        expect(screen.getByRole('link', { name: 'Revisar citas' })).toHaveAttribute('href', '/x');
    });
});
