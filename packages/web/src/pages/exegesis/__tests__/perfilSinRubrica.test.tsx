import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkProfile } from '@dosfilos/domain';

/**
 * TP #7 (#1), leído en producción: el perfil por defecto «TP Semanal» se
 * guardó antes de que guardar un perfil creara su plantilla y quedó con
 * `rubricTemplateId: null`. Al crear, `null` es «sin plantilla: la del
 * sistema», y el trabajo nació con 12 páginas y 13 fuentes.
 */
const perfil = {
    id: 'tp-semanal', displayName: 'TP Semanal', rubricTemplateId: null,
    exegeticalStrategy: 'dialectical', styleGuideId: null, cover: null,
} as unknown as WorkProfile;

const valorDelSelector: Array<string | null | undefined> = [];
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [perfil], defaultProfile: perfil }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({ createPaper: { isPending: false, mutateAsync: vi.fn() }, updatePaperCover: { mutateAsync: vi.fn() } }),
}));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [], defaultBrief: null }) }));
vi.mock('@/components/exegesis/PassagePicker', () => ({ PassagePicker: () => <div>pasaje</div> }));
vi.mock('@/components/exegesis/setup/RubricTemplatePicker', () => ({
    RubricTemplatePicker: ({ value }: { value: string | null | undefined }) => { valorDelSelector.push(value); return <div>rúbrica</div>; },
}));
vi.mock('@/components/exegesis/setup/AssignmentBriefPicker', () => ({ AssignmentBriefPicker: () => <div>consigna</div> }));
const { ExegesisCreatePage } = await import('../ExegesisCreatePage');

describe('un perfil sin rúbrica no impone la del sistema', () => {
    it('el selector queda en automático y la página lo avisa', () => {
        render(<MemoryRouter><ExegesisCreatePage /></MemoryRouter>);
        expect(valorDelSelector.at(-1)).toBeUndefined();
        expect(screen.getByText('paperSetup.workProfile.noRubric')).toBeInTheDocument();
    });
});
