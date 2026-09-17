import type { VerifierSourceChunk } from '../ports/ICitationVerifier';

/**
 * Ordena la evidencia de una fuente para verificar UNA cita: primero los
 * fragmentos de la página citada y sus vecinas, después el resto en su
 * orden original.
 *
 * Existe por una medición. El verificador recortaba la evidencia a los
 * primeros fragmentos de la fuente en orden de hoja, sin mirar la página
 * citada, y el modelo contestaba —con razón— «los fragmentos llegan hasta
 * la página 205» sobre una cita a la 206. En Sal 23:1, 10 de 14 citas
 * correctas salieron «no encontrada» por eso. Un verificador que juzga una
 * cita a la p. 560 con las pp. 553–557 no verifica: reprueba a ciegas.
 *
 * `window` es cuántas páginas a cada lado cuentan como vecinas: una cita
 * suele apoyarse en la página anterior o siguiente cuando el argumento
 * cruza el corte de página.
 */
export function prioritizeChunksForCitedPage(
    chunks: ReadonlyArray<VerifierSourceChunk>,
    citedPages: string | null,
    window = 1,
): VerifierSourceChunk[] {
    const range = parsePageRange(citedPages);
    if (!range) return [...chunks];
    const near: VerifierSourceChunk[] = [];
    const rest: VerifierSourceChunk[] = [];
    for (const chunk of chunks) {
        const page = pageNumberOfHint(chunk.pageHint);
        const isNear = page !== null && page >= range.start - window && page <= range.end + window;
        (isNear ? near : rest).push(chunk);
    }
    return [...near, ...rest];
}

/** Primer número de un rótulo de página: «p. 559» → 559, «hoja 12» → 12, «p. ccxxii» → null. */
export function pageNumberOfHint(hint: string | null): number | null {
    if (!hint) return null;
    const m = hint.match(/(\d+)/);
    return m ? parseInt(m[1]!, 10) : null;
}

/** «559», «559–60», «559-561», «559, 561» → primer tramo como rango. */
export function parsePageRange(raw: string | null): { start: number; end: number } | null {
    if (!raw) return null;
    const cleaned = raw.replace(/\s+/g, '').replace(/[–—]/g, '-');
    const m = cleaned.match(/^(\d+)(?:-(\d+))?/);
    if (!m) return null;
    const start = parseInt(m[1]!, 10);
    let end = m[2] ? parseInt(m[2]!, 10) : start;
    // «559-61» abrevia «559-561».
    if (m[2] && m[2].length < m[1]!.length) {
        end = parseInt(m[1]!.slice(0, m[1]!.length - m[2].length) + m[2], 10);
    }
    return end >= start ? { start, end } : { start, end: start };
}

/**
 * Si dos rótulos de página pueden estar hablando del mismo sitio.
 *
 * Lo usan los tres verificadores para decidir «página no coincide». Vivía
 * copiado en cada uno, y las copias no sabían leer «559–61»: al abreviar,
 * el final salía 61, menor que el inicio, y una cita correcta a un rango
 * quedaba marcada como página equivocada.
 *
 * Cuando alguno de los dos rótulos no trae número —«ad loc.», «ci»— se
 * comparan como texto: es lo único honesto que se puede hacer.
 */
export function pagesOverlap(citedRaw: string, matchedRaw: string): boolean {
    const cited = parsePageRange(citedRaw);
    const matched = parsePageRange(matchedRaw);
    if (!cited || !matched) return citedRaw === matchedRaw;
    return cited.start <= matched.end && matched.start <= cited.end;
}
