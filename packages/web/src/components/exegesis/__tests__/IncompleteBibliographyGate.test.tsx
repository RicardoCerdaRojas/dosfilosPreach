import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { BibliographyEntry, ExegeticalPaper } from '@dosfilos/domain';
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

/** Lo citado: la bibliografía que va a salir. */
const cita = (label: string, missing: BibliographyEntry['missing']): BibliographyEntry =>
    ({ citationKey: label, displayLabel: label, text: missing.length ? null : `${label}. Ficha.`, missing, data: null }) as unknown as BibliographyEntry;
const citasDe = (rows: PaperBibliographyRow[]) => rows.map(r => cita(r.citationKey, r.missing));

beforeEach(() => cleanup());

describe('las fichas incompletas antes de exportar', () => {
    it('nombra cada libro incompleto y lo que le falta, en el idioma de la interfaz', () => {
        filas = [fila('a', 'Adamson', ['city', 'publisher', 'year']), fila('m', 'Mayor', [])];
        render(<IncompleteBibliographyGate paper={paper} entries={citasDe(filas)} open onCancel={vi.fn()} onExport={vi.fn()} />);
        expect(screen.getByText('Adamson')).toBeInTheDocument();
        // Mayor estaba completa: no se lista.
        expect(screen.queryByText('Mayor')).not.toBeInTheDocument();
        expect(screen.getByText(/detail\.bibliography\.fields\.city/)).toBeInTheDocument();
    });

    it('tocar un libro abre su ficha ahí mismo', () => {
        filas = [fila('a', 'Adamson', ['year'])];
        render(<IncompleteBibliographyGate paper={paper} entries={citasDe(filas)} open onCancel={vi.fn()} onExport={vi.fn()} />);
        fireEvent.click(screen.getByText('Adamson'));
        expect(screen.getByText('ficha de Adamson')).toBeInTheDocument();
    });

    it('«Exportar igual» exporta; «Cancelar» no', () => {
        filas = [fila('a', 'Adamson', ['year'])];
        const onExport = vi.fn();
        const onCancel = vi.fn();
        render(<IncompleteBibliographyGate paper={paper} entries={citasDe(filas)} open onCancel={onCancel} onExport={onExport} />);
        fireEvent.click(screen.getByText('detail.bibliography.gate.cancel'));
        expect(onExport).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('detail.bibliography.gate.exportAnyway'));
        expect(onExport).toHaveBeenCalledTimes(1);
    });

    it('completadas las fichas, el botón deja de decir «igual»', () => {
        filas = [fila('a', 'Adamson', ['year'])];
        const { rerender } = render(<IncompleteBibliographyGate paper={paper} entries={citasDe(filas)} open onCancel={vi.fn()} onExport={vi.fn()} />);
        filas = [fila('a', 'Adamson', [])];
        rerender(<IncompleteBibliographyGate paper={paper} entries={citasDe(filas)} open onCancel={vi.fn()} onExport={vi.fn()} />);
        expect(screen.getByText('detail.bibliography.gate.export')).toBeInTheDocument();
        // El libro sigue en la lista, ahora en verde: se ve que se completó.
        expect(screen.getByText('Adamson')).toBeInTheDocument();
    });

    it('sólo cuenta lo citado: un libro del corpus sin citar no frena', () => {
        filas = [fila('a', 'Adamson', ['year']), fila('m', 'Mayor', [])];
        render(<IncompleteBibliographyGate paper={paper} entries={[cita('Mayor', [])]} open onCancel={vi.fn()} onExport={vi.fn()} />);
        expect(screen.queryByText('Adamson')).not.toBeInTheDocument();
        expect(screen.getByText('detail.bibliography.gate.export')).toBeInTheDocument();
    });

    it('un citado que ya no está en el corpus se nombra, sin ficha que abrir', () => {
        // Otra fuente sí está: el huérfano no debe abrir la ficha de ésa.
        filas = [fila('a', 'Adamson', ['year'])];
        render(<IncompleteBibliographyGate paper={paper} entries={[cita('Moo', ['year'])]} open onCancel={vi.fn()} onExport={vi.fn()} />);
        expect(screen.getByText('Moo')).toBeInTheDocument();
        expect(screen.getByText('detail.bibliography.gate.notInCorpus')).toBeInTheDocument();
        expect(screen.getByText('Moo').closest('button')).toBeDisabled();
    });
});

