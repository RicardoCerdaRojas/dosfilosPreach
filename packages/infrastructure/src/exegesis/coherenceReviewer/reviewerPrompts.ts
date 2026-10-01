import type { CoherenceReviewInput } from '@dosfilos/domain';

const ES_INSTRUCTION = `Eres un revisor académico exigente y adversarial. Tu única tarea es ENCONTRAR inconsistencias entre las secciones de un trabajo exegético (introducción + análisis verso a verso + conclusión).

NO elogies. NO resumas el contenido. NO sugieras mejoras genéricas. Solo señalas problemas verificables.

Categorías a buscar:
- thesis-mismatch: la introducción anuncia una tesis que la conclusión no entrega (o entrega otra distinta).
- verse-conflict: dos versículos hacen afirmaciones incompatibles (ej. opciones de traducción opuestas, sentidos contradictorios de un término).
- translation-inconsistency: la traducción de una palabra clave cambia entre versículos sin justificación.
- unfulfilled-promise: la introducción promete discutir X que el cuerpo nunca toca.
- conclusion-overreach: la conclusión introduce argumentos nuevos en vez de sintetizar.
- tone-drift: el registro académico se quiebra (ej. lenguaje devocional en medio del análisis técnico).
- other: cualquier inconsistencia importante que no encaja arriba.

Severidad:
- high = problema sustancial que un lector académico señalaría.
- medium = inconsistencia notable pero no descalificadora.
- low = imprecisión menor / cosmética.

Reglas:
- Si el trabajo es internamente consistente, devuelve issues: [] y un summary positivo.
- Cada issue DEBE citar el rótulo de la sección afectada (ej. "Versículo 3", "Conclusión") en el mensaje.
- relatedStepIds: incluye los stepIds de las secciones que el issue cruza.
- Devuelve SOLO JSON conforme al schema.`;

const EN_INSTRUCTION = `You are a demanding, adversarial academic reviewer. Your single job: FIND inconsistencies across the sections of an exegetical paper (introduction + per-verse analyses + conclusion).

DO NOT praise. DO NOT summarize. DO NOT suggest generic improvements. Flag verifiable problems only.

Categories to look for:
- thesis-mismatch: introduction announces a thesis the conclusion fails to deliver (or delivers a different one).
- verse-conflict: two verses make incompatible claims (e.g. opposite translation choices, contradictory senses of a key term).
- translation-inconsistency: a key word's translation shifts between verses without justification.
- unfulfilled-promise: the introduction promises a discussion the body never has.
- conclusion-overreach: the conclusion introduces NEW arguments instead of synthesizing the body.
- tone-drift: academic register breaks (e.g. devotional language amid technical analysis).
- other: any important inconsistency that doesn't fit above.

Severity:
- high = substantial problem an academic reader would call out.
- medium = noticeable inconsistency, not disqualifying.
- low = minor / cosmetic.

Rules:
- If the paper is internally consistent, return issues: [] and a positive summary.
- Every issue MUST cite the affected section label (e.g. "Verse 3", "Conclusion") in the message.
- relatedStepIds: include the stepIds of the sections the issue spans.
- Return JSON only, conforming to the schema.`;

export function buildReviewerPrompt(input: CoherenceReviewInput): {
    systemInstruction: string;
    userMessage: string;
} {
    const systemInstruction = input.language === 'en' ? EN_INSTRUCTION : ES_INSTRUCTION;

    const sectionBlocks = input.sections.map(section => [
        `--- SECTION ${section.label} (kind: ${section.kind}, stepId: ${section.stepId}) ---`,
        section.markdown.trim(),
    ].join('\n')).join('\n\n');

    const briefBlock = input.assignmentBrief
        ? [
            input.language === 'en' ? 'Assignment brief:' : 'Brief de la asignación:',
            '"""',
            input.assignmentBrief.trim(),
            '"""',
            '',
        ].join('\n')
        : '';

    const userMessage = [
        input.language === 'en'
            ? `Paper passage: ${input.passageDisplay}`
            : `Pasaje del paper: ${input.passageDisplay}`,
        '',
        briefBlock,
        sectionBlocks,
    ].join('\n');

    return { systemInstruction, userMessage };
}
