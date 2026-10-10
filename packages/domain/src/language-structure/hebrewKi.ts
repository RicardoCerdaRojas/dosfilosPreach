import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import { applyRuleChoice, ruleChoiceLines, type RuleChoiceView, type RuleStatus } from './hebrewRuleChoice.js';
import { FINITAS, forma, lema, segmentos, sinAcentos } from './hebrewMorph.js';

/**
 * R4 — LA FUNCIÓN DE כִּי, con el proceso de la fase «reglas extraídas de las
 * gramáticas» (docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md).
 *
 * Las categorías son las de Arnold y Choi (1.ª ed., 2003), §4.3.4 (a)–(n). La
 * estructura de cláusulas ya marca כִּי como «causa o contenido» y כִּי אִם como
 * contraste; esto es más fino y va por palabra: cada regla mira lo que OSHB y
 * MACULA dicen alrededor (אִם después, un juramento antes, el rol de su
 * cláusula, וַיְהִי, «dijo», una pregunta, una prótasis) y deja las categorías
 * POSIBLES. Todas «medidas»: una regla medida ACOTA; con una opción, «Regla ·
 * medida».
 */

export type HebrewKiFunction =
    | 'causal' | 'evidential' | 'clarification' | 'result' | 'temporal' | 'conditional' | 'adversative'
    | 'concessive' | 'asseverative' | 'perceptual' | 'subject' | 'recitative' | 'exceptive' | 'interrogative';

export type HebrewKiRule =
    | 'kiIm' | 'kiApodosis' | 'kiJuramento' | 'kiObjeto' | 'kiSujeto' | 'kiVayehi' | 'kiTrasDecir'
    | 'kiPregunta' | 'kiTrasNegacion' | 'kiInicial' | 'kiGeneral';

export interface HebrewKiCandidate {
    readonly ordinal: number;
    /** La palabra, como está escrita (sin cantilación): así la nombra el prompt. */
    readonly text: string;
    readonly rule: HebrewKiRule;
    readonly allowed: readonly HebrewKiFunction[];
    readonly status: RuleStatus;
    readonly occurrence?: { readonly n: number; readonly of: number };
}

const KI = '3588';
/** Lo que cubre la regla general: las de una cláusula que sigue a otra (§4.3.4 a–i, n). */
const GENERAL: readonly HebrewKiFunction[] = [
    'causal', 'evidential', 'clarification', 'result', 'concessive', 'adversative', 'temporal', 'conditional', 'asseverative', 'interrogative',
];

/** Predicados de valoración o emoción: חרה (enojarse), טוֹב, רַע, רעע. */
const VALORACION = ['2734', '2896', '7451', '7489'];

interface Contexto {
    readonly w: StructureWord;
    readonly ws: readonly StructureWord[];
    readonly i: number;
    /** El rol que MACULA da a la cláusula de כִּי («o» objeto, «s» sujeto), si la marca. */
    readonly rolClausula: string;
    /** Una negación en las últimas palabras del versículo anterior (para el כִּי que abre el versículo). */
    readonly negacionAntes: boolean;
}

const lemaEn = (x: StructureWord | undefined, ...ls: string[]) => !!x && ls.includes(lema(x));
const antes = (c: Contexto, n: number) => c.ws.slice(Math.max(0, c.i - n), c.i);
/**
 * Un juramento antes en el versículo, y este es el PRIMER כִּי después: «חַי יְהוָה» (חַי «vivo», homónimo
 * «2416 a» de OSHB, sin preposición ni sufijo, + nombre: 2 S 12:5; «חֵי פַרְעֹה», Gn 42:16) o «כֹּה יַעֲשֶׂה … וְכֹה
 * יֹסִיף» (1 S 14:44). «חַיַּת הַשָּׂדֶה» (las bestias, 1 S 17:46) y «חַיַּי» (mi vida, 1 S 18:18) son otros
 * homónimos; un segundo כִּי ya es otra cosa («כִּי לֹא מָצָאתִי», 1 S 29:6). Muestra al azar: erraba 5 de 20.
 */
