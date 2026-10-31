/**
 * Proponer y revisar la tesis de un trabajo exegético (fase «Lecciones del
 * TI #2», etapa 3.3; B63).
 *
 * La tesis se formula DESPUÉS de aceptar los análisis (decisión del
 * fundador): se propone desde los análisis aceptados, no desde el encuadre, y
 * cualquier tesis —también la del estudiante— se revisa con los seis
 * criterios del curso (bitácora del TI #2, §2). Error propio que esto debe
 * evitar: la tesis larga que se propuso para el TI #2 decía «imperfectos para
 * lo que el SEÑOR hace», y de los cinco imperfectos solo uno tiene al SEÑOR
 * por sujeto. Por eso cada parte de la tesis se coteja con los análisis.
 */

import {
    THESIS_CRITERIA,
    type ThesisAdvisorInput,
    type ThesisCriterionResult,
    type ThesisProposal,
    type ThesisReview,
} from '@dosfilos/domain';

const CRITERIOS_ES = `Los seis criterios del curso para una tesis. Una buena tesis tiene UNA o DOS oraciones: el cuerpo del trabajo desarrolla los detalles, la tesis no los enumera. No penalices la brevedad.
1. interpretive — Es una afirmación interpretativa, concreta y verificable sobre lo que el texto hace o significa. NO es una descripción del trabajo («este trabajo analiza…») ni un resumen de contenidos.
2. covers — La afirmación abarca todo el pasaje: cada versículo la desarrolla o la sostiene. NO hace falta que nombre cada versículo ni que enumere su contenido. No cumple solo si un versículo queda fuera de lo que la tesis afirma o lo contradice.
3. supported — Lo que afirma tiene respaldo en los análisis aceptados. Coteja cada dato gramatical concreto (forma verbal, sujeto, construcción): un dato inventado o contradicho por los análisis NO cumple. Una inferencia interpretativa razonable de los análisis (por ejemplo, un contraste «y no de sus circunstancias») cumple si los análisis no la contradicen.
4. distinguishes — Donde los análisis decidieron entre lecturas y esa decisión cambia lo que la tesis afirma, la tesis es coherente con la decisión tomada. No exijas que mencione cada decisión de traducción: no cumple solo si contradice una decisión del análisis o depende de la lectura descartada.
5. connects — Retoma explícitamente lo que estableció la tesis de la unidad anterior (una continuidad temática implícita no basta). Si no se da tesis anterior, el veredicto es «no-aplica».
6. answers — Afirma algo que el análisis pedido en el enunciado demuestra (si pide análisis sintáctico y léxico, algo que la sintaxis y el léxico muestran). No exijas que detalle cada herramienta.`;

const VOZ_ES = `Escribe en español llano, como un profesor que corrige: sin jerga innecesaria; un término técnico que no sea de la gramática del curso, glosado entre paréntesis la primera vez. Una sola nomenclatura (perfecto/imperfecto). La voz del texto es «el salmista» (o el autor del pasaje), no «el creyente». Nombra a Dios como lo hace la traducción del trabajo (en el AT, «el SEÑOR» para יהוה), no «Yahweh».`;

/** El idioma de la respuesta: el del trabajo. */
function idioma(lang: 'es' | 'en'): string {
    return lang === 'en' ? 'Write the reasons, the suggestion and the proposals in English.' : 'Escribe las razones, la sugerencia y las propuestas en español.';
}

function contexto(input: ThesisAdvisorInput): string {
    return [
        `Pasaje: ${input.passageLabel}`,
        '',
        '## Enunciado del trabajo',
        input.assignmentBrief?.trim() || '(sin enunciado)',
        '',
        '## Tesis de la unidad anterior del curso',
        input.previousUnitThesis?.trim() || '(no hay: este es el primer trabajo de la serie)',
        '',
        '## Análisis aceptados, versículo por versículo',
        input.briefings,
    ].join('\n');
}

