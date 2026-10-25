import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * La frecuencia de la serie queda guardada (`metadata.frequency`, FASE_ENCUADRE_SERIE
 * U5) y SeriesForm la lee al recalcular las fechas, en lugar de arrancar
 * siempre en semanal. Las series viejas, sin ella, siguen en semanal.
 */
const svc = vi.hoisted(() => ({ getSeries: vi.fn(), updateSeries: vi.fn(), createSeriesFromPlan: vi.fn() }));
vi.mock('@dosfilos/application', () => ({ seriesService: svc }));
vi.mock('@dosfilos/infrastructure', () => ({ FirebaseStorageService: class {} }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/hooks/useUsageLimits', () => ({ useUsageLimits: () => ({ checkCanCreatePreachingPlan: vi.fn() }) }));
vi.mock('@/components/upgrade', () => ({ UpgradeRequiredModal: () => null }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }) }));
vi.mock('react-i18next', () => ({ Trans: () => null }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 's1' }), useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { SeriesForm } from '../SeriesForm';

const serie = (metadata: Record<string, unknown>) => ({
    id: 's1',
    title: 'Esdras',
    description: 'd',
    startDate: new Date(2026, 10, 1),
    metadata: {
        plannedSermons: [1, 2, 3].map((week) => ({
            id: `p${week}`, week, title: `S${week}`, description: '', passage: '', status: 'planned',
            scheduledDate: new Date(2026, 10, week),
        })),
        ...metadata,
    },
});

const fechasRecalculadas = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'form.steps.planning.recalcButton' }));
    await waitFor(() => expect(svc.updateSeries).toHaveBeenCalledTimes(1));
    const [, cambio] = svc.updateSeries.mock.calls[0]!;
    return {
        dias: cambio.metadata.plannedSermons.map((p: { scheduledDate: Date }) => (p.scheduledDate.getTime() - new Date(2026, 10, 1).getTime()) / 86_400_000),
        frequency: cambio.metadata.frequency,
    };
};

beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    svc.updateSeries.mockResolvedValue(undefined);
});

describe('SeriesForm lee la frecuencia guardada', () => {
    it('una serie quincenal recalcula cada 14 días y conserva su frecuencia', async () => {
        svc.getSeries.mockResolvedValue(serie({ frequency: 'biweekly' }));
        render(<SeriesForm />);
        const { dias, frequency } = await fechasRecalculadas();
        expect(dias.map(Math.round)).toEqual([0, 14, 28]);
        expect(frequency).toBe('biweekly');
    });

    it('una serie vieja sin frecuencia recalcula semanal, como siempre', async () => {
        svc.getSeries.mockResolvedValue(serie({}));
        render(<SeriesForm />);
        const { dias, frequency } = await fechasRecalculadas();
        expect(dias.map(Math.round)).toEqual([0, 7, 14]);
        expect(frequency).toBe('weekly');
    });
});
