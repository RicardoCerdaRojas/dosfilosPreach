import { verseWords, type ChapterStructure } from './chapterStructure.js';

/**
 * U9 (revisión del profesor 2026-11, Stg 3:1 «Μὴ πολλοὶ διδάσκαλοι γίνεσθε,
 * ἀδελφοί μου»): VOCATIVO al comienzo del versículo + IMPERATIVO o PREGUNTA.
 * En las cartas es una señal frecuente de que empieza una nueva unidad; en
 * Santiago abren así 1:2, 1:19, 2:1, 2:14, 3:1, 4:11, 5:7, 5:12.
 *
 * Es una SEÑAL, no una regla: medido a mano (2026-11-12) con el vocativo
 * entre las 6 primeras palabras, acierta 23 de 29 (Santiago 11/15, Filipenses
 * 5/6, 1 Juan 5/6, 1 Tesalonicenses 2/2). Falla dentro de una unidad ya abierta
 * (Stg 5:9 y 5:10 tras 5:7; Flp 4:3) o con una pregunta retórica en medio del
 * argumento (Stg 3:12, el control del profesor). Por eso la ficha dice
 * «suele abrir» y pide confirmarlo con el contenido.
 */
export interface SectionOpeningFact {
    /** El vocativo (posición entre las palabras del versículo). */
    readonly vocativeOrdinal: number;
    /** El imperativo, si lo hay. */
    readonly imperativeOrdinal?: number;
    /** Hay una pregunta en el versículo (; o τίς). */
    readonly question: boolean;
}

/** Hasta qué palabra cuenta como «al comienzo»: Stg 3:1 lo trae en la 5.ª, tras el imperativo; Stg 3:10, en la 11.ª. */
const VENTANA = 6;

export function greekSectionOpening(ch: ChapterStructure, verse: number): SectionOpeningFact | undefined {
    if (ch.lang !== 'gr') return undefined;
    const ws = verseWords(ch, verse);
    const voc = ws.findIndex(w => w.parse?.[4] === 'V');
    if (voc < 0 || voc >= VENTANA) return undefined;
    const imp = ws.findIndex(w => w.parse?.[3] === 'D');
    const question = ws.some(w => w.t.includes(';')) || ws.some(w => w.l === 'τίς');
    if (imp < 0 && !question) return undefined;
    return { vocativeOrdinal: voc, ...(imp >= 0 ? { imperativeOrdinal: imp } : {}), question };
}
