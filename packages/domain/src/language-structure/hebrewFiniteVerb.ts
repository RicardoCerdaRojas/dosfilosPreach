import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import { applyRuleChoice, ruleChoiceLines, type RuleChoiceView, type RuleStatus } from './hebrewRuleChoice.js';
import { forma, lema, sinAcentos, verbo } from './hebrewMorph.js';

/**
 * U5 (revisión del profesor 2026-11, Rut 3:5 אֶעֱשֶׂה) — LA FUNCIÓN DEL VERBO
 * FINITO HEBREO, con las categorías de Arnold y Choi (1.ª ed., 2003): §3.2.1
 * perfecto, §3.2.2 imperfecto, §3.3 yusivo, imperativo y cohortativo, §3.5.1 y
 * §3.5.2 las formas con waw consecutiva. Mismo proceso que el infinitivo, el
 * participio y כִּי: la regla deja las funciones POSIBLES y el asistente elige.
 *
 * COHORTATIVO POR FUNCIÓN. Un yiqtol de 1.ª persona puede ser cohortativo
 * aunque la forma no lo muestre: en un verbo III-he la ה final es de la raíz y
 * la ה- del cohortativo no se ve (Rut 3:5 «כֹּל אֲשֶׁר תֹּאמְרִי אֶעֱשֶׂה», OSHB
 * `Vqi1cs`: «haré todo lo que digas», con la determinación del cohortativo).
 * Putnam §2.2.4a: el cohortativo puede verse idéntico al yiqtol y se reconoce
 * por el contexto (Gn 24:58 אֵלֵךְ, «sí, iré»). A&C §3.3.3 (a): la RESOLUCIÓN,
 * «el hablante expresa su determinación de hacer algo que está a su alcance».
 * Por eso al yiqtol de 1.ª persona se le suman las funciones del cohortativo.
 *
 * Con אַל delante, el yusivo (o el yiqtol que OSHB no marca como yusivo) es
 * prohibición: A&C §3.3.1 (d). Es la única regla que decide sola.
 */

export type HebrewVerbFunction =
    // §3.2.1 perfecto
    | 'complete' | 'stative' | 'experience' | 'rhetoricalFuture' | 'proverbial' | 'performative'
    // §3.2.2 imperfecto
    | 'future' | 'customary' | 'progressive' | 'conditional' | 'permission' | 'obligation' | 'command' | 'preterite'
    // §3.3 yusivo, imperativo y cohortativo
    | 'wish' | 'benediction' | 'prohibition' | 'promise' | 'resolve' | 'exhortation'
    // §3.5.1 y §3.5.2 waw consecutiva
    | 'sequential' | 'consequential' | 'narratival' | 'epexegetical' | 'dependent' | 'volitional' | 'apodictic';

export type HebrewVerbForm = 'perfect' | 'imperfect' | 'wayyiqtol' | 'weqatal' | 'jussive' | 'imperative' | 'cohortative';

export type HebrewVerbRule =
    | 'vfProhibicion' | 'vfYiqtolPrimera'
    | 'vfPerfecto' | 'vfImperfecto' | 'vfWayyiqtol' | 'vfWeqatal' | 'vfYusivo' | 'vfImperativo' | 'vfCohortativo';

export interface HebrewVerbCandidate {
    readonly ordinal: number;
    /** La palabra, como está escrita (sin cantilación): así la nombra el prompt. */
    readonly text: string;
    readonly form: HebrewVerbForm;
    readonly rule: HebrewVerbRule;
    readonly allowed: readonly HebrewVerbFunction[];
    readonly status: RuleStatus;
    readonly occurrence?: { readonly n: number; readonly of: number };
}

const FORMA: Readonly<Record<string, HebrewVerbForm>> = {
    p: 'perfect', i: 'imperfect', w: 'wayyiqtol', q: 'weqatal', j: 'jussive', v: 'imperative', h: 'cohortative',
};

/** Las funciones de cada forma (A&C, en su orden). */
export const HEBREW_VERB_FUNCTIONS: Readonly<Record<HebrewVerbForm, readonly HebrewVerbFunction[]>> = {
    perfect: ['complete', 'stative', 'experience', 'rhetoricalFuture', 'proverbial', 'performative'],
    imperfect: ['future', 'customary', 'progressive', 'conditional', 'permission', 'obligation', 'command', 'preterite'],
    jussive: ['command', 'wish', 'benediction', 'prohibition'],
    imperative: ['command', 'permission', 'promise'],
    cohortative: ['resolve', 'wish', 'exhortation'],
    wayyiqtol: ['sequential', 'consequential', 'narratival', 'epexegetical', 'dependent'],
    weqatal: ['sequential', 'consequential', 'volitional', 'apodictic'],
};

interface Contexto {
    readonly w: StructureWord;
    readonly ws: readonly StructureWord[];
    readonly i: number;
    readonly form: HebrewVerbForm;
}

