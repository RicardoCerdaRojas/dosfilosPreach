import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SermonSeriesEntity, type AddProjectSourceInput } from '@dosfilos/domain';

/**
 * La serie que nace dentro de un proyecto (ADR-046 etapa 3,
 * `docs/FASE_PROYECTO_SERIE_2026-10.md`, U3): sus estudios nacen en el
 * proyecto con su bibliografía, se revierten si la serie no se guarda, y una
 * serie existente se puede ligar con sus estudios. Sin proyecto, la forma de
 * hoy queda fijada (SeriesForm, usePlannerWizard y mobile no tenían red).
 */
const repo = vi.hoisted(() => ({ findById: vi.fn(), create: vi.fn(), update: vi.fn() }));
const ex = vi.hoisted(() => ({
    createPaper: vi.fn(),
    setPaperProject: vi.fn(),
    getPaper: vi.fn(),
    addSource: vi.fn(),
}));
const createSermon = vi.hoisted(() => vi.fn());

vi.mock('@dosfilos/infrastructure', () => {
    class Nada {}
    return {
        FirebaseSeriesRepository: class {
            findById = repo.findById;
            create = repo.create;
            update = repo.update;
        },
        FirestoreExpositoryAssistantCacheRepository: Nada,
        GeminiExpositoryAssistant: Nada,
        GeminiPericopeDetector: Nada,
        GeminiPlanGenerator: Nada,
        EXPOSITORY_PIPELINE_VERSION: 'test',
        MorphhbOriginalLanguageProvider: Nada,
        RVR1960Repository: Nada,
        ASVRepository: Nada,
        SBLGNTBibleProvider: Nada,
    };
});
vi.mock('../ExegesisService', () => ({
    exegesisService: {
        createPaper: { execute: ex.createPaper },
        setPaperProject: { execute: ex.setPaperProject },
        getPaper: { execute: ex.getPaper },
        addSource: { execute: ex.addSource },
    },
}));
vi.mock('../SermonService', () => ({ sermonService: { createSermon } }));
vi.mock('../LibraryService', () => ({ LibraryService: class {} }));

import { SeriesService, pericopeAssignmentBrief } from '../SeriesService';

const fuente = (resourceId: string, label: string, sourceType: AddProjectSourceInput['sourceType'] = 'commentary-expository'): AddProjectSourceInput => ({
    corpusId: resourceId,
    sourceLibraryResourceId: resourceId,
    sourceType,
    displayLabel: label,
    mode: 'full-document',
});
const A = fuente('res-a', 'Kidner');
const B = fuente('res-b', 'Williamson (proyecto)', 'commentary-critical');

const unidad = (cs: number, vs: number, ce: number, ve: number) => ({
    book: 'Nehemías', chapterStart: cs, verseStart: vs, chapterEnd: ce, verseEnd: ve, justification: `Neh ${cs}:${vs}`,
});

const defaultsDeLaSerie = {
    styleGuideId: 'guia-1',
    sourceRefs: [
        // B' es el mismo libro que B: debe ganar la ficha del proyecto.
        { libraryResourceId: 'res-b', corpusId: 'res-b', displayLabel: 'Williamson (serie)', sourceType: 'commentary-expository', mode: 'full-document' as const },
        { libraryResourceId: 'res-c', corpusId: 'res-c', displayLabel: 'Fensham', sourceType: 'commentary-expository', mode: 'full-document' as const },
    ],
};

const plan = (extra: Record<string, unknown> = {}) => ({
    series: {
        title: 'Nehemías',
        description: 'Reconstruir',
        type: 'expository' as const,
        metadata: {
            expository: { book: 'Nehemías' },
            exegesisDefaults: defaultsDeLaSerie,
        },
    } as never,
    sermons: [
        { title: 'La oración de Nehemías', description: 'd1', passage: 'Neh 1:1-11', week: 1, syntacticUnit: unidad(1, 1, 1, 11) },
        { title: 'El permiso del rey', description: 'd2', passage: 'Neh 2:1-10', week: 2, syntacticUnit: unidad(2, 1, 2, 10) },
        { title: 'La inspección', description: 'd3', passage: 'Neh 2:11-20', week: 3, syntacticUnit: unidad(2, 11, 2, 20) },
    ],
    displayLanguage: 'es' as const,
    ...extra,
});

