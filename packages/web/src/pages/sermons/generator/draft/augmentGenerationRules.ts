import {
    exegesisService,
    facultyService,
    pastoralSeedService,
    pastoralWordAnalysisReadService,
    seriesService,
    sermonService,
} from '@dosfilos/application';
import {
    currentRevisedIdea,
    evaluatePastoralSeed,
    formatPassageReference,
    type AIProject,
    type GenerationRules,
    type PlannedSermon,
    type Sermon,
    type SermonSeries,
} from '@dosfilos/domain';

type DerivedContext = NonNullable<NonNullable<Sermon['wizardProgress']>['derivedContext']>;

/**
 * TODO EL CONTEXTO QUE EL BORRADOR HEREDA, EN UN SOLO LUGAR.
 *
 * Cinco procedencias distintas alimentan el mismo prompt: el paper de
 * exégesis, la sesión de Faculty, el proyecto al que pertenece el sermón, su
 * lugar en la serie (con el encuadre del proyecto de la serie) y la semilla
 * pastoral de los ocho pasos. Se APILAN —un sermón derivado de un paper
 * dentro de un proyecto recibe los dos bloques— y por eso el orden importa: la
 * semilla va última porque tiene la prioridad más alta (paper y Faculty sólo
 * alimentaron sugerencias; la semilla es lo que el pastor CONFIRMÓ).
 *
 * TODAS SON BEST-EFFORT, y esa es la regla que las une: un paper borrado, una
 * red caída o una semilla incompleta no pueden impedir que el sermón se genere.
 * Se cae a las reglas sin enriquecer y el pastor obtiene su borrador — con menos
 * contexto, pero lo obtiene.
 */

/**
 * T3 #16 Fase 1 — adjunta el `assembledMarkdown` del paper cuando el sermón
 * nació de uno. Deja que el prompt vea el paper completo en CADA generación, en
 * vez de colapsar a homilética+reglas.
 */
async function conContextoDePaper(
    rules: GenerationRules,
    derivedContext: DerivedContext | null,
    userId: string | undefined,
): Promise<GenerationRules> {
    if (derivedContext?.kind !== 'paper' || !userId) return rules;
    try {
        const paper = await exegesisService.getPaper.execute(userId, derivedContext.paperId);
        if (!paper?.assembledMarkdown) return rules;
        const passageLabel = typeof paper.passage === 'string'
            ? paper.passage
            : formatPassageReference(paper.passage, (paper as any).displayLanguage ?? 'es');
        return {
            ...rules,
            paperContext: {
                passage: passageLabel,
                title: paper.title ?? derivedContext.paperTitle,
                assembledMarkdown: paper.assembledMarkdown,
                assignmentBrief: paper.assignmentBrief ?? undefined,
            },
        };
    } catch (error) {
        console.warn('[draft] No se pudo leer el paper — se genera sin ese contexto', error);
        return rules;
    }
}

/**
 * T3 #16 Fase 2 — adjunta el bosquejo aprobado en Faculty. No hace falta ir a
 * buscarlo: `derivedContext` ya lo trae desde que se creó el sermón.
 *
 * La transcripción del chat NO se incluye a propósito: el bosquejo y la
 * personalización capturan lo accionable, y 10k tokens de conversación
 * degradarían el prompt.
 */
function conContextoDeFaculty(
    rules: GenerationRules,
    derivedContext: DerivedContext | null,
): GenerationRules {
    if (derivedContext?.kind !== 'faculty') return rules;
    return {
        ...rules,
        facultyContext: {
            sessionTitle: derivedContext.sessionTitle,
            outline: derivedContext.outline,
        },
    };
}

/**
 * Lo que el sermón sabe de dónde vive: él mismo, su serie y los proyectos del
 * usuario. Se lee UNA vez por generación y lo comparten el contexto del
 * proyecto y el de la serie.
 *
 * Cada lectura cae sola: una serie borrada no le quita al sermón la nota de
 * su proyecto, y una lista de proyectos que no llega no le quita su lugar en
 * la serie. Los proyectos se piden solo si alguien los va a usar.
 */
interface SermonSurroundings {
    sermon: Sermon | null;
    series: SermonSeries | null;
    projects: AIProject[] | null;
}

