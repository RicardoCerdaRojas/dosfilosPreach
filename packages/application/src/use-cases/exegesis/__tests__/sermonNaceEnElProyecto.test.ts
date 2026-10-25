import { describe, it, expect, vi } from 'vitest';
import {
    SermonEntity,
    SermonSeriesEntity,
    type ExegeticalPaper,
    type ISermonRepository,
    type ISeriesRepository,
    type IExegeticalPaperRepository,
} from '@dosfilos/domain';
import { StartStudyFromPaperUseCase } from '../StartStudyFromPaperUseCase';

// Fakes con la misma forma que los de StartStudyFromPaperUseCase.test.ts:
// aquella suite no los exporta y este archivo no debe tocarla.
const makePaper = (overrides: Partial<ExegeticalPaper> = {}): ExegeticalPaper => ({
    id: 'paper-1',
    ownerId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    passage: { bookId: 'NEH', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 11 },
    displayLanguage: 'es',
    title: 'Nehemías ora',
    assignmentBrief: '',
    styleGuideId: null,
    sources: [],
    rubric: null,
    stepPlan: { perStep: [] } as never,
    phase: 'in-progress',
    steps: [],
    currentStepId: null,
    assembledMarkdown: null,
    archivedAt: null,
    ...overrides,
});

const stubPaperRepo = (paper: ExegeticalPaper): IExegeticalPaperRepository =>
    ({ getPaper: vi.fn(async () => paper) }) as unknown as IExegeticalPaperRepository;

interface SermonRepoFalso extends ISermonRepository {
    __created: SermonEntity[];
    __updated: SermonEntity[];
}

const stubSermonRepo = (existing?: SermonEntity, delPaper: SermonEntity[] = []): SermonRepoFalso => {
    const created: SermonEntity[] = [];
    const updated: SermonEntity[] = [];
    return {
        create: vi.fn(async (s: SermonEntity) => { created.push(s); return s; }),
        update: vi.fn(async (s: SermonEntity) => { updated.push(s); return s; }),
        delete: vi.fn(),
        findById: vi.fn(async () => existing ?? null),
        findByShareToken: vi.fn(),
        findByUserId: vi.fn(),
        findAll: vi.fn(),
        findByDraftId: vi.fn(),
        findBySourcePaperId: vi.fn(async () => delPaper),
        __created: created,
        __updated: updated,
    } as unknown as SermonRepoFalso;
};

const borrador = (id: string, projectId?: string): SermonEntity => SermonEntity.create({
    id,
    userId: 'user-1',
    title: 'Nehemías ora',
    content: '',
    bibleReferences: ['Nehemías 1:1-11'],
    sourcePaperId: 'paper-1',
    status: 'draft',
    ...(projectId ? { projectId } : {}),
});

describe('el sermón nace en el proyecto del estudio', () => {
    it('un paper con proyecto crea el sermón dentro de ese proyecto', async () => {
        const sermonRepo = stubSermonRepo();
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ projectId: 'neh', seriesId: 'serie-neh' })),
            sermonRepo,
        );

        await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        const creado = sermonRepo.__created[0]!;
        expect(creado.projectId).toBe('neh');
        expect(creado.sourcePaperId).toBe('paper-1');
        expect(creado.seriesId).toBe('serie-neh');
    });

    it('un paper sin proyecto crea el sermón como hoy (sin projectId)', async () => {
        // Jonás y todos los papers anteriores a la fase.
        const sermonRepo = stubSermonRepo();
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ projectId: null })),
            sermonRepo,
        );

        await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        expect(sermonRepo.__created[0]!.projectId).toBeUndefined();
    });

    it('un borrador retomado con otro proyecto lo conserva', async () => {
        // «Material previo» lo asignó migrateLegacySermons: no se pisa.
        const sermonRepo = stubSermonRepo(undefined, [borrador('s-1', 'material-previo')]);
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ projectId: 'neh' })),
            sermonRepo,
        );

        await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        expect(sermonRepo.__created).toHaveLength(0);
        expect(sermonRepo.__updated[0]!.projectId).toBe('material-previo');
    });

    it('un borrador retomado sin proyecto recibe el del estudio', async () => {
        const sermonRepo = stubSermonRepo(undefined, [borrador('s-1')]);
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ projectId: 'neh' })),
            sermonRepo,
        );

        await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        expect(sermonRepo.__updated[0]!.id).toBe('s-1');
        expect(sermonRepo.__updated[0]!.projectId).toBe('neh');
    });

    it('un sermón objetivo sin proyecto recibe el del estudio', async () => {
        const sermonRepo = stubSermonRepo(borrador('s-objetivo'));
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ projectId: 'neh' })),
            sermonRepo,
        );

        await useCase.execute({
            paperId: 'paper-1',
            actorUserId: 'user-1',
            targetSermonId: 's-objetivo',
        });

        expect(sermonRepo.__updated[0]!.projectId).toBe('neh');
    });

    it('un sermón objetivo con otro proyecto lo conserva', async () => {
        const sermonRepo = stubSermonRepo(borrador('s-objetivo', 'material-previo'));
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ projectId: 'neh' })),
            sermonRepo,
        );

        await useCase.execute({
            paperId: 'paper-1',
            actorUserId: 'user-1',
            targetSermonId: 's-objetivo',
        });

        expect(sermonRepo.__updated[0]!.projectId).toBe('material-previo');
    });
});

describe('el parche de la fila del plan no borra el vínculo de la serie', () => {
    it('conserva projectId y createdAt y sella la perícopa', async () => {
        const creadaEl = new Date('2026-09-01T12:00:00Z');
        const serie = SermonSeriesEntity.create({
            id: 'serie-neh',
            userId: 'user-1',
            title: 'Nehemías',
            description: '',
            type: 'expository',
            metadata: {
                plannedSermons: [
                    { id: 'per-1', week: 1, title: 'Ora', description: '', passage: 'Nehemías 1:1-11' },
                ],
            },
            resourceIds: [],
            sermonIds: [],
            draftIds: [],
            projectId: 'neh',
            createdAt: creadaEl,
        });
        const updates: SermonSeriesEntity[] = [];
        const seriesRepo = {
            create: vi.fn(),
            update: vi.fn(async (s: SermonSeriesEntity) => { updates.push(s); }),
            delete: vi.fn(),
            findById: vi.fn(async () => serie),
            findByUserId: vi.fn(),
        } as unknown as ISeriesRepository;
        const sermonRepo = stubSermonRepo();
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ projectId: 'neh', seriesId: 'serie-neh', pericopeId: 'per-1' })),
            sermonRepo,
            seriesRepo,
        );

        await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        expect(updates).toHaveLength(1);
        const guardada = updates[0]!;
        const sermonId = sermonRepo.__created[0]!.id;
        expect(guardada.projectId).toBe('neh');
        expect(guardada.createdAt).toEqual(creadaEl);
        expect(guardada.draftIds).toEqual([sermonId]);
        const fila = guardada.metadata?.plannedSermons?.find(p => p.id === 'per-1');
        expect(fila?.draftId).toBe(sermonId);
        expect(fila?.status).toBe('sermon-in-progress');
    });
});
