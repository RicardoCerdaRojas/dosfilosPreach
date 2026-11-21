/**
 * El tipo de trabajo decide el flujo (fase «Asistente del corpus», principio D5;
 * procedimiento académico §4d). Tres tipos medidos en cuatro trabajos reales:
 *
 * - **TP por pregunta** (NT785, TP #11–#12): una sección por pregunta del encuadre;
 *   las decisiones discutibles son los puntos de aprobación; sin introducción ni
 *   conclusión.
 * - **Investigación temática** (NT785, Santiago 3:1–5a): secciones por tema;
 *   contrato, esquema, tesis y documento final se aprueban; apéndices fuera del tope.
 * - **Síntesis + sermón** (TI #3, Salmo 23): Parte 1 (síntesis) y Parte 2 (sermón),
 *   cada una con sus capas.
 *
 * No confundir con `WorkProfile` (la plantilla guardada de rúbrica, encuadre y
 * portada): esto es la FORMA del trabajo, y el perfil guardado la recuerda.
 */
import type { ExegeticalMethod } from '../entities/ExegeticalPaper';
import { parseBriefQuestions } from './briefQuestions';

export type PaperProfileKind = 'tp-por-pregunta' | 'investigacion-tematica' | 'sintesis-sermon';

export const PAPER_PROFILE_KINDS: ReadonlyArray<PaperProfileKind> = ['tp-por-pregunta', 'investigacion-tematica', 'sintesis-sermon'];

/** De qué se arma el documento: cada unidad es una sección con su prueba (capa 1). */
export type PaperUnitKind = 'pregunta' | 'tema' | 'parte';

/** Los puntos ✋ del §4d: lo que el autor aprueba antes de seguir. */
export type CheckpointKind =
    | 'contrato'
    | 'decisiones'
    | 'esquema'
    | 'tesis'
    | 'orden'
    | 'parte-1'
    | 'proposicion'
    | 'parte-2'
    | 'documento-final';

export interface PaperProfile {
    kind: PaperProfileKind;
    unitKind: PaperUnitKind;
    checkpoints: ReadonlyArray<CheckpointKind>;
    /** Capas de la batería (§4c) que se aplican. */
    layers: { unit: boolean; integration: boolean; conclusion: boolean; introThesis: boolean; regression: boolean };
    citationStyle: 'parentesis' | 'nota-al-pie';
    appendices: boolean;
    /** Introducción y conclusión como pasos del documento. */
    framingSections: boolean;
    sourcePolicy: {
        /** No repetir las fuentes de la entrega anterior (la regla fina la da el tipo de trabajo del proyecto). */
        excludePreviousDelivery: boolean;
        /** Cuántos comentarios pide el curso, si lo fija. */
        commentaryCount?: number;
    };
}

/** El catálogo, tal como lo fija el procedimiento §4d (v4, 2026-11-20). */
export const PAPER_PROFILES: Readonly<Record<PaperProfileKind, PaperProfile>> = {
    'tp-por-pregunta': {
        kind: 'tp-por-pregunta',
        unitKind: 'pregunta',
        checkpoints: ['decisiones', 'documento-final'],
        // Sin introducción ni conclusión, las capas 3 y 4 no aplican: el cierre de
        // cada respuesta se prueba en la capa 1.
        layers: { unit: true, integration: true, conclusion: false, introThesis: false, regression: true },
        citationStyle: 'parentesis',
        appendices: false,
        framingSections: false,
        sourcePolicy: { excludePreviousDelivery: true, commentaryCount: 3 },
    },
    'investigacion-tematica': {
        kind: 'investigacion-tematica',
        unitKind: 'tema',
        checkpoints: ['contrato', 'esquema', 'tesis', 'documento-final'],
        layers: { unit: true, integration: true, conclusion: true, introThesis: true, regression: true },
        citationStyle: 'nota-al-pie',
        appendices: true,
        framingSections: true,
        sourcePolicy: { excludePreviousDelivery: false },
    },
    'sintesis-sermon': {
        kind: 'sintesis-sermon',
        unitKind: 'parte',
        checkpoints: ['contrato', 'orden', 'parte-1', 'proposicion', 'esquema', 'parte-2', 'documento-final'],
        layers: { unit: true, integration: true, conclusion: true, introThesis: true, regression: true },
        citationStyle: 'nota-al-pie',
        appendices: false,
        framingSections: true,
        sourcePolicy: { excludePreviousDelivery: false },
    },
};

