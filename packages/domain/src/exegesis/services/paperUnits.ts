/**
 * Las unidades de un trabajo y su vínculo con el estudio (fase «Asistente del
 * corpus», diseño §2.1, A4).
 *
 * Una unidad es una sección del documento con su propia prueba (capa 1): una
 * pregunta del encuadre en un TP, un tema en una investigación, una parte en una
 * síntesis + sermón. El análisis, en cambio, se hace por versículo. El
 * `UnitStudyMap` une las dos cosas: qué versículos cubre cada unidad y qué
 * propuso el análisis de esos versículos.
 */
import type { PassageReference } from '../../bible/canon/passage-reference';
import type { QuestionAnswer, TranslationCrux } from '../entities/CanonicalVerseAnalysis';
import type { ExegeticalStep } from '../entities/ExegeticalStep';
import { parseBriefQuestions, type BriefQuestion } from './briefQuestions';
import { PAPER_PROFILES, type PaperProfileKind, type PaperUnitKind } from './paperProfile';

export interface VerseKey {
    chapter: number;
    verse: number;
}

export interface PaperUnit {
    /** Estable mientras no cambie el encuadre ni los pasos: `pregunta-2`, `tema-3.4`, `parte-1`. */
    id: string;
    kind: PaperUnitKind;
    /** El número de la pregunta como lo escribió el profesor, o el orden. */
    number: number;
    /** El texto de la pregunta o el título del tema; `null` si no tiene. */
    text: string | null;
    /** Parte de una síntesis + sermón. */
    part?: 'sintesis' | 'sermon';
    /** Versículos que cubre, en orden. El primero es el dueño (`questionsForVerse`). */
    verses: ReadonlyArray<VerseKey>;
}

type StepLike = Pick<ExegeticalStep, 'id' | 'kind' | 'verseRef' | 'order'>;

export interface PaperUnitsInput {
    kind: PaperProfileKind;
    assignmentBrief?: string | null;
    passage?: Pick<PassageReference, 'chapterStart' | 'chapterEnd' | 'verseStart' | 'verseEnd'> | null;
    steps?: ReadonlyArray<StepLike>;
    /** Títulos temáticos por paso (`ExegeticalPaper.sectionTitles`). */
    sectionTitles?: Readonly<Record<string, string>> | null;
}

/**
 * Las unidades del trabajo según su tipo.
 *
 * - TP: una por pregunta del encuadre. Sin preguntas, una por versículo: el TP
 *   sigue teniendo secciones aunque el profesor lo encargue en prosa.
 * - Investigación: una por versículo, con el título temático del paso si lo
 *   tiene. Agrupar versículos en temas es el esquema, que el autor aprueba
 *   (checkpoint `esquema`, fase B); hasta entonces cada versículo es su tema.
 * - Síntesis + sermón: las dos partes, cada una sobre todo el pasaje.
 */
export function derivePaperUnits(input: PaperUnitsInput): PaperUnit[] {
    const unitKind = PAPER_PROFILES[input.kind].unitKind;
    const versiculos = passageVerses(input.steps ?? [], input.passage ?? null);
    if (unitKind === 'parte') {
        return [
            { id: 'parte-1', kind: 'parte', number: 1, text: null, part: 'sintesis', verses: versiculos },
            { id: 'parte-2', kind: 'parte', number: 2, text: null, part: 'sermon', verses: versiculos },
        ];
    }
    if (unitKind === 'pregunta') {
        const preguntas = parseBriefQuestions(input.assignmentBrief, input.passage).filter(q => q.verses.length > 0);
        if (preguntas.length > 0) {
            return preguntas.map(q => ({ id: `pregunta-${q.number}`, kind: 'pregunta', number: q.number, text: q.text, verses: q.verses }));
        }
    }
    return verseUnits(input.steps ?? [], versiculos, input.sectionTitles ?? null);
}

/**
 * Con qué se revisa el corpus en la tarjeta «¿Qué responde cada …?» (A3/A4).
 *
 * Si el encuadre trae preguntas con versículo, por pregunta, sea cual sea el
 * tipo de trabajo: es lo que el profesor pide contestar, y la tarjeta ya lo
 * hacía así (sin cambios para los TP de siempre). Si no las trae —una
 * investigación, una síntesis + sermón, un TP encargado en prosa—, por
 * versículo, con el título temático del paso: antes la tarjeta no aparecía.
 * Las partes de una síntesis + sermón cubren todo el pasaje y darían dos
 * filas iguales; por eso tampoco se revisa por parte.
 */
export function corpusReviewQuestions(input: Omit<PaperUnitsInput, 'kind'>): { unitKind: 'pregunta' | 'tema'; questions: BriefQuestion[] } {
    const preguntas = parseBriefQuestions(input.assignmentBrief, input.passage);
    if (preguntas.some(q => q.verses.length > 0)) return { unitKind: 'pregunta', questions: preguntas };
    const versiculos = passageVerses(input.steps ?? [], input.passage ?? null);
    return { unitKind: 'tema', questions: unitsAsQuestions(verseUnits(input.steps ?? [], versiculos, input.sectionTitles ?? null)) };
}

/** Las unidades con la forma de una pregunta, para los servicios que leen preguntas. */
export function unitsAsQuestions(units: ReadonlyArray<PaperUnit>): BriefQuestion[] {
    return units.map(u => ({ number: u.number, text: u.text ?? '', verses: u.verses }));
}

