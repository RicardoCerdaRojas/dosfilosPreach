import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { ExegesisPaperSummary, ExegeticalPaper } from '@dosfilos/domain';

/**
 * TP #6 (Santiago 3, 2026-10-07): el encuadre prohibía las fuentes del TP #5
 * y nada en el corpus lo sabía. Las exclusiones son ahora un dato del
 * trabajo: se proponen desde la entrega anterior y se confirman.
 */
const guardar = vi.fn();
let resumenes: ExegesisPaperSummary[] = [];
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({
        papers: resumenes,
        updatePaperExcludedSources: { mutateAsync: guardar, isPending: false },
    }),
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    }),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
let heredables: unknown = null;
const heredar = vi.fn().mockResolvedValue({ creadas: 1, conPaginas: 0, porLema: 0, sinPropuesta: 0 });
vi.mock('@/hooks/exegesis/useCorpusHeredado', () => ({
    useCorpusHeredado: () => ({ propuesta: { data: heredables }, heredar: { mutateAsync: heredar, isPending: false }, avance: null }),
}));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [{ id: 'r-varner', author: 'William Varner' }] }) }));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));

const { ExcludedSourcesCard } = await import('../ExcludedSourcesCard');
const { useExcludedSourceConfirm } = await import('../useExcludedSourceConfirm');
const { usePaperExclusions } = await import('@/hooks/exegesis/usePaperExclusions');
const { HerenciaDeSerie } = await import('../HerenciaDeSerie');
const { renderHook } = await import('@testing-library/react');

const resumen = (id: string, dia: number, cited: string[], title: string) =>
    ({ id, title, passage: {}, createdAt: new Date(2026, 9, dia), citedSourceKeys: cited }) as unknown as ExegesisPaperSummary;
const trabajo = (excludedSources: ExegeticalPaper['excludedSources']) =>
    ({ id: 'tp6', excludedSources }) as unknown as ExegeticalPaper;

beforeEach(() => {
    cleanup();
    guardar.mockReset();
    resumenes = [resumen('tp5', 1, ['Varner', 'McCartney'], 'TP #5'), resumen('tp6', 6, [], 'TP #6')];
});

describe('la tarjeta de fuentes excluidas', () => {
    it('REGRESIÓN: sin confirmar, propone lo citado en la entrega anterior', () => {
        render(<ExcludedSourcesCard paper={trabajo(undefined)} />);
        expect(screen.getByText(/excluded\.proposal/)).toHaveTextContent('TP #5');
        expect(screen.getByLabelText('McCartney')).toBeChecked();
        expect(screen.getByLabelText('Varner')).toBeChecked();
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.excluded.accept'));
        expect(guardar).toHaveBeenCalledWith({
            paperId: 'tp6',
            excludedSources: [
                { key: 'McCartney', previousPaperTitle: 'TP #5' },
                { key: 'Varner', previousPaperTitle: 'TP #5' },
            ],
        });
    });

    it('«No hace falta» guarda la lista vacía, y confirmada ya no se vuelve a proponer', () => {
        render(<ExcludedSourcesCard paper={trabajo(undefined)} />);
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.excluded.decline'));
        expect(guardar).toHaveBeenCalledWith({ paperId: 'tp6', excludedSources: [] });
        cleanup();
        render(<ExcludedSourcesCard paper={trabajo([])} />);
        expect(screen.queryByText(/excluded\.proposal/)).not.toBeInTheDocument();
    });

    it('se agrega a mano y se quita', () => {
        const actuales = [{ key: 'Ropes', previousPaperTitle: 'TP #5' }];
        render(<ExcludedSourcesCard paper={trabajo(actuales)} />);
        fireEvent.change(screen.getByLabelText('paperSetup.subSteps.corpus.excluded.placeholder'), { target: { value: ' Robertson ' } });
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.excluded.add'));
        expect(guardar).toHaveBeenLastCalledWith({
            paperId: 'tp6',
            excludedSources: [...actuales, { key: 'Robertson', previousPaperTitle: null }],
        });
        fireEvent.click(screen.getByLabelText(/excluded\.remove/));
        expect(guardar).toHaveBeenLastCalledWith({ paperId: 'tp6', excludedSources: [] });
    });

    it('sin entrega anterior no propone nada', () => {
        resumenes = [resumen('tp6', 6, [], 'TP #6')];
        render(<ExcludedSourcesCard paper={trabajo(undefined)} />);
        expect(screen.queryByText(/excluded\.proposal/)).not.toBeInTheDocument();
    });
});

function Agregar({ hits, onAdd }: { hits: { key: string; previousPaperTitle: string | null }[]; onAdd: () => void }) {
    const { guard, dialog } = useExcludedSourceConfirm();
    return <><button onClick={() => guard(hits, onAdd)}>agregar</button>{dialog}</>;
}

