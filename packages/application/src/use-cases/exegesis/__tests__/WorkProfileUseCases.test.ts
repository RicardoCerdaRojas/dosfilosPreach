import { describe, it, expect, vi } from 'vitest';
import { defaultsOfProfile, SaveWorkProfileFromPaperUseCase } from '../WorkProfileUseCases';
import type { WorkProfile } from '@dosfilos/domain';

/**
 * El caso que lo motiva: tres trabajos de investigación en el mismo ramo.
 * El primero se configuró a mano; los otros dos no deberían empezar de
 * cero, y sobre todo no deberían empezar «parecido».
 */
const paper = {
    id: 'p1',
    styleGuideId: 'guia-tms',
    exegeticalStrategy: 'dialectical',
    cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda', place: 'Chiguayante, Concepción' },
};

function build(overrides: { paper?: unknown } = {}) {
    // `??` no sirve acá: el caso interesante es justamente `paper: null`.
    const devuelto = 'paper' in overrides ? overrides.paper : paper;
    const paperRepository = { getPaper: vi.fn().mockResolvedValue(devuelto) };
    const profileRepository = {
        createProfile: vi.fn().mockImplementation(async (draft: unknown) => ({ ...(draft as object), id: 'wp1' })),
    };
    const rubricRepository = { createRubric: vi.fn().mockImplementation(async (d: unknown) => ({ ...(d as object), id: 'rub-nueva' })) };
    const briefRepository = { createBrief: vi.fn().mockImplementation(async (d: unknown) => ({ ...(d as object), id: 'enc-nuevo' })) };
    return {
        useCase: new SaveWorkProfileFromPaperUseCase(paperRepository as never, profileRepository as never, rubricRepository as never, briefRepository as never),
        profileRepository,
        rubricRepository,
        briefRepository,
    };
}

const input = { ownerId: 'o1', paperId: 'p1', displayName: 'OT603 · Trabajo de investigación' };

describe('SaveWorkProfileFromPaperUseCase', () => {
    it('copia del trabajo lo que no tiene plantilla propia: guía, método y portada', async () => {
        const { useCase, profileRepository } = build();
        await useCase.execute(input);

        expect(profileRepository.createProfile.mock.calls[0]![0]).toMatchObject({
            styleGuideId: 'guia-tms',
            exegeticalStrategy: 'dialectical',
            cover: { institution: "The Master's Seminary", author: 'Ricardo Cerda' },
        });
    });

    it('la rúbrica y el encuadre viajan como punteros, no como copia', async () => {
        const { useCase, profileRepository, rubricRepository } = build({ paper: { ...paper, rubric: { sourceRequirements: [] } } });
        await useCase.execute({ ...input, rubricTemplateId: 'r1', briefTemplateId: 'b1' });

        const draft = profileRepository.createProfile.mock.calls[0]![0];
        expect(draft).toMatchObject({ rubricTemplateId: 'r1', briefTemplateId: 'b1' });
        // La rúbrica del trabajo es una copia congelada; guardarla acá
        // crearía una tercera verdad sobre la misma rúbrica.
        expect(draft).not.toHaveProperty('rubric');
        // Con plantilla elegida, no se crea otra.
        expect(rubricRepository.createRubric).not.toHaveBeenCalled();
    });

    it('REGRESIÓN (TP #6): sin plantilla elegida, crea las plantillas con la rúbrica y el encuadre DEL TRABAJO', async () => {
        const rubric = { sourceRequirements: [], formatting: { pageLimit: 1 } };
        const { useCase, profileRepository, rubricRepository, briefRepository } = build({
            paper: { ...paper, rubric, assignmentBrief: '  Cuatro preguntas de sintaxis.  ' },
        });
        await useCase.execute(input);
        expect(rubricRepository.createRubric).toHaveBeenCalledWith({
            ownerId: 'o1', displayName: input.displayName, isDefault: false, rubric,
        });
        expect(briefRepository.createBrief).toHaveBeenCalledWith({
            ownerId: 'o1', displayName: input.displayName, isDefault: false, body: 'Cuatro preguntas de sintaxis.',
        });
        expect(profileRepository.createProfile.mock.calls[0]![0]).toMatchObject({
            rubricTemplateId: 'rub-nueva', briefTemplateId: 'enc-nuevo',
        });
    });

    it('sin rúbrica ni encuadre en el trabajo no crea plantillas vacías', async () => {
        const { useCase, profileRepository, rubricRepository, briefRepository } = build({
            paper: { ...paper, rubric: null, assignmentBrief: '   ' },
        });
        await useCase.execute(input);
        expect(rubricRepository.createRubric).not.toHaveBeenCalled();
        expect(briefRepository.createBrief).not.toHaveBeenCalled();
        expect(profileRepository.createProfile.mock.calls[0]![0]).toMatchObject({ rubricTemplateId: null, briefTemplateId: null });
    });

    it('un nombre en blanco no crea un perfil que nadie va a reconocer', async () => {
        const { useCase, profileRepository } = build();
        await expect(useCase.execute({ ...input, displayName: '   ' })).rejects.toThrow();
        expect(profileRepository.createProfile).not.toHaveBeenCalled();
    });

    it('un trabajo que no existe falla en vez de guardar un perfil vacío', async () => {
        const { useCase, profileRepository } = build({ paper: null });
        await expect(useCase.execute(input)).rejects.toThrow(/not found/);
        expect(profileRepository.createProfile).not.toHaveBeenCalled();
    });

    it('un trabajo sin portada guarda el perfil igual: una portada a medias es mejor que ninguna', async () => {
        const { useCase, profileRepository } = build({ paper: { ...paper, cover: null } });
        await useCase.execute(input);
        expect(profileRepository.createProfile.mock.calls[0]![0]).toMatchObject({ cover: null });
    });
});

describe('defaultsOfProfile', () => {
    it('devuelve lo que el perfil aporta, sin aplicarlo', () => {
        const profile: WorkProfile = {
            id: 'wp1', ownerId: 'o1', displayName: 'OT603',
            rubricTemplateId: 'r1', briefTemplateId: null, styleGuideId: 'g1',
            exegeticalStrategy: 'free', cover: null, isDefault: true,
            createdAt: new Date(), updatedAt: new Date(),
        };
        expect(defaultsOfProfile(profile)).toEqual({
            rubricTemplateId: 'r1',
            briefTemplateId: null,
            styleGuideId: 'g1',
            exegeticalStrategy: 'free',
            cover: null,
        });
    });
});