export function isPaperProfileKind(value: unknown): value is PaperProfileKind {
    return typeof value === 'string' && (PAPER_PROFILE_KINDS as ReadonlyArray<string>).includes(value);
}

/** Normaliza lo guardado: lo desconocido es `null` (sin elegir), nunca un tipo inventado. */
export function resolvePaperProfileKind(stored: unknown): PaperProfileKind | null {
    return isPaperProfileKind(stored) ? stored : null;
}

export interface ProfileKindReading {
    kind: PaperProfileKind;
    /** `false` = el autor lo eligió; `true` = se dedujo y falta que lo confirme. */
    inferred: boolean;
    /** Por qué se dedujo así: la clave de la razón, para mostrarla. */
    reason: 'stored' | 'questions' | 'sermon' | 'brief-tp' | 'brief-research' | 'method-research' | 'method-mixed' | 'default';
}

/**
 * El tipo de un trabajo. Si está guardado, ese. Si no (los 33 trabajos creados
 * antes de esta fase), se deduce de lo que el trabajo ya dice, y el autor lo
 * confirma una vez (diseño §2.1).
 *
 * Orden de las pistas, de la más fuerte a la más débil:
 * 1. Un encuadre que pide síntesis y sermón: TI #3 lo pedía con esas palabras.
 * 2. Preguntas numeradas en el encuadre: es un TP (TP #7–#12).
 * 3. El encuadre dice qué es: «trabajo práctico» (la plantilla del TP semanal
 *    de NT785 lo dice y trae las preguntas como hueco, sin numerar) o «trabajo
 *    de investigación».
 * 4. El método: «Investigación» → investigación; «Mixto (TP)» → TP.
 * 5. Nada: investigación, que es la forma completa del procedimiento (§4d:
 *    «el procedimiento completo es el de un trabajo largo»).
 */
export function readPaperProfileKind(input: {
    profileKind?: unknown;
    assignmentBrief?: string | null;
    exegeticalMethod?: ExegeticalMethod | null;
    passage?: { chapterStart: number; chapterEnd: number } | null;
}): ProfileKindReading {
    const guardado = resolvePaperProfileKind(input.profileKind);
    if (guardado) return { kind: guardado, inferred: false, reason: 'stored' };
    const encuadre = input.assignmentBrief ?? '';
    if (pideSermon(encuadre)) return { kind: 'sintesis-sermon', inferred: true, reason: 'sermon' };
    if (parseBriefQuestions(encuadre, input.passage).length > 0) return { kind: 'tp-por-pregunta', inferred: true, reason: 'questions' };
    if (/trabajo pr[aá]ctico|\bTP\b/i.test(encuadre)) return { kind: 'tp-por-pregunta', inferred: true, reason: 'brief-tp' };
    if (/trabajo de investigaci[oó]n|\bpaper de investigaci[oó]n/i.test(encuadre)) return { kind: 'investigacion-tematica', inferred: true, reason: 'brief-research' };
    if (input.exegeticalMethod === 'research') return { kind: 'investigacion-tematica', inferred: true, reason: 'method-research' };
    if (input.exegeticalMethod === 'mixed') return { kind: 'tp-por-pregunta', inferred: true, reason: 'method-mixed' };
    return { kind: 'investigacion-tematica', inferred: true, reason: 'default' };
}

/**
 * «Síntesis exegética breve … Parte homilética»: el encuadre pide un sermón como
 * parte del trabajo. Hacen falta las dos cosas; un TP que pregunta «¿qué
 * implicancia homilética tiene?» no es un sermón.
 */
function pideSermon(encuadre: string): boolean {
    const t = encuadre.toLowerCase();
    const sermon = /\bserm[oó]n\b|parte homil[eé]tica/.test(t);
    const sintesis = /\bs[ií]ntesis\b/.test(t);
    return sermon && sintesis;
}
