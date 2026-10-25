import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * El sermón recibe el contexto de la serie (`docs/FASE_ENCUADRE_SERIE_2026-10.md`,
 * §2 paso 11 y §5 «Sermón»): su lugar en el plan, el propósito pastoral y la
 * idea REVISADA y vigente. Nunca la hipótesis provisoria ni lo que el asistente
 * escribió en la fila del plan.
 */
const m = vi.hoisted(() => ({
    getSermon: vi.fn(),
    getSeries: vi.fn(),
    getProjects: vi.fn(),
    getBySermonId: vi.fn(),
}));
vi.mock('@dosfilos/application', () => ({
    sermonService: { getSermon: m.getSermon },
    seriesService: { getSeries: m.getSeries },
    facultyService: { getProjects: { execute: m.getProjects } },
    pastoralSeedService: { getBySermonId: m.getBySermonId },
    pastoralWordAnalysisReadService: { findById: vi.fn() },
    exegesisService: { getPaper: { execute: vi.fn() } },
}));

import type { AIProject, GenerationRules, PlannedSermon, ProjectFraming, SermonSeries } from '@dosfilos/domain';
import { buildRulesWithContext, seriesContextFor } from '../augmentGenerationRules';

const HIPOTESIS = 'Hipótesis provisoria: Esdras es un manual de liderazgo.';
const REVISADA = 'Dios cumple su palabra restaurando a su pueblo alrededor de su culto y su Ley.';
const PROPOSICION_DEL_PLAN = 'Proposición homilética que escribió el asistente.';
const OBJETIVO_DEL_PLAN = 'Objetivo pastoral que escribió el asistente.';

function fila(id: string, extra: Partial<PlannedSermon> = {}): PlannedSermon {
    return { id, week: 1, title: `Título ${id}`, description: '', passage: `Esdras ${id}`, ...extra };
}

const enriquecida = {
    exegeticalProposition: 'ep',
    homileticalProposition: PROPOSICION_DEL_PLAN,
    pastoralObjective: OBJETIVO_DEL_PLAN,
};

function serie(rows: PlannedSermon[], extra: Partial<SermonSeries> = {}): SermonSeries {
    return {
        id: 'ser1', userId: 'u1', title: 'Esdras — serie expositiva', description: '',
        sermonIds: [], draftIds: [], type: 'expository', resourceIds: [],
        createdAt: new Date(), updatedAt: new Date(),
        projectId: 'p1',
        metadata: { plannedSermons: rows },
        ...extra,
    };
}

const encuadreRevisado: ProjectFraming = {
    purpose: 'preach',
    centralIdea: HIPOTESIS,
    audience: 'Una iglesia que vuelve a empezar',
    need: 'El desánimo ante lo pequeño',
    needEvidence: 'Esd 3:12-13',
    desiredChange: 'Que perseveren',
    revision: { centralIdea: REVISADA, verdict: 'corrected', why: 'Los estudios', ofIdea: HIPOTESIS, revisedAt: '2026-10-20T00:00:00.000Z' },
};

function proyecto(framing?: ProjectFraming, extra: Partial<AIProject> = {}): AIProject {
    return { id: 'p1', title: 'Esdras', ...(framing ? { framing } : {}), ...extra } as AIProject;
}

const sermonBase = { id: 's3', sourceSermonId: undefined, sourcePaperId: undefined };

