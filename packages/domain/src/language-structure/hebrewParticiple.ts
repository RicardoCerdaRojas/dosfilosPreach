import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import { applyRuleChoice, ruleChoiceLines, type RuleChoiceView, type RuleStatus } from './hebrewRuleChoice.js';
import { forma, lema, segmentos, sinAcentos, trasConstructo, verbo } from './hebrewMorph.js';

/**
 * R4 — LA FUNCIÓN DEL PARTICIPIO HEBREO, con el proceso de la fase «reglas
 * extraídas de las gramáticas» (docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md).
 *
 * Las categorías son las de Arnold y Choi (1.ª ed., 2003), §3.4.3: atributivo
 * (a), predicativo (b) en presente (b.1), pasado (b.2) o futuro (b.3), y
 * sustantivo (c). Cada regla mira lo que OSHB y MACULA dicen de la palabra
 * (artículo, preposición pegada, estado, sufijo, la palabra anterior, הָיָה o
 * הִנֵּה cerca, el rol en la cláusula) y deja las categorías POSIBLES.
 *
 * Estado de todas: «medida» (como el infinitivo): una regla medida ACOTA; con
 * una sola opción se muestra «Regla · medida», no validada.
 *
 * Lo que enseñan los ejemplos del libro (medido sobre OSHB/MACULA):
 *   - La morfología sola no alcanza: un participio en constructo puede ser
 *     atributivo («אֹזֶן שֹׁמַעַת תּוֹכַחַת», Pr 15:31) y uno con sufijo,
 *     predicado («הִנְנִי נֹתְנוֹ», 1 R 20:13).
 *   - Sustantivo + participio puede ser atributo («לֵב שֹׁמֵעַ», 1 R 3:9) o
 *     sujeto + predicado («וְנָהָר יֹצֵא», Gn 2:10): lo separa el rol que
 *     MACULA da a cada palabra (el mismo constituyente o no).
 *   - «הוֹי בֹּנֶה» (Jer 22:13) y «אַשְׁרֵי שֹׁמְרֵי» (Sal 106:3) son sustantivos
 *     aunque MACULA los trate como verbo.
 */

export type HebrewParticipleFunction = 'attributive' | 'predicatePresent' | 'predicatePast' | 'predicateFuture' | 'substantive';

export type HebrewParticipleRule =
    | 'ptcPreposicion' | 'ptcExclamacion' | 'ptcPerifrastico' | 'ptcHinne' | 'ptcArticuloTrasDefinido' | 'ptcArticulo'
    | 'ptcSufijo' | 'ptcGenitivo' | 'ptcAtributivo' | 'ptcVerbal' | 'ptcPredicadoNominal' | 'ptcNominal';

export interface HebrewParticipleCandidate {
    readonly ordinal: number;
    /** La palabra, como está escrita (sin cantilación): así la nombra el prompt. */
    readonly text: string;
    readonly rule: HebrewParticipleRule;
    readonly allowed: readonly HebrewParticipleFunction[];
    readonly status: RuleStatus;
    /** Si la misma forma aparece varias veces en el versículo: cuál es. */
    readonly occurrence?: { readonly n: number; readonly of: number };
}

const PREDICADOS: readonly HebrewParticipleFunction[] = ['predicatePresent', 'predicatePast', 'predicateFuture'];

/** ¿Es participio? OSHB: «V» + tronco + «r» (activo) o «s» (pasivo). */
export const esParticipio = (w: StructureWord) => { const f = forma(w); return f === 'r' || f === 's'; };
const nominal = (x: StructureWord | undefined) => !!x && /^(N|A)/.test(segmentos(x).slice(-1)[0] ?? '');
const definido = (x: StructureWord | undefined) =>
    !!x && segmentos(x).some((g, k, a) => g === 'Td' || g.startsWith('Rd') || g === 'Np' || (k > 0 && g.startsWith('S') && /^N/.test(a[k - 1] ?? '')));
