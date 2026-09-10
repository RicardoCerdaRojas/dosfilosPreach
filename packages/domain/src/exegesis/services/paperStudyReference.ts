import { formatPassageReference } from '../../bible/canon/passage-reference';
import type { PastoralSeedStepKey } from '../../entities/PastoralSeed';
import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { ExegeticalPaper } from '../entities/ExegeticalPaper';

/**
 * Traduce el trabajo YA ACEPTADO de un paper exegético en material de
 * consulta para el estudio pastoral de 8 pasos.
 *
 * Por qué existe: hasta ahora el paper producía un BORRADOR de sermón
 * (`GenerateSermonFromPaperUseCase`, retirado). Eso violaba P1 (labor
 * antes que output) y P2 (el asistente desarrolla, no origina): el
 * pastor recibía un sermón terminado sin haber hecho el estudio, y el
 * portón del wizard lo rebotaba igual. La dirección correcta es la
 * inversa — el paper ALIMENTA el estudio, no lo reemplaza.
 *
 * Tres propiedades no negociables de este módulo:
 *
 *   1. **Determinista.** No hay modelo acá. Cada ítem se copia de un
 *      `canonicalAnalysis` que el pastor ya aceptó en su paper. Si el
 *      paper no lo tiene, acá no aparece — nunca se rellena el hueco.
 *
 *   2. **Es consulta, no relleno.** El resultado se MUESTRA junto al
 *      paso; jamás se escribe en los campos de la semilla. Lo que el
 *      pastor escribe sigue siendo suyo, y la métrica de autoría
 *      verbatim sigue siendo verdadera.
 *
 *   3. **Cubre solo los pasos donde el paper tiene evidencia real.**
 *      `function`, `timelessPrinciple` e `insight` quedan VACÍOS a
 *      propósito: son el trabajo interpretativo y pastoral del
 *      predicador. `insight` además contiene los cinco campos de
 *      `PASTORAL_SEED_AI_FORBIDDEN_FIELDS`. Ofrecer material ahí sería
 *      poner palabras en su boca justo donde el producto promete que
 *      son suyas.
 */

/** Un hallazgo del paper, listo para mostrar al lado de un paso. */
export interface PaperReferenceItem {
    /** Rótulo corto: el lexema, la construcción, el aspecto. */
    label: string;
    /** El hallazgo, copiado del análisis. Nunca se redacta acá. */
    detail: string;
    /** Verso del paper del que salió, ya formateado ("Santiago 1:2"). */
    verseLabel: string;
}

export type PaperStudyReferenceByStep = Partial<
    Record<PastoralSeedStepKey, PaperReferenceItem[]>
>;

export interface PaperStudyReference {
    paperId: string;
    paperTitle: string;
    passageLabel: string;
    /** Encuadre del paper, si el estudiante lo escribió. */
    assignmentBrief: string | null;
    /** Versos cuyo análisis el pastor aceptó. Vacío = no hay material. */
    analyzedVerses: string[];
    byStep: PaperStudyReferenceByStep;
    totalItems: number;
}

/**
 * Pasos que este módulo puede alimentar. Los tres ausentes
 * (`function`, `timelessPrinciple`, `insight`) son deliberados — ver
 * la propiedad 3 arriba.
 */
export const PAPER_FED_STEP_KEYS: readonly PastoralSeedStepKey[] = [
    'reading',
    'contextGenre',
    'structuralAnalysis',
    'wordStudies',
    'recognition',
];

export function buildPaperStudyReference(paper: ExegeticalPaper): PaperStudyReference {
    const language = paper.displayLanguage;
    const passageLabel = formatPassageReference(paper.passage, language);
    const byStep: PaperStudyReferenceByStep = {};
    const analyzedVerses: string[] = [];

    const push = (step: PastoralSeedStepKey, item: PaperReferenceItem) => {
        (byStep[step] ??= []).push(item);
    };

    for (const step of paper.steps) {
        if (step.kind !== 'verse') continue;
        // `accepted` y no `current`: lo que el pastor confirmó es
        // evidencia; lo que el modelo acaba de escribir y todavía no
        // se revisó, no. La distinción es el punto entero.
        const analysis = readCanonicalAnalysis(step.accepted);
        if (!analysis) continue;

        const verseLabel = formatPassageReference(analysis.reference, language);
        analyzedVerses.push(verseLabel);

        collectReading(analysis, verseLabel, push);
        collectContextGenre(analysis, verseLabel, push);
        collectStructuralAnalysis(analysis, verseLabel, push);
        collectWordStudies(analysis, verseLabel, push);
        collectRecognition(analysis, verseLabel, paper, push);
    }

    const totalItems = Object.values(byStep).reduce((n, items) => n + items.length, 0);

    return {
        paperId: paper.id,
        paperTitle: paper.title ?? passageLabel,
        passageLabel,
        assignmentBrief: paper.assignmentBrief,
        analyzedVerses,
        byStep,
        totalItems,
    };
}

/** True cuando el paper tiene al menos un análisis aceptado que mostrar. */
export function paperHasStudyMaterial(paper: ExegeticalPaper): boolean {
    return paper.steps.some(
        step => step.kind === 'verse' && readCanonicalAnalysis(step.accepted) !== null,
    );
}

// ── Extracción por paso ────────────────────────────────────────────────

