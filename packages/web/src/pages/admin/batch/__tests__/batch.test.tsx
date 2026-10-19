import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ordenarCandidatos, type CandidatoCrudo } from '@/lib/loteReport';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }));
const acciones = {
    comparar: { mutateAsync: vi.fn(async () => ({})) },
    aplicar: { mutateAsync: vi.fn(async () => ({ reemplazado: true, motivo: 'faltantes 3 → 0' })) },
};
vi.mock('@/hooks/admin/useBatchJobs', () => ({ useBatchActions: () => acciones }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { CandidatesTable } = await import('../CandidatesTable');
const { EstimateBar } = await import('../EstimateBar');

const crudo = (id: string, extra: Partial<CandidatoCrudo> = {}): CandidatoCrudo => ({
    id, titulo: id, autor: '', mimeType: 'application/pdf', sizeBytes: 1_000_000, pdfPageCount: 100, pageCount: 100,
    paginasFaltantes: null, textoEstructuradoVacio: false, extractionVersion: '6.0-gemini-cola', extractionModel: 'gemini-3.8-flash',
    textExtractionStatus: 'ready', reprocesadoEnLote: null, ...extra,
});

describe('panel del lote (PR 1)', () => {
    it('«Elegir los recomendados» y la casilla de un excluido deshabilitada', () => {
        const elegir = vi.fn();
        const candidatos = ordenarCandidatos([
            crudo('malo', { textoEstructuradoVacio: true }),
            crudo('publico', { extractionVersion: '6.0-thml-public-domain' }),
            crudo('ya', { paginasFaltantes: { total: 4, paginas: [] }, reprocesadoEnLote: { lote: 'b1', fecha: null, motivo: null } }),
        ]);
        render(<CandidatesTable candidatos={candidatos} elegidos={new Set()} onAlternar={vi.fn()} onElegirRecomendados={elegir} />);
        // El ya reprocesado no cuenta entre los recomendados.
        expect(screen.getByText('batch.candidates.subtitle:{"count":1}')).toBeTruthy();
        fireEvent.click(screen.getByText('batch.candidates.pickRecommended'));
        expect(elegir).toHaveBeenCalled();
        const publico = screen.getByTestId('candidato-publico').querySelector('button[role="checkbox"]') as HTMLButtonElement;
        expect(publico.disabled).toBe(true);
    });

    it('la estimación y el comando con los ids elegidos', () => {
        const elegidos = ordenarCandidatos([crudo('a', { pdfPageCount: 500 }), crudo('b', { pdfPageCount: 500, sizeBytes: 90 * 1024 * 1024 })]);
        render(<EstimateBar elegidos={elegidos} />);
        const caja = screen.getByTestId('estimacion-del-lote');
        expect(caja.textContent).toContain('"count":1000');
        expect(caja.textContent).toMatch(/preparar lote-\d{4}-\d{2}-\d{2} --ids a,b/);
        expect(caja.textContent).toContain('batch.estimate.large');
    });
});

const { BatchJobCard } = await import('../BatchJobCard');
const cero = { pendiente: 0, ok: 0, fallo: 0, incompleto: 0, reemplazado: 0, abandonado: 0 };
const sinAplicar = { listo: false, incompletos: 0, comparacion: null, comparacionVieja: false, aplicado: null };
const resumen = (extra: Record<string, unknown> = {}) => ({
    id: 'b6', estado: 'listo' as const, motivo: null, creado: Date.UTC(2026, 9, 17), actualizado: 0, creadoPorEmail: 'a@x', dueno: 'u',
    estimadoUsd: 0.5, usd: 0.42, paginas: 35, rondas: [{ numero: 1, estadoJob: 'JOB_STATE_SUCCEEDED', leida: true, tramos: 3 }],
    tramos: { ...cero, ok: 2, fallo: 1 }, paginasConFallas: 20,
    libros: [{ rid: 'A', titulo: 'Libro A', estado: 'saltado' as const, motivo: 'el PDF pide contraseña', paginas: null, tramos: cero, fallas: [], ...sinAplicar }],
    puedeReintentar: true, puedeCancelar: false, ...extra,
});

describe('panel del lote (PR 2)', () => {
    it('«Preparar lote» confirma el costo y lanza con el nombre elegido', () => {
        const lanzar = vi.fn();
        const elegidos = ordenarCandidatos([crudo('a', { pdfPageCount: 500, extractionVersion: '3.0-llamaparse' })]);
        render(<EstimateBar elegidos={elegidos} onLanzar={lanzar} />);
        fireEvent.change(screen.getByLabelText('batch.estimate.name'), { target: { value: 'Hebreo 2' } });
        fireEvent.click(screen.getByText('batch.launch.button'));
        expect(lanzar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText(/^batch\.launch\.confirm:/));
        expect(lanzar).toHaveBeenCalledWith('hebreo-2', expect.any(Number));
        expect(lanzar.mock.calls[0]![1]).toBeGreaterThan(0);
    });

    it('la tarjeta del lote: costo real, libro saltado y sólo los botones que valen', () => {
        const reintentar = vi.fn();
        render(<BatchJobCard lote={resumen()} onReintentar={reintentar} onCancelar={vi.fn()} ocupado={false} />);
        const tarjeta = screen.getByTestId('lote-b6');
        expect(tarjeta.textContent).toContain('batch.jobs.cost:{"usd":"$0.42","estimado":"$0.50"}');
        expect(tarjeta.textContent).toContain('batch.jobs.progress:{"ok":2,"total":3}');
        expect(screen.queryByText('batch.jobs.cancel')).toBeNull();
        fireEvent.click(screen.getByText('batch.jobs.retry:{"count":1}'));
        // Reintentar gasta: pide confirmación con las páginas y el costo.
        expect(reintentar).not.toHaveBeenCalled();
        expect(screen.getByText(/^batch\.jobs\.retryBody:\{"count":20,"usd":"\$0\.04"\}$/)).toBeTruthy();
        fireEvent.click(screen.getByText(/^batch\.jobs\.retryConfirm:/));
        expect(reintentar).toHaveBeenCalled();
    });

    it('cancelar pide confirmación', () => {
        const cancelar = vi.fn();
        render(<BatchJobCard lote={resumen({ estado: 'en-curso', puedeReintentar: false, puedeCancelar: true })} onReintentar={vi.fn()} onCancelar={cancelar} ocupado={false} />);
        fireEvent.click(screen.getByText('batch.jobs.cancel'));
        expect(cancelar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('batch.jobs.cancelConfirm'));
        expect(cancelar).toHaveBeenCalled();
    });
});

const { BatchBooksTable } = await import('../BatchBooksTable');
const { aplicablesSinPreguntar } = await import('@/lib/loteReport');
const comparacion = (reemplazar: boolean) => ({
    reemplazar, motivo: reemplazar ? 'faltantes 3 → 0' : 'no mejora nada', rellenadas: 2, rondasLeidas: 1, calculada: 0,
    actual: { faltantes: 3, hebreo: 0, griego: 10, textoVacio: false }, nueva: { faltantes: 0, hebreo: 0, griego: 12, textoVacio: false },
});
const libro = (rid: string, extra: Record<string, unknown> = {}) => ({
    rid, titulo: `Libro ${rid}`, estado: 'preparado' as const, motivo: null, paginas: 10, tramos: { ...cero, ok: 1 }, fallas: [],
    ...sinAplicar, listo: true, ...extra,
});

describe('panel del lote (PR 3): comparar y aplicar', () => {
    it('«Aplicar los que mejoran» toma sólo lo seguro', () => {
        const libros = [
            libro('ok', { comparacion: comparacion(true) }),
            libro('noMejora', { comparacion: comparacion(false) }),
            libro('vieja', { comparacion: comparacion(true), comparacionVieja: true }),
            libro('fallas', { comparacion: comparacion(true), incompletos: 2 }),
            libro('sinComparar'),
            libro('hecho', { comparacion: comparacion(true), aplicado: { fecha: 0, reemplazado: true, motivo: 'x' } }),
        ];
        expect(aplicablesSinPreguntar(libros).map(b => b.rid)).toEqual(['ok']);
    });

    it('la comparación muestra los números; con tramos que fallaron, aplicar pide confirmación y la manda', async () => {
        acciones.aplicar.mutateAsync.mockClear();
        const lote = resumen({ libros: [libro('X', { comparacion: comparacion(true), incompletos: 2 })] });
        render(<BatchBooksTable lote={lote} />);
        const fila = screen.getByTestId('libro-X');
        expect(fila.textContent).toContain('batch.apply.numbers:{"faltan":"3 → 0","hebreo":"0 → 0","griego":"10 → 12"}');
        expect(fila.textContent).toContain('batch.apply.filled:{"count":2}');
        fireEvent.click(screen.getByText('batch.apply.apply'));
        expect(acciones.aplicar.mutateAsync).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('batch.apply.incompleteConfirm'));
        await vi.waitFor(() => expect(acciones.aplicar.mutateAsync).toHaveBeenCalledWith({ loteId: 'b6', rid: 'X', aceptarIncompletos: true }));
    });

    it('aplicado: verde y sin botones; «no mejoraba» sin ronda nueva: neutro y sin botones', () => {
        render(<BatchBooksTable lote={resumen({ libros: [
            libro('Y', { listo: false, aplicado: { fecha: 0, reemplazado: false, motivo: 'no mejora' } }),
            libro('Z', { listo: false, aplicado: { fecha: 0, reemplazado: true, motivo: 'faltantes 3 → 0' } }),
        ] })} />);
        expect(screen.getByTestId('libro-Y').textContent).toContain('batch.apply.unchanged');
        expect(screen.getByTestId('libro-Z').textContent).toContain('batch.apply.applied');
        expect(screen.queryByText('batch.apply.apply')).toBeNull();
    });

    it('dice qué páginas conservan el texto anterior y resume las fallas largas', () => {
        const conGriego = { ...comparacion(true), conservadas: [301, 302, 319].map(p => ({ pagina: p, escritura: 'griego' as const, antes: 60, despues: 8 })) };
        const fallas = Array.from({ length: 8 }, (_, i) => `${i * 20 + 1}–${i * 20 + 20}: sin leer: ${i * 20 + 2}`);
        render(<BatchBooksTable lote={resumen({ libros: [libro('S', { comparacion: conGriego, fallas, tramos: { ...cero, ok: 3, incompleto: 16 } })] })} />);
        const fila = screen.getByTestId('libro-S');
        expect(fila.textContent).toContain('batch.apply.keptPages:{"count":3,"paginas":"301, 302, 319"}');
        expect(fila.textContent).toContain('batch.apply.moreSections:{"count":13}');
        expect(fila.textContent).not.toContain('61–80');
    });

    it('muestra el autor: el del lote o, si el lote es viejo, el de la biblioteca', () => {
        render(<BatchBooksTable lote={resumen({ libros: [libro('N', { autor: 'Schreiner' }), libro('V')] })} autores={new Map([['V', 'Calvino'], ['N', 'otro']])} />);
        expect(screen.getByTestId('libro-N').textContent).toContain('Schreiner');
        expect(screen.getByTestId('libro-N').textContent).not.toContain('otro');
        expect(screen.getByTestId('libro-V').textContent).toContain('Calvino');
    });
});