const enConstructo = (w: StructureWord) => /c$/.test(verbo(w) ?? '');
const conArticulo = (w: StructureWord) => segmentos(w).some(g => g === 'Td' || g.startsWith('Rd'));
/** Género (m/f/b/c) y número (s/p/d) del participio o del nombre, si OSHB los da. */
const genNum = (x: StructureWord): [string, string] | undefined => {
    const g = segmentos(x).find(s => /^(V..|N[cg]|Aa)[mfbc][spd]/.test(s));
    if (!g) return undefined;
    const k = g.search(/[mfbc][spd]/);
    return [g[k]!, g[k + 1]!];
};
/** ¿Concuerdan en género y número? «b» (ambos) y «c» (común) concuerdan con todo. */
const concuerdan = (a: StructureWord, b: StructureWord) => {
    const x = genNum(a), y = genNum(b);
    if (!x || !y || x[1] !== y[1]) return false;
    return x[0] === y[0] || [x[0], y[0]].some(g => g === 'b' || g === 'c');
};
/** Participios que funcionan como nombre: «מֵאֶרֶץ אוֹיֵב» es «tierra del enemigo» (Jer 31:16), «שַׂר וְשֹׁפֵט» (Éx 2:14). */
const COMO_NOMBRE: ReadonlySet<string> = new Set(['341', '7462', '8130', '8199']);
const coordinado = (w: StructureWord) => segmentos(w)[0] === 'C';
/** «עַל», «אֶל», «מִן»… como palabra propia (OSHB «R» solo, con o sin «וְ»). */
const preposicionSuelta = (x: StructureWord | undefined) => !!x && /^(C\/)?R$/.test(segmentos(x).join('/'));
/**
 * Formas de הָיָה: qatal / wayyiqtol → pasado; yiqtol, weqatal, yusivo, imperativo → futuro. Un qatal con
 * «וְ» que OSHB no marca como weqatal puede ser cualquiera de los dos («וְהָיוּ כְגִבֹּרִים», Zac 10:5).
 */
const tiempoDeHaya = (x: StructureWord): HebrewParticipleFunction[] | undefined => {
    if (lema(x) !== '1961') return undefined;
    const f = forma(x) ?? '';
    if (f === 'p') return segmentos(x)[0] === 'C' ? ['predicatePast', 'predicateFuture'] : ['predicatePast'];
    return f === 'w' ? ['predicatePast'] : ['i', 'q', 'j', 'v', 'h'].includes(f) ? ['predicateFuture'] : undefined;
};

interface Contexto {
    readonly w: StructureWord;
    readonly ws: readonly StructureWord[];
    readonly i: number;
    /** La palabra anterior; al comienzo del versículo, la última del anterior (Lv 22:33 sigue a 22:32). */
    readonly prev?: StructureWord;
    readonly regla: string;
    /** Las palabras de la cláusula más chica de MACULA que contiene al participio. */
    readonly clausula: ReadonlySet<string>;
}

/**
 * הָיָה junto al participio (perifrástico). Hacia atrás, hasta 4 palabras saltando nombres («יְהִי שֵׁם יְהוָה
 * מְבֹרָךְ», Job 1:21), sin otro verbo ni participio en medio; más allá de 2, sólo en la misma cláusula de MACULA.
 * Hacia adelante, la palabra siguiente sólo si no abre con «וְ» y está en la misma cláusula («גַּם בָּרוּךְ
 * יִהְיֶה», Gn 27:33; pero «יוֹצְאִים וְהָיָה», Ez 47:12, abre otra). Revisión de R4.
 */
function haya(c: Contexto): HebrewParticipleFunction[] | undefined {
    for (let k = c.i - 1; k >= Math.max(0, c.i - 4); k--) {
        const x = c.ws[k]!;
        const t = tiempoDeHaya(x);
        if (t) return c.i - k <= 2 || c.clausula.has(x.r) ? t : undefined;
        if (verbo(x)) break;
    }
    const sig = c.ws[c.i + 1];
    return sig && !coordinado(sig) && c.clausula.has(sig.r) ? tiempoDeHaya(sig) : undefined;
}
/**
 * הִנֵּה / הֵן (lema 2009 o 2005: «הִנְנִי» trae los dos; OSHB marca «Tm» también יֵשׁ y כֵּן, que no son
 * esto) hasta 3 palabras antes. Corta un verbo finito o infinitivo y un participio sin artículo (otro
 * predicado: «הִנֵּה אָנֹכִי מֵקִים רֹעֶה», Zac 11:16); un participio con artículo (el sujeto, «וְהִנֵּה הַגֹּאֵל עֹבֵר», Rut 4:1) no.
 */
