import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Publicar otra vez (#2 del ejercicio de Jonás): sin cambios no se crea nada;
 * con cambios se avisa que es la versión N antes de las compuertas.
 */
const m = vi.hoisted(() => ({
    updateSermon: vi.fn(),
    publicationStatus: vi.fn(),
    publishSermonAsCopy: vi.fn(),
    attempt: vi.fn(),
    confirm: vi.fn(),
    info: vi.fn(),
    navigate: vi.fn(),
}));
vi.mock('@dosfilos/application', () => ({
    sermonService: {
        updateSermon: m.updateSermon,
        publicationStatus: m.publicationStatus,
        publishSermonAsCopy: m.publishSermonAsCopy,
    },
    exegesisService: { verifySermonCitations: { execute: vi.fn() } },
}));
vi.mock('@/hooks/useSermonContraScan', () => ({ useSermonContraScan: () => ({ attempt: m.attempt }) }));
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: m.confirm, confirmDialog: null }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => m.navigate }));
vi.mock('sonner', () => ({ toast: { info: m.info, success: vi.fn(), error: vi.fn() } }));

import { PublicationUnchangedError } from '@dosfilos/domain';
import { useDraftPublishing } from '../useDraftPublishing';

const t = ((k: string, o?: { n?: number }) => (o?.n ? `${k}:${o.n}` : k)) as never;

function hook() {
    return renderHook(() =>
        useDraftPublishing({
            draft: { title: 'La huida', pastoralSeed: { centralIdea: 'Dios persigue al que huye.' } },
            exegesis: { passage: 'Jonás 1:4-16', keyWords: [] },
            sermonId: 'b1',
            userId: 'u1',
            getFullContent: () => 'contenido',
            reset: vi.fn(),
            t,
        }),
    ).result;
}

beforeEach(() => Object.values(m).forEach(f => f.mockReset()));

describe('useDraftPublishing — re-publicar', () => {
    it('sin cambios: avisa y no pasa a las compuertas', async () => {
        m.publicationStatus.mockResolvedValue({ change: 'unchanged', version: 3, lastCopyId: 'c2' });
        const r = hook();
        await act(() => r.current.publicar());
        // Guarda el contenido vigente ANTES de comparar: si no, compara el viejo.
        expect(m.updateSermon.mock.invocationCallOrder[0]!).toBeLessThan(m.publicationStatus.mock.invocationCallOrder[0]!);
        expect(m.info).toHaveBeenCalledWith('drafting.republish.unchanged', expect.anything());
        expect(m.attempt).not.toHaveBeenCalled();
        expect(m.confirm).not.toHaveBeenCalled();
    });

    it('con cambios: pregunta por la versión N; si dice que no, no sigue', async () => {
        m.publicationStatus.mockResolvedValue({ change: 'changed', version: 2, lastCopyId: 'c1' });
        m.confirm.mockResolvedValue(false);
        const r = hook();
        await act(() => r.current.publicar());
        expect(m.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'drafting.republish.newVersionTitle:2' }));
        expect(m.attempt).not.toHaveBeenCalled();
    });

    it('con cambios y confirmado, o la primera vez: sigue a las compuertas', async () => {
        m.publicationStatus.mockResolvedValue({ change: 'changed', version: 2, lastCopyId: 'c1' });
        m.confirm.mockResolvedValue(true);
        const r = hook();
        await act(() => r.current.publicar());
        expect(m.attempt).toHaveBeenCalledWith('b1', 'Dios persigue al que huye.');

        m.attempt.mockReset();
        m.confirm.mockReset();
        m.publicationStatus.mockResolvedValue({ change: 'first', version: 1, lastCopyId: null });
        await act(() => r.current.publicar());
        expect(m.confirm).not.toHaveBeenCalled();
        expect(m.attempt).toHaveBeenCalled();
    });

    it('si el servicio se niega por falta de cambios al publicar, avisa en vez de dar error', async () => {
        m.publishSermonAsCopy.mockRejectedValue(new PublicationUnchangedError('c2'));
        const r = hook();
        await act(() => r.current.publicarAhora());
        expect(m.info).toHaveBeenCalledWith('drafting.republish.unchanged', expect.anything());
        expect(m.navigate).not.toHaveBeenCalled();
    });
});
