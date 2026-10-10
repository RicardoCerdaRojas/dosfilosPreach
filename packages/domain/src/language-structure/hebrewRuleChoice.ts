/**
 * R4 — lo común a las reglas «medidas» del hebreo (infinitivo, participio): cómo
 * se le pide al asistente que elija y cómo se muestra lo que eligió.
 *
 * La regla deja las funciones POSIBLES. Con una sola, la propone (medida, sin
 * validar); con varias, elige el asistente. Si el asistente lee una función que
 * la regla no deja, no se descarta: se muestra al lado (revisión de R4, 1 S 22:17).
 */

export type RuleStatus = 'medida' | 'validada';

export interface RuleChoiceCandidate<F extends string> {
    /** La palabra, como está escrita (sin cantilación): así la nombra el prompt. */
    readonly text: string;
    readonly allowed: readonly F[];
    readonly status: RuleStatus;
    /** Si la misma forma aparece varias veces en el versículo (tenga regla o no): cuál es. */
    readonly occurrence?: { readonly n: number; readonly of: number };
}

/** Lo que muestra la ficha. */
export interface RuleChoiceView<C, F extends string> {
    readonly candidate: C;
    /** La función, si la propone la regla (una opción) o el asistente eligió una de la lista. */
    readonly fn?: F;
    /** `rule`: una sola opción; `assistant`: eligió de la lista; ninguna: sólo las opciones. */
    readonly by?: 'rule' | 'assistant';
    /** El asistente leyó una función que la regla (medida, sin validar) no deja: se muestran las dos. */
    readonly assistantReading?: F;
}

export function applyRuleChoice<F extends string, C extends RuleChoiceCandidate<F>>(
    candidate: C, choice: string | undefined, validas: ReadonlySet<string>,
): RuleChoiceView<C, F> {
    const allowed = candidate.allowed as readonly string[];
    const fuera = choice && validas.has(choice) && !allowed.includes(choice) && candidate.status === 'medida'
        ? { assistantReading: choice as F } : {};
    if (candidate.allowed.length === 1) return { candidate, fn: candidate.allowed[0]!, by: 'rule', ...fuera };
    const elegida = choice && allowed.includes(choice) ? (choice as F) : undefined;
    return elegida ? { candidate, fn: elegida, by: 'assistant' } : { candidate, ...fuera };
}

/**
 * Una línea del prompt por candidato. Una forma repetida en el versículo se distingue por su aparición
 * (Neh 9:8, dos «לָתֵת»), contando también las que no tienen regla (revisión de R4).
 */
export function ruleChoiceLines<F extends string, C extends RuleChoiceCandidate<F>>(
    candidates: readonly C[], campo: string, forma: (c: C) => string, nombres: Readonly<Record<F, string>>,
): string[] {
    const todas = Object.keys(nombres).join(', ');
    return candidates.map(c => {
        const cual = c.occurrence ? ` (${c.occurrence.n}.ª aparición de ${c.occurrence.of} en el versículo)` : '';
        const f = c.allowed[0]!;
        return c.allowed.length === 1
            ? `- ${c.text}${cual}: ${forma(c)}; el texto propone ${f} = ${nombres[f]} (regla medida, todavía sin validar). Si el contexto lo confirma, devuelve "${campo}": "${f}" y explícalo; si claramente es otra función, devuelve esa (uno de: ${todas}) y di por qué.`
            : `- ${c.text}${cual}: ${forma(c)}, elige "${campo}" de: ${c.allowed.map(x => `"${x}" (${nombres[x]})`).join('; ')}. Elige por el contexto y explica por qué; si ninguna encaja, devuelve la que corresponda (uno de: ${todas}) y di por qué.`;
    });
}