function hinne(c: Contexto): boolean {
    for (let k = c.i - 1; k >= Math.max(0, c.i - 3); k--) {
        const x = c.ws[k]!;
        if (segmentos(x).includes('Tm') && ['2009', '2005'].includes(lema(x))) return true;
        if (verbo(x) && !(esParticipio(x) && conArticulo(x))) return false;
    }
    return false;
}

interface Regla {
    readonly rule: HebrewParticipleRule;
    readonly when: (c: Contexto) => boolean;
    readonly allowed: (c: Contexto) => readonly HebrewParticipleFunction[];
}

/** Orden: la primera que se cumple decide qué opciones quedan. */
export const HEBREW_PARTICIPLE_RULES: readonly Regla[] = [
    // §3.4.3 (c): «may serve as the object of a preposition» (Sal 103:18 «לְשֹׁמְרֵי»); también de una suelta
    // («עַל יֹשְׁבֵי הָאָרֶץ», Zac 11:6).
    // Una suelta que MACULA no trata como preposición (rol distinto de «pp») puede ser otra cosa: «אֵת רֹכְבִים»
    // (2 R 9:25) y «לְמַעַן שָׂכוּר הוּא» (Neh 6:13) son predicados.
    {
        rule: 'ptcPreposicion', when: c => segmentos(c.w).some(g => g.startsWith('R')) || preposicionSuelta(c.prev),
        allowed: c => (!segmentos(c.w).some(g => g.startsWith('R')) && c.prev!.role !== 'pp' ? ['substantive', ...PREDICADOS] : ['substantive']),
    },
    // הוֹי / אוֹי / אַשְׁרֵי + participio: «¡ay del que edifica!» (Jer 22:13), «dichosos los que guardan» (Sal 106:3).
    { rule: 'ptcExclamacion', when: c => !!c.prev && ['1945', '188', '835'].includes(lema(c.prev)), allowed: () => ['substantive'] },
    // §3.4.3 (b.2, b.3): con הָיָה el tiempo es el de הָיָה («הָיָה רֹעֶה», Éx 3:1; «יִהְיֶה נָכוֹן», 1 R 2:45). No decide:
    // erraba 6–8 de 20 — «וְלֹא הָיָה מַצִּיל» (Dn 8:7) es «no había quien librara», «וַיְהִי כָּל יוֹדְעוֹ» (1 S 10:11)
    // tiene al participio de sujeto y «עֵד מְמַהֵר» (Mal 3:5) es atributivo.
    { rule: 'ptcPerifrastico', when: c => !conArticulo(c.w) && !!haya(c), allowed: c => [...haya(c)!, 'substantive', 'attributive'] },
    // §3.4.3 (b.1–b.3): tras הִנֵּה, predicado; el tiempo, por el contexto («הִנֵּה פְלִשְׁתִּים נִלְחָמִים», 1 S 23:1;
    // «וְהִנֵּה אֹרְחַת … בָּאָה», Gn 37:25; «הִנְנִי מֵבִיא», Gn 6:17).
    // Si MACULA lo pone de sujeto, objeto o predicado nominal, también nombre o atributo: «כִּי הִנֵּה אֹיְבֶיךָ»
    // (Sal 92:10), «וְהִנֵּה מְגִלָּה עָפָה» (Zac 5:1). Con sufijo y rol verbal, el sufijo es el objeto de un predicado
    // («הִנְנִי אֹסִפְךָ», 2 R 22:20; los 18 casos del AT): sólo predicado.
    {
        rule: 'ptcHinne', when: c => !conArticulo(c.w) && hinne(c),
        allowed: c => (['s', 'o', 'pp', 'p'].includes(c.w.role) ? [...PREDICADOS, 'substantive', 'attributive'] : PREDICADOS),
    },
    // §3.4.3 (a): con artículo tras un nombre, atributivo («פַּרְעֹה הַיֹּשֵׁב», Éx 11:5); o en aposición, sustantivo.
    // También tras uno sin artículo: «חֲמֵשֶׁת אֲלָפִים הַנּוֹתָר» (Ez 48:15), «כְּמִתְלַהְלֵהַּ הַיֹּרֶה» (Pr 26:18).
    { rule: 'ptcArticuloTrasDefinido', when: c => conArticulo(c.w) && (definido(c.prev) || nominal(c.prev) || (!!c.prev && esParticipio(c.prev))), allowed: () => ['attributive', 'substantive'] },
    // §3.4.3 (c): «most often occurring with the definite article» (Rut 1:1 «הַשֹּׁפְטִים»).
    { rule: 'ptcArticulo', when: c => conArticulo(c.w), allowed: () => ['substantive'] },
    // §3.4.3 (c): «may take pronominal suffixes» (Sal 121:5 «שֹׁמְרֶךָ»). Pero el sufijo puede ser el objeto de un
    // participio predicado («אַתָּה בוֹדָאם», Neh 6:8): si MACULA lo trata como verbo, también predicado.
    { rule: 'ptcSufijo', when: c => segmentos(c.w).some(g => g.startsWith('S')), allowed: c => (c.w.role === 'v' ? ['substantive', ...PREDICADOS] : ['substantive']) },
    // §3.4.3 (c): regido por un nombre en constructo («מִכֹּל יֹצְאֵי הַתֵּבָה», Gn 9:10). OSHB pone אִישׁ / אִשָּׁה en
    // constructo también cuando el participio lo califica («אִישׁ צָרוּעַ», Lv 13:44; «אִישׁ מֵבִין», 1 Cr 27:32).
    { rule: 'ptcGenitivo', when: c => trasConstructo(c), allowed: c => (['376', '802'].includes(lema(c.prev!)) ? ['substantive', 'attributive'] : ['substantive']) },
    // §3.4.3 (a): tras un nombre, en el MISMO constituyente (mismo rol en MACULA) y con su número («לֵב שֹׁמֵעַ», 1 R 3:9).
    // En constructo (con su complemento) también puede ir en aposición, como sustantivo: «אֹזֶן שֹׁמַעַת תּוֹכַחַת»
    // (Pr 15:31) es atributivo, «עֶלְיוֹן קֹנֵה שָׁמַיִם» (Gn 14:19) es sustantivo para el libro.
    // Decide sólo si concuerdan en género, número y definitud (el atributivo concuerda en las tres): tras un nombre
    // definido, el participio sin artículo es predicado o aposición («וְהָאִישׁ נֹשֵׂא הַצִּנָּה», 1 S 17:41).
    {
        rule: 'ptcAtributivo',
        when: c => nominal(c.prev) && !!c.w.role && c.w.role === c.prev!.role && !['v', 'p'].includes(c.w.role),
        allowed: c => (!concuerdan(c.w, c.prev!) ? ['attributive', 'substantive']
            : definido(c.prev) ? ['attributive', 'substantive', ...PREDICADOS]
                // Coordinado con «וְ», suele ser otro nombre: «וְאַלְמָנָה וּגְרוּשָׁה» (Ez 44:22).
                : enConstructo(c.w) || COMO_NOMBRE.has(lema(c.w)) || coordinado(c.w) ? ['attributive', 'substantive'] : ['attributive']),
    },
    // §3.4.3 (b): MACULA lo trata como verbo. Sin sujeto en la cláusula y tras un nombre, puede ser un atributo
    // que MACULA separa en cláusula propia («לֻחֹת אֶבֶן כְּתֻבִים», Éx 31:18).
    {
        rule: 'ptcVerbal', when: c => c.w.role === 'v',
        allowed: c => (!/S/.test(c.regla) && nominal(c.prev) ? ['attributive', ...PREDICADOS] : PREDICADOS),
    },
    // Predicado de una cláusula nominal: participio o nombre («כֵּאלֹהִים יֹדְעֵי טוֹב וָרָע», Gn 3:5).
    { rule: 'ptcPredicadoNominal', when: c => c.w.role === 'p', allowed: () => [...PREDICADOS, 'attributive', 'substantive'] },
    // Sujeto, objeto o complemento sin nombre al que modificar: sustantivo («גְּאוּלִים», Is 35:9).
    { rule: 'ptcNominal', when: () => true, allowed: () => ['substantive', 'attributive'] },
];

