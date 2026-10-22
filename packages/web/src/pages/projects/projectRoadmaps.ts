import {
    BookOpen,
    ClipboardList,
    Library,
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
import { hasProjectCharge, type AIProject, type ProjectType, type ProjectOutput, type SermonEntity, type AIChatSession } from '@dosfilos/domain';

/**
 * Roadmap definitions per project type. Each phase represents one step in the
 * pastor's natural workflow for that kind of work. Phases are ordered, and the
 * first non-complete phase becomes the "current step" surfaced to the user.
 *
 * Roadmaps are presentational: they live in the web layer (not the domain)
 * because they describe how we COACH the user through the work, not data
 * invariants. The completion check (`isComplete`) only inspects existing
 * project data — no separate state to maintain.
 */

/** Qué hace el botón de una fase. Un solo lugar: antes estaba copiado en tres. */
export type RoadmapCtaKind = 'newSession' | 'greek' | 'hebrew' | 'sermon' | 'output' | 'sources' | 'study' | 'charge';

export interface RoadmapContext {
    project: AIProject;
    /** Estudios del proyecto: de origen y vinculados (ADR-046). */
    studyCount: number;
    /** Estudios del proyecto ya ensamblados (listos para entregar). */
    deliveredCount: number;
    sourceCount: number;
    greekCount: number;
    hebrewCount: number;
    sessionCount: number;
    outputs: ProjectOutput[];
    sermons: SermonEntity[];
    sessions: AIChatSession[];
}

export interface RoadmapPhase {
    id: string;
    title: string;
    /** Short description shown when this phase is the current step. */
    description: string;
    icon: LucideIcon;
    isComplete: (ctx: RoadmapContext) => boolean;
    /** Primary CTA — surfaced when this is the active step. */
    cta: {
        label: string;
        kind: RoadmapCtaKind;
    };
}

export interface ProjectTypeMeta {
    type: ProjectType;
    label: string;
    description: string;
    icon: LucideIcon;
    roadmap: RoadmapPhase[];
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
        isComplete: (ctx) => !!ctx.project.contextNote,
        cta: { label: 'Definir el tema', kind: 'output' },
    },
    {
        id: 'sources',
        title: 'Reúne fuentes',
        description: 'Adjunta los libros, artículos y comentarios que vas a consultar.',
        icon: BookOpen,
        isComplete: (ctx) => ctx.sourceCount > 0,
        cta: { label: 'Adjuntar fuentes', kind: 'sources' },
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
        isComplete: (ctx) => !!ctx.project.contextNote,
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

/** Curso (ADR-046): un encargo, un estado del arte y las tareas como estudios. */
const COURSE_ROADMAP: RoadmapPhase[] = [
    {
        id: 'charge',
        title: 'Encargo',
        description: 'La rúbrica, el encuadre, la guía de estilo y la portada con que nacen las tareas del curso.',
        icon: ClipboardList,
        isComplete: (ctx) => hasProjectCharge(ctx.project),
        cta: { label: 'Definir el encargo', kind: 'charge' },
    },
    {
        id: 'state-of-art',
        title: 'Estado del arte',
        description: 'La bibliografía del curso: los libros y artículos que sirven para todas las tareas.',
        icon: Library,
        isComplete: (ctx) => ctx.sourceCount > 0,
        cta: { label: 'Adjuntar fuentes', kind: 'sources' },
    },
    {
        id: 'studies',
        title: 'Estudios',
        description: 'Cada tarea del curso (un TP, un ensayo) es un estudio que nace con el encargo.',
        icon: ScrollText,
        isComplete: (ctx) => ctx.studyCount > 0,
        cta: { label: 'Nuevo estudio', kind: 'study' },
    },
    {
        id: 'deliveries',
        title: 'Entregas',
        description: 'Los estudios ensamblados y listos para entregar.',
        icon: FileEdit,
        isComplete: (ctx) => ctx.deliveredCount > 0,
        cta: { label: 'Nuevo estudio', kind: 'study' },
    },
];

/** Exegético (ADR-046): un pasaje largo, estudiado por perícopas. */
const EXEGETICAL_ROADMAP: RoadmapPhase[] = [
    {
        id: 'passage',
        title: 'Pasaje y propósito',
        description: 'El pasaje que vas a estudiar y para qué: una serie, una clase, tu archivo.',
        icon: NotebookPen,
        isComplete: (ctx) => !!ctx.project.contextNote,
        cta: { label: 'Escribir el propósito', kind: 'output' },
    },
    {
        id: 'sources',
        title: 'Fuentes',
        description: 'Los comentarios, léxicos y gramáticas que sirven para todo el pasaje.',
        icon: Library,
        isComplete: (ctx) => ctx.sourceCount > 0,
        cta: { label: 'Adjuntar fuentes', kind: 'sources' },
    },
    {
        id: 'pericopes',
        title: 'Estudios por perícopa',
        description: 'Un estudio por cada perícopa del pasaje.',
        icon: ScrollText,
        isComplete: (ctx) => ctx.studyCount >= 2,
        cta: { label: 'Nuevo estudio', kind: 'study' },
    },
    {
        id: 'synthesis',
        title: 'Síntesis',
        description: 'Lo que el pasaje dice como un todo: conversa con los tutores o escribe la síntesis.',
        icon: MessageSquareQuote,
        isComplete: (ctx) => ctx.sessionCount > 0 || ctx.outputs.length > 0,
        cta: { label: 'Iniciar conversación', kind: 'newSession' },
    },
];

const GENERAL_ROADMAP: RoadmapPhase[] = [
    {
        id: 'context',
        title: 'Contexto',
        description: 'Describe en qué consiste este proyecto.',
        icon: NotebookPen,
        isComplete: (ctx) => !!ctx.project.contextNote,
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
    },
    series: {
        type: 'series',
        label: 'Serie',
        description: 'Una secuencia de mensajes sobre un libro o tema, con marco común.',
        icon: GraduationCap,
        roadmap: SERIES_ROADMAP,
    },
    counseling: {
        type: 'counseling',
        label: 'Consejería',
        description: 'Acompañamiento pastoral: situación, análisis bíblico, plan de acción, seguimiento.',
        icon: HeartHandshake,
        roadmap: COUNSELING_ROADMAP,
    },
    study: {
        type: 'study',
        label: 'Investigación',
        description: 'Una pregunta que se responde con varios estudios: pasajes, temas o términos.',
        icon: BookOpen,
        roadmap: STUDY_ROADMAP,
    },
    course: {
        type: 'course',
        label: 'Curso',
        description: 'Las tareas de un curso (TP, ensayos, investigación final) con un encargo y una bibliografía comunes.',
        icon: GraduationCap,
        roadmap: COURSE_ROADMAP,
    },
    exegetical: {
        type: 'exegetical',
        label: 'Exegético',
        description: 'Un pasaje largo estudiado por perícopas, para predicarlo, enseñarlo o archivarlo.',
        icon: ScrollText,
        roadmap: EXEGETICAL_ROADMAP,
    },
    general: {
        type: 'general',
        label: 'General',
        description: 'Proyecto libre, sin un flujo prescrito.',
        icon: Sparkles,
        roadmap: GENERAL_ROADMAP,
    },
};

export function getProjectTypeMeta(type?: ProjectType): ProjectTypeMeta {
    return PROJECT_TYPES[type ?? 'general'] ?? PROJECT_TYPES.general;
}

/**
 * Computes the current state of every phase for a project, plus identifies
 * the "active" phase (the first one that's not yet complete). When all
 * phases are complete, returns the last phase as active (a finished project).
 */
export function computeRoadmapState(meta: ProjectTypeMeta, ctx: RoadmapContext) {
    const phases = meta.roadmap.map((phase) => ({
        phase,
        complete: phase.isComplete(ctx),
    }));
    const activeIdx = phases.findIndex((p) => !p.complete);
    return {
        phases,
        activeIndex: activeIdx === -1 ? phases.length - 1 : activeIdx,
        allComplete: activeIdx === -1,
    };
}