describe('seriesContextFor — la fila del sermón', () => {
    const rows = [
        fila('1', { draftId: 'otro' }),
        fila('2', { paperId: 'paper2' }),
        fila('3', { draftId: 's3', paperId: 'paper3' }),
    ];

    it('por su borrador (draftId === sermon.id)', () => {
        expect(seriesContextFor(sermonBase, serie(rows), null)).toMatchObject({ position: 3, total: 3 });
    });

    it('por la copia publicada (draftId === sermon.sourceSermonId)', () => {
        const copia = { id: 'copia', sourceSermonId: 's3', sourcePaperId: undefined };
        expect(seriesContextFor(copia, serie(rows), null)).toMatchObject({ position: 3 });
    });

    it('por el estudio (paperId === sermon.sourcePaperId)', () => {
        const delEstudio = { id: 'nuevo', sourceSermonId: undefined, sourcePaperId: 'paper2' };
        expect(seriesContextFor(delEstudio, serie(rows), null)).toMatchObject({ position: 2 });
    });

    it('el borrador gana sobre el estudio', () => {
        const ambos = { id: 's3', sourceSermonId: undefined, sourcePaperId: 'paper2' };
        expect(seriesContextFor(ambos, serie(rows), null)).toMatchObject({ position: 3 });
    });

    it('dos ausentes no son un vínculo: un sermón suelto no recibe lugar', () => {
        const suelto = { id: 'suelto', sourceSermonId: undefined, sourcePaperId: undefined };
        // La fila 2 no tiene draftId y el sermón no tiene sourceSermonId.
        expect(seriesContextFor(suelto, serie(rows), null)).toBeUndefined();
    });

    it('el orden es el de SeriesDetail: por fecha, las sin fecha al final, empates por orden del plan', () => {
        const d = (s: string) => new Date(`${s}T12:00:00`);
        const desordenadas = [
            fila('a', { scheduledDate: d('2026-11-15') }),
            fila('b'),
            fila('c', { scheduledDate: d('2026-11-01'), draftId: 's3' }),
            fila('d'),
            fila('e', { scheduledDate: d('2026-11-08') }),
        ];
        // Orden visto: c, e, a, b, d.
        expect(seriesContextFor(sermonBase, serie(desordenadas), null)).toMatchObject({ position: 1, total: 5 });
        const sinFecha = { id: 'x', sourceSermonId: undefined, sourcePaperId: undefined };
        desordenadas[3] = fila('d', { draftId: 'x' });
        expect(seriesContextFor(sinFecha, serie(desordenadas), null)).toMatchObject({ position: 5 });
    });

    it('sin proyecto en la serie: solo el lugar', () => {
        const ctx = seriesContextFor(sermonBase, serie(rows, { projectId: null }), [proyecto(encuadreRevisado)]);
        expect(ctx).toEqual({ title: 'Esdras — serie expositiva', position: 3, total: 3 });
    });
});

describe('seriesContextFor — lo que llega del encuadre', () => {
    const rows = [fila('1', { draftId: 's3', expositoryEnrichment: enriquecida })];

    it('la idea revisada y vigente, y el propósito pastoral', () => {
        const ctx = seriesContextFor(sermonBase, serie(rows), [proyecto(encuadreRevisado)]);
        expect(ctx?.revisedIdea).toBe(REVISADA);
        expect(ctx?.pastoral).toEqual({
            audience: 'Una iglesia que vuelve a empezar',
            need: 'El desánimo ante lo pequeño',
            needEvidence: 'Esd 3:12-13',
            desiredChange: 'Que perseveren',
        });
    });

    it('sin revisión no hay idea revisada (la provisoria NO la reemplaza)', () => {
        const { revision: _r, ...sinRevision } = encuadreRevisado;
        const ctx = seriesContextFor(sermonBase, serie(rows), [proyecto(sinRevision)]);
        expect(ctx).toBeDefined();
        expect(ctx).not.toHaveProperty('revisedIdea');
    });

    it('con la revisión desactualizada tampoco', () => {
        const editada = { ...encuadreRevisado, centralIdea: 'Otra idea, escrita después de consolidar.' };
        expect(seriesContextFor(sermonBase, serie(rows), [proyecto(editada)])).not.toHaveProperty('revisedIdea');
    });

    it('estudio personal: sin propósito pastoral, pero la idea revisada sigue', () => {
        const personal = { ...encuadreRevisado, purpose: 'personal' as const };
        const ctx = seriesContextFor(sermonBase, serie(rows), [proyecto(personal)]);
        expect(ctx).not.toHaveProperty('pastoral');
        expect(ctx?.revisedIdea).toBe(REVISADA);
    });

    it('propósito ausente cuenta como predicar', () => {
        const { purpose: _p, ...sinProposito } = encuadreRevisado;
        expect(seriesContextFor(sermonBase, serie(rows), [proyecto(sinProposito)])?.pastoral?.need).toBe('El desánimo ante lo pequeño');
    });

    it('campos pastorales vacíos no viajan; sin ninguno, no hay pastoral', () => {
        const vacio = { purpose: 'preach' as const, audience: '   ', need: 'La necesidad' };
        expect(seriesContextFor(sermonBase, serie(rows), [proyecto(vacio)])?.pastoral).toEqual({ need: 'La necesidad' });
        expect(seriesContextFor(sermonBase, serie(rows), [proyecto({ purpose: 'teach' })])).not.toHaveProperty('pastoral');
    });

    it('nunca la hipótesis provisoria ni la proposición ni el objetivo del plan', () => {
        const ctx = seriesContextFor(sermonBase, serie(rows), [proyecto(encuadreRevisado)]);
        const json = JSON.stringify(ctx);
        expect(json).not.toContain(HIPOTESIS);
        expect(json).not.toContain(PROPOSICION_DEL_PLAN);
        expect(json).not.toContain(OBJETIVO_DEL_PLAN);
    });
});

