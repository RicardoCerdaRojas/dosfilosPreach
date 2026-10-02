/**
 * Presupuesto de caracteres del prompt que se le manda al callable
 * `runLlmPrompt`.
 *
 * El servidor rechaza con `invalid-argument` todo `prompt` que pase de
 * `MAX_PROMPT_CHARS` (ver `packages/functions/src/llm/runLlmPrompt.ts`). Los
 * constructores de prompt de exégesis venían con presupuestos de fuentes de
 * 220.000 y 250.000 caracteres — por encima del tope. Con un corpus de
 * comentarios completos el prompt superaba el tope y la llamada moría con
 * `prompt excede 200000 caracteres`: la pantalla de exégesis quedaba trabada
 * sin poder generar ningún paso.
 *
 * La constante está DUPLICADA a propósito: `infrastructure` corre en el
 * navegador y `functions` en Cloud Functions; no hay paquete compartido entre
 * los dos. Si cambia allá, cambiá acá.
 */
export const MAX_PROMPT_CHARS = 200_000;

/**
 * Colchón entre el presupuesto calculado y el tope duro. Cubre lo que el
 * bloque variable agrega por encima del texto que se le presupuesta
 * (encabezados por fuente, el bloque de contrato de fuentes asignadas, los
 * marcadores de truncado) y los separadores del armado final.
 */
const SAFETY_MARGIN_CHARS = 4_000;

const PLACEHOLDER = ' __VARIABLE_BLOCK__ ';

/**
 * Arma un mensaje cuyo bloque más grande —el corpus de fuentes— se recorta a
 * lo que quede libre bajo el tope del servidor, en vez de a una constante fija
 * que lo ignora.
 *
 * Dos pasadas: la primera mide todo lo que NO es el bloque variable (las
 * instrucciones, el brief, los análisis previos, el hint de regeneración); la
 * segunda arma el bloque variable con el saldo. Así el recorte cae siempre en
 * las fuentes —que ya tienen truncado con marcador visible— y nunca en el hint
 * del usuario ni en las instrucciones metodológicas.
 *
 * @param render             arma el mensaje completo dado el bloque variable.
 * @param buildVariableBlock arma el bloque variable dado su presupuesto.
 * @param preferredBudget    tope deseado cuando hay lugar de sobra.
 * @param label              para el log cuando hay que recortar.
 */
export function fitPromptToCap(
    render: (variableBlock: string) => string,
    buildVariableBlock: (budgetChars: number) => string,
    preferredBudget: number,
    label: string,
): string {
    const skeleton = render(PLACEHOLDER);
    const overhead = skeleton.length - PLACEHOLDER.length;
    const available = Math.max(0, MAX_PROMPT_CHARS - SAFETY_MARGIN_CHARS - overhead);
    const budget = Math.min(preferredBudget, available);

    if (budget < preferredBudget) {
        console.log(`[${label}] recortando corpus para entrar en el tope del proxy`, {
            overhead,
            preferredBudget,
            budget,
            maxPromptChars: MAX_PROMPT_CHARS,
        });
    }

    const message = skeleton.replace(PLACEHOLDER, buildVariableBlock(budget));

    // Red de seguridad: si el texto FIJO solo ya pasa el tope (guía de estilo,
    // análisis previos y brief al máximo), no hay presupuesto que ajustar y la
    // llamada moriría en el servidor. Se recorta acá con un aviso fuerte, que
    // es peor que no llegar a este caso pero mejor que trabar la pantalla.
    if (message.length > MAX_PROMPT_CHARS) {
        console.warn(`[${label}] el prompt pasa el tope aun sin corpus; se recorta el final`, {
            length: message.length,
            maxPromptChars: MAX_PROMPT_CHARS,
        });
        return message.slice(0, MAX_PROMPT_CHARS);
    }

    return message;
}

/**
 * Lo que ocupa en el mensaje del analizador todo lo que NO es el corpus:
 * 5.003 caracteres medidos para Jonás 4:6 (2026-10-02), redondeado hacia
 * arriba.
 *
 * La guía de estilo, el encuadre, el texto base, el entorno y la morfología NO
 * van aquí: viajan en las instrucciones de sistema, que tienen su propio tope.
 * Los análisis previos SÍ van en el mensaje y crecen con el trabajo (hasta
 * 40.000): el medidor lo dice en pantalla.
 */
const VERSE_FIXED_PARTS_CHARS = 6_000;

/**
 * Tope de los análisis ya aceptados que el analizador repite en cada versículo
 * para dar continuidad. Ocupan el mismo mensaje que el corpus.
 */
export const PRIOR_ANALYSES_BUDGET_CHARS = 40_000;

/**
 * El espacio para el corpus que muestra el medidor del trabajo: hasta aquí,
 * ninguna fuente se recorta en un versículo sin análisis previos. Lo ata a
 * `buildAnalyzerPrompt` una prueba (`espacioDelCorpus.test.ts`), no la
 * confianza en esta cuenta.
 */
export const VERSE_CORPUS_SPACE_CHARS = MAX_PROMPT_CHARS - SAFETY_MARGIN_CHARS - VERSE_FIXED_PARTS_CHARS;

/**
 * Reparte el espacio del corpus entre las fuentes sin desperdiciar nada.
 *
 * Antes cada fuente recibía una parte fija (igual, o según su tipo) y se
 * recortaba a esa parte aunque sobrara espacio: en Jonás 4:5-11, con siete
 * fuentes, cada una tenía ~26.000 (el espacio / 7); Gelston usaba 8.741 y lo
 * que dejaba no pasaba a ninguna otra. Aquí
 * la fuente que necesita menos que su parte se queda con lo suyo, y lo que deja
 * se reparte entre las demás, con los mismos pesos.
 *
 * Si todo cabe, nadie se recorta. Si no, se recortan las que más traen.
 */
export function allocateSourceBudgets(
    lengths: ReadonlyArray<number>,
    weights: ReadonlyArray<number>,
    totalChars: number,
): number[] {
    const budgets = lengths.map(() => 0);
    let pending = lengths.map((_, i) => i).filter(i => lengths[i]! > 0 && weights[i]! > 0);
    let left = Math.max(0, totalChars);
    while (pending.length > 0 && left > 0) {
        const weightSum = pending.reduce((s, i) => s + weights[i]!, 0);
        const share = (i: number) => Math.floor(left * weights[i]! / weightSum);
        const fit = pending.filter(i => lengths[i]! <= share(i));
        if (fit.length === 0) {
            for (const i of pending) budgets[i] = share(i);
            break;
        }
        for (const i of fit) {
            budgets[i] = lengths[i]!;
            left -= lengths[i]!;
        }
        pending = pending.filter(i => !fit.includes(i));
    }
    return budgets;
}
