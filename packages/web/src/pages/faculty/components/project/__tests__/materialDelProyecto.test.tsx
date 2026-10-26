import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * «Material producido» al final del escritorio (W2-A, §3.6): las acciones se
 * ven siempre (antes, solo al pasar el mouse: en el teléfono no existían),
 * se muestran las 5 más recientes con «Ver todo», y «Nuevo» es de contorno
 * (el único botón lleno del escritorio es «Ahora»).
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('../../../utils/exportMarkdown', () => ({ exportOutputMarkdown: vi.fn() }));
const { ProjectMaterialList, MATERIAL_VISIBLE } = await import('../ProjectMaterialList');

const nota = (i: number) => {
    const output = { id: `o${i}`, kind: 'note' as const, title: `Nota ${i}`, content: 'x', updatedAt: new Date(2026, 9, i), createdAt: new Date(2026, 9, i) };
    return { source: 'output' as const, id: output.id, title: output.title, updatedAt: output.updatedAt, kind: output.kind, output: output as never };
};

beforeEach(() => cleanup());

const montar = (n: number, extra: { onDeleteOutput?: () => void } = {}) => render(
    <MemoryRouter>
        <ProjectMaterialList
            items={Array.from({ length: n }, (_, i) => nota(i + 1))}
            isLoading={false}
            onCreateOutput={vi.fn()}
            onEditOutput={vi.fn()}
            onDeleteOutput={extra.onDeleteOutput ?? vi.fn()}
        />
    </MemoryRouter>,
);

describe('el material del proyecto', () => {
    it('muestra las 5 primeras y «Ver todo» despliega el resto', () => {
        montar(8);
        const lista = screen.getByRole('list');
        expect(within(lista).getAllByRole('listitem')).toHaveLength(MATERIAL_VISIBLE);
        const ver = screen.getByText('material.seeAll');
        expect(ver.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(ver);
        expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(8);
        expect(screen.getByText('material.seeLess')).toBeInTheDocument();
    });

    it('con 5 o menos no ofrece «Ver todo»', () => {
        montar(5);
        expect(screen.queryByText('material.seeAll')).toBeNull();
    });

    it('las acciones de cada material se ven siempre, con nombre accesible', () => {
        const onDeleteOutput = vi.fn();
        montar(1, { onDeleteOutput });
        const borrar = screen.getByRole('button', { name: 'material.actions.delete: Nota 1' });
        expect(borrar.closest('.opacity-0')).toBeNull();
        fireEvent.click(borrar);
        expect(onDeleteOutput).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'material.actions.downloadMarkdown: Nota 1' })).toBeInTheDocument();
    });

    it('«Nuevo» es de contorno: no compite con «Ahora»', () => {
        montar(0);
        expect(screen.getByText('material.newButton').closest('button')!.className).not.toMatch(/bg-foreground|bg-primary-solid/);
    });
});
