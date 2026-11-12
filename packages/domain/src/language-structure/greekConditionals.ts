import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import { verseStructure } from './verseStructure.js';

/**
 * La condicional griega en la FICHA de su partícula (εἰ, ἐάν). Revisión del
 * profesor (2026-11, Stg 2:14): el fundador no sabía qué es la «3.ª clase»; la
 * clase se veía sólo en «Estructura» y la ficha de ἐάν no la decía.
 *
 * Para la 3.ª clase, Wallace (p. 696, «Third Class Condition › Clarification
 * and Semantics») distingue: una conexión lógica en el presente («presente
 * general»; con presente indicativo en la apódosis la llama «quinta clase»), un
 * caso meramente hipotético, y un hecho futuro más probable. Aquí se decide por
 * el verbo de la apódosis, sólo cuando el versículo tiene UNA apódosis:
 *   - presente indicativo, o sin verbo (Stg 2:14 «Τί τὸ ὄφελος…;») → presente general;
 *   - futuro indicativo o imperativo → futuro más probable.
 * Lo demás queda sin valor: la clase sola.
 */
export type ThirdClassUse = 'presentGeneral' | 'moreProbableFuture';

export interface ConditionalFact {
    /** Posición de la partícula (εἰ, ἐάν) entre las palabras del versículo. */
    readonly ordinal: number;
    readonly conditionalClass: 1 | 2 | 3 | 4;
    readonly use?: ThirdClassUse;
}

const modo = (w: StructureWord | undefined) => (w?.pos?.startsWith('V') ? w.parse?.[3] ?? '' : '');
const tiempo = (w: StructureWord | undefined) => (w?.pos?.startsWith('V') ? w.parse?.[1] ?? '' : '');

export function greekConditionals(ch: ChapterStructure, verse: number): ConditionalFact[] {
    if (ch.lang !== 'gr') return [];
    const ws = verseWords(ch, verse);
    const ordinal = new Map(ws.map((w, i) => [w.r, i]));
    const porRef = new Map(ws.map(w => [w.r, w]));
    const filas = verseStructure(ch, verse);
    const apodosis = filas.filter(f => f.isApodosis);
    const uso = (): ThirdClassUse | undefined => {
        if (apodosis.length !== 1) return undefined;
        const a = apodosis[0]!;
        const v = a.words.map(t => porRef.get(t.r)).find(w => ['I', 'S', 'O', 'D'].includes(modo(w)));
        if (!v) return a.verbless ? 'presentGeneral' : undefined;
        if (modo(v) === 'I' && tiempo(v) === 'P') return 'presentGeneral';
        if ((modo(v) === 'I' && tiempo(v) === 'F') || modo(v) === 'D') return 'moreProbableFuture';
        return undefined;
    };
    const out: ConditionalFact[] = [];
    for (const f of filas) {
        if (f.relation !== 'condition' || !f.conditionalClass || !f.connector) continue;
        const o = ordinal.get(f.connector);
        if (o === undefined) continue;
        const u = f.conditionalClass === 3 ? uso() : undefined;
        out.push({ ordinal: o, conditionalClass: f.conditionalClass, ...(u ? { use: u } : {}) });
    }
    return out;
}
