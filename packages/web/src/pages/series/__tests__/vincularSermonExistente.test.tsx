import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';

/**
 * «Vincular sermón existente…» (#3 del ejercicio de Jonás 4:5-11): el sermón
 * de Jonás 1:1-3 se escribió antes de la serie y se vinculó a mano.
 */
const svc = vi.hoisted(() => ({
    getUserSermonSummaries: vi.fn(),
    updateSermon: vi.fn(),
    getPublishedVersions: vi.fn(),
    getSermon: vi.fn(),
    getSeries: vi.fn(),
    updateSeries: vi.fn(),
}));
vi.mock('@dosfilos/application', () => ({
    sermonService: {
        getUserSermonSummaries: svc.getUserSermonSummaries,
        updateSermon: svc.updateSermon,
        getPublishedVersions: svc.getPublishedVersions,
        getSermon: svc.getSermon,
    },
    seriesService: { getSeries: svc.getSeries, updateSeries: svc.updateSeries },
}));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({}) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LinkExistingSermonDialog } from '../components/LinkExistingSermonDialog';
import { useSeriesData } from '@/hooks/useSeriesData';

const d = (n: number) => new Date(2026, 8, n);

beforeEach(() => {
    Object.values(svc).forEach(f => f.mockReset());
});

describe('LinkExistingSermonDialog', () => {
    it('el del mismo pasaje primero; elegir la copia publicada vincula el borrador', async () => {
        svc.getUserSermonSummaries.mockResolvedValue([
            { id: 'rut', title: 'Rut', status: 'draft', updatedAt: d(20), bibleReferences: [], wizardProgress: { passage: 'Rut 1:1' } },
            { id: 'copia', title: 'La huida (publicado)', status: 'published', updatedAt: d(5), bibleReferences: ['Jonas 1:1-3'], sourceSermonId: 'borrador' },
            { id: 'borrador', title: 'La huida', status: 'draft', updatedAt: d(3), bibleReferences: [], wizardProgress: { passage: 'Jonas 1:1-3' } },
        ]);
        const onLink = vi.fn().mockResolvedValue(true);
        const onClose = vi.fn();
        render(
            <LinkExistingSermonDialog
                pericopeLabel="Jonás 1:1-3" pericopePassage="Jonás 1:1-3" seriesId="serie" userId="u1"
                linkedIds={new Set()} onLink={onLink} onClose={onClose}
            />,
        );
        const radios = await screen.findAllByRole('radio');
        expect(radios.map(r => r.textContent)).toEqual([
            expect.stringContaining('La huida'),
            expect.stringContaining('Rut'),
        ]);
        expect(screen.getByRole('button', { name: /confirm/ })).toBeDisabled();
        fireEvent.click(radios[0]!);
        fireEvent.click(screen.getByRole('button', { name: /confirm/ }));
        await waitFor(() => expect(onLink).toHaveBeenCalledWith('borrador'));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('un sermón de otra serie se ve pero no se puede elegir', async () => {
        svc.getUserSermonSummaries.mockResolvedValue([
            { id: 'ajeno', title: 'Ajeno', status: 'draft', updatedAt: d(1), bibleReferences: [], seriesId: 'otra' },
        ]);
        render(
            <LinkExistingSermonDialog
                pericopeLabel="x" pericopePassage="Jonás 1:1-3" seriesId="serie" userId="u1"
                linkedIds={new Set()} onLink={vi.fn()} onClose={vi.fn()}
            />,
        );
        expect(await screen.findByRole('radio')).toBeDisabled();
    });
});

describe('useSeriesData.handleLinkExisting', () => {
    it('escribe el borrador en la perícopa, sin duplicar draftIds, y la serie en el borrador y sus copias', async () => {
        const series = {
            id: 'serie',
            draftIds: ['b1'],
            sermonIds: [],
            metadata: { plannedSermons: [{ id: 'p1', title: 'Jonás 1', passage: 'Jonás 1:1-3' }, { id: 'p2', title: 'Jonás 2' }] },
        };
        svc.getSeries.mockResolvedValue(series);
        svc.getSermon.mockResolvedValue(null);
        svc.updateSeries.mockResolvedValue(undefined);
        svc.updateSermon.mockResolvedValue(undefined);
        svc.getPublishedVersions.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

        const { result } = renderHook(() => useSeriesData('serie'));
        await waitFor(() => expect(result.current.series).not.toBeNull());

        let ok = false;
        await act(async () => {
            ok = await result.current.handleLinkExisting({ id: 'p1', plannedSermonId: 'p1' } as never, 'b1');
        });
        expect(ok).toBe(true);
        const [, patch] = svc.updateSeries.mock.calls[0]!;
        expect(patch.draftIds).toEqual(['b1']);
        expect(patch.metadata.plannedSermons.map((p: { id: string; draftId?: string }) => [p.id, p.draftId])).toEqual([
            ['p1', 'b1'],
            ['p2', undefined],
        ]);
        expect(svc.updateSermon.mock.calls.map(c => c[0]).sort()).toEqual(['b1', 'c1', 'c2']);
        expect(svc.updateSermon).toHaveBeenCalledWith('b1', { seriesId: 'serie' });
    });
});
