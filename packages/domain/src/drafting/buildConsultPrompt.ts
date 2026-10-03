import { SPANISH_REGISTER } from '../shared/spanishRegister';

/**
 * El chat de CONSULTA del Taller (hallazgo 32 del ejercicio de Jonás 4:5-11).
 *
 * Pedido del fundador: mientras arma un punto quiere preguntar rápido, por
 * ejemplo «¿qué pasajes o personajes ilustran la actitud de Jonás y la de
 * Dios?» o «dame versículos sobre la misericordia de Dios». Es una herramienta
 * de búsqueda, NO un redactor: no escribe el sermón, no decide por él.
 *
 * Las dos reglas que sostienen el rigor del sistema:
 *   - Los versículos van con su referencia («Libro c:v»): la pantalla los
 *     muestra con el texto REAL de la Biblia y marca los que no existen.
 *   - Nada de citas de autores: las citas de autoridad salen SÓLO de su
 *     biblioteca («Buscar citas en mi biblioteca»), verificadas. Una cita
 *     inventada atribuida a un autor real destruye la credibilidad.
 */
export interface ConsultTurn {
    role: 'pastor' | 'asistente';
    text: string;
}

export interface ConsultInput {
    question: string;
    passage: string;
    /** El tema o la proposición del sermón, si ya existe. */
    proposition?: string;
    /** Dónde está trabajando: «Punto 3 — ilustración». */
    sectionLabel?: string;
    pointTitle?: string;
    /** Lo anterior de esta conversación, del más viejo al más nuevo. */
    history?: ReadonlyArray<ConsultTurn>;
}

/** Cuántos turnos anteriores viajan: lo justo para seguir el hilo. */
export const CONSULT_HISTORY_TURNS = 6;

export const CONSULT_SYSTEM = `Eres un asistente de consulta para un pastor que prepara un sermón. Respondes preguntas puntuales para que encuentre material rápido. NO escribes el sermón ni decides por él.

${SPANISH_REGISTER}

REGLAS:
1. Breve y concreto: listas cortas cuando pide varias cosas. Sin introducciones ni cierres.
2. Cada versículo que menciones va con su referencia completa en la forma «Libro capítulo:versículo» (por ejemplo, «Jonás 4:2», «Salmo 103:8»). Nunca inventes una referencia: si no estás seguro de que exista, no la pongas.
3. NO cites autores, comentaristas ni libros, ni entre comillas ni parafraseados. Si te pide una cita de autoridad, dile que la busque con «Buscar citas en mi biblioteca», que sale de sus propios libros y se verifica.
4. Para ilustraciones: personajes, pasajes o situaciones de la Biblia o de la vida común, descritos en una o dos líneas cada uno, diciendo qué tienen en común con el punto.
5. No redactes párrafos para el púlpito: das material; él escribe.`;

export function buildConsultPrompt(input: ConsultInput): string {
    const contexto = [
        `PASAJE DEL SERMÓN: ${input.passage}`,
        input.proposition?.trim() ? `PROPOSICIÓN: ${input.proposition.trim()}` : null,
        input.pointTitle?.trim() ? `PUNTO EN EL QUE TRABAJA: ${input.pointTitle.trim()}` : null,
        input.sectionLabel?.trim() ? `SECCIÓN: ${input.sectionLabel.trim()}` : null,
    ].filter(Boolean).join('\n');
    const historia = (input.history ?? [])
        .slice(-CONSULT_HISTORY_TURNS)
        .map(t => `${t.role === 'pastor' ? 'PASTOR' : 'ASISTENTE'}: ${t.text.trim()}`)
        .join('\n\n');
    return [
        contexto,
        historia ? `CONVERSACIÓN HASTA AHORA:\n${historia}` : null,
        `PREGUNTA DEL PASTOR:\n${input.question.trim()}`,
    ].filter(Boolean).join('\n\n');
}
