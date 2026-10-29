import type { ProseReviewInput, ProseReviewerFinding } from '@dosfilos/domain';

/**
 * Prompt, esquema y lectura de «Revisión antes de entregar» (TP #8, 8b, E3).
 * Aparte del cliente, como `ideaPlacementPrompt.ts`: se prueban sin Firebase.
 */
export const PROSE_REVIEW_SCHEMA = {
    type: 'object',
    properties: {
        findings: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    criterion: { type: 'integer', description: 'Número del criterio que la prosa no cumple.' },
                    quote: { type: 'string', description: 'La frase de la prosa donde falla, copiada EXACTA. Vacía si el problema es lo que falta.' },
                    problem: { type: 'string', description: 'Qué falla, en una oración.' },
                    fix: { type: 'string', description: 'Cómo arreglarlo, en una oración, con lo que ya dice el análisis.' },
                },
                required: ['criterion', 'quote', 'problem', 'fix'],
            },
        },
    },
    required: ['findings'],
} as const;

/** Hallazgos que la tarjeta muestra, como mucho. */
export const MAX_FINDINGS = 12;

export function buildProseReviewPrompt(input: ProseReviewInput): { systemInstruction: string; userMessage: string } {
    const en = input.language === 'en';
    const criterios = input.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const systemInstruction = en
        ? [
            'You review the academic prose of ONE verse before it is delivered, the way the course professor corrects it. You do NOT rewrite it.',
            '- Report only real failures of the numbered criteria. If the prose meets a criterion, say nothing about it. An empty list is a valid answer.',
            '- Copy the failing phrase EXACTLY as it appears in the prose. If the failure is something missing, leave "quote" empty.',
            '- The fix uses only what the prose and the analysis already say. Do not propose sources, pages or data that are not there.',
            '- Never name a citation (author and page) that is not in AVAILABLE CITATIONS. Do not ask for a reference the work does not have.',
            '- The analysis is the student\'s draft, not the truth: the student may depart from it in the prose on purpose. If the prose departs from the analysis and a STUDENT REVIEW NOTE explains it, it is not a failure: do not report it.',
            '- If the prose departs from the analysis and no note explains it, report it as a question ("The prose does not follow the analysis on X: is this on purpose?"), never as an order to restore what the analysis said.',
            '- Accents, dashes and commas are checked elsewhere: do not report them.',
            '',
            'Criteria:',
            criterios,
        ].join('\n')
        : [
            'Revisas la prosa académica de UN versículo antes de entregarla, como la corrige el profesor del curso. NO la reescribes.',
            '- Informa solo fallas reales de los criterios numerados. Si la prosa cumple un criterio, no digas nada de él. Una lista vacía es una respuesta válida.',
            '- Copia la frase que falla EXACTA, como aparece en la prosa. Si la falla es algo que falta, deja "quote" vacío.',
            '- El arreglo usa solo lo que ya dicen la prosa y el análisis. No propongas fuentes, páginas ni datos que no estén.',
            '- Nunca nombres una cita (autor y página) que no esté en CITAS DISPONIBLES. No pidas una referencia que el trabajo no tiene.',
            '- El análisis es el borrador del estudiante, no la verdad: el estudiante puede apartarse de él en la prosa a propósito. Si la prosa se aparta del análisis y una NOTA DE REVISIÓN DEL ESTUDIANTE lo explica, no es falla: no lo informes.',
            '- Si la prosa se aparta del análisis y ninguna nota lo explica, infórmalo como pregunta («La prosa no sigue al análisis en X: ¿es a propósito?»), nunca como orden de restituir lo que decía el análisis.',
            '- Acentos, rayas y comas se revisan aparte: no los informes.',
            '',
            'Criterios:',
            criterios,
        ].join('\n');

    const preguntas = input.questions.map(q => `${q.number}. ${q.text}`).join('\n');
    const decididos = input.decisiveCriteria.map(c => {
        const linea = en
            ? `- Question ${c.questionNumber}: criterion «${c.text}» (why: ${c.whyThisOverThat}). Decision: ${c.decision}`
            : `- Pregunta ${c.questionNumber}: criterio «${c.text}» (por qué: ${c.whyThisOverThat}). Decisión: ${c.decision}`;
        // La nota va pegada a lo que corrige: «el criterio no decide; se
        // corrige en la prosa» (TP #9, 4:14).
        const notas = (c.reviewNotes ?? []).map(n => en ? `  · Student's review note: ${n}` : `  · Nota de revisión del estudiante: ${n}`);
        return [linea, ...notas].join('\n');
    }).join('\n');
    const gramatica = input.grammarCitations.join('; ');
    const notas = (input.reviewNotes ?? []).map(n => `- ${n.citation}: ${n.note}`).join('\n');
    const disponibles = (input.availableCitations ?? []).join('; ');
    const bloques = [
        `${en ? 'VERSE' : 'VERSÍCULO'}: ${input.verseLabel}`,
        preguntas ? `${en ? 'QUESTIONS IT ANSWERS' : 'PREGUNTAS QUE RESPONDE'}:\n${preguntas}` : '',
        decididos ? `${en ? 'WHAT THE ANALYSIS DECIDED' : 'LO QUE EL ANÁLISIS DECIDIÓ'}:\n${decididos}` : '',
        gramatica ? `${en ? 'COURSE GRAMMAR CITED IN THE ANALYSIS' : 'GRAMÁTICA DEL CURSO CITADA EN EL ANÁLISIS'}: ${gramatica}` : '',
        notas ? `${en ? 'STUDENT REVIEW NOTES (they outweigh the analysis)' : 'NOTAS DE REVISIÓN DEL ESTUDIANTE (pesan más que el análisis)'}:\n${notas}` : '',
        disponibles ? `${en ? 'AVAILABLE CITATIONS' : 'CITAS DISPONIBLES'}: ${disponibles}` : '',
        `${en ? 'PROSE' : 'PROSA'}:\n${input.prose.trim()}`,
    ].filter(Boolean);
    return { systemInstruction, userMessage: bloques.join('\n\n') };
}

