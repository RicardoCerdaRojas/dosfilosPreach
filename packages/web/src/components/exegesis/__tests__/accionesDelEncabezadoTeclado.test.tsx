import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StepHeaderActions } from '../StepHeaderActions';

/**
 * Revisión adversarial de D2: Enter sobre un ícono del encabezado llegaba al
 * encabezado, que colapsaba el paso y cancelaba la acción con preventDefault.
 */
describe('StepHeaderActions — teclado', () => {
    it('Enter sobre un ícono no llega al encabezado', () => {
        const encabezado = vi.fn();
        render(
            <MemoryRouter>
                <div onKeyDown={encabezado}>
                    <StepHeaderActions actions={[{ key: 'aceptar', label: 'Aceptar', icon: <span>✓</span>, onClick: vi.fn() }]} />
                </div>
            </MemoryRouter>,
        );
        fireEvent.keyDown(screen.getByRole('button', { name: 'Aceptar' }), { key: 'Enter' });
        fireEvent.keyDown(screen.getByRole('button', { name: 'Aceptar' }), { key: ' ' });
        expect(encabezado).not.toHaveBeenCalled();
    });
});
