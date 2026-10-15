import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Desde la fase TP #7 la sugerencia para «Versos» suma los tipos que exige la
 * rúbrica. Los trabajos guardados con la sugerencia anterior quedaban
 * marcados «personalizado» sin que nadie los tocara.
 */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ updateStepPlan: { mutateAsync: vi.fn(), isPending: false } }) }));
// La sugerencia nueva, como la arma `UpdateStepPlanUseCase.rubricDefaultEmphasis`.
vi.mock('@dosfilos/application', () => ({
    UpdateStepPlanUseCase: {
        rubricDefaultEmphasis: () => ({ emphasizedTypes: ['commentary-critical', 'grammar-syntax', 'commentary-expository'], deemphasizedTypes: [], citationOverrides: [] }),
    },
}));
const { StepKindEmphasisCard } = await import('../StepKindEmphasisCard');

const emphasis = (emphasizedTypes: string[]) => ({ emphasizedTypes, deemphasizedTypes: [], citationOverrides: [] });
const paper = (guardado: string[], anterior: string[] = ['commentary-critical', 'grammar-syntax']) => ({
    id: 'p',
    structuralExpectations: [{ section: 'verse', emphasizedTypes: anterior, justification: 'x' }],
    rubric: { provenance: 'user-edited', sourceRequirements: [{ sourceType: 'commentary-expository', minimum: 1 }] },
    stepPlan: { defaults: { verse: emphasis(guardado), introduction: emphasis([]), conclusion: emphasis([]) }, perStep: {} },
}) as never;

describe('la insignia «personalizado» del plan estructural', () => {
    it('no aparece con la sugerencia anterior', () => {
        render(<StepKindEmphasisCard paper={paper(['commentary-critical', 'grammar-syntax'])} kind="verse" icon={null} />);
        expect(screen.queryByText('paperSetup.subSteps.plan.savedHint')).not.toBeInTheDocument();
    });
    it('aparece con una elección propia', () => {
        render(<StepKindEmphasisCard paper={paper(['historical-background'])} kind="verse" icon={null} />);
        expect(screen.getByText('paperSetup.subSteps.plan.savedHint')).toBeInTheDocument();
    });
});

describe('vaciar a propósito sí es una elección', () => {
    it('con la sugerencia anterior vacía, un énfasis vacío se marca personalizado', () => {
        render(<StepKindEmphasisCard paper={paper([], [])} kind="verse" icon={null} />);
        expect(screen.getAllByText('paperSetup.subSteps.plan.savedHint').length).toBeGreaterThan(0);
    });
});