/**
 * Lee la respuesta. Una frase que no está en la prosa se descarta como cita
 * (queda el hallazgo sin lugar): el revisor no puede señalar algo que la
 * prosa no dice. Un criterio fuera de la lista se descarta entero.
 */
export function parseProseReview(raw: string, prose: string, criteriaCount: number): ProseReviewerFinding[] {
    const limpio = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let data: unknown;
    try {
        data = JSON.parse(limpio);
    } catch {
        throw new Error('GeminiProseReviewer: la respuesta no es JSON');
    }
    const lista = Array.isArray((data as { findings?: unknown })?.findings) ? (data as { findings: unknown[] }).findings : [];
    const enLaProsa = comparable(prose);
    const out: ProseReviewerFinding[] = [];
    for (const f of lista) {
        const r = f as Partial<ProseReviewerFinding>;
        const criterion = typeof r.criterion === 'number' ? Math.round(r.criterion) : NaN;
        const problem = typeof r.problem === 'string' ? r.problem.trim() : '';
        if (!problem || !(criterion >= 1 && criterion <= criteriaCount)) continue;
        const quote = typeof r.quote === 'string' ? r.quote.trim() : '';
        out.push({
            criterion,
            quote: quote && enLaProsa.includes(comparable(quote)) ? quote : '',
            problem,
            fix: typeof r.fix === 'string' ? r.fix.trim() : '',
        });
        if (out.length >= MAX_FINDINGS) break;
    }
    return out;
}

function comparable(texto: string): string {
    return texto.normalize('NFC')
        .replace(/[“”«»„"]/g, '"').replace(/[‘’‚']/g, "'")
        .replace(/[*_]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
