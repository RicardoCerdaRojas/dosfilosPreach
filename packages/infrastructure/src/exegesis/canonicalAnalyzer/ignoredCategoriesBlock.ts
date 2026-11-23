/**
 * Las categorías que el curso no acepta como categoría final (A5). Vacío sin
 * lista: el prompt de siempre, sin un carácter distinto.
 */
export function formatIgnoredCategories(categories: ReadonlyArray<string> | null | undefined, lang: 'es' | 'en'): string {
    const lista = (categories ?? []).map(c => c.trim()).filter(Boolean);
    if (lista.length === 0) return '';
    if (lang === 'en') {
        return [
            `## Categories the course does not accept as final`,
            `The course grammar marks these categories as not to be used as the final category: ${lista.join('; ')}.`,
            `You may name one as a rival reading, with who holds it; never as the decision, the commitment or the syntactic function you settle on.`,
        ].join('\n');
    }
    return [
        `## Categorías que el curso no acepta como final`,
        `La gramática del curso marca estas categorías para no usarlas como categoría final: ${lista.join('; ')}.`,
        `Puedes nombrar una como lectura rival, con quién la sostiene; nunca como la decisión, el compromiso ni la función sintáctica que eliges.`,
    ].join('\n');
}