async function leerEntorno(sermonId: string | null, userId: string | undefined): Promise<SermonSurroundings> {
    const vacio: SermonSurroundings = { sermon: null, series: null, projects: null };
    if (!sermonId || !userId) return vacio;
    let sermon: Sermon | null;
    try {
        sermon = await sermonService.getSermon(sermonId);
    } catch (error) {
        console.warn('[draft] No se pudo leer el sermón — se genera sin contexto de proyecto ni de serie', error);
        return vacio;
    }
    if (!sermon) return vacio;
    let series: SermonSeries | null = null;
    if (sermon.seriesId) {
        try {
            series = await seriesService.getSeries(sermon.seriesId);
        } catch (error) {
            console.warn('[draft] No se pudo leer la serie — se genera sin ese contexto', error);
        }
    }
    let projects: AIProject[] | null = null;
    if (sermon.projectId || series?.projectId) {
        try {
            projects = await facultyService.getProjects.execute(userId);
        } catch (error) {
            console.warn('[draft] No se pudo leer el proyecto — se genera sin ese contexto', error);
        }
    }
    return { sermon, series, projects };
}

/**
 * T3 #16 Fase 2 — la nota de contexto del proyecto al que pertenece el sermón.
 * Apila independiente del paper/Faculty.
 *
 * Camino: sermon.projectId → lista de proyectos → buscar por id.
 * `FacultyService` no expone un getter por proyecto; la lista es barata y ocurre
 * una vez por generación.
 */
function conContextoDeProyecto(rules: GenerationRules, entorno: SermonSurroundings): GenerationRules {
    const { sermon, projects } = entorno;
    if (!sermon?.projectId || !projects) return rules;
    const project = projects.find((p) => p.id === sermon.projectId);
    if (!project?.contextNote?.trim()) return rules;
    // `title`, NO `name`: `AIProject` nunca tuvo un campo `name`, así que el
    // prompt venía recibiendo `undefined` como nombre del proyecto desde
    // siempre. El error estaba congelado en el baseline de tipos del paso,
    // donde no se leía; al mudarse acá quedó a la vista.
    return { ...rules, projectContext: { name: project.title, contextNote: project.contextNote } };
}

type PlannedRow = Pick<PlannedSermon, 'id' | 'draftId' | 'paperId' | 'scheduledDate'>;

function fechaDe(row: PlannedRow): number | null {
    if (!row.scheduledDate) return null;
    const t = new Date(row.scheduledDate).getTime();
    return Number.isNaN(t) ? null : t;
}

/**
 * Las filas del plan en el orden en que el pastor ve la serie: el MISMO
 * criterio de `useSeriesData` (SeriesDetail) — por fecha programada, las sin
 * fecha al final, y entre iguales manda el orden del plan (`sort` es estable).
 * Si el sermón dijera «3 de 12» y la pantalla lo mostrara cuarto, el pastor
 * dejaría de creerle a los dos.
 */
function filasEnOrden<R extends PlannedRow>(rows: ReadonlyArray<R>): R[] {
    return [...rows].sort((a, b) => {
        const ta = fechaDe(a);
        const tb = fechaDe(b);
        if (ta !== null && tb !== null) return ta - tb;
        if (ta !== null) return -1;
        if (tb !== null) return 1;
        return 0;
    });
}

/**
 * La fila del plan que le corresponde al sermón, por tres vías en orden de
 * certeza: es su borrador (`draftId`), es la copia publicada de su borrador
 * (`sourceSermonId`), o nació del estudio de esa perícopa (`sourcePaperId`).
 * Cada vía exige el dato presente en los dos lados: dos `undefined` no son
 * un vínculo.
 */
function filaDelSermon<R extends PlannedRow>(
    rows: ReadonlyArray<R>,
    sermon: Pick<Sermon, 'id' | 'sourceSermonId' | 'sourcePaperId'>,
): R | null {
    const porBorrador = (id: string | undefined) => (id ? rows.find((r) => r.draftId === id) : undefined);
    return (
        porBorrador(sermon.id)
        ?? porBorrador(sermon.sourceSermonId)
        ?? (sermon.sourcePaperId ? rows.find((r) => r.paperId === sermon.sourcePaperId) : undefined)
        ?? null
    );
}

