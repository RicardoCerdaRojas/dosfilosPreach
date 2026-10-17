import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ordenarCandidatos, type CandidatoCrudo } from '@/lib/loteReport';

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }));
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
