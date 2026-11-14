import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import { verseStructure } from './verseStructure.js';
import { MIRROR_LIST } from './greekMirrorList.js';
import { MIRROR_LIST_HE } from './hebrewMirrorList.js';
import { MIRROR_LIST_SOURCES, MIRROR_SOURCES, type RuleSource } from './ruleSources.js';

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
 * Medido (2026-11-13) en el NT: 88 versículos. Precisión clasificada A CIEGAS por revisores
 * independientes, sobre muestras al azar:
 *   - versión sin el criterio de bloques: 17 de 30 (57 %);
 *   - con él, en una muestra NUEVA (fuera de la que sirvió para diseñarlo): 23 de 30 (77 %). Fallan
 *     la narración sin figura (Jn 19:29, Lc 5:7, Lc 11:1), dos paralelos (1 Co 7:14, Ap 1:20) y dos
 *     elecciones de par discutibles (Lc 6:42 ojo/viga en vez de paja/viga, que abarca 28 palabras; Lc 6:43).
 * Sensibilidad: de 29 quiasmos conocidos (lista armada de memoria, no de un manual), salen los de
 * palabras dentro del versículo, salvo Mt 13:15 / Hch 28:27 (Is 6:10), cuyas mitades abarcan varias
 * cláusulas; no salen los de sentido (Mt 6:24, Flp 1:21) ni los que cruzan de versículo, por diseño.
 * Afinar más con reglas sobre las mismas muestras empeoraba (sobreajuste): se dejó aquí.
 * La primera versión (217) se había juzgado con una muestra elegida, no al azar.
 * Sin ἔχω, Stg 2:18 daba «πίστιν ἔχεις | ἔχω πίστιν»; sin nombres propios caen la genealogía (Mt 1)
 * y la fórmula «Χριστῷ Ἰησοῦ | Ἰησοῦ Χριστοῦ».
 */
export interface MirrorFact {
    /** Posiciones en el versículo: A, B, B′, A′. */
    readonly a: number;
    readonly b: number;
    readonly b2: number;
    readonly a2: number;
    /** De dónde sale: Lund o Bullinger cuando tratan el versículo, y la indicación del profesor. */
    readonly sources?: readonly RuleSource[];
}

export type MirrorPosition = 'A' | 'B' | 'B2' | 'A2';

const FUERA: ReadonlySet<string> = new Set(['εἰμί', 'λέγω', 'αὐτός', 'ἐγώ', 'σύ', 'οὗτος', 'ὅς', 'ὁ', 'καί', 'πᾶς', 'γίνομαι', 'ἔχω',
    // Cuantificadores y numerales: «ἄλλα πέντε τάλαντα … πέντε τάλαντα» (Mt 25:20) es paralelismo, no espejo.
    'εἷς', 'δύο', 'τρεῖς', 'πέντε', 'πολύς', 'ἄλλος']);
/** Más lejos que esto ya no se percibe como espejo (Jn 8:44 daba 34 palabras); Stg 2:18 abarca 14. */
const MAX_ABARCA = 15;
const deContenido = (w: { pos?: string; l: string }) =>
    /^(N|V|A)/.test(w.pos ?? '') && !FUERA.has(w.l) && w.l[0] === w.l[0]!.toLowerCase();

/**
 * Lo que se MUESTRA: la repetición en espejo del versículo si está en la lista curada (`greekMirrorList.ts`),
 * con las posiciones de sus cuatro palabras y sus fuentes. El detector de abajo sólo propone candidatos.
 */
export function greekMirrorRepetition(ch: ChapterStructure, verse: number): MirrorFact | undefined {
    return ch.lang === 'gr' ? mirrorRepetition(ch, verse) : undefined;
}

/**
 * La repetición en espejo del versículo, en griego o en hebreo, si está en su lista curada (el hebreo:
 * `hebrewMirrorList.ts`, revisada con Lund y Bullinger igual que la griega; pendientes de la revisión del
 * profesor, 2026-11-13).
 */