/**
 * El lugar del sermón en su serie y lo que el pastor escribió y revisó en el
 * encuadre (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, §2 paso 11). Puro: lo
 * prueban sin red.
 *
 * - `total` cuenta FILAS del plan: cada fila es un sermón (un domingo), tenga
 *   o no borrador. Los marcadores vacíos (`isEmptySermonPlaceholder`) son
 *   borradores colgados de una fila, no filas, así que no cambian la cuenta.
 *   No se cuentan unidades (`plannedUnits`): eso es para el estudio, que
 *   dice «perícopa 3 de 12»; el sermón dice «sermón k de N».
 * - Un sermón de la serie que no está en el plan (borrador suelto) no tiene
 *   lugar que decir: no recibe nada. Mejor callar que inventar un número.
 * - El proyecto sale de `series.projectId`: los marcadores de sermón no
 *   llevan `projectId`, y el encuadre es de la serie, no del sermón.
 * - `pastoral` solo fuera de «estudio personal» (ausente cuenta como
 *   «predicar»). `revisedIdea` solo si está consolidada y vigente
 *   (`currentRevisedIdea`). La hipótesis provisoria y lo que el asistente
 *   escribió en la fila no viajan nunca.
 */
export function seriesContextFor(
    sermon: Pick<Sermon, 'id' | 'sourceSermonId' | 'sourcePaperId'>,
    series: Pick<SermonSeries, 'title' | 'projectId' | 'metadata'>,
    projects: ReadonlyArray<Pick<AIProject, 'id' | 'framing'>> | null,
): GenerationRules['seriesContext'] | undefined {
    // El plan llega de Firestore sin validar: una fila que no es objeto no cuenta.
    const plan: unknown = series.metadata?.plannedSermons;
    const rows = filasEnOrden(
        Array.isArray(plan) ? plan.filter((r): r is PlannedSermon => !!r && typeof r === 'object') : [],
    );
    const fila = filaDelSermon(rows, sermon);
    if (!fila || !series.title?.trim()) return undefined;
    const ctx: NonNullable<GenerationRules['seriesContext']> = {
        title: series.title.trim(),
        position: rows.indexOf(fila) + 1,
        total: rows.length,
    };
    const framing = series.projectId ? projects?.find((p) => p.id === series.projectId)?.framing : undefined;
    if (!framing) return ctx;
    if (framing.purpose !== 'personal') {
        const pastoral: NonNullable<NonNullable<GenerationRules['seriesContext']>['pastoral']> = {};
        for (const k of ['audience', 'need', 'needEvidence', 'desiredChange'] as const) {
            const v = framing[k]?.trim();
            if (v) pastoral[k] = v;
        }
        if (Object.keys(pastoral).length) ctx.pastoral = pastoral;
    }
    const revisedIdea = currentRevisedIdea(framing);
    if (revisedIdea) ctx.revisedIdea = revisedIdea;
    return ctx;
}

/** Adjunta `seriesContext` cuando el sermón vive en una serie y ocupa una fila de su plan. */
function conContextoDeSerie(rules: GenerationRules, entorno: SermonSurroundings): GenerationRules {
    const { sermon, series, projects } = entorno;
    if (!sermon || !series) return rules;
    try {
        const seriesContext = seriesContextFor(sermon, series, projects);
        return seriesContext ? { ...rules, seriesContext } : rules;
    } catch (error) {
        // Un plan con datos raros no puede impedir el borrador.
        console.warn('[draft] No se pudo armar el contexto de la serie — se genera sin ese contexto', error);
        return rules;
    }
}

/**
 * Le adjunta a cada estudio de palabra SU ANÁLISIS LÉXICO, si existe.
 *
 * POR QUÉ HACÍA FALTA: el seed guarda `wordAnalysisId` desde la Fase 1.5 y el
 * análisis cacheado (`pastoralWordAnalyses/`) trae rango semántico, uso en el
 * versículo y peso teológico — exactamente lo que el pastor espera ver en las
 * palabras clave del sermón. Nunca llegaba: el mapeo pasaba sólo su
 * descubrimiento, y el borrador lo imprimía como si fuera la glosa.
 *
 * BEST-EFFORT A PROPÓSITO. Un análisis que no está —estudio escrito a mano, o
 * caché expirada por versión curada nueva— no puede impedir que el sermón se
 * genere. Se cae al comportamiento anterior: sólo el descubrimiento del pastor,
 * pero ahora rotulado como suyo.
 */