function verseUnits(steps: ReadonlyArray<StepLike>, versiculos: ReadonlyArray<VerseKey>, titles: Readonly<Record<string, string>> | null): PaperUnit[] {
    return versiculos.map((v, i) => {
        const paso = steps.find(s => s.kind === 'verse' && s.verseRef?.chapterStart === v.chapter && (s.verseRef.verseStart ?? 1) === v.verse);
        const titulo = paso ? titles?.[paso.id]?.trim() : undefined;
        return { id: `tema-${v.chapter}.${v.verse}`, kind: 'tema', number: i + 1, text: titulo || null, verses: [v] };
    });
}

/**
 * Los versículos del trabajo: los de sus pasos de versículo, en orden. Sin pasos
 * (un trabajo recién creado), los del pasaje si es de un solo capítulo: sin la
 * cantidad de versículos de cada capítulo no se puede recorrer uno de varios.
 */
export function passageVerses(
    steps: ReadonlyArray<StepLike>,
    passage: Pick<PassageReference, 'chapterStart' | 'chapterEnd' | 'verseStart' | 'verseEnd'> | null,
): VerseKey[] {
    const dePasos = [...steps]
        .filter(s => s.kind === 'verse' && s.verseRef)
        .sort((a, b) => a.order - b.order)
        .map(s => ({ chapter: s.verseRef!.chapterStart, verse: s.verseRef!.verseStart ?? 1 }));
    if (dePasos.length > 0) return unicos(dePasos);
    if (!passage || (passage.chapterEnd ?? passage.chapterStart) !== passage.chapterStart) return [];
    const desde = passage.verseStart;
    const hasta = passage.verseEnd ?? desde;
    if (!desde || !hasta || hasta < desde) return [];
    return Array.from({ length: hasta - desde + 1 }, (_, i) => ({ chapter: passage.chapterStart, verse: desde + i }));
}

function unicos(vs: VerseKey[]): VerseKey[] {
    return vs.filter((v, i) => vs.findIndex(x => x.chapter === v.chapter && x.verse === v.verse) === i);
}

// ── UnitStudyMap ────────────────────────────────────────────────────────────

export interface UnitAnswerProposal {
    stepId: string;
    verse: VerseKey;
    answer: QuestionAnswer;
}

export interface UnitCruxProposal {
    stepId: string;
    verse: VerseKey;
    crux: TranslationCrux;
}

export interface UnitStudyEntry {
    unit: PaperUnit;
    /** Los pasos de versículo que cubre, en el orden de la unidad. */
    stepIds: string[];
    /** Versículos de la unidad sin paso (el pasaje no los tiene, o aún no se sembraron). */
    versesWithoutStep: VerseKey[];
    /** Versículos con paso pero sin análisis todavía. */
    versesWithoutAnalysis: VerseKey[];
    /** Las respuestas del análisis a ESTA pregunta, de cualquiera de sus versículos. */
    answers: UnitAnswerProposal[];
    /** Los puntos discutibles de traducción de sus versículos. */
    cruxes: UnitCruxProposal[];
    /**
     * Las decisiones distintas que propone el análisis para esta pregunta. Más de
     * una = dos versículos contestaron distinto: la decisión las muestra juntas
     * (diseño §2.1), no elige una en silencio.
     */
    proposedDecisions: string[];
    conflict: boolean;
}

export type UnitStudyMap = UnitStudyEntry[];

/**
 * Unidad → versículos → lo que el análisis de esos versículos propone.
 *
 * Se lee la versión aceptada del paso o, si no hay, la actual: la decisión se
 * arma con lo último que el autor vio. La misma pregunta del encuadre es la
 * misma decisión, aunque la contesten dos versículos.
 */
export function buildUnitStudyMap(
    units: ReadonlyArray<PaperUnit>,
    steps: ReadonlyArray<Pick<ExegeticalStep, 'id' | 'kind' | 'verseRef' | 'order' | 'accepted' | 'current'>>,
): UnitStudyMap {
    return units.map(unit => {
        const entry: UnitStudyEntry = {
            unit, stepIds: [], versesWithoutStep: [], versesWithoutAnalysis: [],
            answers: [], cruxes: [], proposedDecisions: [], conflict: false,
        };
        const leidos = new Set<string>();
        for (const v of unit.verses) {
            const paso = steps.find(s => s.kind === 'verse' && s.verseRef?.chapterStart === v.chapter && (s.verseRef.verseStart ?? 1) <= v.verse && (s.verseRef.verseEnd ?? s.verseRef.verseStart ?? 1) >= v.verse);
            if (!paso) { entry.versesWithoutStep.push(v); continue; }
            if (leidos.has(paso.id)) continue;
            leidos.add(paso.id);
            entry.stepIds.push(paso.id);
            const analisis = (paso.accepted ?? paso.current)?.canonicalAnalysis;
            if (!analisis) { entry.versesWithoutAnalysis.push(v); continue; }
            for (const crux of analisis.translationCruxes ?? []) entry.cruxes.push({ stepId: paso.id, verse: v, crux });
            if (unit.kind === 'pregunta') {
                for (const answer of analisis.questionAnswers ?? []) {
                    if (answer.questionNumber === unit.number) entry.answers.push({ stepId: paso.id, verse: v, answer });
                }
            }
        }
        const decisiones = entry.answers.map(a => a.answer.decision.trim()).filter(Boolean);
        entry.proposedDecisions = decisiones.filter((d, i) => decisiones.findIndex(x => normalizar(x) === normalizar(d)) === i);
        entry.conflict = entry.proposedDecisions.length > 1;
        return entry;
    });
}

function normalizar(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.;:,]+$/, '').trim();
}
