import { findInlineCitations, SENTENCE_ABBREVIATIONS, type ParsedCitation } from '@dosfilos/domain';

/**
 * De las citas inline al reclamo que cada una sostiene.
 *
 * El RECONOCIMIENTO —las tres formas que el sistema emite y cómo se resuelven
 * sus solapamientos— vive en el dominio (`findInlineCitations`), porque el
 * exportador Word necesita leer exactamente lo mismo y tenía su propio patrón,
 * más pobre. Lo que queda aquí es lo del verificador y de nadie más: recortar
 * la frase que la cita respalda.
 */
/**
 * Parses every inline citation in `markdown` plus its surrounding
 * "claim text" — the closest preceding `"..."` block, or the
 * containing sentence as fallback. Pure function.
 *
 * Cuando dos formas se solapan sobre el mismo texto gana la más rica:
 * `(Adamson, "The Epistle of James", p. 53)` se lee entera, y no como
 * un `(Autor, N)` recortado adentro.
 */
export function parseCitations(markdown: string): ParsedCitation[] {
    const accepted = findInlineCitations(markdown);

    // Las citas se tapan ANTES de buscar la evidencia. Sus títulos van entre
    // comillas rectas, y el buscador de comillas las tomaba por una frase
    // citada: en un paper real, la evidencia de una cita a Subukjian terminó
    // siendo «Diccionario Teologico del NT» —el título del libro de la cita
    // anterior—, y el verificador salió a buscar ESO en el corpus.
    //
    // Se reemplaza por espacios, no se borra: los offsets ya calculados
    // tienen que seguir siendo válidos.
    const masked = maskRanges(markdown, accepted);

    const ordenadas = [...accepted].sort((a, b) => a.offset - b.offset);
    const grupos = parenthesisGroups(ordenadas);
    return ordenadas.map((m, i) => {
        // Todas las de un mismo paréntesis comparten la oración: cada una se
        // juzga por SU parte (TP #8, 8b, D1). «(Mayor, 129; Adamson, 166)»
        // salía falsa alarma porque cada una cargaba con la parte de la otra.
        const primera = ordenadas[grupos[i]!.first]!;
        const evidence = extractEvidence(masked, primera.offset);
        const otras = grupos[i]!.members.filter(j => j !== i).map(j => ordenadas[j]!.author).filter(Boolean);
        return {
            raw: m.raw,
            author: m.author,
            title: m.title,
            pages: m.pages,
            offset: m.offset,
            evidence: evidence.text,
            evidenceIsQuoted: evidence.fromQuote,
            ...(otras.length > 0 ? { otherSources: [...new Set(otras)] } : {}),
        };
    });
}

/**
 * A qué paréntesis pertenece cada cita: una que abre con «;» sigue al de la
 * anterior («(Mayor, 129; Adamson, 166)» son dos citas, la segunda con «;»).
 */
function parenthesisGroups(citas: ReadonlyArray<{ raw: string }>): Array<{ first: number; members: number[] }> {
    const out: Array<{ first: number; members: number[] }> = [];
    let actual: { first: number; members: number[] } | null = null;
    citas.forEach((c, i) => {
        if (actual && /^\s*;/.test(c.raw)) actual.members.push(i);
        else { actual = { first: i, members: [i] }; }
        out[i] = actual;
    });
    return out;
}

/** Tapa con espacios los tramos indicados, conservando la longitud y los offsets. */
function maskRanges(text: string, ranges: ReadonlyArray<{ offset: number; end: number }>): string {
    const chars = [...text];
    for (const r of ranges) {
        for (let i = r.offset; i < r.end && i < chars.length; i++) chars[i] = ' ';
    }
    return chars.join('');
}

/**
 * Extracts the text the citation is asserting comes from the source.
 * Strategy:
 *   1. If a `"..."` quote ends within ~200 chars before the citation,
 *      use that quote (high-confidence verbatim claim).
 *   2. Otherwise, walk back to the nearest sentence boundary
 *      (`.`/`!`/`?`/`\n\n`) and use that sentence (paraphrase claim).
 *
 * The window cap (200 chars / 1 sentence) keeps the evidence focused —
 * a paragraph-sized claim against a paragraph-sized excerpt would
 * always land in fuzzy-low territory because the noise dominates.
 */
