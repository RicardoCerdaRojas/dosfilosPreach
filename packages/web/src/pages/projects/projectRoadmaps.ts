import {
    BookOpen,
    ScrollText,
    Mic2,
    HeartHandshake,
    GraduationCap,
    Sparkles,
    Languages,
    MessageSquareQuote,
    FileEdit,
    NotebookPen,
    FileCode,
    type LucideIcon,
} from 'lucide-react';
import type { AIProject, ProjectType, ProjectOutput, SermonEntity } from '@dosfilos/domain';

/**
 * Lo que cada tipo de proyecto muestra en su escritorio
 * (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §2.9): sus capacidades y, para
 * los tipos que todavía no tienen escritorio propio, su recorrido de hoy.
 *
 * Exegético y Curso NO tienen recorrido aquí: sus fases, estados y «Ahora»
 * salen del dominio (`buildProjectDesk`), con su evidencia. Antes el
 * Exegético estaba escrito dos veces y una acción completaba fases que no
 * tenían relación entre sí. General no tiene modelo (como un estudio en
 * blanco): su escritorio no dibuja fases, pero conserva su lista para
 * quienes la lean.
 *
 * Los recorridos que quedan (Investigación, Consejería, Sermón, Serie y
 * General) son presentacionales: `isComplete` solo mira datos del proyecto.
 */

/** Qué hace el botón de una fase. Un solo lugar: antes estaba copiado en tres. */
export type RoadmapCtaKind = 'newSession' | 'greek' | 'hebrew' | 'sermon' | 'output' | 'sources' | 'study' | 'charge' | 'stateOfArt' | 'planSeries' | 'openSeries' | 'frame';

export interface RoadmapContext {
    project: AIProject;
    /** Estudios del proyecto: de origen y vinculados (ADR-046). */
    studyCount: number;
    sourceCount: number;
    greekCount: number;
    hebrewCount: number;
    sessionCount: number;
    outputs: ProjectOutput[];
    /** Cada versión: el recorrido de Serie cuenta como antes, sin agrupar. */
    sermons: ReadonlyArray<Pick<SermonEntity, 'id'>>;
}

export interface RoadmapPhase {
    id: string;
    title: string;
    /** Short description shown when this phase is the current step. */
    description: string;
    icon: LucideIcon;
    /** Clave bajo `roadmap.phases.` en projects.json; sin ella se muestran los textos de aquí. */
    i18nKey?: string;
    isComplete: (ctx: RoadmapContext) => boolean;
    /** Primary CTA — surfaced when this is the active step. */
    cta: {
        label: string;
        kind: RoadmapCtaKind;
    };
    /**
     * La misma fase según el estado del proyecto: cambia su botón (y sus
     * textos) sin cambiar cuándo se cumple. `computeRoadmapState` la aplica.
     */
    variant?: (ctx: RoadmapContext) => Partial<Pick<RoadmapPhase, 'description' | 'cta' | 'i18nKey'>> | null;
}

/**
 * Qué muestra el escritorio de cada tipo. Reemplaza los `includes([...])`
 * que el panel tenía regados (deuda 6): Consejería mostraba estudios y
 * griego, y un Exegético las opciones de curso.
 */
export interface ProjectTypeCapabilities {
    /**
     * De dónde salen el recorrido y «Ahora»: `exegetical` y `course`, del
     * dominio con su mesa; `general`, del dominio sin fases (lo último que se
     * tocó); `legacy`, el recorrido de aquí, como hasta ahora.
     */
    desk: 'exegetical' | 'course' | 'general' | 'legacy';
    /** La lista simple de estudios (los tipos sin mesa propia). */
    studies: boolean;
    /** Las herramientas de griego y hebreo. */
    languages: boolean;
    /**
     * Cómo se eligen las fuentes. `stateOfArt`: solo por el estado del arte
     * (Exegético y Curso, sin atajo que apruebe sin pasar por el método);
     * `picker`: el selector de la biblioteca; `both`: los dos (Investigación).
     */
    sources: 'stateOfArt' | 'picker' | 'both';
    /** Los datos del curso y los tipos de trabajo como tarjetas: abiertas, plegadas mientras no se usen, o ninguna. */
    courseSetup: 'open' | 'collapsible' | 'none';
    /** La tarjeta de series de los tipos viejos (en Exegético la serie vive en su mesa). */
    seriesCard: 'always' | 'whenLinked';
}

