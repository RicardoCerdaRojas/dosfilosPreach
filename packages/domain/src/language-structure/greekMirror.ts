import { verseWords, type ChapterStructure } from './chapterStructure.js';
import { verseStructure } from './verseStructure.js';

/**
 * Revisión del profesor (2026-11, p. 15, Stg 2:18): él marca «πίστιν (A) … ἔργων (B) | ἔργων (B′) …
 * πίστιν (A′)», una REPETICIÓN EN ESPEJO de lemas. Es un DATO del texto (los lemas se repiten en orden
 * inverso); si es un quiasmo literario lo decide quien lee: el prompt ya advierte que el quiasmo es lo
 * más sobre-diagnosticado, y aquí no se rotula como tal.
 *
 * Criterio, entre las APARICIONES de los lemas de contenido del versículo (sustantivo, verbo,
 * adjetivo; sin palabras de función, sin ἔχω ni nombres propios): A B … B′ A′ con A ≠ B, B y B′
 * seguidas (sin otra A ni B en medio) y A y A′ las más cercanas por fuera, con las dos mitades en filas
 * distintas de «Estructura». Si hay varias, la más corta.
 *
 * Medido (2026-11-13) en el NT: 217 versículos. En una muestra de 30, todas son repeticiones en espejo
 * de verdad y cerca de 3 de 4 son notables (Mt 19:30 πρῶτοι ἔσχατοι | ἔσχατοι πρῶτοι; 2 P 3:8; Jn 17:10;
 * Stg 2:13, 2:18, 2:22, 4:11); el resto, menores (Ap 9:2). Sin ἔχω, Stg 2:18 daba «πίστιν ἔχεις | ἔχω
 * πίστιν» en vez del espejo del profesor; sin los nombres propios, caen la genealogía (Mt 1) y la
 * fórmula «Χριστῷ Ἰησοῦ | Ἰησοῦ Χριστοῦ».
 */
export interface MirrorFact {
    /** Posiciones en el versículo: A, B, B′, A′. */
    readonly a: number;
    readonly b: number;
    readonly b2: number;
    readonly a2: number;
}

export type MirrorPosition = 'A' | 'B' | 'B2' | 'A2';

const FUERA: ReadonlySet<string> = new Set(['εἰμί', 'λέγω', 'αὐτός', 'ἐγώ', 'σύ', 'οὗτος', 'ὅς', 'ὁ', 'καί', 'πᾶς', 'γίνομαι', 'ἔχω']);
const deContenido = (w: { pos?: string; l: string }) =>
    /^(N|V|A)/.test(w.pos ?? '') && !FUERA.has(w.l) && w.l[0] === w.l[0]!.toLowerCase();

export function greekMirrorRepetition(ch: ChapterStructure, verse: number): MirrorFact | undefined {
    if (ch.lang !== 'gr') return undefined;
    const ws = verseWords(ch, verse);
    const seq = ws.map((w, i) => ({ l: w.l, i })).filter((_, i) => deContenido(ws[i]!));
    if (seq.length < 4) return undefined;
    const filas = verseStructure(ch, verse);
    const filaDe = (i: number) => filas.findIndex(f => f.words.some(t => t.r === ws[i]!.r));
    let mejor: MirrorFact | undefined;
    for (let j = 0; j < seq.length; j++) for (let k = j + 1; k < seq.length; k++) {
        const B = seq[j]!, B2 = seq[k]!;
        if (B.l !== B2.l) continue;
        const entre = seq.slice(j + 1, k);
        if (entre.some(x => x.l === B.l)) continue;
        for (let a = j - 1; a >= 0; a--) {
            const A = seq[a]!;
            if (A.l === B.l) break;
            const m2 = seq.findIndex((x, m) => m > k && x.l === A.l);
            if (m2 < 0) continue;
            const A2 = seq[m2]!;
            const limpio = !seq.slice(a + 1, j).some(x => x.l === A.l || x.l === B.l)
                && !seq.slice(k + 1, m2).some(x => x.l === A.l || x.l === B.l)
                && !entre.some(x => x.l === A.l);
            if (!limpio || (filaDe(A.i) === filaDe(A2.i) && filaDe(B.i) === filaDe(B2.i))) continue;
            if (!mejor || A2.i - A.i < mejor.a2 - mejor.a) mejor = { a: A.i, b: B.i, b2: B2.i, a2: A2.i };
            break;
        }
    }
    return mejor;
}

/** La posición de la palabra `ordinal` en el espejo, si es una de las cuatro. */
export function mirrorPositionOf(m: MirrorFact | undefined, ordinal: number): MirrorPosition | undefined {
    if (!m) return undefined;
    return m.a === ordinal ? 'A' : m.b === ordinal ? 'B' : m.b2 === ordinal ? 'B2' : m.a2 === ordinal ? 'A2' : undefined;
}