function extractEvidence(
    markdown: string,
    citationOffset: number,
): { text: string; fromQuote: boolean } {
    // Search the 250-char window preceding the citation for a closing
    // quote. Use the LAST one (closest to the cite) — earlier quotes
    // in the same paragraph belong to other claims.
    const lookBack = Math.max(0, citationOffset - 250);
    const window = markdown.slice(lookBack, citationOffset);

    // Se admiten las comillas rectas Y las angulares: la prosa académica en
    // español cita con «», y mirar sólo `"` dejaba sin detectar toda cita
    // verbatim de un paper en castellano.
    for (const [open, close] of [['«', '»'], ['"', '"']] as const) {
        const closeIdx = window.lastIndexOf(close);
        if (closeIdx <= 0) continue;
        const openIdx = window.lastIndexOf(open, close === open ? closeIdx - 1 : closeIdx);
        if (openIdx < 0 || closeIdx - openIdx < 4) continue;
        const quoteText = window.slice(openIdx + 1, closeIdx).trim();
        if (quoteText.length >= 8) {
            return { text: quoteText, fromQuote: true };
        }
    }

    // Fallback: containing sentence. Walk back to the previous
    // sentence-ending punctuation or paragraph break.
    const sentenceStart = findSentenceStart(markdown, citationOffset);
    const sentence = markdown
        .slice(sentenceStart, citationOffset)
        .replace(/\s+/g, ' ')
        .trim();
    return { text: sentence, fromQuote: false };
}

/**
 * Abreviaturas cuyo punto NO cierra la oración. TP #8 (#42): en
 * «…una paráfrasis de 1QS 4:9ss. (Adamson, 171)» el punto de «ss.» se leía
 * como fin de oración, la evidencia quedaba vacía y la cita salía «revisión
 * manual» con «No se pudo extraer el texto reclamado». En minúscula, sin el
 * punto final.
 *
 * Dos clases (revisión adversarial):
 * - las que van ANTES de algo («cf. Pr 3:34», «p. 53», «el Dr. Mayor») no
 *   cortan nunca;
 * - las que pueden CERRAR una oración («…virtudes, etc. Santiago…», «4:9ss.
 *   Adamson…») cortan sólo si lo que sigue empieza con mayúscula. Si no, la
 *   evidencia se tragaba la oración anterior y bajaba el puntaje de la cita.
 *
 * La base es la lista del dominio (`SENTENCE_ABBREVIATIONS`), la regla única
 * de qué es una oración; aquí se suman las de las citas académicas.
 */
const PUEDEN_CERRAR = new Set(['etc', 's', 'ss', 'aprox', 'esp']);
const ABREVIATURAS = new Set([
    ...SENTENCE_ABBREVIATIONS,
    ...PUEDEN_CERRAR,
    'cf', 'p', 'pp', 'v', 'vv', 'n', 'nn', 'ed', 'eds', 'trad', 'vol', 'vols',
    'cap', 'caps', 'núm', 'num', 'ibíd', 'ibid', 'op', 'cit', 'lit', 'fig', 'col', 'cols',
    'ca', 'vs', 'i.e', 'e.g',
]);

/** ¿Lo que sigue al punto, saltando espacios, empieza con mayúscula? */
function sigueMayuscula(markdown: string, i: number): boolean {
    let j = i + 1;
    while (j < markdown.length && /\s/.test(markdown[j]!)) j++;
    return j < markdown.length && /\p{Lu}/u.test(markdown[j]!);
}

/** La palabra pegada al punto de `i`: «ss» en «4:9ss.», «i.e» en «i.e.». */
function palabraAntesDelPunto(markdown: string, i: number): string {
    let j = i - 1;
    while (j >= 0 && /[\p{L}.]/u.test(markdown[j]!)) j--;
    return markdown.slice(j + 1, i).toLowerCase();
}

function findSentenceStart(markdown: string, offset: number): number {
    // Stop at the closest of: `. `, `! `, `? `, `\n\n`, or start of file.
    for (let i = offset - 1; i >= 0; i--) {
        const c = markdown[i];
        const next = markdown[i + 1];
        if ((c === '.' || c === '!' || c === '?') && (next === ' ' || next === '\n')) {
            // El punto de una abreviatura no cierra la oración.
            if (c === '.') {
                const palabra = palabraAntesDelPunto(markdown, i);
                const cierra = PUEDEN_CERRAR.has(palabra) && sigueMayuscula(markdown, i);
                if (ABREVIATURAS.has(palabra) && !cierra) continue;
            }
            // Un punto pegado a la cita, «… desconocida. (Adamson, 170)», cierra
            // la MISMA oración que la cita respalda: se sigue buscando hacia
            // atrás, o la evidencia queda vacía.
            if (markdown.slice(i + 1, offset).trim() === '') continue;
            return i + 2;
        }
        if (c === '\n' && next === '\n') return i + 2;
    }
    return 0;
}