export interface ProjectTypeMeta {
    type: ProjectType;
    label: string;
    description: string;
    icon: LucideIcon;
    roadmap: RoadmapPhase[];
    capabilities: ProjectTypeCapabilities;
}

const SERMON_ROADMAP: RoadmapPhase[] = [
    {
        id: 'sources',
        title: 'Pasaje y fuentes',
        description: 'Define el pasaje del sermón y adjunta las fuentes (comentarios, libros) que vas a consultar.',
        icon: BookOpen,
        isComplete: (ctx) => !!ctx.project.contextNote && ctx.sourceCount > 0,
        cta: { label: 'Adjuntar fuentes', kind: 'sources' },
    },
    {
        id: 'languages',
        title: 'Estudio del original',
        description: 'Estudia el griego o hebreo del pasaje. Identifica formas, sintaxis, palabras clave.',
        icon: Languages,
        isComplete: (ctx) => ctx.greekCount > 0 || ctx.hebrewCount > 0,
        cta: { label: 'Estudiar griego', kind: 'greek' },
    },
    {
        id: 'tutors',
        title: 'Consulta exegética',
        description: 'Conversa con tus tutores teológicos sobre el pasaje. Sus respuestas alimentan tus notas.',
        icon: MessageSquareQuote,
        isComplete: (ctx) => ctx.sessionCount > 0,
        cta: { label: 'Iniciar conversación', kind: 'newSession' },
    },
    {
        id: 'outline',
        title: 'Bosquejo',
        description: 'Construye el esqueleto del sermón: proposición, divisiones, transiciones, aplicación.',
        icon: FileCode,
        isComplete: (ctx) => ctx.outputs.some((o) => o.kind === 'outline' || o.kind === 'draft'),
        cta: { label: 'Crear bosquejo', kind: 'output' },
    },
    {
        id: 'sermon',
        title: 'Sermón completo',
        description: 'Redacta o genera el sermón final, listo para predicar.',
        icon: Mic2,
        isComplete: (ctx) =>
            ctx.outputs.some((o) => o.kind === 'sermon') || ctx.sermons.length > 0,
        cta: { label: 'Generar sermón', kind: 'sermon' },
    },
];

const COUNSELING_ROADMAP: RoadmapPhase[] = [
    {
        id: 'situation',
        title: 'Recopila la situación',
        description: 'Documenta el contexto del aconsejado: datos, historia, problema presentado.',
        icon: NotebookPen,
        isComplete: (ctx) =>
            !!ctx.project.contextNote || ctx.outputs.some((o) => o.kind === 'note'),
        cta: { label: 'Crear nota inicial', kind: 'output' },
    },
    {
        id: 'biblical',
        title: 'Análisis bíblico',
        description: 'Identifica los principios bíblicos aplicables. Adjunta material de consejería que uses.',
        icon: BookOpen,
        isComplete: (ctx) => ctx.sourceCount > 0,
        cta: { label: 'Adjuntar fuentes', kind: 'sources' },
    },
    {
        id: 'pastoral',
        title: 'Orientación pastoral',
        description: 'Consulta al Pastor Noutético u otros tutores para discernir el enfoque correcto.',
        icon: HeartHandshake,
        isComplete: (ctx) => ctx.sessionCount > 0,
        cta: { label: 'Hablar con un tutor', kind: 'newSession' },
    },
    {
        id: 'plan',
        title: 'Plan de acción',
        description: 'Elabora el plan de tareas, pasajes a meditar, hábitos a desarrollar (Jay Adams / ACBC).',
        icon: FileEdit,
        isComplete: (ctx) => ctx.outputs.some((o) => o.kind === 'draft' || o.kind === 'outline'),
        cta: { label: 'Escribir plan', kind: 'output' },
    },
    {
        id: 'followup',
        title: 'Seguimiento',
        description: 'Registra el progreso de cada sesión y los próximos pasos.',
        icon: NotebookPen,
        isComplete: (ctx) =>
            ctx.outputs.filter((o) => o.kind === 'note').length >= 2,
        cta: { label: 'Nueva nota de seguimiento', kind: 'output' },
    },
];