async function hidratarEstudiosDePalabra(
    studies: readonly { word: string; reference: string; pastorDiscovery: string; wordAnalysisId?: string }[],
): Promise<NonNullable<GenerationRules['pastoralSeed']>['wordStudies']> {
    return Promise.all(
        studies.map(async (w) => {
            const base = { word: w.word, reference: w.reference, discovery: w.pastorDiscovery };
            if (!w.wordAnalysisId) return base;
            try {
                const doc = await pastoralWordAnalysisReadService.findById(w.wordAnalysisId);
                if (!doc) return base;
                const a = doc.analysis;
                return {
                    ...base,
                    ...(a.gloss?.semanticRange?.length ? { semanticRange: a.gloss.semanticRange } : {}),
                    ...(a.grammaticalFunctionInVerse ? { useInVerse: a.grammaticalFunctionInVerse } : {}),
                    ...(a.theologicalWeight ? { theologicalWeight: a.theologicalWeight } : {}),
                    ...(a.lexiconSource ? { lexiconSource: String(a.lexiconSource) } : {}),
                };
            } catch (error) {
                console.warn('[draft] No se pudo leer el análisis de', w.word, error);
                return base;
            }
        }),
    );
}

/**
 * Pastoral Fidelity Fase 1 — la semilla de los ocho pasos se convierte en la
 * VOZ PRIMARIA del prompt.
 *
 * La completitud la deciden los validadores, NO el flag guardado en el
 * documento: una semilla marcada completa que perdió un paso seguiría entrando
 * como voz primaria a medias.
 */
async function conSemillaPastoral(
    rules: GenerationRules,
    sermonId: string | null,
    userId: string | undefined,
): Promise<GenerationRules> {
    if (!sermonId) return rules;
    try {
        const seed = await pastoralSeedService.getBySermonId(sermonId, { userId });
        if (!seed || !evaluatePastoralSeed(seed).completed) return rules;
        return {
            ...rules,
            pastoralSeed: {
                centralIdea: seed.insight.centralIdea,
                observations: seed.insight.observations,
                openQuestion: seed.insight.openQuestion,
                pastoralAnecdote: seed.insight.pastoralAnecdote,
                doxologicalApplication: seed.insight.doxologicalApplication,
                mainClauseReference: seed.structuralAnalysis.mainClause.reference,
                mainClauseNote: seed.structuralAnalysis.mainClause.pastorNote,
                wordStudies: await hidratarEstudiosDePalabra(seed.wordStudies.studies),
                parallels: seed.recognition.parallels.map((p) => ({
                    reference: p.reference,
                    relevance: p.relevanceNote,
                })),
                originalAudienceFunction: seed.function.originalAudienceFunction,
                genre: seed.contextGenre.genre || undefined,
                genreImplication: seed.contextGenre.genreImplication || undefined,
                bookLocationNote: seed.contextGenre.bookLocationNote || undefined,
                timelessPrinciple: seed.timelessPrinciple.principle || undefined,
            },
        };
    } catch (error) {
        console.warn('[draft] No se pudo leer la semilla pastoral — se genera sin VOZ PRIMARIA', error);
        return rules;
    }
}

export interface RulesContextInput {
    rules: GenerationRules;
    derivedContext: DerivedContext | null;
    sermonId: string | null;
    userId: string | undefined;
}

/**
 * Encadena las cinco procedencias en el orden de prioridad. El encadenamiento
 * vivía suelto dentro del generador, donde no se veía que fuera una secuencia
 * con un orden que importa.
 */
export async function buildRulesWithContext(input: RulesContextInput): Promise<GenerationRules> {
    const { rules, derivedContext, sermonId, userId } = input;
    const conPaper = await conContextoDePaper(rules, derivedContext, userId);
    const conFaculty = conContextoDeFaculty(conPaper, derivedContext);
    const entorno = await leerEntorno(sermonId, userId);
    const conProyecto = conContextoDeProyecto(conFaculty, entorno);
    const conSerie = conContextoDeSerie(conProyecto, entorno);
    return conSemillaPastoral(conSerie, sermonId, userId);
}