let uuid = 0;
beforeEach(() => {
    uuid = 0;
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `id-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`);
    [...Object.values(repo), ...Object.values(ex), createSermon].forEach(f => f.mockReset());
    repo.create.mockImplementation(async (s: SermonSeriesEntity) => s);
    repo.update.mockImplementation(async (s: SermonSeriesEntity) => s);
    let n = 0;
    ex.createPaper.mockImplementation(async () => ({ id: `paper-${++n}` }));
    ex.setPaperProject.mockResolvedValue({});
    ex.addSource.mockResolvedValue({});
    createSermon.mockImplementation(async () => ({ id: 'sermon-x' }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

const argsDeCreatePaper = () => ex.createPaper.mock.calls.map(c => c[0]);

describe('createSeriesFromPlan con proyecto', () => {
    it('cada estudio nace en el proyecto, de la serie y su perícopa, con las fuentes del proyecto primero', async () => {
        const svc = new SeriesService();
        const serie = await svc.createSeriesFromPlan('u1', plan({ project: { projectId: 'neh', sources: [A, B] } }));

        expect(ex.createPaper).toHaveBeenCalledTimes(3);
        const pericopas = serie.metadata!.plannedSermons!;
        argsDeCreatePaper().forEach((arg, i) => {
            expect(arg.projectId).toBe('neh');
            expect(arg.seriesId).toBe(serie.id);
            expect(arg.pericopeId).toBe(pericopas[i]!.id);
            expect(arg.initialSources.map((s: AddProjectSourceInput) => s.sourceLibraryResourceId)).toEqual(['res-a', 'res-b', 'res-c']);
            // B viene del proyecto, no de la copia de la serie.
            expect(arg.initialSources[1].displayLabel).toBe('Williamson (proyecto)');
            expect('rubricTemplateId' in arg).toBe(false);
            expect('projectWorkTypeId' in arg).toBe(false);
        });
        expect(repo.create).toHaveBeenCalledTimes(1);
        expect(repo.create.mock.calls[0]![0].projectId).toBe('neh');
        expect(serie.projectId).toBe('neh');
        expect(pericopas.map(p => p.paperId)).toEqual(['paper-1', 'paper-2', 'paper-3']);
    });

    it('guarda las obras desmarcadas solo si hay alguna', async () => {
        const svc = new SeriesService();
        const con = await svc.createSeriesFromPlan('u1', plan({ project: { projectId: 'neh', sources: [A], excludedResourceIds: ['res-z'] } }));
        expect(con.metadata!.projectSourceExclusions).toEqual(['res-z']);
        const sin = await svc.createSeriesFromPlan('u1', plan({ project: { projectId: 'neh', sources: [A], excludedResourceIds: [] } }));
        expect('projectSourceExclusions' in sin.metadata!).toBe(false);
    });

    it('si falla un estudio, los demás conservan su paperId y la serie se guarda con proyecto', async () => {
        let n = 0;
        ex.createPaper.mockImplementation(async () => {
            n++;
            if (n === 2) throw new Error('boom');
            return { id: `paper-${n}` };
        });
        const svc = new SeriesService();
        const serie = await svc.createSeriesFromPlan('u1', plan({ project: { projectId: 'neh', sources: [A] } }));
        const ids = serie.metadata!.plannedSermons!.map(p => p.paperId);
        expect(ids.filter(Boolean)).toHaveLength(2);
        expect(ids).toContain(undefined);
        expect(serie.projectId).toBe('neh');
        expect(repo.create.mock.calls[0]![0].projectId).toBe('neh');
        expect(ex.setPaperProject).not.toHaveBeenCalled();
    });

    it('si la serie no se guarda, a los estudios recién creados se les quita el origen y el error sigue', async () => {
        repo.create.mockRejectedValue(new Error('permiso denegado'));
        const svc = new SeriesService();
        const conPrevio = plan({ project: { projectId: 'neh', sources: [A] } });
        // Una perícopa que ya traía estudio: no es de este lote y no se toca.
        (conPrevio.sermons[0] as { paperId?: string }).paperId = 'paper-viejo';

        await expect(svc.createSeriesFromPlan('u1', conPrevio)).rejects.toThrow('permiso denegado');
        expect(ex.createPaper).toHaveBeenCalledTimes(2);
        const revertidos = ex.setPaperProject.mock.calls.map(c => c[0]);
        expect(revertidos).toEqual([
            { ownerId: 'u1', paperId: 'paper-1', change: { kind: 'origin', projectId: null } },
            { ownerId: 'u1', paperId: 'paper-2', change: { kind: 'origin', projectId: null } },
        ]);
    });

    it('la reversión es de mejor esfuerzo: un fallo al revertir no tapa el error original', async () => {
        repo.create.mockRejectedValue(new Error('permiso denegado'));
        ex.setPaperProject.mockRejectedValueOnce(new Error('otra cosa'));
        const svc = new SeriesService();
        await expect(svc.createSeriesFromPlan('u1', plan({ project: { projectId: 'neh', sources: [] } }))).rejects.toThrow('permiso denegado');
        expect(ex.setPaperProject).toHaveBeenCalledTimes(3);
    });

    it('un título que la serie no acepta falla antes de crear estudios', async () => {
        const svc = new SeriesService();
        const corto = plan({ project: { projectId: 'neh', sources: [A] } });
        (corto.series as { title: string }).title = 'Ne';
        await expect(svc.createSeriesFromPlan('u1', corto)).rejects.toThrow('al menos 3 caracteres');
        expect(ex.createPaper).not.toHaveBeenCalled();
        expect(repo.create).not.toHaveBeenCalled();
    });
});

describe('createSeriesFromPlan sin proyecto (como hoy)', () => {
    it('los argumentos de createPaper y la serie guardada tienen la forma de siempre', async () => {
        const svc = new SeriesService();
        const serie = await svc.createSeriesFromPlan('u1', plan());

        for (const arg of argsDeCreatePaper()) expect('projectId' in arg).toBe(false);
        expect(serie.projectId).toBeUndefined();
        expect(argsDeCreatePaper()[0]).toEqual({
            ownerId: 'u1',
            passage: { bookId: 'NEH', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11 },
            displayLanguage: 'es',
            title: 'La oración de Nehemías',
            // La justificación y, debajo, su lugar en el libro.
            assignmentBrief: 'Neh 1:1\n\nPerícopa 1 de 3 de la serie. Después: Neh 2:1-10 («El permiso del rey»).',
            styleGuideId: 'guia-1',
            initialSources: [
                { corpusId: 'res-b', sourceType: 'commentary-expository', displayLabel: 'Williamson (serie)', mode: 'full-document', sourceLibraryResourceId: 'res-b' },
                { corpusId: 'res-c', sourceType: 'commentary-expository', displayLabel: 'Fensham', mode: 'full-document', sourceLibraryResourceId: 'res-c' },
            ],
            seriesId: 'id-1',
            pericopeId: 'id-2',
        });
        const guardada = repo.create.mock.calls[0]![0] as SermonSeriesEntity;
        const { createdAt, updatedAt, ...resto } = guardada;
        expect(createdAt).toBeInstanceOf(Date);
        expect(updatedAt).toBeInstanceOf(Date);
        expect(resto).toEqual({
            id: 'id-1',
            userId: 'u1',
            title: 'Nehemías',
            description: 'Reconstruir',
            sermonIds: [],
            draftIds: [],
            type: 'expository',
            resourceIds: [],
            startDate: undefined,
            coverUrl: undefined,
            endDate: undefined,
            projectId: undefined,
            metadata: {
                expository: { book: 'Nehemías' },
                exegesisDefaults: defaultsDeLaSerie,
                plannedSermons: [1, 2, 3].map(i => expect.objectContaining({ paperId: `paper-${i}`, status: 'paper-in-progress' })),
            },
        });
        expect('projectSourceExclusions' in guardada.metadata!).toBe(false);
    });
});

describe('setSeriesProject', () => {
    const vieja = () =>
        SermonSeriesEntity.create({
            id: 's1', userId: 'u1', title: 'Jonás', description: '', type: 'expository',
            sermonIds: [], draftIds: [], resourceIds: [], createdAt: new Date('2026-01-01T00:00:00Z'),
            projectId: 'otro',
        });

    it('con un id lo cambia y conserva createdAt', async () => {
        repo.findById.mockResolvedValue(vieja());
        const r = await new SeriesService().setSeriesProject('s1', 'neh');
        expect(r.projectId).toBe('neh');
        expect(r.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect(repo.update).toHaveBeenCalledTimes(1);
    });

    it('con null la desliga', async () => {
        repo.findById.mockResolvedValue(vieja());
        const r = await new SeriesService().setSeriesProject('s1', null);
        expect(r.projectId).toBeNull();
    });

    const conExclusiones = (projectId: string | null) =>
        SermonSeriesEntity.create({
            id: 's1', userId: 'u1', title: 'Jonás', description: '', type: 'expository',
            sermonIds: [], draftIds: [], resourceIds: [], projectId,
            metadata: { projectSourceExclusions: ['res-x'], exegesisDefaults: { sourceRefs: [] } },
        });

    it('al cambiar de proyecto borra las obras desmarcadas (escribe [], no las omite) y conserva el resto', async () => {
        repo.findById.mockResolvedValue(conExclusiones('neh'));
        const r = await new SeriesService().setSeriesProject('s1', 'otro');
        expect(r.metadata!.projectSourceExclusions).toEqual([]);
        expect(r.metadata!.exegesisDefaults).toEqual({ sourceRefs: [] });
        const guardada = repo.update.mock.calls[0]![0] as SermonSeriesEntity;
        expect(guardada.metadata!.projectSourceExclusions).toEqual([]);
    });

    it('al desligar también las borra', async () => {
        repo.findById.mockResolvedValue(conExclusiones('neh'));
        const r = await new SeriesService().setSeriesProject('s1', null);
        expect(r.metadata!.projectSourceExclusions).toEqual([]);
    });

    it('con el mismo proyecto las conserva', async () => {
        repo.findById.mockResolvedValue(conExclusiones('neh'));
        const r = await new SeriesService().setSeriesProject('s1', 'neh');
        expect(r.metadata!.projectSourceExclusions).toEqual(['res-x']);
    });

    it('sin serie, lanza', async () => {
        repo.findById.mockResolvedValue(null);
        await expect(new SeriesService().setSeriesProject('s1', 'neh')).rejects.toThrow('Serie no encontrada');
        expect(repo.update).not.toHaveBeenCalled();
    });
});

describe('linkSeriesToProject', () => {
    const jonas = () =>
        SermonSeriesEntity.create({
            id: 's1', userId: 'u1', title: 'Jonás', description: '', type: 'expository',
            sermonIds: [], draftIds: [], resourceIds: [],
            metadata: {
                plannedSermons: [
                    { id: 'p1', week: 1, title: 'a', description: '', passage: '', paperId: 'suelto' },
                    { id: 'p2', week: 2, title: 'b', description: '', passage: '', paperId: 'ajeno' },
                    { id: 'p3', week: 3, title: 'c', description: '', passage: '', paperId: 'yaDentro' },
                    // Mismo estudio en dos filas: se procesa una vez.
                    { id: 'p4', week: 4, title: 'd', description: '', passage: '', paperId: 'suelto' },
                    { id: 'p5', week: 5, title: 'e', description: '', passage: '' },
                ],
            },
        });
    const papers: Record<string, unknown> = {
        suelto: { id: 'suelto', projectId: null, sources: [] },
        ajeno: { id: 'ajeno', projectId: 'otro', linkedProjectIds: [], sources: [{ corpusId: 'res-a', sourceLibraryResourceId: 'res-a' }] },
        yaDentro: { id: 'yaDentro', projectId: 'neh', sources: [] },
    };

    beforeEach(() => {
        repo.findById.mockResolvedValue(jonas());
        ex.getPaper.mockImplementation(async (_uid: string, id: string) => papers[id] ?? null);
    });

    it('mueve el suelto, vincula el ajeno, deja el que ya está y agrega solo las obras que faltan', async () => {
        const r = await new SeriesService().linkSeriesToProject('u1', 's1', 'neh', { movePapers: true, sourcesToAdd: [A] });
        expect(r).toEqual({ moved: 1, linked: 1, unchanged: 1, sourcesAdded: 2, failed: 0 });
        expect(repo.update.mock.calls[0]![0].projectId).toBe('neh');
        expect(ex.setPaperProject.mock.calls.map(c => c[0])).toEqual([
            { ownerId: 'u1', paperId: 'suelto', change: { kind: 'origin', projectId: 'neh' } },
            { ownerId: 'u1', paperId: 'ajeno', change: { kind: 'link', projectId: 'neh' } },
        ]);
        expect(ex.addSource.mock.calls.map(c => c[0].paperId)).toEqual(['suelto', 'yaDentro']);
        expect(ex.addSource.mock.calls[0]![0]).toEqual({ ownerId: 'u1', paperId: 'suelto', ...A });
    });

    it('el estudio vinculado (con otro origen) también recibe las obras que le faltan', async () => {
        const antes = papers.ajeno;
        papers.ajeno = { ...(antes as object), sources: [] };
        try {
            const r = await new SeriesService().linkSeriesToProject('u1', 's1', 'neh', { movePapers: true, sourcesToAdd: [A] });
            expect(r).toEqual({ moved: 1, linked: 1, unchanged: 1, sourcesAdded: 3, failed: 0 });
            expect(ex.addSource.mock.calls.map(c => c[0].paperId)).toEqual(['suelto', 'ajeno', 'yaDentro']);
            expect(ex.addSource.mock.calls[1]![0]).toEqual({ ownerId: 'u1', paperId: 'ajeno', ...A });
        } finally {
            papers.ajeno = antes;
        }
    });

    it('al ligar a otro proyecto borra las obras desmarcadas del anterior', async () => {
        repo.findById.mockResolvedValue(
            jonas().update({ projectId: 'otro', metadata: { ...jonas().metadata, projectSourceExclusions: ['res-a'] } }),
        );
        await new SeriesService().linkSeriesToProject('u1', 's1', 'neh', { movePapers: false });
        const guardada = repo.update.mock.calls[0]![0] as SermonSeriesEntity;
        expect(guardada.projectId).toBe('neh');
        expect(guardada.metadata!.projectSourceExclusions).toEqual([]);
        expect(guardada.metadata!.plannedSermons).toHaveLength(5);
    });

    it('un vínculo previo cuenta como ya dentro', async () => {
        papers.ajeno = { ...(papers.ajeno as object), linkedProjectIds: ['neh'] };
        const r = await new SeriesService().linkSeriesToProject('u1', 's1', 'neh', { movePapers: true });
        expect(r).toMatchObject({ moved: 1, linked: 0, unchanged: 2 });
        papers.ajeno = { ...(papers.ajeno as object), linkedProjectIds: [] };
    });

    it('sin movePapers solo liga la serie', async () => {
        const r = await new SeriesService().linkSeriesToProject('u1', 's1', 'neh', { movePapers: false, sourcesToAdd: [A] });
        expect(r).toEqual({ moved: 0, linked: 0, unchanged: 0, sourcesAdded: 0, failed: 0 });
        expect(ex.getPaper).not.toHaveBeenCalled();
        expect(repo.update.mock.calls[0]![0].projectId).toBe('neh');
    });

    it('un estudio que falla suma a failed y los demás siguen', async () => {
        ex.setPaperProject.mockRejectedValueOnce(new Error('proyecto archivado'));
        const r = await new SeriesService().linkSeriesToProject('u1', 's1', 'neh', { movePapers: true });
        expect(r).toEqual({ moved: 0, linked: 1, unchanged: 1, sourcesAdded: 0, failed: 1 });
    });
});

describe('encuadre de la serie (U5)', () => {
    it('cada estudio del lote nace con su lugar en el libro en el encargo', async () => {
        const svc = new SeriesService();
        await svc.createSeriesFromPlan('u1', plan());
        expect(argsDeCreatePaper().map(a => a.assignmentBrief)).toEqual([
            'Neh 1:1\n\nPerícopa 1 de 3 de la serie. Después: Neh 2:1-10 («El permiso del rey»).',
            'Neh 2:1\n\nPerícopa 2 de 3 de la serie. Antes: Neh 1:1-11 («La oración de Nehemías»). Después: Neh 2:11-20 («La inspección»).',
            'Neh 2:11\n\nPerícopa 3 de 3 de la serie. Antes: Neh 2:1-10 («El permiso del rey»).',
        ]);
    });

    it('sin justificación, el encargo es solo el lugar en el libro', async () => {
        const svc = new SeriesService();
        const p = plan();
        p.sermons = p.sermons.map(s => ({ ...s, syntacticUnit: { ...s.syntacticUnit, justification: undefined as unknown as string } }));
        await svc.createSeriesFromPlan('u1', p);
        expect(argsDeCreatePaper()[0]!.assignmentBrief).toBe('Perícopa 1 de 3 de la serie. Después: Neh 2:1-10 («El permiso del rey»).');
    });

    it('la frecuencia queda guardada en metadata.frequency', async () => {
        const svc = new SeriesService();
        const serie = await svc.createSeriesFromPlan('u1', plan({ frequency: 'biweekly', series: { ...plan().series as object, startDate: new Date(2026, 10, 1) } as never }));
        expect(serie.metadata!.frequency).toBe('biweekly');
        const guardada = repo.create.mock.calls[0]![0] as SermonSeriesEntity;
        expect(guardada.metadata!.frequency).toBe('biweekly');
        // Y las fechas salieron con esa frecuencia: 14 días entre perícopas.
        const [a, b] = guardada.metadata!.plannedSermons!.map(p => p.scheduledDate!.getTime());
        expect((b! - a!) / 86_400_000).toBe(14);
    });

    it('sin frecuencia en el plan no escribe la clave (series viejas: semanal)', async () => {
        const svc = new SeriesService();
        await svc.createSeriesFromPlan('u1', plan());
        const guardada = repo.create.mock.calls[0]![0] as SermonSeriesEntity;
        expect('frequency' in guardada.metadata!).toBe(false);
    });
});

describe('pericopeAssignmentBrief', () => {
    const serie = { metadata: { plannedSermons: [
        { id: 'a', title: 'Uno', passage: 'Esd 1:1-4' },
        { id: 'b', title: 'Dos', passage: 'Esd 1:5-11' },
    ] } };
    it('junta la justificación y el lugar en el libro', () => {
        expect(pericopeAssignmentBrief(' Frontera. ', serie, 'b')).toBe('Frontera.\n\nPerícopa 2 de 2 de la serie. Antes: Esd 1:1-4 («Uno»).');
    });
    it('una perícopa fuera del plan conserva solo la justificación; sin nada, null', () => {
        expect(pericopeAssignmentBrief('Frontera.', serie, 'zzz')).toBe('Frontera.');
        expect(pericopeAssignmentBrief(null, null, 'a')).toBeNull();
    });
});
