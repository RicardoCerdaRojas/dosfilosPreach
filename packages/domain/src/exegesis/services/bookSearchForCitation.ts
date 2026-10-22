import type { ParsedCitation } from '../entities/CitationVerification';
import { parsePageRange } from './evidenceForCitation';
import { hasResolvedNumbering, sheetForPrintedIn, type PageNumbering } from '../outline/pageNumbering';

/**
 * Antes de alarmar, leer: la página citada, sus vecinas y el libro entero
 * (TP #8, fase 8b, D1).
 *
 * El juez de citas decidía con lo que tenía a mano —las hojas de la receta y
 * los cinco fragmentos más parecidos— y nunca pedía la página citada aparte.
 * McCartney 203 (TP #7) y Adamson 171 → 170 (TP #8) salieron «no encontrada»
 * con el texto a una página de distancia. Esto decide QUÉ leer; leer y volver
 * a juzgar lo hace el verificador (`BookSearchBeforeAlarmVerifier`).
 */

/** Hojas a cada lado de la citada que se leen siempre. */
export const NEIGHBOUR_SHEETS = 2;
/** Hojas candidatas del libro que se vuelven a juzgar, como mucho. */
export const MAX_CANDIDATE_SHEETS = 3;

/**
 * Las hojas físicas que cubre la cita, más sus vecinas.
 *
 * `pages` viene en la unidad de la evidencia: página impresa cuando el libro
 * tiene numeración resuelta y la cita no dice «hoja»; si no, la hoja misma.
 * Devuelve vacío cuando no hay cómo ubicarla (sin página, o una impresa que
 * la numeración no traduce).
 */
export function sheetsAroundCitation(
    citation: Pick<ParsedCitation, 'pages' | 'evidencePage' | 'raw'>,
    numbering: PageNumbering | null,
    neighbours: number = NEIGHBOUR_SHEETS,
): number[] {
    const rango = parsePageRange(citation.pages ?? citation.evidencePage ?? null);
    if (!rango) return [];
    const esHoja = /\bhoja\b|\bsheet\b/i.test(citation.raw ?? '') || !hasResolvedNumbering(numbering);
    const aHoja = (n: number): number | null => (esHoja ? n : sheetForPrintedIn(numbering, n));
    const desde = aHoja(rango.start);
    const hasta = aHoja(rango.end) ?? desde;
    if (desde === null || hasta === null) return [];
    const out: number[] = [];
    for (let s = Math.max(1, Math.min(desde, hasta) - neighbours); s <= Math.max(desde, hasta) + neighbours; s++) out.push(s);
    return out;
}

const VACIAS = new Set([
    // es
    'que', 'para', 'como', 'pero', 'porque', 'cuando', 'donde', 'desde', 'hasta', 'sobre', 'entre', 'según',
    'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'aquel', 'aquella', 'también', 'sólo', 'solo', 'cada',
    'tiene', 'tienen', 'puede', 'pueden', 'hace', 'sino', 'aunque', 'mismo', 'misma', 'otro', 'otra', 'todos',
    // en
    'that', 'this', 'these', 'those', 'which', 'with', 'from', 'into', 'about', 'there', 'their', 'would',
    'should', 'could', 'because', 'while', 'where', 'when', 'than', 'then', 'also', 'only', 'other', 'have',
]);

/**
 * Qué buscar en el libro para ubicar la cita.
 *
 * - Cita textual: dos tramos de seis palabras (el comienzo y el medio). Una
 *   frase literal es inconfundible y tolera que el resto se haya cortado.
 * - Paráfrasis: las tres palabras más distintivas (las más largas que no son
 *   de relleno), incluidas las griegas y hebreas. Ubican la hoja; el juez
 *   decide si la sostiene.
 */
export function searchTermsForCitation(evidence: string, evidenceIsQuoted: boolean): string[] {
    const palabras = evidence.normalize('NFC').split(/[^\p{L}\p{M}\p{N}'’-]+/u).filter(Boolean);
    if (evidenceIsQuoted && palabras.length >= 6) {
        const medio = Math.max(0, Math.floor(palabras.length / 2) - 3);
        const tramos = [palabras.slice(0, 6), palabras.slice(medio, medio + 6)].map(t => t.join(' '));
        return [...new Set(tramos)];
    }
    const candidatas = [...new Set(palabras.filter(p => {
        const sinMarcas = p.normalize('NFD').replace(/\p{M}/gu, '');
        return sinMarcas.length >= 5 && !VACIAS.has(sinMarcas.toLowerCase());
    }))];
    return candidatas.sort((a, b) => b.length - a.length).slice(0, 3);
}

/**
 * Las hojas del libro que más términos contienen, fuera de las ya leídas.
 * Una hoja con un solo término de tres no es candidata cuando hay otra con
 * más: la frase de una paráfrasis aparece suelta en todo el libro.
 */
export function candidateSheets(
    hitsByTerm: ReadonlyArray<ReadonlyArray<{ sheet: number; count: number }>>,
    alreadyRead: ReadonlySet<number>,
    max: number = MAX_CANDIDATE_SHEETS,
): number[] {
    const porHoja = new Map<number, { terminos: number; apariciones: number }>();
    for (const hits of hitsByTerm) {
        for (const h of hits) {
            if (alreadyRead.has(h.sheet)) continue;
            const actual = porHoja.get(h.sheet) ?? { terminos: 0, apariciones: 0 };
            actual.terminos += 1;
            actual.apariciones += h.count;
            porHoja.set(h.sheet, actual);
        }
    }
    const mejor = Math.max(0, ...[...porHoja.values()].map(v => v.terminos));
    // Si alguna hoja reúne dos términos o más, sólo cuentan las que reúnen dos:
    // una palabra suelta aparece en todo el libro. Si ninguna, basta uno (una
    // frase literal de seis palabras hallada sola ya es inconfundible).
    const minimo = Math.min(2, mejor);
    return [...porHoja.entries()]
        .filter(([, v]) => v.terminos >= minimo)
        .sort((a, b) => b[1].terminos - a[1].terminos || b[1].apariciones - a[1].apariciones || a[0] - b[0])
        .slice(0, max)
        .map(([sheet]) => sheet);
}