const STUDY_ROADMAP: RoadmapPhase[] = [
    {
        id: 'topic',
        title: 'Define el tema',
        description: 'Escribe la pregunta o tópico que quieres investigar. Acota el alcance.',
        icon: NotebookPen,
        // El botón de esta fase escribe una nota: también la completa.
        isComplete: (ctx) => !!ctx.project.contextNote || ctx.outputs.some((o) => o.kind === 'note'),
        cta: { label: 'Definir el tema', kind: 'output' },
    },
    {
        id: 'sources',
        title: 'Reúne fuentes',
        description: 'Adjunta los libros, artículos y comentarios que vas a consultar.',
        icon: BookOpen,
        isComplete: (ctx) => ctx.sourceCount > 0,
        cta: { label: 'Preparar el estado del arte', kind: 'stateOfArt' },
    },
    {
        id: 'studies',
        title: 'Estudios',
        description: 'Un estudio por cada pasaje, tema o término que responde a la pregunta.',
        icon: ScrollText,
        isComplete: (ctx) => ctx.studyCount > 0,
        cta: { label: 'Nuevo estudio', kind: 'study' },
    },
    {
        id: 'synthesis',
        title: 'Síntesis con tutores',
        description: 'Conversa con la facultad teológica para sintetizar lo aprendido.',
        icon: MessageSquareQuote,
        isComplete: (ctx) => ctx.sessionCount > 0,
        cta: { label: 'Iniciar conversación', kind: 'newSession' },
    },
    {
        id: 'document',
        title: 'Documento final',
        description: 'Redacta el documento de estudio para tu archivo personal o compartir.',
        icon: FileEdit,
        isComplete: (ctx) => ctx.outputs.some((o) => o.kind === 'draft' || o.kind === 'note'),
        cta: { label: 'Escribir documento', kind: 'output' },
    },
];

const SERIES_ROADMAP: RoadmapPhase[] = [
    {
        id: 'frame',
        title: 'Marco de la serie',
        description: 'Define el libro o tema, número de mensajes, audiencia y arco general.',
        icon: NotebookPen,
        // El botón de esta fase escribe una nota: también la completa.
        isComplete: (ctx) => !!ctx.project.contextNote || ctx.outputs.some((o) => o.kind === 'note'),
        cta: { label: 'Escribir marco', kind: 'output' },
    },
    {
        id: 'sources',
        title: 'Bibliografía base',
        description: 'Adjunta los comentarios y monografías que vas a usar en toda la serie.',
        icon: BookOpen,
        isComplete: (ctx) => ctx.sourceCount > 0,
        cta: { label: 'Adjuntar fuentes', kind: 'sources' },
    },
    {
        id: 'overview',
        title: 'Estudio general',
        description: 'Conversa con tutores sobre el contexto histórico, teología y estructura del libro.',
        icon: MessageSquareQuote,
        isComplete: (ctx) => ctx.sessionCount > 0,
        cta: { label: 'Iniciar conversación', kind: 'newSession' },
    },
    {
        id: 'outlines',
        title: 'Bosquejos por mensaje',
        description: 'Crea un bosquejo por cada mensaje de la serie. Bloque exegético, bloque homilético.',
        icon: FileCode,
        isComplete: (ctx) =>
            ctx.outputs.filter((o) => o.kind === 'outline').length >= 2,
        cta: { label: 'Nuevo bosquejo', kind: 'output' },
    },
    {
        id: 'sermons',
        title: 'Sermones',
        description: 'Redacta o genera cada sermón a partir de su bosquejo.',
        icon: Mic2,
        isComplete: (ctx) =>
            ctx.outputs.filter((o) => o.kind === 'sermon').length + ctx.sermons.length >= 2,
        cta: { label: 'Generar sermón', kind: 'sermon' },
    },
];

const GENERAL_ROADMAP: RoadmapPhase[] = [
    {
        id: 'context',
        title: 'Contexto',
        description: 'Describe en qué consiste este proyecto.',
        icon: NotebookPen,
        // El botón de esta fase escribe una nota: también la completa.
        isComplete: (ctx) => !!ctx.project.contextNote || ctx.outputs.some((o) => o.kind === 'note'),
        cta: { label: 'Editar contexto', kind: 'output' },
    },
    {
        id: 'sources',
        title: 'Fuentes',
        description: 'Adjunta los recursos que vas a consultar.',
        icon: BookOpen,
        isComplete: (ctx) => ctx.sourceCount > 0,
        cta: { label: 'Adjuntar fuentes', kind: 'sources' },
    },
    {
        id: 'work',
        title: 'Trabajo',
        description: 'Conversa con tutores y produce material.',
        icon: MessageSquareQuote,
        isComplete: (ctx) => ctx.sessionCount > 0 || ctx.outputs.length > 0,
        cta: { label: 'Iniciar conversación', kind: 'newSession' },
    },
];

