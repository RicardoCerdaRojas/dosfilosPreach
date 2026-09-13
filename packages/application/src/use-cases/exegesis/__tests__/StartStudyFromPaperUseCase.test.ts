import { describe, it, expect, vi } from 'vitest';
import {
    SermonEntity,
    SermonSeriesEntity,
    buildEmptyCanonicalVerseAnalysis,
    type ExegeticalPaper,
    type ExegeticalStep,
    type ExegeticalStepVersion,
    type IExegeticalPaperRepository,
    type ISermonRepository,
    type ISeriesRepository,
    type PlannedSermon,
} from '@dosfilos/domain';
import { StartStudyFromPaperUseCase } from '../StartStudyFromPaperUseCase';

const PASSAGE = {
    bookId: 'JAS',
    chapterStart: 1,
    chapterEnd: 1,
    verseStart: 1,
    verseEnd: 5,
} as const;

const makePaper = (overrides: Partial<ExegeticalPaper> = {}): ExegeticalPaper => ({
    id: 'paper-1',
    ownerId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    passage: { ...PASSAGE },
    displayLanguage: 'es',
    title: 'Santiago y la prueba',
    assignmentBrief: 'Argumentar que el gozo es volitivo',
    styleGuideId: null,
    sources: [],
    rubric: null,
    stepPlan: { perStep: [] } as any,
    phase: 'in-progress',
    steps: [],
    currentStepId: null,
    assembledMarkdown: null,
    archivedAt: null,
    ...overrides,
});

/** Un paso de verso con análisis canónico aceptado. */
const makeAcceptedStep = (): ExegeticalStep => {
    const analysis = buildEmptyCanonicalVerseAnalysis({
        bookId: 'JAS',
        chapterStart: 1,
        chapterEnd: 1,
        verseStart: 2,
        verseEnd: 2,
    });
    const accepted = {
        id: 'v-1',
        markdown: '',
        origin: 'generated',
        parentVersionId: null,
        createdAt: new Date(),
        canonicalAnalysis: analysis,
    } as ExegeticalStepVersion;
    return {
        id: 'step-1',
        paperId: 'paper-1',
        kind: 'verse',
        verseRef: analysis.reference,
        order: 1,
        state: 'accepted',
        current: accepted,
        accepted,
        versions: [accepted],
        createdAt: new Date(),
        updatedAt: new Date(),
    };
};

const stubPaperRepo = (paper: ExegeticalPaper | null): IExegeticalPaperRepository =>
    ({ getPaper: vi.fn(async () => paper) }) as any;

const stubSermonRepo = (existing?: SermonEntity, delPaper: SermonEntity[] = []): ISermonRepository => {
    const created: SermonEntity[] = [];
    const updated: SermonEntity[] = [];
    return {
        create: vi.fn(async (s: SermonEntity) => {
            created.push(s);
            return s;
        }),
        update: vi.fn(async (s: SermonEntity) => {
            updated.push(s);
            return s;
        }),
        delete: vi.fn(),
        findById: vi.fn(async () => existing ?? null),
        findByShareToken: vi.fn(),
        findByUserId: vi.fn(),
        findAll: vi.fn(),
        findByDraftId: vi.fn(),
        findBySourcePaperId: vi.fn(async () => delPaper),
        __created: created,
        __updated: updated,
    } as any;
};

