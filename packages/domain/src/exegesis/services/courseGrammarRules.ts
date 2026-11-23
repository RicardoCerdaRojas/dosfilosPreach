/**
 * Las categorías gramaticales que el curso no acepta como categoría FINAL
 * (procedimiento §4d: «sus categorías marcadas IGNORA no se usan como
 * categoría final»; fase «Asistente del corpus», A5).
 *
 * Medido: el resumen de Wallace del curso NT785 marca «IGNORA» varias
 * categorías del genitivo; el TP #11 eligió «genitivo de producción», que el
 * curso veta, y es el riesgo abierto de su devolución. Una categoría vetada
 * puede nombrarse como lectura rival; nunca ser la decisión.
 */
export const IGNORED_GRAMMAR_CATEGORIES_MAX = 60;
export const IGNORED_GRAMMAR_CATEGORY_MAX_CHARS = 80;

/** Lista lista para guardar: sin vacíos, sin repetir (sin mayúsculas ni tildes), recortada. */
export function cleanIgnoredGrammarCategories(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const vistos = new Set<string>();
    const out: string[] = [];
    for (const raw of value) {
        if (typeof raw !== 'string') continue;
        const texto = raw.replace(/\s+/g, ' ').trim().slice(0, IGNORED_GRAMMAR_CATEGORY_MAX_CHARS);
        const clave = normalizarCategoria(texto);
        if (!clave || vistos.has(clave)) continue;
        vistos.add(clave);
        out.push(texto);
        if (out.length >= IGNORED_GRAMMAR_CATEGORIES_MAX) break;
    }
    return out;
}

/** Una por línea o separadas por punto y coma, como se pegan del resumen del curso. */
export function parseIgnoredGrammarCategories(text: string): string[] {
    return cleanIgnoredGrammarCategories(text.split(/\n|;/));
}

/**
 * Las categorías vetadas que nombra un texto (una decisión, una respuesta).
 * Es la comprobación de la capa 1 sobre la decisión: «genitivo de producción»
 * en la decisión de la pregunta 2 es un hallazgo, no una opinión.
 */
export function ignoredCategoriesIn(text: string | null | undefined, ignored: ReadonlyArray<string>): string[] {
    const t = ` ${normalizarCategoria(text ?? '')} `;
    return ignored.filter(c => {
        const clave = normalizarCategoria(c);
        return !!clave && t.includes(` ${clave} `);
    });
}

function normalizarCategoria(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9Ͱ-Ͽ֐-׿]+/g, ' ').trim();
}