type Push = (step: PastoralSeedStepKey, item: PaperReferenceItem) => void;

/**
 * Paso 1 (Lectura): la traducción a la que llegó el paper y el texto
 * griego base. No es "la primera impresión" del pastor — eso lo
 * escribe él. Es el texto sobre el que va a trabajar.
 */
function collectReading(a: CanonicalVerseAnalysis, verseLabel: string, push: Push): void {
    if (a.finalTranslation.trim()) {
        push('reading', {
            label: 'Traducción del paper',
            detail: a.finalTranslation.trim(),
            verseLabel,
        });
    }
    if (a.originalText.trim()) {
        push('reading', { label: 'Texto base', detail: a.originalText.trim(), verseLabel });
    }
}

/** Paso 2 (Contexto y género): el trasfondo histórico-cultural documentado. */
function collectContextGenre(a: CanonicalVerseAnalysis, verseLabel: string, push: Push): void {
    for (const point of a.historicalContext) {
        push('contextGenre', {
            label: point.aspect,
            detail: point.relevance,
            verseLabel,
        });
    }
}

/**
 * Paso 3 (Análisis estructural): verbo principal, construcciones
 * clave, partículas de discurso y el rol argumentativo del verso —
 * exactamente la materia prima de este paso.
 */
function collectStructuralAnalysis(
    a: CanonicalVerseAnalysis,
    verseLabel: string,
    push: Push,
): void {
    const syntax = a.syntacticAnalysis;
    if (syntax.mainVerb) {
        push('structuralAnalysis', {
            label: `Verbo principal: ${syntax.mainVerb.text}`,
            detail: `${syntax.mainVerb.morphology}. ${syntax.mainVerb.interpretiveSignificance}`,
            verseLabel,
        });
    } else if (syntax.mainVerbNote?.trim()) {
        push('structuralAnalysis', {
            label: 'Sin verbo principal propio',
            detail: syntax.mainVerbNote.trim(),
            verseLabel,
        });
    }
    for (const element of syntax.keyConstructions) {
        push('structuralAnalysis', {
            label: `${element.text} — ${element.syntacticFunction}`,
            detail: element.interpretiveSignificance,
            verseLabel,
        });
    }
    for (const particle of syntax.discourseParticles) {
        push('structuralAnalysis', {
            label: `${particle.particle} — ${particle.function}`,
            detail: particle.note,
            verseLabel,
        });
    }
    if (a.argumentativeRole.trim()) {
        push('structuralAnalysis', {
            label: 'Rol en el argumento',
            detail: a.argumentativeRole.trim(),
            verseLabel,
        });
    }
}

/**
 * Paso 4 (Estudio de palabras): los análisis léxicos, con la
 * separación que el paper ya impone entre rango semántico general y
 * carga específica del verso. Esa separación es justo lo que este
 * paso le pide al pastor, así que verla hecha en su propio paper es
 * el mejor andamio posible.
 */
function collectWordStudies(a: CanonicalVerseAnalysis, verseLabel: string, push: Push): void {
    for (const lex of a.lexicalAnalyses) {
        const range = lex.generalSemanticRange.glosses.join(', ');
        const detail = [
            lex.gloss ? `«${lex.gloss}»` : '',
            range ? `Rango: ${range}.` : '',
            lex.verseSpecificLoading,
        ]
            .filter(Boolean)
            .join(' ');
        push('wordStudies', {
            label: `${lex.term} (${lex.lemma})`,
            detail,
            verseLabel,
        });
    }
}

/**
 * Paso 5 (Reconocimiento): con quién dialogó el paper. Los
 * comentaristas y los enlaces al AT son las voces externas que este
 * paso le pide al pastor confrontar; el paper ya las tiene con página
 * y rol dialéctico.
 */
function collectRecognition(
    a: CanonicalVerseAnalysis,
    verseLabel: string,
    paper: ExegeticalPaper,
    push: Push,
): void {
    for (const commentator of a.commentatorEngagement) {
        push('recognition', {
            label: `${resolveSourceLabel(paper, commentator.sourceKey)}, p. ${commentator.page}`,
            detail: commentator.position,
            verseLabel,
        });
    }
    for (const link of a.oldTestamentLinks) {
        push('recognition', {
            label: `${link.sourcePassage} (${link.type})`,
            detail: link.interpretiveBearing,
            verseLabel,
        });
    }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * `ExegeticalStepVersion.canonicalAnalysis` es opcional y los papers
 * antiguos (o los de estrategia libre) no lo traen. Devolver `null` en
 * vez de romper: un paper sin análisis canónico simplemente no aporta
 * material, y la UI lo dice.
 */
function readCanonicalAnalysis(
    version: { canonicalAnalysis?: CanonicalVerseAnalysis | null } | null,
): CanonicalVerseAnalysis | null {
    return version?.canonicalAnalysis ?? null;
}

/**
 * El análisis guarda `sourceKey` (la clave de cita); el pastor
 * reconoce el nombre de la obra. Se resuelve contra las fuentes del
 * paper y se cae a la clave cruda cuando la fuente ya no está — mejor
 * una clave que un hueco.
 */
function resolveSourceLabel(paper: ExegeticalPaper, sourceKey: string): string {
    const source = paper.sources.find(s => s.citationKey === sourceKey);
    return source?.displayLabel ?? sourceKey;
}
