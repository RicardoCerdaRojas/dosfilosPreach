import { verseWords, type ChapterStructure } from './chapterStructure.js';
import { verseStructure } from './verseStructure.js';

/**
 * Revisión del profesor (2026-11, p. 15, Stg 2:18): él marca «πίστιν (A) … ἔργων (B) | ἔργων (B′) …
 * πίστιν (A′)», una REPETICIÓN EN ESPEJO de lemas. Es un DATO del texto (los lemas se repiten en orden
 * inverso); si es un quiasmo literario lo decide quien lee: el prompt ya advierte que el quiasmo es lo
 * más sobre-diagnosticado, y aquí no se rotula como tal.
 *
 * Criterio, entre las APARICIONES de los lemas de contenido del versículo (sustantivo, verbo,
 * adjetivo; sin palabras de función, sin ἔχω, cuantificadores ni nombres propios): A B … B′ A′ con
 * A ≠ B; B y B′ seguidas (sin otra A ni B en medio) pero no pegadas; A y A′ las más cercanas por fuera;
 * lo que sigue a B no se repite tras B′ (eso es paralelismo); a lo sumo 15 palabras de A a A′. Se
 * descarta si A y A′ comparten fila de «Estructura» y B y B′ también. Si hay varias, la más corta (en
 * empate, la primera).
 *
 * Medido (2026-11-13) en el NT: 136 versículos. Muestra AL AZAR de 30 (semilla fija, revisión
 * adversarial): 28 son espejo de verdad (Jn 16:28, 2 Co 2:16, Mc 2:27, 1 Jn 4:20, Hch 28:27…) y 2 son
 * paralelismo (Mt 10:41, Ap 4:7). La primera versión (217) se había juzgado con una muestra elegida, no
 * al azar, y traía «Κύριε κύριε» (Mt 7:22), paralelismos (Mt 25:20) y espejos de hasta 34 palabras.
 * Sin ἔχω, Stg 2:18 daba «πίστιν ἔχεις | ἔχω πίστιν»; sin nombres propios caen la genealogía (Mt 1)
 * y la fórmula «Χριστῷ Ἰησοῦ | Ἰησοῦ Χριστοῦ».
 */
export interface MirrorFact {
    /** Posiciones en el versículo: A, B, B′, A′. */
    readonly a: number;
    readonly b: number;
    readonly b2: number;
    readonly a2: number;
}

export type MirrorPosition = 'A' | 'B' | 'B2' | 'A2';

const FUERA: ReadonlySet<string> = new Set(['εἰμί', 'λέγω', 'αὐτός', 'ἐγώ', 'σύ', 'οὗτος', 'ὅς', 'ὁ', 'καί', 'πᾶς', 'γίνομαι', 'ἔχω',
    // Cuantificadores y numerales: «ἄλλα πέντε τάλαντα … πέντε τάλαντα» (Mt 25:20) es paralelismo, no espejo.
    'εἷς', 'δύο', 'τρεῖς', 'πέντε', 'πολύς', 'ἄλλος']);
/** Más lejos que esto ya no se percibe como espejo (Jn 8:44 daba 34 palabras); Stg 2:18 abarca 14. */
const MAX_ABARCA = 15;
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
        // B y B′ pegados es una repetición («Κύριε κύριε», Mt 7:22), no el centro de un espejo.
        if (B.l !== B2.l || B2.i - B.i < 2) continue;
        // Si lo que sigue a B se repite tras B′, es paralelismo (A B C … B C), no espejo.
        if (seq[j + 1] && seq[k + 1] && seq[j + 1]!.l === seq[k + 1]!.l && j + 1 !== k) continue;
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
            if (!limpio || A2.i - A.i > MAX_ABARCA || (filaDe(A.i) === filaDe(A2.i) && filaDe(B.i) === filaDe(B2.i))) continue;
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