export const PROJECT_TYPES: Record<ProjectType, ProjectTypeMeta> = {
    sermon: {
        type: 'sermon',
        label: 'Sermón',
        description: 'Un mensaje individual: pasaje, exégesis, bosquejo y redacción.',
        icon: Mic2,
        roadmap: SERMON_ROADMAP,
        capabilities: { desk: 'legacy', studies: true, languages: true, sources: 'picker', courseSetup: 'none', seriesCard: 'always' },
    },
    series: {
        type: 'series',
        label: 'Serie',
        description: 'Una secuencia de mensajes sobre un libro o tema, con marco común.',
        icon: GraduationCap,
        roadmap: SERIES_ROADMAP,
        capabilities: { desk: 'legacy', studies: true, languages: true, sources: 'picker', courseSetup: 'none', seriesCard: 'always' },
    },
    counseling: {
        type: 'counseling',
        label: 'Consejería',
        description: 'Acompañamiento pastoral: situación, análisis bíblico, plan de acción, seguimiento.',
        icon: HeartHandshake,
        roadmap: COUNSELING_ROADMAP,
        capabilities: { desk: 'legacy', studies: false, languages: false, sources: 'picker', courseSetup: 'none', seriesCard: 'whenLinked' },
    },
    study: {
        type: 'study',
        label: 'Investigación',
        description: 'Una pregunta que se responde con varios estudios: pasajes, temas o términos.',
        icon: BookOpen,
        roadmap: STUDY_ROADMAP,
        capabilities: { desk: 'legacy', studies: true, languages: true, sources: 'both', courseSetup: 'open', seriesCard: 'whenLinked' },
    },
    course: {
        type: 'course',
        label: 'Curso',
        description: 'Las tareas de un curso (TP, ensayos, investigación final), cada una con su rúbrica, sobre una bibliografía común.',
        icon: GraduationCap,
        // Sus fases salen del dominio (`buildProjectDesk`).
        roadmap: [],
        capabilities: { desk: 'course', studies: false, languages: true, sources: 'stateOfArt', courseSetup: 'none', seriesCard: 'whenLinked' },
    },
    exegetical: {
        type: 'exegetical',
        label: 'Exegético',
        description: 'Un pasaje largo estudiado por perícopas, para predicarlo, enseñarlo o archivarlo.',
        icon: ScrollText,
        // Sus fases salen del dominio (`buildProjectDesk`).
        roadmap: [],
        capabilities: { desk: 'exegetical', studies: false, languages: true, sources: 'stateOfArt', courseSetup: 'none', seriesCard: 'whenLinked' },
    },
    general: {
        type: 'general',
        label: 'General',
        description: 'Proyecto libre, sin un flujo prescrito.',
        icon: Sparkles,
        roadmap: GENERAL_ROADMAP,
        capabilities: { desk: 'general', studies: true, languages: true, sources: 'picker', courseSetup: 'collapsible', seriesCard: 'whenLinked' },
    },
};

export function getProjectTypeMeta(type?: ProjectType): ProjectTypeMeta {
    const clave = type ?? 'general';
    return Object.prototype.hasOwnProperty.call(PROJECT_TYPES, clave) ? PROJECT_TYPES[clave] : PROJECT_TYPES.general;
}

/** El estado de un recorrido de los tipos viejos: un solo tipo, sin moldes a mano en el panel. */
export interface RoadmapState {
    phases: Array<{ phase: RoadmapPhase; complete: boolean }>;
    activeIndex: number;
    allComplete: boolean;
}

/**
 * Computes the current state of every phase for a project, plus identifies
 * the "active" phase (the first one that's not yet complete). When all
 * phases are complete, returns the last phase as active (a finished project).
 */
export function computeRoadmapState(meta: ProjectTypeMeta, ctx: RoadmapContext): RoadmapState {
    const phases = meta.roadmap.map((phase) => {
        const cambio = phase.variant?.(ctx);
        return {
            phase: cambio ? { ...phase, ...cambio } : phase,
            complete: phase.isComplete(ctx),
        };
    });
    const activeIdx = phases.findIndex((p) => !p.complete);
    return {
        phases,
        activeIndex: activeIdx === -1 ? phases.length - 1 : activeIdx,
        allComplete: activeIdx === -1,
    };
}
