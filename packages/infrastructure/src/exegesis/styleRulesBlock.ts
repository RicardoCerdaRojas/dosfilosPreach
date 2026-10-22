/**
 * Las reglas propias de la guía de estilo del curso (`additionalRules`), como
 * bloque de prompt (TP #8, fase 8b, E2). Las usan el analizador y el
 * compositor del versículo; antes sólo el del trabajo completo, y por eso el
 * profesor seguía marcando lo mismo en cada TP.
 */
export function buildStyleRulesBlock(rules: ReadonlyArray<string> | null | undefined, lang: 'es' | 'en'): string {
    const reglas = (rules ?? []).map(r => r.trim()).filter(Boolean);
    if (reglas.length === 0) return '';
    return [
        lang === 'en' ? '## Course rules (from the style guide, mandatory)' : '## Reglas del curso (de la guía de estilo, obligatorias)',
        ...reglas.map(r => `- ${r}`),
    ].join('\n');
}
