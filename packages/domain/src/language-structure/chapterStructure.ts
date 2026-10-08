/**
 * La estructura sintáctica de un capítulo, para hebreo y griego: un solo
 * modelo (fase módulos de idioma, G0).
 *
 * Sale de `scripts/language-structure/build.mjs`: morfología de MorphGNT /
 * OSHB y árboles de MACULA, alineados por identificador y verificados. Es DATO:
 * lo que aquí dice (qué cláusula contiene a cuál, el rol de cada palabra) no lo
 * decide el asistente.
 */

export type StructureLanguage = 'gr' | 'he';

/** Una pieza de una palabra hebrea (prefijo, raíz, sufijo) según MACULA. */
export interface StructurePart {
    readonly t: string;
    /** Código morfológico (el de OSHB, sin prefijo de idioma). */
    readonly m: string;
    readonly role: string;
}

export interface StructureWord {
    /** «versículo!n», con n desde 1 en el orden del texto. */
    readonly r: string;
    readonly t: string;
    /** Lema (MorphGNT) o número de Strong de OSHB. */
    readonly l: string;
    /** Rol en su cláusula según MACULA: s, v, o, io, adv, p… o vacío. */
    readonly role: string;
    /** Griego: categoría y código de 8 posiciones de MorphGNT. */
    readonly pos?: string;
    readonly parse?: string;
    /** Hebreo: código de OSHB y piezas. */
    readonly m?: string;
    readonly parts?: readonly StructurePart[];
    /** Hebreo: la forma escrita (ketiv); se lee el qere que le sigue. */
    readonly ketiv?: boolean;
}

export interface StructureClause {
    /** Índice de la cláusula que la contiene en el mismo capítulo, o `null`. */
    readonly p: number | null;
    /** Regla de MACULA: «S-V-O», «Conj-CL», «sub-CL»… */
    readonly rule: string;
    /** Rol de la cláusula en la que la contiene: adv, o, s… */
    readonly role: string;
    /** Palabras («versículo!n») en orden. */
    readonly w: readonly string[];
}

export interface ChapterStructure {
    readonly lang: StructureLanguage;
    readonly book: string;
    readonly chapter: number;
    readonly words: readonly StructureWord[];
    readonly clauses: readonly StructureClause[];
}

export interface ILanguageStructureProvider {
    /** `null` si el capítulo no existe en los datos. */
    getChapter(lang: StructureLanguage, book: string, chapter: number): Promise<ChapterStructure | null>;
}

const versoDe = (r: string) => Number(r.split('!')[0]);

/** Las palabras de un versículo, en orden (sin los ketiv: se lee el qere). */
export function verseWords(ch: ChapterStructure, verse: number): StructureWord[] {
    return ch.words.filter(w => versoDe(w.r) === verse && !w.ketiv);
}

export interface VerseClauseNode {
    /** Índice en `ch.clauses`. */
    readonly index: number;
    readonly clause: StructureClause;
    /** Profundidad entre las cláusulas que tocan el versículo (0 = la de afuera). */
    readonly depth: number;
    /** Sus palabras en ESTE versículo. */
    readonly words: readonly string[];
}

/**
 * Las cláusulas que tocan un versículo, en el orden de su primera palabra, con
 * la profundidad de anidamiento: lo que dibuja la vista «Estructura».
 */
export function clausesOfVerse(ch: ChapterStructure, verse: number): VerseClauseNode[] {
    const orden = new Map(ch.words.map((w, i) => [w.r, i]));
    const tocan = ch.clauses
        .map((clause, index) => ({ clause, index, words: clause.w.filter(r => versoDe(r) === verse) }))
        .filter(x => x.words.length > 0);
    const indices = new Set(tocan.map(x => x.index));
    const profundidad = (i: number): number => {
        let d = 0;
        let p = ch.clauses[i]?.p ?? null;
        while (p !== null && d < 64) {
            if (indices.has(p)) d++;
            p = ch.clauses[p]?.p ?? null;
        }
        return d;
    };
    return tocan
        .map(x => ({ ...x, depth: profundidad(x.index) }))
        .sort((a, b) => (orden.get(a.words[0]!) ?? 0) - (orden.get(b.words[0]!) ?? 0));
}
