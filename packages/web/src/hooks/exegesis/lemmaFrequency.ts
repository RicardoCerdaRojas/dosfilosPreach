/**
 * Cuántas veces aparece un lema en toda la Biblia, de los índices
 * PRECOMPUTADOS: NT por lema (`scripts/build-greek-lemma-index.mjs`) y AT por
 * número de Strong (`scripts/build-hebrew-strong-frequency.mjs`). Entran por
 * import dinámico: sólo se bajan al pedir una «Selección sugerida».
 */
let nt: Promise<Record<string, number>> | null = null;
let at: Promise<Record<string, number>> | null = null;

export const loadNtFrequency = () =>
    (nt ??= import('@/pages/greek-analyzer/ntLemmaFrequency.json').then(m => m.default as Record<string, number>));

export const loadOtFrequency = () =>
    (at ??= import('@/data/hebrew/strongFrequency.json').then(m => m.default as Record<string, number>));
