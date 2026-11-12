import { verseWords, type ChapterStructure } from './chapterStructure.js';

/**
 * U10 (revisión del profesor 2026-11, Stg 3:5 «ἰδοὺ ἡλίκον πῦρ ἡλίκην ὕλην
 * ἀνάπτει»): el MISMO lema dos veces en el versículo con distinto sentido en
 * contexto. MACULA lo distingue con su glosa (ἡλίκον «small», ἡλίκην «how
 * great»); Louw-Nida no, porque las dos van en 79.127, que abarca «qué
 * grande» y «qué pequeño» y cita justamente Stg 3:5.
 *
 * Medido (2026-11-12, gpt-6-luna, prompt v15): sin ayuda, las dos salen «qué
 * gran» y la LITERAL dice «qué gran fuego enciende qué gran bosque». Una regla
 * general de coherencia literal/fluida corrige la palabra pero NO la literal,
 * porque el modelo escribe la literal antes que las palabras. Con la glosa de
 * MACULA como pista, la literal sale bien («qué pequeño fuego enciende qué
 * gran bosque») en 2 de 2 corridas, y Lc 12:42 κύριος distingue «el Señor» de
 * «el amo» de la parábola.
 *
 * La glosa (`g`) la exporta `build.mjs` sólo para estas palabras (157
 * versículos del NT). La mitad son sentidos de verdad distintos y la otra
 * mitad, sinónimos («now» / «already»): por eso es una PISTA y un DATO, nunca
 * un aviso. La glosa en contexto es correcta en los dos casos.
 */
export interface SameLemmaWord {
    /** Posición de la palabra en el versículo. */
    readonly ordinal: number;
    /** La glosa inglesa en contexto de MACULA. */
    readonly gloss: string;
}

export interface SameLemmaFact {
    readonly lemma: string;
    /** Las apariciones del lema en el versículo, en orden, cada una con su glosa. */
    readonly words: readonly SameLemmaWord[];
}

export function greekSameLemma(ch: ChapterStructure, verse: number): SameLemmaFact[] {
    if (ch.lang !== 'gr') return [];
    const porLema = new Map<string, SameLemmaWord[]>();
    verseWords(ch, verse).forEach((w, ordinal) => {
        if (!w.g) return;
        porLema.set(w.l, [...(porLema.get(w.l) ?? []), { ordinal, gloss: w.g }]);
    });
    return [...porLema].filter(([, ws]) => ws.length > 1).map(([lemma, words]) => ({ lemma, words }));
}

/** Las líneas para el prompt griego: una pista por lema, con la glosa de cada aparición. */
export function buildSameLemmaTask(facts: readonly SameLemmaFact[], words: readonly string[]): string {
    if (!facts.length) return '';
    const lineas = facts.map(f => `- ${f.lemma}: ${f.words.map(w => `${w.ordinal + 1}. ${words[w.ordinal]} «${w.gloss}»`).join('; ')}`);
    return `
MISMO LEMA, GLOSAS DISTINTAS EN CONTEXTO (dato: la glosa inglesa de cada aparición según el análisis sintáctico MACULA):
${lineas.join('\n')}
Traduce cada aparición por SU sentido en contexto: en su "translation" y TAMBIÉN en la literal y la fluida; no las unifiques. Si las glosas son sinónimos («now» / «already»), basta con una traducción fiel; no fuerces una diferencia.`;
}
