import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

/**
 * Etapa 0 (2026-10-22): el tipo elegido al crear un proyecto se perdía en el
 * hook y todos los proyectos quedaban «General»; al editar uno sin tipo, se
 * guardaba «Sermón» sin que nadie lo pidiera.
 */
const createProject = vi.fn().mockResolvedValue({});
const updateProject = vi.fn().mockResolvedValue({});
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({
    useFacultyProjects: () => ({
        createProject: { mutateAsync: createProject, isPending: false },
        updateProject: { mutateAsync: updateProject, isPending: false },
        generateContext: { mutateAsync: vi.fn(), isPending: false },
    }),
}));
const { ProjectEditDialog } = await import('../ProjectEditDialog');

beforeEach(() => { cleanup(); vi.clearAllMocks(); });

const guardar = () => fireEvent.click(screen.getByRole('button', { name: /crear|guardar/i }));

describe('el tipo del proyecto', () => {
    it('al crear, viaja el tipo elegido', async () => {
        render(<ProjectEditDialog onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Serie').closest('button')!);
        fireEvent.change(screen.getByRole('textbox', { name: /nombre/i }), { target: { value: 'Serie 2 Pedro' } });
        guardar();
        await waitFor(() => expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ title: 'Serie 2 Pedro', type: 'series' })));
    });

    it('al editar un proyecto sin tipo no se le pone «Sermón»: queda «General» si no se elige otro', async () => {
        render(<ProjectEditDialog project={{ id: 'p1', userId: 'u', title: 'Teología II', color: 'amber' } as never} onClose={vi.fn()} />);
        guardar();
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        expect(updateProject.mock.calls[0]![0]).toMatchObject({ type: 'general' });
    });

    it('a un proyecto sin tipo se le puede elegir uno al editarlo (revisión de la etapa 0)', async () => {
        render(<ProjectEditDialog project={{ id: 'p1', userId: 'u', title: 'Teología II', color: 'amber' } as never} onClose={vi.fn()} />);
        fireEvent.click(screen.getByText('Estudio').closest('button')!);
        guardar();
        await waitFor(() => expect(updateProject).toHaveBeenCalledWith(expect.objectContaining({ type: 'study' })));
    });

    it('a un proyecto con tipo no se le ofrece cambiarlo ni se manda', async () => {
        render(<ProjectEditDialog project={{ id: 'p1', userId: 'u', title: 'Serie', color: 'amber', type: 'series' } as never} onClose={vi.fn()} />);
        expect(screen.queryByText('Tipo de proyecto')).toBeNull();
        guardar();
        await waitFor(() => expect(updateProject).toHaveBeenCalled());
        expect(updateProject.mock.calls[0]![0]).not.toHaveProperty('type');
    });
});

describe('«Nuevo proyecto» sin tipo elegido (regresión de #800)', () => {
    it('un initialType que no es un tipo (el evento del clic) no llega a guardarse', async () => {
        render(<ProjectEditDialog initialType={{ type: 'click' } as never} onClose={vi.fn()} />);
        fireEvent.change(screen.getByRole('textbox', { name: /nombre/i }), { target: { value: 'Teología III' } });
        guardar();
        await waitFor(() => expect(createProject).toHaveBeenCalled());
        expect(typeof createProject.mock.calls[0]![0].type).toBe('string');
    });
});
