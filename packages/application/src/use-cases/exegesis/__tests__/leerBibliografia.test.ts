import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Estado del arte: leer la bibliografía del curso se cobra del plan, como las demás lecturas. */
const reserva = { markLlmContacted: vi.fn(), refundIfPreLlm: vi.fn(async () => undefined) };
const open = vi.fn(async () => reserva);
vi.mock('../../../services/ExegesisCreditReservation', () => ({ ExegesisCreditReservation: { open } }));
const { ExtractProjectBibliographyUseCase } = await import('../ExtractProjectBibliographyUseCase');

beforeEach(() => { vi.clearAllMocks(); });

describe('ExtractProjectBibliographyUseCase', () => {
    it('abre la reserva de la operación, lee y devuelve sin entradas vacías', async () => {
        const extractor = { extract: vi.fn(async () => ({ entries: [{ title: 'Moo', requirement: 'required' }, { title: '  ', requirement: 'recommended' }], requirements: 'Mínimo 100 páginas de artículos', prohibitions: null })) };
        const res = await new ExtractProjectBibliographyUseCase(extractor as never).execute({ ownerId: 'u', text: '  Moo, Douglas J. Comentario de la epístola de Santiago.  ', language: 'es' });
        expect(open).toHaveBeenCalledWith('u', 'extractProjectBibliography');
        expect(reserva.markLlmContacted).toHaveBeenCalled();
        expect(extractor.extract).toHaveBeenCalledWith({ text: 'Moo, Douglas J. Comentario de la epístola de Santiago.', image: null, language: 'es' });
        expect(res.entries.map(e => e.title)).toEqual(['Moo']);
    });

    it('sin texto ni imagen no cobra nada', async () => {
        const extractor = { extract: vi.fn() };
        await expect(new ExtractProjectBibliographyUseCase(extractor as never).execute({ ownerId: 'u', text: ' ', language: 'es' })).rejects.toThrow(/nada que leer/);
        expect(open).not.toHaveBeenCalled();
    });

    it('con solo una imagen lee; si la lectura falla, se intenta devolver la reserva', async () => {
        const extractor = { extract: vi.fn(async () => { throw new Error('503'); }) };
        await expect(new ExtractProjectBibliographyUseCase(extractor as never).execute({ ownerId: 'u', text: '', image: { mimeType: 'image/png', base64: 'AAA' }, language: 'es' })).rejects.toThrow('503');
        expect(reserva.refundIfPreLlm).toHaveBeenCalled();
    });
});
