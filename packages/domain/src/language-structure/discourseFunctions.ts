import { clausesOfVerse, verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import type { DiscourseFunction } from '../greek-analyzer/particleTaxonomy.js';
import { autosUseAt } from './nominalFunctions.js';

/**
 * G4 — PARTÍCULAS Y PALABRAS DE INTENCIÓN (Runge, *Discourse Grammar of the
 * Greek New Testament*): qué hace cada conector en el argumento, y el
 * pronombre que sobra porque el verbo ya marca la persona.
 *
 * El profesor (2026-10-07): «siempre la función de verbos, partículas,
 * participios y toda palabra que ayude a entender la intención del autor»; y
 * en Stg 2:7 «οὐκ αὐτοὶ βλασφημοῦσιν»: αὐτοί es enfático porque -ουσιν ya
 * dice «ellos» (#G1).
 *
 * Como en G2: lo que el lema fija, lo decide el código (δέ = desarrollo; γάρ =
 * apoyo); lo que admite dos lecturas, el código lo acota y el asistente elige
 * (οὖν: inferencia o retoma; ἀλλά: corrección o contraste).
 */

export type DiscourseRule =
    | 'deDevelopment' | 'garSupport' | 'kaiContinuity' | 'kaiAdditive' | 'teContinuity'
    | 'ounInference' | 'inferential' | 'allaAfterNegation' | 'allaCorrection' | 'menPoint' | 'idouAttention' | 'mononRestrictive' | 'intensiveParticle'
    | 'overtPronoun';

export interface DiscourseCandidate {
    readonly ordinal: number;
    readonly allowed: readonly DiscourseFunction[];
    readonly decided?: DiscourseFunction;
    readonly rule: DiscourseRule;
    /** Con `overtPronoun`: el verbo que ya marca la persona. */
    readonly verbOrdinal?: number;
}

const modo = (w: StructureWord | undefined) => (w?.pos?.startsWith('V') ? w.parse?.[3] ?? '' : '');
const finito = (w: StructureWord) => ['I', 'S', 'O', 'D'].includes(modo(w));

interface ReglaDiscurso {
    readonly rule: DiscourseRule;
    /** `antes`: lo previo del versículo; `despues`: lo que sigue, más el versículo siguiente. */
    readonly when: (w: StructureWord, prev: StructureWord | undefined, antes: readonly StructureWord[], despues: readonly StructureWord[]) => boolean;
    readonly allowed: readonly DiscourseFunction[];
}

const NEGACIONES_GR: ReadonlySet<string> = new Set([
    'οὐ', 'οὐχί', 'μή', 'οὐδέ', 'μηδέ', 'οὔτε', 'μήτε', 'οὐκέτι', 'μηκέτι', 'οὔπω', 'μήπω', 'οὐδέποτε', 'μηδέποτε', 'οὐδείς', 'μηδείς',
]);
/** ¿Termina una oración? (la negación de una oración anterior no corrige a este ἀλλά: Lc 21:9, Ro 7:7). */
const cierraOracion = (w: StructureWord) => /[.;·]$/.test(w.t);

/**
 * ἀλλά que CORRIGE una negación de su misma oración (desde el ἀλλά anterior).
 * No «οὐ μόνον … ἀλλὰ καί» («no sólo… sino también»): afirma las dos mitades
 * (Fil 1:29, 1 Ts 1:5; revisión de G4).
 */
function corrigeNegacion(antes: readonly StructureWord[]): boolean {
    let desde = antes.map(x => x.l).lastIndexOf('ἀλλά') + 1;
    for (let k = antes.length - 1; k >= desde; k--) if (cierraOracion(antes[k]!)) { desde = k + 1; break; }
    const tramo = antes.slice(desde);
    const k = tramo.findIndex(x => NEGACIONES_GR.has(x.l));
    if (k < 0) return false;
    return !tramo.slice(k + 1, k + 3).some(esMonon);
}
/** μόνον: MorphGNT lo etiqueta casi siempre como el adjetivo μόνος (neutro acusativo singular). */
const esMonon = (w: StructureWord) => w.l === 'μόνον' || (w.l === 'μόνος' && w.parse?.slice(4, 7) === 'ASN' && /^μόνον/.test(w.t));

/** En orden: gana la primera. El καί adverbial («también», «aun») antes que el conector. */
export const DISCOURSE_RULES: readonly ReglaDiscurso[] = [
    { rule: 'idouAttention', when: w => w.l === 'ἰδού' || w.l === 'ἴδε', allowed: ['attentionGetter'] },
    // Sólo D-: MACULA le da al καί coordinante el rol de su frase («χάρις ὑμῖν καὶ εἰρήνη»
    // salía «adv» → «también»; 762 casos, revisión de G4). MorphGNT ya marca D- el adverbial.
    { rule: 'kaiAdditive', when: w => w.l === 'καί' && w.pos === 'D-', allowed: ['additive', 'emphasis'] },
    { rule: 'kaiContinuity', when: w => w.l === 'καί', allowed: ['continuity'] },
    // MorphGNT acentúa el lema de las enclíticas: «τέ», «γέ».
    { rule: 'teContinuity', when: w => w.l === 'τέ' || w.l === 'τε', allowed: ['continuity'] },
    { rule: 'deDevelopment', when: w => w.l === 'δέ', allowed: ['development'] },
    { rule: 'garSupport', when: w => w.l === 'γάρ', allowed: ['explanation'] },
    { rule: 'ounInference', when: w => w.l === 'οὖν', allowed: ['inference', 'resumption'] },
    // «εἰ ἄρα», «εἴπερ ἄρα» («quizás», Hch 8:22) y «ἐπεὶ ἄρα» («de lo contrario», 1 Co 5:10) no infieren.
    { rule: 'inferential', when: (w, prev) => ['ἄρα', 'διό', 'τοιγαροῦν', 'τοίνυν'].includes(w.l) && !(w.l === 'ἄρα' && ['εἰ', 'εἴπερ', 'ἐπεί'].includes(prev?.l ?? '')), allowed: ['inference'] },
    // ἀλλά tras una negación: CORRECCIÓN («no esto, sino aquello»; Runge). Jn 3:16 «μὴ
    // ἀπόληται ἀλλ’ ἔχῃ»: el asistente había elegido «contraste» (prueba del fundador).
    // La negación puede estar lejos (Jn 3:17 «οὐ … ἀπέστειλεν … ἵνα κρίνῃ…, ἀλλ’ ἵνα σωθῇ»):
    // se busca en el versículo desde el ἀλλά anterior (Mc 14:36 tiene dos).
    { rule: 'allaAfterNegation', when: (w, _p, antes) => w.l === 'ἀλλά' && corrigeNegacion(antes), allowed: ['correction'] },
    { rule: 'allaCorrection', when: w => w.l === 'ἀλλά', allowed: ['correction', 'contrast'] },
    // μέν anticipa un δέ: sólo si el δέ llega (en el versículo o el siguiente; Hch 1:18 no lo trae).
    { rule: 'menPoint', when: (w, _p, _a, despues) => w.l === 'μέν' && despues.some(x => x.l === 'δέ'), allowed: ['pointCounterpoint'] },
    // «οὐ μόνον» (1 Ts 2:8) y el μόνον adverbial; MACULA le da a μόνον el rol de su frase.
    { rule: 'mononRestrictive', when: (w, prev) => esMonon(w) && (w.l === 'μόνον' || NEGACIONES_GR.has(prev?.l ?? '') || w.role === 'adv'), allowed: ['restrictive'] },
    // «εἰ δὲ μή γε» (2 Co 11:16) es «de lo contrario», no énfasis.
    { rule: 'intensiveParticle', when: (w, prev) => (w.l === 'γέ' || w.l === 'δή') && prev?.l !== 'μή', allowed: ['emphasis'] },
];

/** ¿La regla DECIDE la función (una sola opción) o sólo la acota para el asistente? */
export function discourseRuleDecides(rule: DiscourseRule): boolean {
    return DISCOURSE_RULES.find(r => r.rule === rule)?.allowed.length === 1;
}

/** Persona de un pronombre personal en nominativo (por el lema). */
const PERSONA: Readonly<Record<string, string>> = { 'ἐγώ': '1', 'σύ': '2', 'αὐτός': '3' };

/**
 * El pronombre personal en NOMINATIVO junto a un verbo finito de la MISMA
 * persona y número, en su cláusula: el verbo ya marca el sujeto con su
 * terminación, así que el pronombre sobra — es enfático o contrastivo
 * (Stg 2:7 «αὐτοὶ βλασφημοῦσιν»; 2:6 «ὑμεῖς δὲ ἠτιμάσατε»). Medido sobre el
 * NT: «ὁ αὐτός» («el mismo») nunca va con un verbo de 3.ª que lo repita, así
 * que no hace falta excluirlo.
 */
function pronombreExplicito(ch: ChapterStructure, ws: readonly StructureWord[], i: number): number | undefined {
    const w = ws[i]!;
    const persona = PERSONA[w.l];
    if (!persona || w.pos !== 'RP' || w.parse?.[4] !== 'N' || w.role === 'p') return undefined; // predicado: «ὃν ἂν φιλήσω αὐτός ἐστιν» (Mc 14:44)
    // αὐτός intensivo o identificador («αὐτὸς ὁ κύριος», 1 Ts 4:16; «ἡ φύσις αὐτή», 1 Co 11:14):
    // «él mismo» / «el mismo», no un sujeto repetido. Misma regla que la ficha (`autosUseAt`).
    if (autosUseAt(ws, i)) return undefined;
    // Sujeto compuesto («εἰσῆλθεν αὐτὸς καὶ οἱ μαθηταί», Jn 18:1): no repite la persona del verbo.
    if (ws[i + 1]?.l === 'καί' && ws.slice(i + 2, i + 4).some(x => x.parse?.[4] === 'N' && /^(RA|N|RP)/.test(x.pos ?? ''))) return undefined;
    const numero = w.parse?.[5];
    const porRef = new Map(ch.words.map(x => [x.r, x]));
    const clausulas = clausesOfVerse(ch, Number(w.r.split('!')[0]));
    const propia = clausulas.filter(c => c.words.includes(w.r)).sort((a, b) => b.depth - a.depth)[0];
    if (!propia) return undefined;
    // El verbo de la cláusula del pronombre, o de su madre si la propia no tiene verbo.
    const palabras = (c: number) => ch.clauses[c]!.w.map(r => porRef.get(r)).filter((x): x is StructureWord => !!x);
    const propias = palabras(propia.index);
    const madre = !propias.some(x => x.pos === 'V-') && ch.clauses[propia.index]!.p !== null ? palabras(ch.clauses[propia.index]!.p!) : [];
    const verbo = [...propias, ...madre].find(x => finito(x) && x.parse?.[0] === persona && x.parse?.[5] === numero);
    const v = verbo ? ws.indexOf(verbo) : -1;
    return v >= 0 ? v : undefined;
}

export function greekDiscourseCandidates(ch: ChapterStructure, verse: number): DiscourseCandidate[] {
    if (ch.lang !== 'gr') return [];
    const ws = verseWords(ch, verse);
    const siguiente = verseWords(ch, verse + 1);
    const despuesDe = (i: number) => [...ws.slice(i + 1), ...siguiente];
    const out: DiscourseCandidate[] = [];
    ws.forEach((w, i) => {
        const v = pronombreExplicito(ch, ws, i);
        if (v !== undefined) {
            out.push({ ordinal: i, allowed: ['emphasis', 'contrast'], rule: 'overtPronoun', verbOrdinal: v });
            return;
        }
        const regla = DISCOURSE_RULES.find(r => r.when(w, ws[i - 1], ws.slice(0, i), despuesDe(i)));
        if (!regla) return;
        out.push({ ordinal: i, allowed: regla.allowed, rule: regla.rule, ...(regla.allowed.length === 1 ? { decided: regla.allowed[0]! } : {}) });
    });
    return out;
}

/**
 * Aplicadas al mostrar: lo decidido manda; una elección del asistente que la
 * regla de hoy no permite se quita (con lo que enlaza, que la explicaba).
 */
export function applyDiscourseRules<T extends { text?: string; discourseFunction?: string; connects?: string; discourseRule?: DiscourseRule; overtPronounVerb?: number; overtPronounVerbText?: string }>(
    words: readonly T[],
    candidates: readonly DiscourseCandidate[],
): T[] {
    const porPos = new Map(candidates.map(c => [c.ordinal, c]));
    return words.map((w, i) => {
        const c = porPos.get(i);
        const { discourseRule: _r, overtPronounVerb: _v, overtPronounVerbText: _t, ...resto } = w;
        if (!c) return { ...resto } as T;
        const elegida = w.discourseFunction && (c.allowed as readonly string[]).includes(w.discourseFunction) ? w.discourseFunction : undefined;
        const fn = c.decided ?? elegida;
        const { discourseFunction: _f, connects, ...sin } = resto as T;
        return {
            ...sin,
            ...(fn ? { discourseFunction: fn } : {}),
            ...(fn && connects && (!c.decided || c.decided === w.discourseFunction) ? { connects } : {}),
            discourseRule: c.rule,
            ...(c.verbOrdinal !== undefined ? { overtPronounVerb: c.verbOrdinal, ...(words[c.verbOrdinal]?.text ? { overtPronounVerbText: words[c.verbOrdinal]!.text } : {}) } : {}),
        } as T;
    });
}

const FUNCION_ES: Record<DiscourseFunction, string> = {
    development: 'desarrollo (un paso nuevo del argumento, no necesariamente contrario)', continuity: 'continuidad (suma sin cambiar de plano)',
    contrast: 'contraste', correction: 'corrección (no esto, sino aquello)', inference: 'inferencia («por lo tanto»)', explanation: 'apoyo o explicación de lo dicho',
    emphasis: 'énfasis', pointCounterpoint: 'tesis y contraparte (μέν… δέ)', resumption: 'retoma el hilo', purpose: 'finalidad', temporal: 'marco temporal',
    condition: 'condición', additive: 'aditivo («también», «aun»)', attentionGetter: 'llama la atención sobre lo que sigue', restrictive: 'restrictivo («sólo»)',
};

/** El tramo del prompt: por palabra, la función decidida (explícala) o las opciones. */
export function buildDiscourseTask(candidates: readonly DiscourseCandidate[], words: readonly string[]): string {
    if (!candidates.length) return '';
    const lineas = candidates.map(c => {
        const base = `${c.ordinal + 1}. ${words[c.ordinal] ?? ''}`;
        if (c.rule === 'overtPronoun') {
            return `${base} — pronombre EXPLÍCITO: el verbo ${words[c.verbOrdinal!] ?? ''} ya marca esa persona con su terminación. "discourseFunction", elige: "emphasis" (realza a quién) o "contrast" (lo opone a otro); en "connects", di con qué contrasta o qué realza.`;
        }
        if (c.decided) return `${base} — FUNCIÓN YA DECIDIDA: devuelve "discourseFunction": "${c.decided}" (${FUNCION_ES[c.decided]}) y explica en "connects" qué enlaza.`;
        return `${base} — "discourseFunction", elige de: ${c.allowed.map(f => `"${f}" (${FUNCION_ES[f]})`).join('; ')}.`;
    });
    return `
FUNCIÓN EN EL ARGUMENTO (Runge) de estas palabras, con el MISMO número que en
la lista de palabras:
${lineas.join('\n')}`;
}