export function mirrorRepetition(ch: ChapterStructure, verse: number): MirrorFact | undefined {
    const ref = `${ch.book} ${ch.chapter}:${verse}`;
    const par = (ch.lang === 'gr' ? MIRROR_LIST : MIRROR_LIST_HE)[ref];
    if (!par) return undefined;
    // Sin puntuación pegada: en griego coma, punto, variantes; en hebreo maqaf, sof pasuq y paseq.
    const limpia = (t: string) => t.normalize('NFC').replace(/[,.·;:’⸀-⸅\d\u05BE\u05C3\u05C0]/g, '');
    const ws = verseWords(ch, verse).map(w => limpia(w.t));
    const pos: number[] = [];
    for (const palabra of par) {
        const i = ws.findIndex((t, k) => k > (pos[pos.length - 1] ?? -1) && t === limpia(palabra));
        if (i < 0) return undefined;
        pos.push(i);
    }
    return { a: pos[0]!, b: pos[1]!, b2: pos[2]!, a2: pos[3]!, sources: [...(MIRROR_LIST_SOURCES[ref] ?? []), ...MIRROR_SOURCES] };
}

/** El detector: propone candidatos para revisar (no se muestra; ver la lista curada). */
export function greekMirrorCandidates(ch: ChapterStructure, verse: number): MirrorFact | undefined {
    return ch.lang === 'gr' ? candidatos(ch, verse, w => w.l, deContenido) : undefined;
}

/** Hebreo: «אמר», «היה», «כל», YHWH, «אלהים», «אשר», «יש», «אין» no cuentan; tampoco nombres propios ni números. */
const FUERA_HE: ReadonlySet<string> = new Set(['559', '1961', '3605', '3068', '430', '834', '3426', '369']);
const lemaHe = (w: StructureWord) => w.l.replace(/^([a-z]+\/)+/, '').replace(/\s.*$/, '');
const deContenidoHe = (w: StructureWord) => (w.parts ?? []).some(p => /^(Nc|V|Aa)/.test(p.m)) && !FUERA_HE.has(lemaHe(w));

/**
 * El detector hebreo (sólo propone): el mismo criterio que el griego, sobre el lema de OSHB. Medido
 * (2026-11-13): 284 candidatos en el AT; con ellos se armó la lista curada.
 */
export function hebrewMirrorCandidates(ch: ChapterStructure, verse: number): MirrorFact | undefined {
    return ch.lang === 'he' ? candidatos(ch, verse, lemaHe, deContenidoHe) : undefined;
}

function candidatos(ch: ChapterStructure, verse: number, lema: (w: StructureWord) => string, contenido: (w: StructureWord) => boolean): MirrorFact | undefined {
    const ws = verseWords(ch, verse);
    const seq = ws.map((w, i) => ({ l: lema(w), i })).filter((_, i) => contenido(ws[i]!));
    if (seq.length < 4) return undefined;
    const filas = verseStructure(ch, verse);
    const clausulaDe = (i: number) => filas.find(f => f.words.some(t => t.r === ws[i]!.r))?.index;
    /** ¿x es y o cuelga de y en el árbol de MACULA? */
    const bajo = (x: number | undefined, y: number | undefined) => {
        if (x === undefined || y === undefined) return false;
        for (let p: number | null = x; p !== null; p = p >= 0 ? ch.clauses[p]?.p ?? null : null) if (p === y) return true;
        return false;
    };
    const juntos = (x: number | undefined, y: number | undefined) => bajo(x, y) || bajo(y, x);
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
            // Cada mitad es UN bloque (una cláusula y lo que cuelga de ella: Lc 14:11 «ὁ ὑψῶν … ταπεινωθήσεται»)
            // y las dos mitades van en filas distintas (pueden estar anidadas: Stg 2:18, donde MACULA cuelga
            // «κἀγώ σοι δείξω» de «δεῖξόν μοι»). Sin esto, dos cláusulas paralelas cortadas por la mitad parecían
            // espejo (1 Co 14:15, 1 Jn 5:6). Muestra ciega de 30 (revisor independiente): sin el criterio, 17
            // espejos; con él, pasan 20 y 17 son espejo (85 %), sin perder ninguno de los 17.
            const [ca, cb, cb2, ca2] = [A.i, B.i, B2.i, A2.i].map(clausulaDe);
            const dosBloques = juntos(ca, cb) && juntos(cb2, ca2) && ca !== ca2 && cb !== cb2 && ca !== cb2 && cb !== ca2;
            if (!limpio || A2.i - A.i > MAX_ABARCA || !dosBloques) continue;
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
