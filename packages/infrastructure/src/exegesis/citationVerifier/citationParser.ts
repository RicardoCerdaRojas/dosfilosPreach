import { findInlineCitations, type ParsedCitation } from '@dosfilos/domain';

/**
 * De las citas inline al reclamo que cada una sostiene.
 *
 * El RECONOCIMIENTO —las tres formas que el sistema emite y cómo se resuelven
 * sus solapamientos— vive en el dominio (`findInlineCitations`), porque el
 * exportador Word necesita leer exactamente lo mismo y tenía su propio patrón,
 * más pobre. Lo que queda acá es lo del verificador y de nadie más: recortar
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

    return accepted
        .sort((a, b) => a.offset - b.offset)
        .map(m => {
            const evidence = extractEvidence(masked, m.offset);
            return {
                raw: m.raw,
                author: m.author,
                title: m.title,
                pages: m.pages,
                offset: m.offset,
                evidence: evidence.text,
                evidenceIsQuoted: evidence.fromQuote,
            };
        });
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

function findSentenceStart(markdown: string, offset: number): number {
    // Stop at the closest of: `. `, `! `, `? `, `\n\n`, or start of file.
    for (let i = offset - 1; i >= 0; i--) {
        const c = markdown[i];
        const next = markdown[i + 1];
        if ((c === '.' || c === '!' || c === '?') && (next === ' ' || next === '\n')) {
            return i + 2;
        }
        if (c === '\n' && next === '\n') return i + 2;
    }
    return 0;
}