describe('StartStudyFromPaperUseCase', () => {
    it('rechaza un paper inexistente o ajeno', async () => {
        const useCase = new StartStudyFromPaperUseCase(stubPaperRepo(null), stubSermonRepo());

        await expect(
            useCase.execute({ paperId: 'p1', actorUserId: 'user-1' }),
        ).rejects.toThrow(/no encontrado|sin permiso/i);
    });

    it('NO exige que el paper esté ensamblado', async () => {
        // El caso de uso retirado sí lo exigía, porque redactaba desde
        // `assembledMarkdown`. Este lee análisis aceptados, que existen
        // mucho antes — y el estudio gana si arranca temprano.
        const sermonRepo = stubSermonRepo();
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ phase: 'in-progress', steps: [makeAcceptedStep()] })),
            sermonRepo,
        );

        const result = await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        expect(result.hasStudyMaterial).toBe(true);
        expect((sermonRepo as any).__created).toHaveLength(1);
    });

    it('crea el sermón en el Paso 1, SIN borrador ni exégesis sintética', async () => {
        // La garantía central: el pastor no recibe texto que no escribió.
        const sermonRepo = stubSermonRepo();
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ steps: [makeAcceptedStep()] })),
            sermonRepo,
        );

        await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        const created = (sermonRepo as any).__created[0] as SermonEntity;
        expect(created.wizardProgress?.currentStep).toBe(1);
        expect(created.content).toBe('');
        expect(created.wizardProgress?.draft).toBeUndefined();
        expect(created.wizardProgress?.exegesis).toBeUndefined();
        expect(created.wizardProgress?.homiletics).toBeUndefined();
        expect(created.status).toBe('draft');
        expect(created.sourcePaperId).toBe('paper-1');
        expect(created.bibleReferences).toContain('Santiago 1:1-5');
    });

    it('marca el origen para que el wizard cargue el material del paper', async () => {
        const sermonRepo = stubSermonRepo();
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ steps: [makeAcceptedStep()] })),
            sermonRepo,
        );

        await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        const derived = (sermonRepo as any).__created[0].wizardProgress?.derivedContext;
        expect(derived?.kind).toBe('paper');
        expect(derived?.paperId).toBe('paper-1');
        expect(derived?.paperTitle).toBe('Santiago y la prueba');
        // Ya no hay tono ni modelo: nada se redacta por este camino.
        expect(derived?.tone).toBeUndefined();
        expect(derived?.transformerModelId).toBeUndefined();
    });

    it('avisa cuando el paper todavía no tiene análisis aceptados', async () => {
        // El estudio se abre igual —el pasaje ya es algo— pero la UI
        // necesita saber que no hay nada que mostrar junto a los pasos.
        const sermonRepo = stubSermonRepo();
        const useCase = new StartStudyFromPaperUseCase(
            stubPaperRepo(makePaper({ steps: [] })),
            sermonRepo,
        );

        const result = await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

        expect(result.hasStudyMaterial).toBe(false);
        expect((sermonRepo as any).__created).toHaveLength(1);
    });

    describe('targetSermonId (recuperación de marcadores vacíos)', () => {
        const placeholder = () =>
            SermonEntity.create({
                id: 'sermon-existing',
                userId: 'user-1',
                title: 'Marcador',
                content: '',
                bibleReferences: [],
                sourcePaperId: 'paper-1',
                status: 'draft',
            });

        it('actualiza el sermón existente en vez de crear uno nuevo', async () => {
            const sermonRepo = stubSermonRepo(placeholder());
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(makePaper({ steps: [makeAcceptedStep()] })),
                sermonRepo,
            );

            const result = await useCase.execute({
                paperId: 'paper-1',
                actorUserId: 'user-1',
                targetSermonId: 'sermon-existing',
            });

            expect(result.sermonId).toBe('sermon-existing');
            expect((sermonRepo as any).__created).toHaveLength(0);
            const updated = (sermonRepo as any).__updated[0] as SermonEntity;
            expect(updated.wizardProgress?.currentStep).toBe(1);
        });

        it('rechaza un sermón objetivo de otro usuario', async () => {
            const foreign = SermonEntity.create({
                id: 'sermon-existing',
                userId: 'otro-usuario',
                title: 'Marcador',
                content: '',
                bibleReferences: [],
                status: 'draft',
            });
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(makePaper()),
                stubSermonRepo(foreign),
            );

            await expect(
                useCase.execute({
                    paperId: 'paper-1',
                    actorUserId: 'user-1',
                    targetSermonId: 'sermon-existing',
                }),
            ).rejects.toThrow(/no pertenece al actor/);
        });
    });

    describe('coherencia con el planificador de series', () => {
        const makePlanned = (id: string, overrides: Partial<PlannedSermon> = {}): PlannedSermon => ({
            id,
            week: 1,
            title: 'Perícopa',
            description: '',
            passage: 'Santiago 1:1-5',
            ...overrides,
        });

        const stubSeriesRepo = (series: SermonSeriesEntity | null): ISeriesRepository => {
            const updates: SermonSeriesEntity[] = [];
            return {
                create: vi.fn(),
                update: vi.fn(async (s: SermonSeriesEntity) => {
                    updates.push(s);
                    return s;
                }),
                delete: vi.fn(),
                findById: vi.fn(async () => series),
                findByUserId: vi.fn(),
                __updates: updates,
            } as any;
        };

        const linkedPaper = () =>
            makePaper({ seriesId: 'series-1', pericopeId: 'pericope-A', steps: [makeAcceptedStep()] });

        const makeSeries = (planned: PlannedSermon[]) =>
            SermonSeriesEntity.create({
                id: 'series-1',
                userId: 'user-1',
                title: 'Serie Santiago',
                description: '',
                type: 'expository',
                metadata: { plannedSermons: planned },
                resourceIds: [],
                sermonIds: [],
                draftIds: [],
            });

        it('sella draftId en la perícopa que corresponde', async () => {
            const seriesRepo = stubSeriesRepo(
                makeSeries([makePlanned('pericope-A'), makePlanned('pericope-B')]),
            );
            const sermonRepo = stubSermonRepo();
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(linkedPaper()),
                sermonRepo,
                seriesRepo,
            );

            await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

            const updates = (seriesRepo as any).__updates as SermonSeriesEntity[];
            const patched = updates[0]!.metadata?.plannedSermons ?? [];
            const created = (sermonRepo as any).__created[0] as SermonEntity;
            expect(patched.find(p => p.id === 'pericope-A')?.draftId).toBe(created.id);
            expect(patched.find(p => p.id === 'pericope-A')?.status).toBe('sermon-in-progress');
            expect(patched.find(p => p.id === 'pericope-B')?.draftId).toBeUndefined();
        });

        it('no pisa un draftId existente en la misma perícopa', async () => {
            const seriesRepo = stubSeriesRepo(
                makeSeries([
                    makePlanned('pericope-A', {
                        draftId: 'sermon-existing',
                        status: 'sermon-in-progress',
                    }),
                ]),
            );
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(linkedPaper()),
                stubSermonRepo(),
                seriesRepo,
            );

            await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

            expect((seriesRepo as any).__updates).toHaveLength(0);
        });

        it('no toca series cuando se actualiza un marcador ya vinculado', async () => {
            const seriesRepo = stubSeriesRepo(makeSeries([makePlanned('pericope-A')]));
            const existing = SermonEntity.create({
                id: 'sermon-existing',
                userId: 'user-1',
                title: 'Marcador',
                content: '',
                bibleReferences: [],
                sourcePaperId: 'paper-1',
                status: 'draft',
            });
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(linkedPaper()),
                stubSermonRepo(existing),
                seriesRepo,
            );

            await useCase.execute({
                paperId: 'paper-1',
                actorUserId: 'user-1',
                targetSermonId: 'sermon-existing',
            });

            expect(seriesRepo.findById).not.toHaveBeenCalled();
        });

        it('se traga fallas del repo de series sin perder el sermón', async () => {
            const seriesRepo: ISeriesRepository = {
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
                findById: vi.fn(async () => {
                    throw new Error('firestore caído');
                }),
                findByUserId: vi.fn(),
            };
            const sermonRepo = stubSermonRepo();
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(linkedPaper()),
                sermonRepo,
                seriesRepo,
            );

            const result = await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

            expect(result.sermonId).toBeTruthy();
            expect((sermonRepo as any).__created).toHaveLength(1);
        });
    });

    describe('no deja borradores duplicados', () => {
        /** Un sermón ya colgado de este paper, en el estado y paso que se diga. */
        const sermonDelPaper = (over: {
            id: string; status: string; currentStep?: number; updatedAt?: Date;
        }): SermonEntity => SermonEntity.create({
            id: over.id,
            userId: 'user-1',
            title: 'Santiago y la prueba',
            content: '',
            bibleReferences: ['JAS 1:1-5'],
            sourcePaperId: 'paper-1',
            status: over.status,
            wizardProgress: { currentStep: over.currentStep ?? 1, passage: 'JAS 1:1-5', lastSaved: new Date() },
            createdAt: new Date('2026-08-23'),
            updatedAt: over.updatedAt ?? new Date('2026-08-23'),
        } as never, true);

        it('retoma el borrador que este paper ya había abierto', async () => {
            // CASO REAL: cinco «Sermón sobre Jonas 1:1-3» parados en el paso 1,
            // uno por cada clic. El pastor creía volver a su estudio.
            const yaExiste = sermonDelPaper({ id: 'sermon-1', status: 'draft' });
            const sermonRepo = stubSermonRepo(undefined, [yaExiste]);
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(makePaper({ steps: [makeAcceptedStep()] })),
                sermonRepo,
            );

            const r = await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

            expect(r.sermonId).toBe('sermon-1');
            expect((sermonRepo as any).__created).toHaveLength(0);
        });

        it('no le borra el paso al que ya iba avanzado', async () => {
            const enElPaso5 = sermonDelPaper({ id: 'sermon-1', status: 'draft', currentStep: 5 });
            const sermonRepo = stubSermonRepo(undefined, [enElPaso5]);
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(makePaper({ steps: [makeAcceptedStep()] })),
                sermonRepo,
            );

            await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

            const guardado = (sermonRepo as any).__updated[0] as SermonEntity;
            expect(guardado.wizardProgress?.currentStep).toBe(5);
        });

        it('entre varios borradores retoma el último tocado', async () => {
            const viejo = sermonDelPaper({ id: 'viejo', status: 'draft', updatedAt: new Date('2026-08-23') });
            const reciente = sermonDelPaper({ id: 'reciente', status: 'draft', updatedAt: new Date('2026-09-01') });
            const sermonRepo = stubSermonRepo(undefined, [viejo, reciente]);
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(makePaper({ steps: [makeAcceptedStep()] })),
                sermonRepo,
            );

            const r = await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

            expect(r.sermonId).toBe('reciente');
        });

        it('NO reabre un sermón ya publicado: crea uno nuevo', async () => {
            // Predicarlo otra vez es empezar de cero, no seguir editando lo que
            // ya se predicó.
            const publicado = sermonDelPaper({ id: 'publicado', status: 'published' });
            const sermonRepo = stubSermonRepo(undefined, [publicado]);
            const useCase = new StartStudyFromPaperUseCase(
                stubPaperRepo(makePaper({ steps: [makeAcceptedStep()] })),
                sermonRepo,
            );

            const r = await useCase.execute({ paperId: 'paper-1', actorUserId: 'user-1' });

            expect(r.sermonId).not.toBe('publicado');
            expect((sermonRepo as any).__created).toHaveLength(1);
        });
    });
});