interface Regla {
    readonly rule: HebrewVerbRule;
    readonly when: (c: Contexto) => boolean;
    readonly allowed: (c: Contexto) => readonly HebrewVerbFunction[];
}

const AL = '408';
const persona = (w: StructureWord) => verbo(w)?.[3];

/** Orden: la primera que se cumple decide qué opciones quedan. */
export const HEBREW_VERB_RULES: readonly Regla[] = [
    // A&C §3.3.1 (d): אַל + yusivo (o un yiqtol que OSHB no marca yusivo) prohíbe: «אַל תִּפְגְּעִי בִי» (Rut 1:16).
    { rule: 'vfProhibicion', when: c => (c.form === 'jussive' || c.form === 'imperfect') && !!c.ws[c.i - 1] && lema(c.ws[c.i - 1]!) === AL, allowed: () => ['prohibition'] },
    // Putnam §2.2.4a, A&C §3.3.3: el yiqtol de 1.ª persona puede ser cohortativo por su función (Rut 3:5 אֶעֱשֶׂה).
    { rule: 'vfYiqtolPrimera', when: c => c.form === 'imperfect' && persona(c.w) === '1', allowed: () => [...HEBREW_VERB_FUNCTIONS.imperfect, ...HEBREW_VERB_FUNCTIONS.cohortative] },
    { rule: 'vfPerfecto', when: c => c.form === 'perfect', allowed: () => HEBREW_VERB_FUNCTIONS.perfect },
    { rule: 'vfImperfecto', when: c => c.form === 'imperfect', allowed: () => HEBREW_VERB_FUNCTIONS.imperfect },
    { rule: 'vfWayyiqtol', when: c => c.form === 'wayyiqtol', allowed: () => HEBREW_VERB_FUNCTIONS.wayyiqtol },
    { rule: 'vfWeqatal', when: c => c.form === 'weqatal', allowed: () => HEBREW_VERB_FUNCTIONS.weqatal },
    { rule: 'vfYusivo', when: c => c.form === 'jussive', allowed: () => HEBREW_VERB_FUNCTIONS.jussive },
    { rule: 'vfImperativo', when: c => c.form === 'imperative', allowed: () => HEBREW_VERB_FUNCTIONS.imperative },
    { rule: 'vfCohortativo', when: c => c.form === 'cohortative', allowed: () => HEBREW_VERB_FUNCTIONS.cohortative },
];

export const HEBREW_VERB_RULE_STATUS: Readonly<Record<HebrewVerbRule, RuleStatus>> =
    Object.fromEntries(HEBREW_VERB_RULES.map(r => [r.rule, 'medida'])) as Record<HebrewVerbRule, RuleStatus>;

export function hebrewFiniteVerbCandidates(ch: ChapterStructure, verse: number): HebrewVerbCandidate[] {
    if (ch.lang !== 'he') return [];
    const ws = verseWords(ch, verse);
    const out: HebrewVerbCandidate[] = [];
    ws.forEach((w, i) => {
        // El arameo (Dn, Esd) tiene otras formas: fuera.
        if (!w.m?.startsWith('H')) return;
        const form = FORMA[forma(w) ?? ''];
        if (!form) return;
        const c: Contexto = { w, ws, i, form };
        const regla = HEBREW_VERB_RULES.find(r => r.when(c))!;
        const text = sinAcentos(w.t);
        const iguales = ws.map(x => sinAcentos(x.t)).map((t, k) => (t === text ? k : -1)).filter(k => k >= 0);
        out.push({
            ordinal: i, text, form, rule: regla.rule, allowed: regla.allowed(c), status: HEBREW_VERB_RULE_STATUS[regla.rule],
            ...(iguales.length > 1 ? { occurrence: { n: iguales.indexOf(i) + 1, of: iguales.length } } : {}),
        });
    });
    return out;
}

/**
 * Las funciones en castellano, para el prompt: la DEFINICIÓN de Arnold y Choi, no
 * un rótulo. Con rótulos de una palabra, el banco (2026-11-12) dio 7 de 14: Rut 3:5
 * salió «promesa» (que es del imperativo), Rut 2:2 «déjame ir» salió «resolución»
 * (es deseo: pide el consentimiento de otro), «no robarás» salió «prohibición» (en
 * el yiqtol, A&C la cuenta dentro del mandato). Sin los versículos del banco como
 * ejemplos, para no medir sobre lo enseñado.
 */
