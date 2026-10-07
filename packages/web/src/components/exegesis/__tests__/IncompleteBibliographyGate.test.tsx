import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ExegeticalPaper } from '@dosfilos/domain';
import type { PaperBibliographyRow } from '@/hooks/exegesis/usePaperBibliography';

/**
 * Las fichas incompletas se ven ANTES de descargar (TP #6, 2026-10-07): el
 * Word casi se entrega con «[FICHA INCOMPLETA…]» porque el aviso llegaba
 * después, como un mensaje pasajero.
 */
let filas: PaperBibliographyRow[] = [];
vi.mock('@/hooks/exegesis/usePaperBibliography', () => ({ usePaperBibliography: () => filas }));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    }),
}));
vi.mock('../BibliographyEditDialog', () => ({
    BibliographyEditDialog: ({ displayLabel }: { displayLabel: string }) => <div>ficha de {displayLabel}</div>,
}));

const { IncompleteBibliographyGate } = await import('../IncompleteBibliographyGate');

const fila = (id: string, label: string, missing: PaperBibliographyRow['missing']): PaperBibliographyRow =>
    ({ sourceId: id, resourceId: `r-${id}`, citationKey: label, displayLabel: label, data: null, missing, editable: true }) as PaperBibliographyRow;

const paper = {} as ExegeticalPaper;

beforeEach(() => cleanup());

describe('las fichas incompletas antes de exportar', () => {
    it('nombra cada libro incompleto y lo que le falta, en el idioma de la interfaz', () => {
        filas = [fila('a', 'Adamson', ['city', 'publisher', 'year']), fila('m', 'Mayor', [])];
        render(<IncompleteBibliographyGate paper={paper} open onCancel={vi.fn()} onExport={vi.fn()} />);
        expect(screen.getByText('Adamson')).toBeInTheDocument();
        // Mayor estaba completa: no se lista.
        expect(screen.queryByText('Mayor')).not.toBeInTheDocument();
        expect(screen.getByText(/detail\.bibliography\.fields\.city/)).toBeInTheDocument();
    });

    it('tocar un libro abre su ficha ahí mismo', () => {
        filas = [fila('a', 'Adamson', ['year'])];
        render(<IncompleteBibliographyGate paper={paper} open onCancel={vi.fn()} onExport={vi.fn()} />);
        fireEvent.click(screen.getByText('Adamson'));
        expect(screen.getByText('ficha de Adamson')).toBeInTheDocument();
    });

    it('«Exportar igual» exporta; «Cancelar» no', () => {
        filas = [fila('a', 'Adamson', ['year'])];
        const onExport = vi.fn();
        const onCancel = vi.fn();
        render(<IncompleteBibliographyGate paper={paper} open onCancel={onCancel} onExport={onExport} />);
        fireEvent.click(screen.getByText('detail.bibliography.gate.cancel'));
        expect(onExport).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('detail.bibliography.gate.exportAnyway'));
        expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('completadas las fichas, el botón deja de decir «igual»', () => {
        filas = [fila('a', 'Adamson', ['year'])];
        const { rerender } = render(<IncompleteBibliographyGate paper={paper} open onCancel={vi.fn()} onExport={vi.fn()} />);
        filas = [fila('a', 'Adamson', [])];
        rerender(<IncompleteBibliographyGate paper={paper} open onCancel={vi.fn()} onExport={vi.fn()} />);
        expect(screen.getByText('detail.bibliography.gate.export')).toBeInTheDocument();
        // El libro sigue en la lista, ahora en verde: se ve que se completó.
        expect(screen.getByText('Adamson')).toBeInTheDocument();
    });
});
