import type { VersePhrase } from './chapterStructure.js';
import type { StructureNode, StructureToken } from './verseStructure.js';

/**
 * U11c (revisión del profesor 2026-11, p. 15 y 27): el DIAGRAMA de la vista «Estructura», como el
 * profesor estructura Stg 2:14 y 2:18. Una línea por cláusula, sangrada según su nivel, y la frase
 * preposicional que va con el verbo en SU PROPIA LÍNEA, un nivel más adentro (*phrasing* de Fee):
 *
 *     δεῖξόν μοι τὴν πίστιν σου
 *         χωρὶς τῶν ἔργων,
 *     κἀγώ σοι δείξω
 *         ἐκ τῶν ἔργων μου
 *     τὴν πίστιν.
 *
 * Lo que sigue a la frase vuelve al nivel de su cláusula («continuación»). Quedan en la línea: la
 * frase que va con un nombre (Stg 2:16 «τις ἐξ ὑμῶν») y la de predicado, que no modifican al verbo,
 * y la antepuesta, que va antes de todo constituyente (Stg 2:21 «ἐξ ἔργων ἐδικαιώθη»).
 * Sólo se ordena lo que ya decidieron las filas y el dato; aquí no se decide nada nuevo.
 */
export type DiagramLineKind = 'clause' | 'phrase' | 'continuation';

export interface DiagramLine {
    /** La fila de «Estructura» de la que sale (su `index`). */
    readonly row: number;
    readonly depth: number;
    readonly kind: DiagramLineKind;
    readonly words: readonly StructureToken[];
}

/** Las frases que bajan a su línea: adverbiales, enteras en la fila, sin su conector y sin ser toda la fila. */
function frasesQueBajan(n: StructureNode, frases: readonly VersePhrase[]): Map<string, readonly string[]> {
    const pos = new Map(n.words.map((w, i) => [w.r, i]));
    const out = new Map<string, readonly string[]>();
    for (const f of frases) {
        if (f.kind !== 'a' || f.rs.length >= n.words.length) continue;
        const ps = f.rs.map(r => pos.get(r));
        if (ps.some(p => p === undefined)) continue;
        const nums = ps as number[];
        // Seguida en la fila (sin otra palabra de la fila en medio) y sin el conector de la cláusula.
        if (nums.some((p, k) => k > 0 && p !== nums[k - 1]! + 1)) continue;
        if (n.connector && f.rs.includes(n.connector)) continue;
        // Antepuesta (antes de todo constituyente: Stg 2:21 «ἐξ ἔργων ἐδικαιώθη») queda en la línea:
        // bajarla la dejaba arriba de su verbo y más adentro que él.
        if (!n.words.slice(0, nums[0]).some(w => w.role && w.r !== n.connector)) continue;
        out.set(f.rs[0]!, f.rs);
    }
    return out;
}

export function diagramLines(nodes: readonly StructureNode[], frases: readonly VersePhrase[]): DiagramLine[] {
    const lineas: DiagramLine[] = [];
    for (const n of nodes) {
        const bajan = frasesQueBajan(n, frases);
        let actual: StructureToken[] = [];
        let yaHayClausula = false;
        const cerrar = () => {
            if (!actual.length) return;
            lineas.push({ row: n.index, depth: n.depth, kind: yaHayClausula ? 'continuation' : 'clause', words: actual });
            yaHayClausula = true;
            actual = [];
        };
        for (let i = 0; i < n.words.length; i++) {
            const w = n.words[i]!;
            const frase = bajan.get(w.r);
            if (!frase) { actual.push(w); continue; }
            cerrar();
            lineas.push({ row: n.index, depth: n.depth + 1, kind: 'phrase', words: n.words.slice(i, i + frase.length) });
            i += frase.length - 1;
        }
        cerrar();
    }
    return lineas;
}