describe('agregar una excluida', () => {
    it('una fuente que no está excluida se agrega sin preguntar', () => {
        const onAdd = vi.fn();
        render(<Agregar hits={[]} onAdd={onAdd} />);
        fireEvent.click(screen.getByText('agregar'));
        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('REGRESIÓN: una excluida pide confirmación; cancelar no la agrega, confirmar sí', () => {
        const onAdd = vi.fn();
        render(<Agregar hits={[{ key: 'Varner', previousPaperTitle: 'TP #5' }]} onAdd={onAdd} />);
        fireEvent.click(screen.getByText('agregar'));
        expect(onAdd).not.toHaveBeenCalled();
        expect(screen.getByText(/excluded\.confirmBody/)).toHaveTextContent('Varner');
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.excluded.confirmCancel'));
        expect(onAdd).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('agregar'));
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.excluded.confirmAdd'));
        expect(onAdd).toHaveBeenCalledTimes(1);
    });
});

describe('la propuesta y sus bordes (revisión)', () => {
    it('se excluyen sólo las marcadas: una gramática citada la vez pasada se puede desmarcar', () => {
        resumenes = [resumen('tp5', 1, ['Varner', 'Wallace'], 'TP #5'), resumen('tp6', 6, [], 'TP #6')];
        render(<ExcludedSourcesCard paper={trabajo(undefined)} />);
        fireEvent.click(screen.getByLabelText('Wallace'));
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.excluded.accept'));
        expect(guardar).toHaveBeenCalledWith({ paperId: 'tp6', excludedSources: [{ key: 'Varner', previousPaperTitle: 'TP #5' }] });
    });

    it('con la propuesta pendiente no se puede agregar a mano (la descartaría)', () => {
        render(<ExcludedSourcesCard paper={trabajo(undefined)} />);
        expect(screen.queryByLabelText('paperSetup.subSteps.corpus.excluded.placeholder')).not.toBeInTheDocument();
    });

    it('si guardar falla, lo escrito se queda', async () => {
        guardar.mockRejectedValueOnce(new Error('red'));
        render(<ExcludedSourcesCard paper={trabajo([])} />);
        const input = screen.getByLabelText('paperSetup.subSteps.corpus.excluded.placeholder');
        fireEvent.change(input, { target: { value: 'Robertson' } });
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.excluded.add'));
        await act(() => new Promise(r => setTimeout(r, 0)));
        expect(guardar).toHaveBeenCalledTimes(1);
        expect(input).toHaveValue('Robertson');
    });

    it('REGRESIÓN (revisión): sin confirmar, las listas ya tratan lo de la entrega anterior como excluido', () => {
        const { result } = renderHook(() => usePaperExclusions(trabajo(undefined)));
        expect(result.current.map(e => e.key)).toEqual(['McCartney', 'Varner']);
        // Confirmado (aunque vacío), manda lo confirmado.
        expect(renderHook(() => usePaperExclusions(trabajo([]))).result.current).toEqual([]);
    });
});

describe('la herencia de la serie (revisión)', () => {
    const fuente = (id: string, citationKey: string) =>
        ({ sourceLibraryResourceId: id, corpusId: id, sourceType: 'commentary-expository', chosenRole: null, displayLabel: citationKey, citationKey, deTrabajoId: 'tp5' });

    it('REGRESIÓN: la fuente excluida llega desmarcada, al final y marcada; traer no la incluye', async () => {
        heredables = { fuentes: [fuente('r-varner', 'Varner'), fuente('r-moo', 'Moo')], yaPresentes: 0 };
        const { container } = render(<HerenciaDeSerie paper={trabajo([{ key: 'Varner', previousPaperTitle: 'TP #5' }])} />);
        const filas = [...container.querySelectorAll('li')].map(li => li.textContent ?? '');
        expect(filas[0]).toContain('Moo');
        expect(filas[1]).toContain('Varner');
        const casillas = container.querySelectorAll('input[type=checkbox]');
        expect(casillas[0]).toBeChecked();
        expect(casillas[1]).not.toBeChecked();
        fireEvent.click(screen.getByText(/herencia\.cta/));
        await Promise.resolve();
        expect(heredar.mock.calls[0]![0].soloEstos).toEqual(['r-moo']);
    });

    it('marcarla a mano pide confirmación antes de traerla', () => {
        heredar.mockClear();
        heredables = { fuentes: [fuente('r-varner', 'Varner')], yaPresentes: 0 };
        const { container } = render(<HerenciaDeSerie paper={trabajo([{ key: 'Varner', previousPaperTitle: 'TP #5' }])} />);
        fireEvent.click(container.querySelector('input[type=checkbox]')!);
        fireEvent.click(screen.getByText(/herencia\.cta/));
        expect(heredar).not.toHaveBeenCalled();
        expect(screen.getByText(/excluded\.confirmBody/)).toBeInTheDocument();
    });
});

