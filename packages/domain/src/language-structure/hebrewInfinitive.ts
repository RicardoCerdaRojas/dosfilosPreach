import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';

/**
 * R4 — LA FUNCIÓN DEL INFINITIVO HEBREO, con el proceso de la fase «reglas
 * extraídas de las gramáticas» (docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md).
 *
 * Las categorías son las de Arnold y Choi (1.ª ed., 2003), §3.4.1 (infinitivo
 * constructo) y §3.4.2 (infinitivo absoluto), más las de §4.1.5 para בְּ. Cada
 * regla mira lo que OSHB y MACULA dicen de la palabra (forma, preposición
 * pegada o anterior, verbo de la cláusula) y deja las categorías POSIBLES.
 *
 * Estado de todas: «medida» — probadas contra los ejemplos del libro y contra
 * un conjunto de control (cap. 4.1), pero sin la muestra del profesor. Por el
 * principio de la fase, una regla medida ACOTA; con una sola opción se muestra
 * como «Regla · medida», no como validada.
 *
 * Lo que la prueba de concepto y el control enseñaron (medido):
 *   - בְּ + infinitivo NO es siempre temporal: 6/8 en el control; §4.1.5 (f)
 *     trae causales (Éx 16:7, 1 R 18:18). Acota entre temporal, causal e
 *     instrumental.
 *   - Los verbos que piden complemento (§3.4.1 a, p. 69) acotan entre
 *     complemento y propósito: el libro mismo pone 1 R 5:17 bajo propósito en
 *     §4.1.10 (d) — pregunta abierta al profesor (Anexo A.1).
 */

export type HebrewInfinitiveFunction =
    | 'subject' | 'genitive' | 'object'
    | 'temporalWhile' | 'temporalAsSoonAs' | 'temporalUntil' | 'temporalAfter' | 'comparative'
    | 'causal' | 'instrumental' | 'purpose' | 'result' | 'obligation' | 'imminence' | 'specification'
    | 'emphatic' | 'manner' | 'verbalSubstitute';

export type HebrewInfinitiveRule =
    | 'bInf' | 'kInf' | 'adInf' | 'achareInf' | 'lemaanInf' | 'baavurInf' | 'lemor' | 'lComplemento' | 'lInf'
    | 'trasConstructo' | 'desnudo' | 'absEnfatico' | 'absGenitivo' | 'absManera' | 'absConVerbo' | 'absSinVerbo';

export type RuleStatus = 'medida' | 'validada';

export interface HebrewInfinitiveCandidate {
    readonly ordinal: number;
    /** La palabra, como está escrita (sin cantilación): así la nombra el prompt. */
    readonly text: string;
    readonly form: 'construct' | 'absolute';
    readonly rule: HebrewInfinitiveRule;
    readonly allowed: readonly HebrewInfinitiveFunction[];
    readonly status: RuleStatus;
    /** Si la misma forma aparece varias veces en el versículo (tenga regla o no): cuál es. Así la nombra el prompt. */
    readonly occurrence?: { readonly n: number; readonly of: number };
}

const lema = (w: StructureWord) => w.l.split('/').pop()!.split(' ')[0]!;
/** OSHB separa ילך (3212) de הלך (1980): para «misma raíz» son uno («וַיֵּלֶךְ … הָלוֹךְ», 2 S 3:16). */
const RAIZ: Readonly<Record<string, string>> = { '3212': '1980' };
const raiz = (w: StructureWord) => RAIZ[lema(w)] ?? lema(w);
const trasConstructo = (c: { prev?: StructureWord }) => !!c.prev && /^N[cgp]?[mfbc][spd]c$/.test(segmentos(c.prev).slice(-1)[0] ?? '');
const prefijos = (w: StructureWord) => w.l.split('/').slice(0, -1);
const segmentos = (w: StructureWord) => (w.m ?? '').replace(/^[HA]/, '').split('/');
const verbo = (w: StructureWord) => segmentos(w).find(s => s.startsWith('V') && s.length >= 3);
const forma = (w: StructureWord) => verbo(w)?.[2];
const FINITAS = new Set(['p', 'i', 'w', 'q', 'v', 'j', 'h']);
/** Un participio también predica («הוּא יֹצֵא לִקְרָאתֶךָ», Éx 4:14). */
const PREDICADO = new Set([...FINITAS, 'r', 's']);

