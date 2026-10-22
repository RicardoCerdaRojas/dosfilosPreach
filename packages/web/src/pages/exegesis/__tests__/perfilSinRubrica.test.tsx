import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    exegeticalStrategy: 'dialectical', styleGuideId: null,
    cover: { institution: 'The Master\'s Seminary', date: 'SEPTIEMBRE 2026' },
} as unknown as WorkProfile;

const valorDelSelector: Array<string | null | undefined> = [];
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [perfil], defaultProfile: perfil }) }));
const createPaper = vi.fn().mockResolvedValue({ id: 'nuevo' });
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: [] }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({
        createPaper: { isPending: false, mutateAsync: createPaper },
    }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [], defaultRubric: null }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [], defaultBrief: null }) }));
vi.mock('@/components/exegesis/PassagePicker', () => ({
    PassagePicker: ({ onChange }: { onChange: (r: unknown) => void }) => (
        <button type="button" onClick={() => onChange({ bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 13, verseEnd: 18 })}>pasaje</button>
    ),
}));
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

/** TP #7: la portada salió «SEPTIEMBRE 2026» en octubre; el perfil guardaba la fecha. */
describe('la portada del perfil lleva el mes en curso', () => {
    it('la fecha avanza al crear', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-14T12:00:00'));
        render(<MemoryRouter><ExegesisCreatePage /></MemoryRouter>);
        fireEvent.click(screen.getAllByText('pasaje')[0]!);
        fireEvent.click(screen.getByRole('button', { name: 'create.submit' }));
        // La portada va en la misma creación (etapa 1): antes era una segunda llamada.
        await waitFor(() => expect(createPaper).toHaveBeenCalled());
        expect(createPaper.mock.calls[0]![0].cover.date).toBe('OCTUBRE 2026');
        vi.useRealTimers();
    });
});