const FUNCION_ES: Readonly<Record<HebrewVerbFunction, string>> = {
    complete: 'acción completa, vista entera de principio a fin (pasado: «hizo», «ha hecho», «había hecho»)',
    stative: 'estado o condición, con un verbo de estado (presente: «está lleno», «es grande»)',
    experience: 'experiencia: estado de ánimo, percepción o actitud con un verbo de acción (presente: «no sé», «aborrezco»)',
    rhetoricalFuture: 'futuro retórico: algo que todavía no ocurre pero el hablante da por cierto (profecía dada por cumplida)',
    proverbial: 'proverbial: verdad general, sin tiempo (presente)',
    performative: 'performativo: la acción se cumple al decirla; suele ser 1.ª persona con verbos de dar, nombrar, jurar o bendecir en el momento de hablar (presente: «te nombro», «te doy», no «te he dado»)',
    future: 'futuro: acción anunciada o esperada',
    customary: 'habitual o característico: lo que ocurre regularmente, se repite o vale siempre (también la verdad general dicha con yiqtol)',
    progressive: 'progresivo: acción en curso en el momento del que se habla, típica de preguntas por lo que alguien está haciendo («¿qué buscas?»: presente, no futuro)',
    conditional: 'condicional: depende de una condición',
    permission: 'permiso: «puedes», «se puede»',
    obligation: 'obligación: «debe», «no se debe»',
    command: 'mandato: orden o prohibición fuerte (con לֹא: «no harás»)',
    preterite: 'pretérito: pasado, después de אָז, טֶרֶם o בְּטֶרֶם',
    wish: 'deseo: se pide algo que requiere el consentimiento de otro («déjame…», «que…»)',
    benediction: 'bendición: Dios como sujeto, a favor de un tercero',
    prohibition: 'prohibición: con אַל, el mandato o el deseo en negativo',
    promise: 'promesa (sólo del imperativo): asegura que el otro hará algo que no está en su poder',
    resolve: 'resolución: el hablante se decide o se compromete a hacer algo que está a su alcance («sí, lo haré»)',
    exhortation: 'exhortación: varios se animan a actuar juntos («hagamos»)',
    sequential: 'secuencial: sigue en el tiempo a la acción anterior',
    consequential: 'consecuencia: resulta de lo anterior',
    narratival: 'narrativo: abre o retoma el relato',
    epexegetical: 'epexegético: explica o detalla lo anterior',
    dependent: 'dependiente: sigue a una cláusula de tiempo',
    volitional: 'volitivo: continúa un mandato o un deseo',
    apodictic: 'apodíctico: ley o instrucción',
};
const FUNCIONES: ReadonlySet<string> = new Set(Object.keys(FUNCION_ES));
const FORMA_ES: Readonly<Record<HebrewVerbForm, string>> = {
    perfect: 'perfecto (qatal)', imperfect: 'imperfecto (yiqtol)', wayyiqtol: 'wayyiqtol', weqatal: 'weqatal',
    jussive: 'yusivo', imperative: 'imperativo', cohortative: 'cohortativo',
};

export function buildHebrewFiniteVerbTask(candidates: readonly HebrewVerbCandidate[]): string {
    if (!candidates.length) return '';
    // La lista de cada forma es la de A&C completa: una respuesta fuera de ella es un error de categoría
    // («promesa» es del imperativo; «proverbial», del perfecto), no otra lectura posible (banco 2026-11-12).
    const lineas = ruleChoiceLines(candidates, 'verbFunction', c => FORMA_ES[c.form], FUNCION_ES)
        .map(l => l.replace(/; si ninguna encaja, devuelve la que corresponda \(uno de: [^)]*\) y di por qué\.$/, '. Elige SÓLO de esta lista: son todas las funciones de esa forma.')
            .replace(/ Si el contexto lo confirma, devuelve "verbFunction": "([a-zA-Z]+)" y explícalo; si claramente es otra función, devuelve esa \(uno de: [^)]*\) y di por qué\.$/, ' Devuelve "verbFunction": "$1" y explícalo.'));
    return `
## VERBOS FINITOS: SU FUNCIÓN (campo "verbFunction" de cada verbo)
Un yiqtol de 1.ª persona puede ser COHORTATIVO por su función aunque la forma no
lo muestre (en un verbo III-he la ה- del cohortativo no se ve): si el hablante se
compromete o se decide, elige "resolve" y tradúcelo con esa fuerza («sí, lo haré»).
${lineas.join('\n')}`;
}

export type HebrewVerbView = RuleChoiceView<HebrewVerbCandidate, HebrewVerbFunction>;

export function applyHebrewFiniteVerb(candidate: HebrewVerbCandidate, choice: string | undefined): HebrewVerbView {
    return applyRuleChoice<HebrewVerbFunction, HebrewVerbCandidate>(candidate, choice, FUNCIONES);
}

/** ¿Es cohortativo por función? Un yiqtol (forma) con una función del cohortativo. */
export const isCohortativeByFunction = (v: HebrewVerbView): boolean =>
    v.candidate.form === 'imperfect' && !!v.fn && (HEBREW_VERB_FUNCTIONS.cohortative as readonly string[]).includes(v.fn);
