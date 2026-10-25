import { ARAMAIC_SPANS, BOOKS_WITH_ARAMAIC_SECTIONS, findBooksByAlias, getBookById, type AssistantVerseInput } from '@dosfilos/domain';

/**
 * Pipeline version identifier embedded into every PassResult.passVersion
 * so the application layer can fingerprint a full run by combining the
 * 5 pass versions. Bump when ANY prompt changes meaningfully — that
 * invalidates memoization and forces the wizard to re-run.
 */
export const EXPOSITORY_PIPELINE_VERSION = 'v1';

/**
 * Renders verse-by-verse text in the format every pass uses to feed
 * the LLM: `cap:vers <TAB> texto` per line. Compact, predictable, and
 * easy for the model to reference back when emitting boundaries.
 */
export function formatVerses(verses: ReadonlyArray<AssistantVerseInput>): string {
    return verses.map((v) => `${v.chapter}:${v.verse}\t${v.text}`).join('\n');
}

/**
 * Stable djb2 hash of an arbitrary string. Used to fingerprint per-pass
 * inputs (not crypto — just change-detection for memoization).
 */
export function djb2Hash(input: string): string {
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
        h = ((h << 5) + h + input.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Cheap heuristic to summarize a list of verses for hashing without
 * including all the text — first/last verse coords + a sample of text
 * lengths. Keeps the hash stable across reformatted inputs that don't
 * change the actual content.
 */
export function fingerprintVerses(verses: ReadonlyArray<AssistantVerseInput>): string {
    if (verses.length === 0) return 'empty';
    const first = verses[0]!;
    const last = verses[verses.length - 1]!;
    const totalChars = verses.reduce((acc, v) => acc + v.text.length, 0);
    return `${first.chapter}:${first.verse}-${last.chapter}:${last.verse}|n=${verses.length}|chars=${totalChars}`;
}

/**
 * Produces the per-pass "source-aware preamble" that frames the
 * model's expectations about the verse text it's about to read.
 *
 * - 'greek' / 'hebrew': model can cite syntactic markers directly
 *   from the text (cadenas participiales, μέν/δέ, waw-consecutivo,
 *   etc.).
 * - 'translation': model must approximate the original markers from
 *   the translation surrogate — same task, with the explicit caveat
 *   that the input is one step removed.
 * - undefined: returns an empty string so legacy callers that don't
 *   set sourceLanguage emit no preamble (back-compat with v1.5).
 *
 * Returned with leading newlines so it slots cleanly between the
 * book header and the verse-text body in the user message.
 *
 * `book` (nombre visible o id): con Esdras o Daniel, el preámbulo hebreo
 * avisa qué secciones están en arameo. Sin él, el texto es el de siempre.
 */
export function buildSourcePreamble(
    sourceLanguage: 'greek' | 'hebrew' | 'translation' | undefined,
    displayLanguage: 'es' | 'en',
    book?: string,
): string {
    if (!sourceLanguage) return '';
    const isSpanish = displayLanguage === 'es';
    // Solo lo usan los dos casos «hebrew»: con traducción el texto ya no es el original.
    const arameo = aramaicNote(book, displayLanguage);
    if (isSpanish) {
        switch (sourceLanguage) {
            case 'greek':
                return '\nFuente del texto: griego original (SBLGNT). Cita marcadores sintácticos directamente desde el texto provisto (cadenas participiales, μέν/δέ, asíndeton, conectores como γάρ/οὖν/διό, inclusio).\n';
            case 'hebrew':
                return `\nFuente del texto: hebreo original (WLC). Cita marcadores sintácticos directamente desde el texto provisto (waw-consecutivo, וַיְהִי, paralelismo, fórmulas tipo כֹּה אָמַר יְהוָה).${arameo}\n`;
            case 'translation':
                return '\nFuente del texto: traducción al español como surrogate (RVR1960) — el original griego/hebreo no estuvo disponible. Aproxima los marcadores sintácticos del original que se reflejen en la traducción y reconócelo en tus justificaciones cuando la inferencia sea débil.\n';
        }
    }
    switch (sourceLanguage) {
        case 'greek':
            return '\nText source: original Greek (SBLGNT). Cite syntactic markers directly from the provided text (participial chains, μέν/δέ, asyndeton, connectors like γάρ/οὖν/διό, inclusio).\n';
        case 'hebrew':
            return `\nText source: original Hebrew (WLC). Cite syntactic markers directly from the provided text (waw-consecutive, וַיְהִי, parallelism, formulas like כֹּה אָמַר יְהוָה).${arameo}\n`;
        case 'translation':
            return '\nText source: English translation as surrogate (ASV) — the original Greek/Hebrew was not available. Approximate the original syntactic markers that carry over into the translation and acknowledge in your justifications when the inference is weak.\n';
    }
    return '';
}


/**
 * «Esdras 4:8–6:18 y 7:12–26 están en arameo», con los tramos de
 * `ARAMAIC_SPANS`. Sin esto, el panorama de Esdras se escribía como si todo
 * el libro fuera hebreo y nombraba con categorías hebreas la correspondencia
 * imperial.
 */
function aramaicNote(book: string | undefined, displayLanguage: 'es' | 'en'): string {
    const nombre = book?.trim();
    if (!nombre) return '';
    const id = getBookById(nombre as never)?.id ?? (() => {
        const hallados = findBooksByAlias(nombre);
        return hallados.length === 1 ? hallados[0]!.id : undefined;
    })();
    if (!id || !BOOKS_WITH_ARAMAIC_SECTIONS.has(id)) return '';
    const y = displayLanguage === 'es' ? ' y ' : ' and ';
    const tramos = ARAMAIC_SPANS.filter(s => s.bookId === id).map(s =>
        s.fromChapter === s.toChapter
            ? `${s.fromChapter}:${s.fromVerse}–${s.toVerse}`
            : `${s.fromChapter}:${s.fromVerse}–${s.toChapter}:${s.toVerse}`).join(y);
    return displayLanguage === 'es'
        ? ` Ojo: ${nombre} ${tramos} está en arameo bíblico, no en hebreo; los marcadores de esas secciones se nombran como arameos.`
        : ` Note: ${nombre} ${tramos} is in Biblical Aramaic, not Hebrew; name markers from those sections as Aramaic.`;
}