function juramento(c: Contexto): boolean {
    for (let k = c.i - 1; k >= Math.max(0, c.i - 12); k--) {
        const x = c.ws[k]!, sig = c.ws[k + 1];
        if (lema(x) === KI) return false;
        // Un אִם en medio ya cerró el juramento: «חַי יְהוָה אִם יִפֹּל … כִּי עִם אֱלֹהִים עָשָׂה» (1 S 14:45) es causa.
        if (lema(x) === '518') return false;
        const vivo = /(^|\/)2416 a$/.test(x.l) && segmentos(x).every(g => !g.startsWith('R') && !g.startsWith('S'));
        if (vivo && !!sig && /^(N|Np)/.test(segmentos(sig).slice(-1)[0] ?? '')) return true;
        // La fórmula completa, con «וְכֹה יֹסִיף» (como `markOathFormula`): «כֹּה אֶעֱשֶׂה לְּךָ» (Am 4:12) no jura.
        if (lema(x) === '3541' && lemaEn(sig, '6213') && c.ws.slice(k + 2, c.i).some(y => lema(y) === '3254')) return true;
    }
    return false;
}

const valoracion = (c: Contexto) => antes(c, 4).some(x => lemaEn(x, ...VALORACION));
/**
 * Verbos de percepción, de saber y de decir (ידע, ראה, שמע, נגד Hifil, זכר, אמן, בין, אמר, דבר, קרא). MACULA deja fuera
 * de toda cláusula al 74 % de los כִּי, y entonces su rol «objeto» no se ve: «וַיֵּדַע דָּוִד כִּי» (2 S 5:12) caía
 * en la general sin «perceptiva» (revisión de R4). Con uno de estos hasta 5 palabras antes («וַיִּרְאוּ הַמִּצְרִים אֶת
 * הָאִשָּׁה כִּי», Gn 12:14), sin otro כִּי ni otro verbo finito en medio, se agregan perceptiva y recitativa.
 */
const PERCEPCION = ['3045', '7200', '8085', '5046', '2142', '539', '995', '559', '1696', '7121'];
function trasPercepcion(c: Contexto): boolean {
    for (let k = c.i - 1; k >= Math.max(0, c.i - 5); k--) {
        const x = c.ws[k]!;
        if (lema(x) === KI) return false;
        if (PERCEPCION.includes(lema(x))) return true;
        if (FINITAS.has(forma(x) ?? '')) return false;
    }
    return false;
}
const conPercepcion = (c: Contexto, fs: readonly HebrewKiFunction[]): HebrewKiFunction[] =>
    trasPercepcion(c) ? [...fs, ...(['perceptual', 'recitative'] as const).filter(f => !fs.includes(f))] : [...fs];

function trasDecir(c: Contexto): boolean {
    for (let k = c.i - 1; k >= Math.max(0, c.i - 4); k--) {
        const x = c.ws[k]!;
        if (lema(x) === '559') return true;
        if (FINITAS.has(forma(x) ?? '') || lema(x) === KI) return false;
    }
    return false;
}

interface Regla {
    readonly rule: HebrewKiRule;
    readonly when: (c: Contexto) => boolean;
    readonly allowed: (c: Contexto) => readonly HebrewKiFunction[];
}

