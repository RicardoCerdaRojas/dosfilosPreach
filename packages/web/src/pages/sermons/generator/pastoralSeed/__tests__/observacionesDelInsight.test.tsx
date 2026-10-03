import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { InsightStepData, PastoralSeed } from '@dosfilos/domain';
import { InsightStep } from '../InsightStep';

/**
 * Las observaciones del Insight (#30 del ejercicio de Jonás 4:5-11): el
 * fundador escribió en la «Pregunta abierta» creyendo que era la caja de las
 * observaciones, porque éstas eran sólo un botón «Agregar».
 */
vi.mock('@/i18n', () => ({
    useTranslation: () => ({
        t: (key: string, o?: Record<string, unknown>) => (o?.n ? `${key}:${o.n}` : o?.ready !== undefined ? `${o.ready}/${o.total}` : key),
    }),
}));
vi.mock('@/hooks/useInlineCoreTripwire', () => ({
    useInlineCoreTripwire: () => ({ check: () => {}, warning: null, dismiss: () => {} }),
}));
vi.mock('../stepTimer', () => ({ useStepTimer: () => {} }));
vi.mock('../StepShell', () => ({
    StepShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../StepHelp', () => ({
    StepHelp: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const LARGA = 'Dios prepara la planta para enseñarle a Jonás algo.';

function renderStep(observations: string[], onChange = vi.fn()) {
    const data = {
        centralIdea: '', observations, openQuestion: '', pastoralAnecdote: '', doxologicalApplication: '',
    } as unknown as InsightStepData;
    render(
        <InsightStep
            passage="Jonás 4:5-11"
            seed={{} as PastoralSeed}
            data={data}
            onChange={onChange}
            onPasteEvent={() => {}}
        />,
    );
    return onChange;
}

const caja = (n: number) => screen.getByLabelText(`insightStep.observations.slotLabel:${n}`);

describe('InsightStep — observaciones', () => {
    it('sin nada escrito muestra las 3 cajas del mínimo, sin papelera', () => {
        renderStep([]);
        expect(caja(1)).toBeTruthy();
        expect(caja(2)).toBeTruthy();
        expect(caja(3)).toBeTruthy();
        expect(screen.queryByLabelText(/observations.slotLabel:4/)).toBeNull();
        expect(screen.queryByRole('button', { name: /observations.remove/ })).toBeNull();
        expect(screen.getByText('0/3')).toBeTruthy();
    });

    it('escribir en la tercera guarda las tres posiciones', () => {
        const onChange = renderStep([]);
        fireEvent.change(caja(3), { target: { value: LARGA } });
        expect(onChange).toHaveBeenCalledWith({ observations: ['', '', LARGA] });
    });

    it('«Agregar otra» suma una cuarta y entonces aparece la papelera', () => {
        const onChange = renderStep([LARGA, LARGA, LARGA]);
        expect(screen.getByText('3/3')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /observations.remove/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'insightStep.observations.add' }));
        expect(onChange).toHaveBeenCalledWith({ observations: [LARGA, LARGA, LARGA, ''] });
    });

    it('una cuarta vacía hace «3/4»: el paso todavía no pasa', () => {
        renderStep([LARGA, LARGA, LARGA, '']);
        expect(screen.getByText('3/4')).toBeTruthy();
        expect(screen.getByText('3/4').className).not.toContain('text-success');
    });

    it('con cuatro se puede quitar cualquiera', () => {
        const onChange = renderStep(['a', LARGA, 'c', 'd']);
        fireEvent.click(screen.getByRole('button', { name: 'insightStep.observations.remove:1' }));
        expect(onChange).toHaveBeenCalledWith({ observations: [LARGA, 'c', 'd'] });
    });

    it('la caja de la pregunta abierta tiene su propia etiqueta', () => {
        renderStep([]);
        expect(screen.getByLabelText('insightStep.openQuestion.label')).not.toBe(caja(1));
    });
});
