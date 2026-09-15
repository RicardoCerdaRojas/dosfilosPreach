import {
    exegesisService,
    facultyService,
    pastoralSeedService,
    pastoralWordAnalysisReadService,
    sermonService,
} from '@dosfilos/application';
import { evaluatePastoralSeed, formatPassageReference, type GenerationRules, type Sermon } from '@dosfilos/domain';

type DerivedContext = NonNullable<NonNullable<Sermon['wizardProgress']>['derivedContext']>;

/**
 * TODO EL CONTEXTO QUE EL BORRADOR HEREDA, EN UN SOLO LUGAR.
 *
 * Cuatro procedencias distintas alimentan el mismo prompt: el paper de
 * exégesis, la sesión de Faculty, el proyecto al que pertenece el sermón y la
 * semilla pastoral de los ocho pasos. Se APILAN —un sermón derivado de un paper
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
 * T3 #16 Fase 2 — la nota de contexto del proyecto al que pertenece el sermón.
 * Apila independiente del paper/Faculty.
 *
 * Camino: sermonId → sermon.projectId → lista de proyectos → buscar por id.
 * `FacultyService` no expone un getter por proyecto; la lista es barata y ocurre
 * una vez por generación.
 */
async function conContextoDeProyecto(
    rules: GenerationRules,
    sermonId: string | null,
    userId: string | undefined,
): Promise<GenerationRules> {
    if (!sermonId || !userId) return rules;
    try {
        const sermon = await sermonService.getSermon(sermonId);
        if (!sermon?.projectId) return rules;
        const projects = await facultyService.getProjects.execute(userId);
        const project = projects.find((p) => p.id === sermon.projectId);
        if (!project?.contextNote?.trim()) return rules;
        // `title`, NO `name`: `AIProject` nunca tuvo un campo `name`, así que el
        // prompt venía recibiendo `undefined` como nombre del proyecto desde
        // siempre. El error estaba congelado en el baseline de tipos del paso,
        // donde no se leía; al mudarse acá quedó a la vista.
        return { ...rules, projectContext: { name: project.title, contextNote: project.contextNote } };
    } catch (error) {
        console.warn('[draft] No se pudo leer el proyecto — se genera sin ese contexto', error);
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
 * Encadena las cuatro procedencias en el orden de prioridad. El encadenamiento
 * vivía suelto dentro del generador, donde no se veía que fuera una secuencia
 * con un orden que importa.
 */
export async function buildRulesWithContext(input: RulesContextInput): Promise<GenerationRules> {
    const { rules, derivedContext, sermonId, userId } = input;
    const conPaper = await conContextoDePaper(rules, derivedContext, userId);
    const conFaculty = conContextoDeFaculty(conPaper, derivedContext);
    const conProyecto = await conContextoDeProyecto(conFaculty, sermonId, userId);
    return conSemillaPastoral(conProyecto, sermonId, userId);
}
