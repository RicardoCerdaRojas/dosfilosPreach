import type { ChapterStructure, StructureWord } from './chapterStructure.js';

/**
 * Lectura de la morfología de OSHB y de las cláusulas de MACULA, común a las
 * reglas del hebreo de R4 (infinitivo, participio). Sólo lee: no decide nada.
 */

export const lema = (w: StructureWord) => w.l.split('/').pop()!.split(' ')[0]!;
/** OSHB separa ילך (3212) de הלך (1980): para «misma raíz» son uno («וַיֵּלֶךְ … הָלוֹךְ», 2 S 3:16). */
export const RAIZ: Readonly<Record<string, string>> = { '3212': '1980' };
export const raiz = (w: StructureWord) => RAIZ[lema(w)] ?? lema(w);
export const trasConstructo = (c: { prev?: StructureWord }) => !!c.prev && /^N[cgp]?[mfbc][spd]c$/.test(segmentos(c.prev).slice(-1)[0] ?? '');
export const prefijos = (w: StructureWord) => w.l.split('/').slice(0, -1);
export const segmentos = (w: StructureWord) => (w.m ?? '').replace(/^[HA]/, '').split('/');
export const verbo = (w: StructureWord) => segmentos(w).find(s => s.startsWith('V') && s.length >= 3);
export const forma = (w: StructureWord) => verbo(w)?.[2];
export const FINITAS = new Set(['p', 'i', 'w', 'q', 'v', 'j', 'h']);
/** Un participio también predica («הוּא יֹצֵא לִקְרָאתֶךָ», Éx 4:14). */
export const PREDICADO = new Set([...FINITAS, 'r', 's']);

/**
 * La cláusula donde la forma (infinitivo, participio) FUNCIONA: se sube por las madres hasta la
 * primera con predicado. MACULA anida un infinitivo dentro de otro («לָלֶכֶת
 * לִדְרֹשׁ», 1 Cr 21:30): mirar un solo nivel hacía creer que no había verbo
 * (revisión de R4: «sin verbo» erraba en 19 de 20). Sin predicado en toda la
 * cadena, la cláusula raíz.
 */
export function clausulaDe(ch: ChapterStructure, w: StructureWord, porRef: ReadonlyMap<string, StructureWord>): StructureWord[] {
    let k = -1;
    ch.clauses.forEach((c, i) => { if (c.w.includes(w.r) && (k < 0 || c.w.length < ch.clauses[k]!.w.length)) k = i; });
    if (k < 0) return [];
    const palabras = (i: number) => ch.clauses[i]!.w.map(r => porRef.get(r)).filter((x): x is StructureWord => !!x);
    for (let i: number | null | undefined = k, n = 0; i !== null && i !== undefined && n < 32; i = ch.clauses[i]!.p, n++) {
        const ps = palabras(i);
        if (ps.some(x => x !== w && PREDICADO.has(forma(x) ?? '') && !esInfinitivo(x))) return ps;
        if (ch.clauses[i]!.p === null || ch.clauses[i]!.p === undefined) return ps;
    }
    return palabras(k);
}
export const esInfinitivo = (x: StructureWord) => forma(x) === 'c' || forma(x) === 'a';
/** La palabra sin cantilación (los acentos de OSHB): así la nombra el prompt. */
export const sinAcentos = (t: string) => t.replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3]/g, '');
