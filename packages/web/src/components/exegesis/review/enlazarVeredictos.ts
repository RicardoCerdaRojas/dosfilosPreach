import { isProsePath, type VerifiedCitation } from '@dosfilos/domain';

/** Prefijo de los enlaces que marcan, dentro del markdown, una cita con veredicto. */
export const PREFIJO_VEREDICTO = '#veredicto-';

/** Bloques de código, código en línea y enlaces o imágenes markdown: no se tocan. */
const PROTEGIDO = /```[\s\S]*?```|`[^`\n]*`|!?\[[^\]\n]*\]\([^)\n]*\)/g;

/**
 * La prosa de un paso con cada cita verificada marcada como enlace, para
 * dibujarla con su veredicto en la página «Revisión de citas» (TP #9, B41).
 *
 * El veredicto de una cita de la prosa trae su posición en el texto
 * (`offset`, en el markdown que se verificó) y su forma (`raw`). Si la prosa
 * ya no tiene esa forma en esa posición —se editó después de verificar—, se
 * busca la misma forma en el texto; si no está, la cita queda solo en la
 * lista lateral.
 */
export function enlazarVeredictos(
    markdown: string,
    verdicts: ReadonlyMap<string, VerifiedCitation>,
): { markdown: string; paths: string[] } {
    const protegidos = [...markdown.matchAll(PROTEGIDO)].map(m => ({ desde: m.index!, hasta: m.index! + m[0].length }));
    const tramos: Array<{ desde: number; hasta: number; path: string }> = [];
    for (const [path, v] of verdicts) {
        if (!isProsePath(path) || !v.raw) continue;
        const inicio = markdown.slice(v.offset, v.offset + v.raw.length) === v.raw ? v.offset : markdown.indexOf(v.raw);
        if (inicio < 0) continue;
        // Sin el «(» o el «; » con que abre la forma reconocida: se marca «Autor, p. N».
        const abre = /^[\s(;]*/.exec(v.raw)![0].length;
        const cierra = v.raw.length - v.raw.trimEnd().length;
        const desde = inicio + abre;
        const hasta = inicio + v.raw.length - cierra;
        if (hasta <= desde) continue;
        if (protegidos.some(p => desde < p.hasta && p.desde < hasta)) continue;
        if (tramos.some(t => desde < t.hasta && t.desde < hasta)) continue;
        tramos.push({ desde, hasta, path });
    }
    tramos.sort((a, b) => a.desde - b.desde);
    const paths: string[] = [];
    let salida = '';
    let cursor = 0;
    for (const t of tramos) {
        const texto = markdown.slice(t.desde, t.hasta).replace(/[[\]]/g, '\\$&');
        salida += `${markdown.slice(cursor, t.desde)}[${texto}](${PREFIJO_VEREDICTO}${paths.length})`;
        paths.push(t.path);
        cursor = t.hasta;
    }
    return { markdown: salida + markdown.slice(cursor), paths };
}