describe('la revisión antes de exportar en el mismo diálogo (fase «Lecciones del TI #2», etapa 2)', () => {
    const aviso = { kind: 'accent' as const, offset: 3, find: 'aqui', replace: 'aquí', context: 'el aqui no' };
    const revision = (over: Record<string, unknown> = {}) => ({
        findings: [aviso, { kind: 'unbalanced-paren' as const, offset: 20, find: 'Uno (dos', replace: null, context: 'Uno (dos' }],
        mechanicalCount: 1, blockedBy: null, isApplying: false,
        apply: vi.fn().mockResolvedValue(undefined), applyMechanical: vi.fn().mockResolvedValue(undefined),
        ...over,
    });

    it('lista los avisos del texto; «Aplicar» corrige el que tiene reemplazo y el que no, no lo ofrece', () => {
        filas = [];
        const r = revision();
        render(<IncompleteBibliographyGate paper={paper} entries={[]} open onCancel={vi.fn()} onExport={vi.fn()} review={r} />);
        expect(screen.getByText('detail.exportReview.title')).toBeInTheDocument();
        expect(screen.getAllByText('detail.exportReview.apply')).toHaveLength(1);
        fireEvent.click(screen.getByText('detail.exportReview.apply'));
        expect(r.apply).toHaveBeenCalledWith(aviso);
        fireEvent.click(screen.getByText(/detail\.exportReview\.applyMechanical/));
        expect(r.applyMechanical).toHaveBeenCalled();
        // Con avisos, el botón dice «Exportar igual».
        expect(screen.getByText('detail.bibliography.gate.exportAnyway')).toBeInTheDocument();
    });

    it('con el ensamble sin aceptar, explica por qué no corrige y no ofrece «Aplicar»', () => {
        filas = [];
        render(<IncompleteBibliographyGate paper={paper} entries={[]} open onCancel={vi.fn()} onExport={vi.fn()} review={revision({ blockedBy: 'difiere', mechanicalCount: 0 })} />);
        expect(screen.getByText('detail.exportReview.blockedStale')).toBeInTheDocument();
        expect(screen.queryByText('detail.exportReview.apply')).not.toBeInTheDocument();
    });

    it('los avisos que antes llegaban después de bajar (ensamble, portada) se ven antes', () => {
        filas = [];
        render(<IncompleteBibliographyGate paper={paper} entries={[]} open onCancel={vi.fn()} onExport={vi.fn()} warnings={['El Word saldrá sin portada']} />);
        expect(screen.getByText('El Word saldrá sin portada')).toBeInTheDocument();
        expect(screen.getByText('detail.exportReview.title')).toBeInTheDocument();
    });
});

describe('REVISIÓN: mientras se guarda una corrección no se exporta', () => {
    it('«Exportar igual» queda deshabilitado con una corrección en camino', () => {
        filas = [];
        const r = { findings: [{ kind: 'accent' as const, offset: 0, find: 'aqui', replace: 'aquí', context: 'aqui' }], mechanicalCount: 1, blockedBy: null, isApplying: true, apply: vi.fn(), applyMechanical: vi.fn() };
        render(<IncompleteBibliographyGate paper={paper} entries={[]} open onCancel={vi.fn()} onExport={vi.fn()} review={r} />);
        expect(screen.getByText('detail.bibliography.gate.exportAnyway').closest('button')).toBeDisabled();
    });
});