export const HEBREW_PARTICIPLE_RULE_STATUS: Readonly<Record<HebrewParticipleRule, RuleStatus>> =
    Object.fromEntries(HEBREW_PARTICIPLE_RULES.map(r => [r.rule, 'medida'])) as Record<HebrewParticipleRule, RuleStatus>;

/** La cláusula más chica de MACULA que contiene la palabra. */
function clausulaMinima(ch: ChapterStructure, w: StructureWord): { readonly w: readonly string[]; readonly rule?: string } | undefined {
    let best: { w: readonly string[]; rule?: string } | undefined;
    for (const c of ch.clauses) if (c.w.includes(w.r) && (!best || c.w.length < best.w.length)) best = c;
    return best;
}

export function hebrewParticipleCandidates(ch: ChapterStructure, verse: number): HebrewParticipleCandidate[] {
    if (ch.lang !== 'he') return [];
    const ws = verseWords(ch, verse);
    const ultimaDelAnterior = verse > 1 ? verseWords(ch, verse - 1).slice(-1)[0] : undefined;
    const out: HebrewParticipleCandidate[] = [];
    ws.forEach((w, i) => {
        if (!esParticipio(w)) return;
        // Arameo (Dn 2–7, Esd): no es la gramática del hebreo.
        if ((w.m ?? '').startsWith('A')) return;
        const cl = clausulaMinima(ch, w);
        const c: Contexto = { w, ws, i, prev: ws[i - 1] ?? ultimaDelAnterior, regla: cl?.rule ?? '', clausula: new Set(cl?.w ?? []) };
        const regla = HEBREW_PARTICIPLE_RULES.find(r => r.when(c))!;
        const text = sinAcentos(w.t);
        const iguales = ws.map(x => sinAcentos(x.t)).map((t, k) => (t === text ? k : -1)).filter(k => k >= 0);
        out.push({
            ordinal: i, text, rule: regla.rule, allowed: regla.allowed(c), status: HEBREW_PARTICIPLE_RULE_STATUS[regla.rule],
            ...(iguales.length > 1 ? { occurrence: { n: iguales.indexOf(i) + 1, of: iguales.length } } : {}),
        });
    });
    return out;
}

