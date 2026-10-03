import type { WordStudyLanguage } from '../entities/PastoralWordAnalysis';
import { parsePassageReference } from './canon/passage-reference';

/**
 * Heuristic: which original language carries the canonical text of a
 * given Bible book. NT books → greek, OT books → hebrew. The list is
 * conservative and matches the SBLGNT / MorphHB coverage shipped in
 * Phase 0. Ambiguous edge cases (Aramaic portions in Daniel / Ezra)
 * still resolve to `hebrew` because the MorphHB tagging covers them.
 *
 * Used by `PastoralWordStudyModal` to default the `language` prop from
 * the passage's book. The user can still toggle if the heuristic is
 * wrong for their use case (e.g., AT quoted in NT context).
 */
export function inferLanguageFromBook(book: string): WordStudyLanguage {
    const normalized = book.trim().toLowerCase().replace(/\s+/g, '');
    if (NT_BOOK_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        return 'greek';
    }
    return 'hebrew';
}

/**
 * Prefix list rather than full names so abbreviations + Spanish names
 * + numerals (1 Cor / 1Cor / 1cor) match without an explicit table.
 */
const NT_BOOK_PREFIXES = [
    'mateo', 'mat', 'mt',
    'marcos', 'mar', 'mc', 'mr',
    'lucas', 'luc', 'lc',
    'juan1', 'juan2', 'juan3', // 1/2/3 Juan handled below; also catch unspaced
    'juan', 'jn',
    'hechos', 'hch', 'ac',
    'romanos', 'rom', 'rm',
    '1corintios', '1cor', '1co',
    '2corintios', '2cor', '2co',
    'galatas', 'gal', 'gá',
    'efesios', 'efe', 'ef',
    'filipenses', 'fil', 'flp',
    'colosenses', 'col',
    '1tesalonicenses', '1tes', '1ts',
    '2tesalonicenses', '2tes', '2ts',
    '1timoteo', '1tim', '1ti',
    '2timoteo', '2tim', '2ti',
    'tito', 'tit',
    'filemon', 'flm',
    'hebreos', 'heb',
    'santiago', 'stg', 'jas',
    '1pedro', '1pe', '1p',
    '2pedro', '2pe', '2p',
    '1juan', '1jn',
    '2juan', '2jn',
    '3juan', '3jn',
    'judas', 'jud',
    'apocalipsis', 'apoc', 'ap', 'rev',
];

/**
 * La lengua original de un pasaje, por el testamento de su libro.
 *
 * El estudio de palabras arrancaba siempre en «Griego» y en Jonás había que
 * cambiarlo a mano en cada palabra (#29 del ejercicio). El canon sabe el
 * testamento de cada libro; la heurística por prefijos queda de respaldo para
 * un pasaje que no se pueda leer.
 */
export function languageForPassage(passage: string): WordStudyLanguage {
    const parsed = parsePassageReference(passage);
    if (parsed.ok) return parsed.book.testament === 'NT' ? 'greek' : 'hebrew';
    return inferLanguageFromBook(passage.replace(/\s*\d+[:.].*$/, ''));
}
