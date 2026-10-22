import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

/** ADR-046, etapa 1: el encargo del curso se copia de un perfil o se elige a mano. */
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/exegesis/useWorkProfiles', () => ({ useWorkProfiles: () => ({ profiles: [
    { id: 'tp', displayName: 'TP Semanal', course: 'Griego NT', rubricTemplateId: 'r1', briefTemplateId: 'b1', styleGuideId: 'g1', exegeticalStrategy: 'dialectical', cover: { institution: 'TMS' } },
] }) }));
vi.mock('@/hooks/exegesis/useUserRubrics', () => ({ useUserRubrics: () => ({ rubrics: [{ id: 'r1', displayName: 'TMS' }] }) }));
vi.mock('@/hooks/exegesis/useUserAssignmentBriefs', () => ({ useUserAssignmentBriefs: () => ({ briefs: [{ id: 'b1', displayName: 'TP' }] }) }));
vi.mock('@/hooks/exegesis/useUserStyleGuides', () => ({ useUserStyleGuides: () => ({ guides: [{ id: 'g1', displayName: 'Guía TMS' }] }) }));
const { ProjectChargeCard } = await import('../ProjectChargeCard');

beforeEach(cleanup);

describe('ProjectChargeCard', () => {
    it('copiar un perfil llena el encargo y guardarlo lo manda entero', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<ProjectChargeCard project={{ id: 'p', userId: 'u', title: 'Teología II', color: 'amber' } as never} onSave={onSave} saving={false} />);
        fireEvent.change(screen.getByLabelText('charge.fromProfile'), { target: { value: 'tp' } });
        fireEvent.click(screen.getByText('charge.save'));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workProfileId: 'tp', styleGuideId: 'g1', rubricTemplateId: 'r1', cover: { institution: 'TMS' } }));
    });

    it('un proyecto con encargo se puede dejar sin él', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<ProjectChargeCard project={{ id: 'p', userId: 'u', title: 'T', color: 'amber', charge: { styleGuideId: 'g1' } } as never} onSave={onSave} saving={false} />);
        fireEvent.click(screen.getByText('charge.clear'));
        expect(onSave).toHaveBeenCalledWith(null);
    });

    it('la rúbrica tiene tres estados y la estrategia puede quedar sin preferencia (revisión de la etapa 1)', () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<ProjectChargeCard project={{ id: 'p', userId: 'u', title: 'T', color: 'amber' } as never} onSave={onSave} saving={false} />);
        fireEvent.change(screen.getByLabelText('charge.rubric'), { target: { value: '__system' } });
        fireEvent.change(screen.getByLabelText('charge.styleGuide'), { target: { value: 'g1' } });
        fireEvent.click(screen.getByText('charge.save'));
        const guardado = onSave.mock.calls[0]![0];
        expect(guardado.rubricTemplateId).toBeNull();
        expect(guardado.exegeticalStrategy).toBeUndefined();
    });
});