/** Verbos que piden complemento (§3.4.1 a, p. 69): ידע, חלל (Hifil), יסף (Hifil), בקש (Piel), חדל, יכל, מאן, נתן, אבה. */
const COMPLEMENTO: ReadonlySet<string> = new Set(['3045', '2490', '3254', '1245', '2308', '3201', '3985', '5414', '14']);
/** Infinitivos absolutos de manera (§3.4.2 c): הַרְבֵּה, הֵיטֵב, הַשְׁכֵּם, הַרְחֵק, מַהֵר. */
const MANERA: ReadonlySet<string> = new Set(['7235', '3190', '7925', '7368', '4116', '4118']);

/**
 * La cláusula donde el infinitivo FUNCIONA: se sube por las madres hasta la
 * primera con predicado. MACULA anida un infinitivo dentro de otro («לָלֶכֶת
 * לִדְרֹשׁ», 1 Cr 21:30): mirar un solo nivel hacía creer que no había verbo
 * (revisión de R4: «sin verbo» erraba en 19 de 20). Sin predicado en toda la
 * cadena, la cláusula raíz.
 */
function clausulaDe(ch: ChapterStructure, w: StructureWord, porRef: ReadonlyMap<string, StructureWord>): StructureWord[] {
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
const esInfinitivo = (x: StructureWord) => forma(x) === 'c' || forma(x) === 'a';
/**
 * El verbo finito del que puede depender el infinitivo: el más cercano antes, hasta 6 palabras, sin otro
 * verbo en medio. Una ventana de 2 perdía el orden verbo-sujeto-infinitivo («וְלֹא אָבוּ עַבְדֵי הַמֶּלֶךְ
 * לִשְׁלֹחַ», 1 S 22:17: 101 casos, revisión de R4). Un infinitivo en medio corta, salvo que el nuestro
 * vaya coordinado con él («לִשְׁמֹעַ וְלַעֲשׂוֹת»).
 */
function verboQueRige(ws: readonly StructureWord[], i: number): StructureWord | undefined {
    const coordinado = prefijos(ws[i]!).includes('c');
    for (let k = i - 1; k >= Math.max(0, i - 6); k--) {
        const x = ws[k]!;
        if (FINITAS.has(forma(x) ?? '')) return x;
        if (PREDICADO.has(forma(x) ?? '')) return undefined;
        if (esInfinitivo(x) && !(coordinado || k === i - 1)) return undefined;
    }
    return undefined;
}
/**
 * ¿La palabra anterior es una preposición SUELTA («עַל», «יַעַן») o una compuesta con פָּנִים
 * («לִפְנֵי» antes de, «מִפְּנֵי» por causa de)? «בְּיוֹם» (preposición + sustantivo en constructo) NO:
 * su infinitivo es genitivo, el ejemplo del libro (Gn 2:17).
 */
const esPreposicion = (x: StructureWord | undefined) =>
    !!x && ((segmentos(x).length === 1 && segmentos(x)[0]!.startsWith('R')) || (segmentos(x)[0] === 'R' && lema(x) === '6440'));

interface Regla {
    readonly rule: HebrewInfinitiveRule;
    readonly form: 'construct' | 'absolute';
    readonly when: (c: Contexto) => boolean;
    readonly allowed: (c: Contexto) => readonly HebrewInfinitiveFunction[];
}
interface Contexto {
    readonly w: StructureWord;
    readonly prev?: StructureWord;
    readonly preposicion?: string;
    readonly clausula: readonly StructureWord[];
    readonly finitoAntes?: StructureWord;
    readonly ws: readonly StructureWord[];
    readonly i: number;
}

/** Orden: la primera que se cumple decide qué opciones quedan. */
export const HEBREW_INFINITIVE_RULES: readonly Regla[] = [
    // §3.4.1 (b.1) temporal «cuando»; §4.1.5 (c) instrumental y (f) causal (control: 6/8 temporales).
    { rule: 'bInf', form: 'construct', when: c => c.preposicion === 'b', allowed: () => ['temporalWhile', 'causal', 'instrumental'] },
    // §3.4.1 (b.2) «en cuanto», que «may also point to simultaneous action» (p. 70); y §4.1.9: כְּ sólo
    // es temporal con infinitivo, pero con infinitivo también compara (a: «כְּהִנְדֹּף», Sal 68:3).
    // Revisión de R4: «en cuanto» solo erraba 16–24 % (y más en poesía).
    { rule: 'kInf', form: 'construct', when: c => c.preposicion === 'k', allowed: () => ['temporalAsSoonAs', 'temporalWhile', 'comparative'] },
    // §3.4.1 (b.3) «hasta» — sin לְ propia: «עַד לָמוּת» (grado) y «עַד לְבוֹא» (espacial) no (2 Cr 32:24, 26:8).
    { rule: 'adInf', form: 'construct', when: c => !!c.prev && lema(c.prev) === '5704' && !c.preposicion, allowed: () => ['temporalUntil'] },
    // §3.4.1 (b.4) «después de» — sin preposición propia: «אַחֲרָיו לְ…» es espacial (1 R 15:4, Is 30:21).
    // (אַחֲרֵי con sufijo seguido de infinitivo sin preposición no aparece en todo el AT.)
    { rule: 'achareInf', form: 'construct', when: c => !!c.prev && lema(c.prev) === '310' && !c.preposicion, allowed: () => ['temporalAfter'] },
    // §4.1.11 (a) לְמַעַן propósito; y §3.4.1 (d): «the infinitive construct of result also occurs with לְמַעַן» (2 R 22:17).
    { rule: 'lemaanInf', form: 'construct', when: c => !!c.prev && lema(c.prev) === '4616', allowed: () => ['purpose', 'result'] },
    // §3.4.1 (c): «the infinitive construct of purpose also occurs with … בַּעֲבוּר» (p. 71; 1 S 1:6, Éx 9:16).
    { rule: 'baavurInf', form: 'construct', when: c => !!c.prev && lema(c.prev) === '5668', allowed: () => ['purpose'] },
    // §3.4.1 (g) לֵאמֹר: especificación («diciendo»).
    { rule: 'lemor', form: 'construct', when: c => c.preposicion === 'l' && lema(c.w) === '559', allowed: () => ['specification'] },
    // §3.4.1 (a.3) complemento de los verbos de la lista; pero §4.1.10 (d) pone 1 R 5:17 bajo propósito.
    { rule: 'lComplemento', form: 'construct', when: c => c.preposicion === 'l' && !!c.finitoAntes && COMPLEMENTO.has(lema(c.finitoAntes)), allowed: () => ['object', 'purpose'] },
    // §3.4.1 (c, d, g, a.3, e, f): propósito, resultado, especificación; acusativo tras verbo; inminencia con
    // הָיָה; y obligación o inminencia si la cláusula no tiene verbo. Una regla «sin verbo → obligación»
    // erraba 18 de 20 al azar (la cláusula sin verbo suele seguir al versículo anterior): sólo se ofrece.
    {
        rule: 'lInf', form: 'construct', when: c => c.preposicion === 'l',
        allowed: c => {
            const sinVerbo = !c.clausula.some(x => x !== c.w && PREDICADO.has(forma(x) ?? ''));
            return [
                'purpose', 'result', 'specification',
                ...(c.finitoAntes ? ['object' as const] : []),
                ...(sinVerbo ? ['obligation' as const] : []),
                ...(sinVerbo || c.clausula.some(x => lema(x) === '1961') || (c.finitoAntes && lema(c.finitoAntes) === '7126') ? ['imminence' as const] : []),
            ];
        },
    },
    // §3.4.1 (a.2) genitivo: tras un sustantivo en constructo («בְּיוֹם אֲכָלְךָ», Gn 2:17).
    // Tras otra preposición sin regla propia (לִפְנֵי, יַעַן, עַל, לְבִלְתִּי…) no se dice nada: el libro
    // los remite a Waltke-O'Connor, y «genitivo» engañaba (revisión de R4).
    { rule: 'trasConstructo', form: 'construct', when: c => !c.preposicion && trasConstructo(c) && !esPreposicion(c.prev), allowed: () => ['genitive'] },
    // §3.4.1 (a) nominal.
    { rule: 'desnudo', form: 'construct', when: c => !c.preposicion && !esPreposicion(c.prev) && !(c.prev && ['1115', '3282'].includes(lema(c.prev))), allowed: () => ['subject', 'genitive', 'object'] },
    // §3.4.2 (c) manera primero: «הַשְׁכֵּם וְדַבֵּר» (Jer 7:13) y «הַרְבֵּה מַרְבִּים» (Ec 6:11) son modismos de manera.
    { rule: 'absManera', form: 'absolute', when: c => MANERA.has(lema(c.w)), allowed: c => (c.clausula.some(x => x !== c.w && PREDICADO.has(forma(x) ?? '')) ? ['manner', 'object'] : ['subject', 'genitive', 'object']) },
    // §3.4.2 (b) enfático: con un verbo (o participio) de la misma raíz cerca («מוֹת תָּמוּת»).
    { rule: 'absEnfatico', form: 'absolute', when: c => c.ws.slice(Math.max(0, c.i - 3), c.i + 4).some(x => x !== c.w && PREDICADO.has(forma(x) ?? '') && raiz(x) === raiz(c.w)), allowed: () => ['emphatic'] },
    // §3.4.2 (a.2) genitivo: tras un sustantivo en constructo («רוּחַ בָּעֵר», Is 4:4; «דֶּרֶךְ הַשְׂכֵּל», Pr 21:16).
    { rule: 'absGenitivo', form: 'absolute', when: c => trasConstructo(c), allowed: () => ['genitive'] },
    { rule: 'absConVerbo', form: 'absolute', when: c => c.clausula.some(x => x !== c.w && PREDICADO.has(forma(x) ?? '')), allowed: () => ['manner', 'object', 'verbalSubstitute'] },
    // §3.4.2 (d) sustituto verbal, o (a) nominal.
    { rule: 'absSinVerbo', form: 'absolute', when: () => true, allowed: () => ['subject', 'genitive', 'object', 'verbalSubstitute'] },
];

/** El estado de cada regla: ninguna está validada por el profesor todavía (R5). */
export const HEBREW_INFINITIVE_RULE_STATUS: Readonly<Record<HebrewInfinitiveRule, RuleStatus>> =
    Object.fromEntries(HEBREW_INFINITIVE_RULES.map(r => [r.rule, 'medida'])) as Record<HebrewInfinitiveRule, RuleStatus>;

const sinAcentos = (t: string) => t.replace(/[\u0591-\u05AF\u05BD\u05C0\u05C3]/g, '');

export function hebrewInfinitiveCandidates(ch: ChapterStructure, verse: number): HebrewInfinitiveCandidate[] {
    if (ch.lang !== 'he') return [];
    const ws = verseWords(ch, verse);
    const porRef = new Map(ch.words.map(w => [w.r, w]));
    const out: HebrewInfinitiveCandidate[] = [];
    ws.forEach((w, i) => {
        const f = forma(w);
        if (f !== 'c' && f !== 'a') return;
        // Arameo (Dn 2–7, Esd): no es la gramática del hebreo (revisión de R4).
        if ((w.m ?? '').startsWith('A')) return;
        const form = f === 'c' ? 'construct' : 'absolute';
        const pre = prefijos(w).filter(p => ['b', 'k', 'l', 'm'].includes(p)).pop();
        const finitoAntes = verboQueRige(ws, i);
        const c: Contexto = { w, prev: ws[i - 1], preposicion: pre, clausula: clausulaDe(ch, w, porRef), finitoAntes, ws, i };
        const regla = HEBREW_INFINITIVE_RULES.find(r => r.form === form && r.when(c));
        if (!regla) return;
        const text = sinAcentos(w.t);
        const iguales = ws.map(x => sinAcentos(x.t)).map((t, k) => (t === text ? k : -1)).filter(k => k >= 0);
        out.push({
            ordinal: i, text, form, rule: regla.rule, allowed: regla.allowed(c), status: HEBREW_INFINITIVE_RULE_STATUS[regla.rule],
            ...(iguales.length > 1 ? { occurrence: { n: iguales.indexOf(i) + 1, of: iguales.length } } : {}),
        });
    });
    return out;
}

/** Las funciones en castellano, para el prompt. */
const FUNCION_ES: Readonly<Record<HebrewInfinitiveFunction, string>> = {
    subject: 'sujeto (nominal)', genitive: 'genitivo (nominal)', object: 'complemento u objeto (nominal)',
    temporalWhile: 'temporal «cuando, mientras»', temporalAsSoonAs: 'temporal «en cuanto»', temporalUntil: 'temporal «hasta»',
    temporalAfter: 'temporal «después de»', comparative: 'comparativo «como»', causal: 'causal «porque»', instrumental: 'instrumental «por, mediante»',
    purpose: 'propósito «para»', result: 'resultado «de modo que»', obligation: 'obligación (en cláusula sin verbo)',
    imminence: 'inminencia «a punto de»', specification: 'especificación «diciendo, haciendo»',
    emphatic: 'enfático (con verbo de la misma raíz)', manner: 'manera (adverbial)', verbalSubstitute: 'sustituto del verbo principal',
};
const FUNCIONES: ReadonlySet<string> = new Set(Object.keys(FUNCION_ES));

/**
 * La tarea para el asistente: con UNA opción, la explica; con varias, elige de
 * la lista y lo devuelve en "infinitiveFunction" de esa palabra.
 */
export function buildHebrewInfinitiveTask(candidates: readonly HebrewInfinitiveCandidate[]): string {
    if (!candidates.length) return '';
    // Una forma repetida en el versículo se distingue por su aparición (Neh 9:8, dos «לָתֵת»), contando
    // también las que no tienen regla: si no, «1.ª» podía nombrar otra palabra (revisión de R4).
    const lineas = candidates.map(c => {
        const cual = c.occurrence ? ` (${c.occurrence.n}.ª aparición de ${c.occurrence.of} en el versículo)` : '';
        const forma = c.form === 'construct' ? 'infinitivo constructo' : 'infinitivo absoluto';
        return c.allowed.length === 1
            ? `- ${c.text}${cual}: ${forma}; el texto propone ${c.allowed[0]} = ${FUNCION_ES[c.allowed[0]!]} (regla medida, todavía sin validar). Si el contexto lo confirma, devuelve "infinitiveFunction": "${c.allowed[0]}" y explícalo; si claramente es otra función, devuelve esa (uno de: ${[...FUNCIONES].join(', ')}) y di por qué.`
            : `- ${c.text}${cual}: ${forma}, elige "infinitiveFunction" de: ${c.allowed.map(f => `"${f}" (${FUNCION_ES[f]})`).join('; ')}. Elige por el contexto y explica por qué; si ninguna encaja, devuelve la que corresponda (uno de: ${[...FUNCIONES].join(', ')}) y di por qué.`;
    });
    return `
## INFINITIVOS: SU FUNCIÓN (campo "infinitiveFunction" de cada palabra)
${lineas.join('\n')}`;
}

/** Lo que muestra la ficha de un infinitivo. */
export interface HebrewInfinitiveView {
    readonly candidate: HebrewInfinitiveCandidate;
    /** La función, si la propone la regla (una opción) o el asistente eligió una de la lista. */
    readonly fn?: HebrewInfinitiveFunction;
    /** `rule`: una sola opción; `assistant`: eligió de la lista; ninguna: sólo las opciones. */
    readonly by?: 'rule' | 'assistant';
    /**
     * Si la regla (medida, sin validar) propone una función y el asistente lee otra, se muestran las dos:
     * es justo el caso que el profesor tiene que mirar (revisión de R4: no imponer lo no validado).
     */
    readonly assistantReading?: HebrewInfinitiveFunction;
}

/**
 * Al mostrar: la regla propone; la elección del asistente vale si está en la lista. Si el asistente lee una
 * función que la regla (medida, sin validar) no deja, se muestra al lado: con una opción o con varias
 * (revisión de R4: 1 S 22:17, el asistente acertaba «complemento» y se descartaba en silencio).
 */
export function applyHebrewInfinitive(candidate: HebrewInfinitiveCandidate, choice: string | undefined): HebrewInfinitiveView {
    const fuera = choice && FUNCIONES.has(choice) && !(candidate.allowed as readonly string[]).includes(choice) && candidate.status === 'medida'
        ? { assistantReading: choice as HebrewInfinitiveFunction } : {};
    if (candidate.allowed.length === 1) return { candidate, fn: candidate.allowed[0]!, by: 'rule', ...fuera };
    const elegida = choice && (candidate.allowed as readonly string[]).includes(choice) ? (choice as HebrewInfinitiveFunction) : undefined;
    return elegida ? { candidate, fn: elegida, by: 'assistant' } : { candidate, ...fuera };
}