/** Las funciones en castellano, para el prompt. */
const FUNCION_ES: Readonly<Record<HebrewParticipleFunction, string>> = {
    attributive: 'atributivo (califica a un nombre, como un adjetivo)',
    predicatePresent: 'predicado, presente (acción en curso o verdad general)',
    predicatePast: 'predicado, pasado (acción en curso en el pasado)',
    predicateFuture: 'predicado, futuro (inminente o venidero)',
    substantive: 'sustantivo (funciona como nombre: «el que…»)',
};
const FUNCIONES: ReadonlySet<string> = new Set(Object.keys(FUNCION_ES));

/** La tarea para el asistente: con UNA opción, la explica; con varias, elige y lo devuelve en "participleFunction". */
export function buildHebrewParticipleTask(candidates: readonly HebrewParticipleCandidate[]): string {
    if (!candidates.length) return '';
    const lineas = ruleChoiceLines(candidates, 'participleFunction', () => 'participio', FUNCION_ES);
    return `
## PARTICIPIOS: SU FUNCIÓN (campo "participleFunction" de cada palabra)
${lineas.join('\n')}`;
}

/** Lo que muestra la ficha de un participio. */
export type HebrewParticipleView = RuleChoiceView<HebrewParticipleCandidate, HebrewParticipleFunction>;

export function applyHebrewParticiple(candidate: HebrewParticipleCandidate, choice: string | undefined): HebrewParticipleView {
    return applyRuleChoice<HebrewParticipleFunction, HebrewParticipleCandidate>(candidate, choice, FUNCIONES);
}