export function buildThesisReviewPrompt(input: ThesisAdvisorInput & { thesis: string }): { system: string; user: string } {
    const system = [
        'Eres un profesor de exégesis del Antiguo y del Nuevo Testamento que revisa la tesis de un trabajo de investigación de un estudiante de MDiv.',
        CRITERIOS_ES,
        'Juzga SOLO con lo que está en los análisis aceptados, el enunciado y la tesis anterior. No inventes datos del texto.',
        'Para cada criterio da un veredicto («cumple», «no-cumple» o «no-aplica») y la razón en una o dos oraciones, nombrando el versículo cuando corresponda.',
        'Si algún criterio no se cumple, propone una tesis corregida de una o dos oraciones que los cumpla todos, lo más cercana posible a la del estudiante (cambia lo mínimo). Si cumple todos, la sugerencia es null.',
        VOZ_ES,
        idioma(input.language),
    ].join('\n\n');
    const user = [contexto(input), '', '## Tesis a revisar', input.thesis.trim()].join('\n');
    return { system, user };
}

export function buildThesisProposalPrompt(input: ThesisAdvisorInput): { system: string; user: string } {
    const system = [
        'Eres un profesor de exégesis que ayuda a un estudiante de MDiv a formular la tesis de su trabajo de investigación DESPUÉS de haber aceptado los análisis de cada versículo.',
        CRITERIOS_ES,
        'Propón entre 2 y 3 tesis distintas entre sí (no reformulaciones de la misma), cada una de una o dos oraciones y no más de 60 palabras, que cumplan los seis criterios. El respaldo va aparte, versículo por versículo: qué decisión o dato del análisis aceptado sostiene la tesis en ese versículo.',
        'Si el enunciado pide análisis sintáctico o léxico, cada tesis afirma qué muestra la sintaxis o el léxico: nombra la construcción o la forma verbal decisiva que sostiene la interpretación (por ejemplo, una cláusula sin verbo, un cambio de conjugación), sin enumerar todas. Una tesis solo temática no responde a ese enunciado.',
        'Cada afirmación gramatical de la tesis tiene que estar en los análisis: forma verbal, sujeto, construcción. No generalices («los imperfectos…») si los análisis no lo sostienen para todos los casos.',
        VOZ_ES,
        idioma(input.language),
    ].join('\n\n');
    return { system, user: contexto(input) };
}

/** Esquemas JSON para el modo estricto. */
export const THESIS_REVIEW_SCHEMA = {
    type: 'object',
    properties: {
        criteria: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    criterion: { type: 'string', enum: [...THESIS_CRITERIA] },
                    verdict: { type: 'string', enum: ['cumple', 'no-cumple', 'no-aplica'] },
                    reason: { type: 'string' },
                },
                required: ['criterion', 'verdict', 'reason'],
                additionalProperties: false,
            },
        },
        suggestion: { type: ['string', 'null'] },
    },
    required: ['criteria', 'suggestion'],
    additionalProperties: false,
} as const;

export const THESIS_PROPOSAL_SCHEMA = {
    type: 'object',
    properties: {
        proposals: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    thesis: { type: 'string' },
                    support: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { verse: { type: 'string' }, evidence: { type: 'string' } },
                            required: ['verse', 'evidence'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['thesis', 'support'],
                additionalProperties: false,
            },
        },
    },
    required: ['proposals'],
    additionalProperties: false,
} as const;

/** La revisión, validada: los seis criterios en orden, uno por criterio. */
export function parseThesisReview(text: string): ThesisReview {
    const raw = JSON.parse(text) as { criteria?: Array<Partial<ThesisCriterionResult>>; suggestion?: string | null };
    const criteria = THESIS_CRITERIA.map(criterion => {
        const c = (raw.criteria ?? []).find(x => x.criterion === criterion);
        const verdict = c?.verdict === 'cumple' || c?.verdict === 'no-cumple' || c?.verdict === 'no-aplica' ? c.verdict : 'no-aplica';
        return { criterion, verdict, reason: (c?.reason ?? '').trim() };
    });
    const suggestion = raw.suggestion?.trim() || null;
    // Sin ningún «no-cumple», no hay nada que corregir.
    return { criteria, suggestion: criteria.some(c => c.verdict === 'no-cumple') ? suggestion : null };
}

/** Las propuestas, sin vacías: como mucho tres. */
export function parseThesisProposals(text: string): ThesisProposal[] {
    const raw = JSON.parse(text) as { proposals?: Array<Partial<ThesisProposal>> };
    return (raw.proposals ?? [])
        .filter(p => p.thesis?.trim())
        .slice(0, 3)
        .map(p => ({
            thesis: p.thesis!.trim(),
            support: (p.support ?? []).filter(s => s.verse?.trim() && s.evidence?.trim()).map(s => ({ verse: s.verse.trim(), evidence: s.evidence.trim() })),
        }));
}