describe('buildRulesWithContext — las lecturas', () => {
    const rules: GenerationRules = { tone: 'pastoral' };
    const sermon = { id: 's3', seriesId: 'ser1', projectId: 'p1' };
    const rows = [fila('1', { draftId: 'otro' }), fila('2', { draftId: 's3', expositoryEnrichment: enriquecida })];
    const espiarWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
    let warn: ReturnType<typeof espiarWarn>;

    beforeEach(() => {
        Object.values(m).forEach(f => f.mockReset());
        m.getBySermonId.mockResolvedValue(null);
        warn = espiarWarn();
    });
    afterEach(() => warn.mockRestore());

    const build = () => buildRulesWithContext({ rules, derivedContext: null, sermonId: 's3', userId: 'u1' });

    it('lee el sermón y los proyectos UNA vez para los dos contextos, y suma la serie', async () => {
        m.getSermon.mockResolvedValue(sermon);
        m.getSeries.mockResolvedValue(serie(rows));
        m.getProjects.mockResolvedValue([proyecto(encuadreRevisado, { contextNote: 'Iglesia pequeña' })]);
        const out = await build();
        expect(m.getSermon).toHaveBeenCalledTimes(1);
        expect(m.getProjects).toHaveBeenCalledTimes(1);
        expect(m.getSeries).toHaveBeenCalledWith('ser1');
        expect(out.projectContext).toEqual({ name: 'Esdras', contextNote: 'Iglesia pequeña' });
        expect(out.seriesContext).toMatchObject({ title: 'Esdras — serie expositiva', position: 2, total: 2, revisedIdea: REVISADA });
        const json = JSON.stringify(out);
        expect(json).not.toContain(HIPOTESIS);
        expect(json).not.toContain(PROPOSICION_DEL_PLAN);
        expect(json).not.toContain(OBJETIVO_DEL_PLAN);
    });

    it('el proyecto sale de la serie aunque el sermón (marcador) no lleve projectId', async () => {
        m.getSermon.mockResolvedValue({ id: 's3', seriesId: 'ser1' });
        m.getSeries.mockResolvedValue(serie(rows));
        m.getProjects.mockResolvedValue([proyecto(encuadreRevisado, { contextNote: 'Nota' })]);
        const out = await build();
        expect(out.seriesContext?.pastoral?.need).toBe('El desánimo ante lo pequeño');
        // La nota del proyecto sigue siendo del sermón: sin projectId propio, no llega.
        expect(out).not.toHaveProperty('projectContext');
    });

    it('sin serie no se lee la serie ni cambia nada', async () => {
        m.getSermon.mockResolvedValue({ id: 's3' });
        const out = await build();
        expect(m.getSeries).not.toHaveBeenCalled();
        expect(m.getProjects).not.toHaveBeenCalled();
        expect(out).toEqual(rules);
    });

    it('la serie que falla no rompe la generación ni le quita la nota del proyecto', async () => {
        m.getSermon.mockResolvedValue(sermon);
        m.getSeries.mockRejectedValue(new Error('red caída'));
        m.getProjects.mockResolvedValue([proyecto(encuadreRevisado, { contextNote: 'Iglesia pequeña' })]);
        const out = await build();
        expect(out).not.toHaveProperty('seriesContext');
        expect(out.projectContext?.contextNote).toBe('Iglesia pequeña');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('No se pudo leer la serie'), expect.any(Error));
    });

    it('los proyectos que fallan: queda el lugar en la serie, sin encuadre', async () => {
        m.getSermon.mockResolvedValue(sermon);
        m.getSeries.mockResolvedValue(serie(rows));
        m.getProjects.mockRejectedValue(new Error('permiso'));
        const out = await build();
        expect(out.seriesContext).toEqual({ title: 'Esdras — serie expositiva', position: 2, total: 2 });
        expect(out).not.toHaveProperty('projectContext');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('No se pudo leer el proyecto'), expect.any(Error));
    });

    it('el sermón que falla: se genera con las reglas de base', async () => {
        m.getSermon.mockRejectedValue(new Error('red caída'));
        const out = await build();
        expect(out).toEqual(rules);
        expect(m.getSeries).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalled();
    });

    it('un plan con datos raros no rompe la generación', async () => {
        m.getSermon.mockResolvedValue(sermon);
        m.getSeries.mockResolvedValue(serie(null as unknown as PlannedSermon[], { metadata: { plannedSermons: 'roto' as never } }));
        m.getProjects.mockResolvedValue([]);
        const out = await build();
        expect(out).not.toHaveProperty('seriesContext');
        // Una fila nula no tumba a las demás.
        m.getSeries.mockResolvedValue(serie([null as unknown as PlannedSermon, fila('1', { draftId: 's3' })]));
        expect((await build()).seriesContext).toMatchObject({ position: 1, total: 1 });
    });
});