/** Orden: la primera que se cumple decide qué opciones quedan. */
export const HEBREW_KI_RULES: readonly Regla[] = [
    // §4.3.4 (g, m, i): כִּי אִם es «sino» tras negación, «excepto», o asevera («ciertamente», Jue 15:7; tras juramento, 2 R 5:20).
    // Sin negación antes en el versículo también puede ser «porque si» («כִּי אִם מָאֵן אַתָּה», Éx 10:4; 1 S 20:9).
    {
        rule: 'kiIm', when: c => lemaEn(c.ws[c.i + 1], '518'),
        allowed: c => conPercepcion(c, juramento(c) ? ['asseverative', 'exceptive']
            : antes(c, 12).some(x => lemaEn(x, '3808', '369', '408')) ? ['adversative', 'exceptive', 'asseverative']
                : ['adversative', 'exceptive', 'asseverative', 'causal', 'conditional']),
    },
    // §4.3.4 (f): tras לוּ / לוּלֵא (o tras אִם si sigue עַתָּה / אָז) introduce la apódosis (Gn 43:10 «כִּי עַתָּה»; 2 S 19:7
    // «כִּי אָז»). Va antes que el juramento: en «חַי הָאֱלֹהִים כִּי לוּלֵא דִּבַּרְתָּ כִּי אָז…» (2 S 2:27) el segundo es la
    // apódosis. Con cualquier אִם en 6 palabras erraba 8–10 de 20 («כִּי פִּי יְהוָה דִּבֵּר», Is 1:20, es causa).
    {
        rule: 'kiApodosis',
        when: c => antes(c, 6).some(x => lemaEn(x, '3863', '3884')) || (antes(c, 6).some(x => lemaEn(x, '518')) && lemaEn(c.ws[c.i + 1], '6258', '227')),
        allowed: () => ['conditional', 'asseverative'],
    },
    // §4.3.4 (i): tras un juramento, asevera («חַי יְהוָה כִּי בֶן מָוֶת», 2 S 12:5). Con un yiqtol después también puede ser
    // la condición que se jura («כֹּה יַעֲשֶׂה … כִּי יֵיטִב אֶל אָבִי», 1 S 20:13): entonces no decide.
    {
        rule: 'kiJuramento', when: juramento,
        allowed: c => (forma(c.ws[c.i + 1] ?? c.w) === 'i' ? ['asseverative', 'conditional'] : ['asseverative']),
    },
    // §4.3.4 (j, l): cláusula objeto (MACULA «o») de ver, saber, oír… o de decir («וַיַּרְא … כִּי טוֹב», Gn 1:10).
    { rule: 'kiObjeto', when: c => c.rolClausula === 'o', allowed: () => ['perceptual', 'recitative'] },
    // §4.3.4 (k, c): cláusula sujeto («טוֹב כִּי תִהְיֶה», 2 S 18:3; «הַמְעַט כִּי», Nm 16:13).
    { rule: 'kiSujeto', when: c => c.rolClausula === 's', allowed: () => ['subject', 'clarification'] },
    // §4.3.4 (e, f): וַיְהִי / וְהָיָה כִּי abre un tiempo o una condición (Gn 6:1, Éx 1:10).
    { rule: 'kiVayehi', when: c => lemaEn(c.ws[c.i - 1], '1961') && ['w', 'q'].includes(forma(c.ws[c.i - 1]!) ?? ''), allowed: () => ['temporal', 'conditional'] },
    // §4.3.4 (l): tras «decir», introduce lo dicho (2 R 8:13) — o empieza lo dicho con otra función (Nm 33:51, temporal).
    // Hasta 4 palabras atrás, sin otro verbo finito en medio («וַיֹּאמְרוּ אֶל יְהוֹשֻׁעַ כִּי», Jos 2:24).
    { rule: 'kiTrasDecir', when: trasDecir, allowed: () => ['recitative', ...GENERAL] },
    // §4.3.4 (n): con la pregunta en la palabra siguiente («כִּי הָאָדָם עֵץ הַשָּׂדֶה», Dt 20:19).
    { rule: 'kiPregunta', when: c => !!c.ws[c.i + 1] && segmentos(c.ws[c.i + 1]!).includes('Ti'), allowed: () => ['interrogative', 'causal'] },
    // (Sin regla «tras una pregunta → resultado» (Éx 3:11): erraba 4 de 20 — «כִּי תָבוֹא עָלָיו צָרָה» (Job 27:9) es
    // temporal, «הֲטוֹב לְךָ כִּי» (Job 10:3) sujeto. Esos caen en la general, que incluye el resultado.)
    // §4.3.4 (g, m): tras una negación y sin verbo después, «sino» o «excepto» («לֹא תִקְרָא … כִּי שָׂרָה», Gn 17:15;
    // «אֵין חֵפֶץ … כִּי בְּמֵאָה עָרְלוֹת», 1 S 18:25); o la causa de lo negado (Dt 1:42).
    {
        rule: 'kiTrasNegacion', when: c => antes(c, 8).some(x => lemaEn(x, '3808', '369', '408')) && !!c.ws[c.i + 1] && !FINITAS.has(forma(c.ws[c.i + 1]!) ?? ''),
        // Y aseverar tras una prótasis negada: «אִם לֹא תַאֲמִינוּ כִּי לֹא תֵאָמֵנוּ» (Is 7:9).
        allowed: c => conPercepcion(c, ['adversative', 'exceptive', 'causal', 'clarification', 'asseverative', ...(valoracion(c) ? ['subject' as const] : [])]),
    },
    // §4.3.4 (f, e, h, i): al comienzo del versículo, sin cláusula antes: condición o tiempo (ley, Éx 21:2), concesión
    // (Sal 37:24) o aseveración (Is 1:29); o causa que sigue al versículo anterior.
    // Tras una negación al final del versículo anterior, también «sino» («לֹא תִקַּח אִשָּׁה … כִּי אֶל אַרְצִי … תֵּלֵךְ»,
    // Gn 24:3–4).
    {
        rule: 'kiInicial', when: c => c.i === 0,
        allowed: c => ['conditional', 'temporal', 'concessive', 'asseverative', 'causal', ...(c.negacionAntes ? ['adversative' as const] : [])],
    },
    // §4.3.4 (k): tras un predicado de valoración o de enojo, también la cláusula sujeto («אַל יִחַר … כִּי», Gn 31:35).
    { rule: 'kiGeneral', when: () => true, allowed: c => conPercepcion(c, valoracion(c) ? [...GENERAL, 'subject'] : GENERAL) },
];

