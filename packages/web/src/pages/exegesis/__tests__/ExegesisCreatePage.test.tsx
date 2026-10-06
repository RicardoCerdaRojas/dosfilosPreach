import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { WorkProfile } from '@dosfilos/domain';

/**
 * La página de crear un trabajo con un PERFIL guardado (TP #6, 2026-10-06):
 * se caía en blanco con «Cannot access 'U' before initialization» porque
 * el perfil elegido se buscaba antes de declarar su estado. Con la lista
 * de perfiles vacía no fallaba: el `find` no llegaba a leerlo.
 */
const perfil = {
    id: 'tp-semanal',
    name: 'TP semanal griego NT',
    rubricTemplateId: null,
    exegeticalStrategy: 'dialectical',
    styleGuideId: null,
    cover: null,
} as unknown as WorkProfile;

let perfiles: WorkProfile[] = [];

vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}));

vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({
    useWorkProfiles: () => ({ profiles: perfiles, defaultProfile: perfiles[0] ?? null }),
}));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({
        createPaper: { isPending: false, mutateAsync: vi.fn() },
        updatePaperCover: { mutateAsync: vi.fn() },
    }),
}));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({
    useUserAssignmentBriefs: () => ({ briefs: [], defaultBrief: null }),
}));
vi.mock('@/components/exegesis/PassagePicker', () => ({ PassagePicker: () => <div>pasaje</div> }));
vi.mock('@/components/exegesis/setup/RubricTemplatePicker', () => ({ RubricTemplatePicker: () => <div>rúbrica</div> }));
vi.mock('@/components/exegesis/setup/AssignmentBriefPicker', () => ({ AssignmentBriefPicker: () => <div>consigna</div> }));

const { ExegesisCreatePage } = await import('../ExegesisCreatePage');

beforeEach(() => cleanup());

describe('crear un trabajo exegético', () => {
    it('REGRESIÓN: con un perfil de trabajo guardado, la página se abre (antes quedaba en blanco)', () => {
        perfiles = [perfil];
        render(
            <MemoryRouter>
                <ExegesisCreatePage />
            </MemoryRouter>,
        );
        expect(screen.getByText('pasaje')).toBeInTheDocument();
    });

    it('sin perfiles, también', () => {
        perfiles = [];
        render(
            <MemoryRouter>
                <ExegesisCreatePage />
            </MemoryRouter>,
        );
        expect(screen.getByText('pasaje')).toBeInTheDocument();
    });
});
