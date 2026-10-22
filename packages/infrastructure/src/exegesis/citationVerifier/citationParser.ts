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
        const ultima = ordenadas[grupos[i]!.members[grupos[i]!.members.length - 1]!]!;
        // La evidencia no cruza la cita anterior: su oración o su cita textual
        // son de otra fuente (Mayor heredaba el «πρὸς φθόνον» de Metzger).
        const anterior = grupos[i]!.first > 0 ? ordenadas[grupos[i]!.first - 1]!.end : 0;
        const evidence = extractEvidence(masked, primera.offset, ultima.end, anterior, /^\s*[(;]/.test(primera.raw));
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

/**
 * Tapa con espacios los tramos indicados, conservando la longitud y los
 * offsets. En unidades UTF-16, las mismas de `regex.exec`: con `[...text]`
 * (puntos de código) una letra fuera del plano básico (𝔓⁴⁶, un emoji) corría
 * el tramo tapado y acortaba el texto (revisión de 8b, D2).
 */
export function maskRanges(text: string, ranges: ReadonlyArray<{ offset: number; end: number }>): string {
    let out = text;
    for (const r of ranges) {
        const desde = Math.max(0, r.offset);
        const hasta = Math.min(out.length, r.end);
        if (hasta > desde) out = out.slice(0, desde) + ' '.repeat(hasta - desde) + out.slice(hasta);
    }
    return out;
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
    citationEnd: number = citationOffset,
    /** Fin de la cita anterior: la evidencia no lo cruza. */
    previousEnd: number = 0,
    /** La cita es un paréntesis («(Mayor, 129)»), no «Mayor (p. 129)». */
    isParenthesis: boolean = true,
): { text: string; fromQuote: boolean } {
    // Search the 250-char window preceding the citation for a closing
    // quote. Use the LAST one (closest to the cite) — earlier quotes
    // in the same paragraph belong to other claims.
    const lookBack = Math.max(0, citationOffset - 250, previousEnd);
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
    const sentenceStart = Math.max(findSentenceStart(markdown, citationOffset, isParenthesis), previousEnd);
    const sentence = markdown
        .slice(sentenceStart, citationOffset)
        .replace(/\s+/g, ' ')
        .trim()
        // El cierre de la cita anterior («), y Adamson…») no es de esta.
        .replace(/^[)\]\s,;:]+/, '');
    // La oración EMPIEZA con la cita, «Mayor (p. 314) lo discute…»: lo que
    // la cita respalda viene después (D2). Hacia atrás no había nada, y la
    // cita salía «no se pudo extraer el texto reclamado».
    if (sentence.length < MIN_EVIDENCE_CHARS) {
        const adelante = forwardSentence(markdown, citationEnd);
        if (adelante.length >= MIN_EVIDENCE_CHARS) return { text: adelante, fromQuote: false };
    }
    return { text: sentence, fromQuote: false };
}

/** Menos que esto no es una afirmación que se pueda cotejar. */
const MIN_EVIDENCE_CHARS = 8;

/** Desde el fin de la cita hasta el fin de su oración. */
function forwardSentence(markdown: string, from: number): string {
    let fin = markdown.length;
    for (let i = from; i < markdown.length; i++) {
        const c = markdown[i];
        const next = markdown[i + 1];
        if (c === '\n' && next === '\n') { fin = i; break; }
        if ((c === '.' || c === '!' || c === '?') && (next === undefined || next === ' ' || next === '\n')) {
            const palabra = palabraAntesDelPunto(markdown, i);
            if (c === '.' && ABREVIATURAS.has(palabra) && !(PUEDEN_CERRAR.has(palabra) && sigueMayuscula(markdown, i))) continue;
            fin = i + 1;
            break;
        }
    }
    return markdown.slice(from, fin).replace(/\s+/g, ' ').trim();
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

function findSentenceStart(markdown: string, offset: number, isParenthesis: boolean = true): number {
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
            // Sólo si la cita es un paréntesis: «Mayor (p. 314) lo discute…»
            // abre la oración, y el punto anterior sí la cierra.
            if (isParenthesis && markdown.slice(i + 1, offset).trim() === '') continue;
            return i + 2;
        }
        if (c === '\n' && next === '\n') return i + 2;
    }
    return 0;
}