export const HEBREW_KI_RULE_STATUS: Readonly<Record<HebrewKiRule, RuleStatus>> =
    Object.fromEntries(HEBREW_KI_RULES.map(r => [r.rule, 'medida'])) as Record<HebrewKiRule, RuleStatus>;

/**
 * El rol de la cláusula que abre כִּי: la más chica de MACULA que contiene al כִּי. Sólo la propia: la de la palabra
 * siguiente daba «sujeto» a «כִּי הִנְנִי מֵקִים» (Hab 1:6), que es causa (9 de 20 errados).
 */
function rolDeClausula(ch: ChapterStructure, ws: readonly StructureWord[], i: number): string {
    let best: { w: readonly string[]; role?: string; p?: number | null } | undefined;
    for (const c of ch.clauses) if (c.w.includes(ws[i]!.r) && (!best || c.w.length < best.w.length)) best = c;
    if (!best) return '';
    // Sin rol propio, el de la madre si sólo coordina («CLaCL», «ClCl»…): ahí deja MACULA la «o» (Gn 29:12).
    const madre = !best.role && best.p !== null && best.p !== undefined ? ch.clauses[best.p] : undefined;
    return best.role || (madre && COORDINA.has(madre.rule) ? madre.role ?? '' : '');
}
const COORDINA: ReadonlySet<string> = new Set(['CLaCL', 'ClCl', 'ClCl2', 'CLandCL2']);

export function hebrewKiCandidates(ch: ChapterStructure, verse: number): HebrewKiCandidate[] {
    if (ch.lang !== 'he') return [];
    const ws = verseWords(ch, verse);
    const anterior = verse > 1 ? verseWords(ch, verse - 1).slice(-12) : [];
    const out: HebrewKiCandidate[] = [];
    ws.forEach((w, i) => {
        // (El arameo no tiene כִּי: usa דִּי. No hace falta filtrarlo.)
        if (lema(w) !== KI) return;
        const c: Contexto = { w, ws, i, rolClausula: rolDeClausula(ch, ws, i), negacionAntes: i === 0 && anterior.some(x => ['3808', '369', '408'].includes(lema(x))) };
        const regla = HEBREW_KI_RULES.find(r => r.when(c))!;
        const text = sinAcentos(w.t);
        const iguales = ws.map(x => sinAcentos(x.t)).map((t, k) => (t === text ? k : -1)).filter(k => k >= 0);
        out.push({
            ordinal: i, text, rule: regla.rule, allowed: regla.allowed(c), status: HEBREW_KI_RULE_STATUS[regla.rule],
            ...(iguales.length > 1 ? { occurrence: { n: iguales.indexOf(i) + 1, of: iguales.length } } : {}),
        });
    });
    return out;
}

/** Las funciones en castellano, para el prompt. */
const FUNCION_ES: Readonly<Record<HebrewKiFunction, string>> = {
    causal: 'causal «porque»', evidential: 'evidencial «pues (se ve en que)»', clarification: 'aclaratoria «que, es decir»',
    result: 'resultado «que (para que)»', temporal: 'temporal «cuando»', conditional: 'condicional «si»',
    adversative: 'adversativa «sino»', concessive: 'concesiva «aunque»', asseverative: 'aseverativa «ciertamente»',
    perceptual: 'perceptiva «que» (tras ver, saber, oír)', subject: 'cláusula sujeto «que»', recitative: 'recitativa (introduce lo dicho)',
    exceptive: 'exceptiva «excepto»', interrogative: 'interrogativa',
};
const FUNCIONES: ReadonlySet<string> = new Set(Object.keys(FUNCION_ES));

export function buildHebrewKiTask(candidates: readonly HebrewKiCandidate[]): string {
    if (!candidates.length) return '';
    const lineas = ruleChoiceLines(candidates, 'kiFunction', () => 'כִּי', FUNCION_ES);
    return `
## כִּי: SU FUNCIÓN (campo "kiFunction" de cada palabra)
${lineas.join('\n')}`;
}

export type HebrewKiView = RuleChoiceView<HebrewKiCandidate, HebrewKiFunction>;

export function applyHebrewKi(candidate: HebrewKiCandidate, choice: string | undefined): HebrewKiView {
    return applyRuleChoice<HebrewKiFunction, HebrewKiCandidate>(candidate, choice, FUNCIONES);
}
