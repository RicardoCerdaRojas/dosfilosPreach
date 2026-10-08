import { clausesOfVerse, verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import { verseStructure, type StructureNode } from './verseStructure.js';

/**
 * G2 — LA FUNCIÓN DE CADA VERBO GRIEGO (Wallace, *Greek Grammar Beyond the
 * Basics*), en listas CERRADAS como las de los casos.
 *
 * Quién decide qué (lección de H1-H3 y G1: el asistente sin razonamiento no
 * compara bien; lo que se puede decidir con el dato, se decide en el código):
 *   - REGLA: lo que la forma y la sintaxis fijan (infinitivo con preposición
 *     y artículo, perifrástico, genitivo absoluto, subjuntivo tras ἵνα o en
 *     una condición con ἐάν, οὐ μή, μή + aoristo, μὴ γένοιτο).
 *   - LISTA: lo que el dato acota pero no decide (un participio con artículo
 *     sólo puede ser adjetival o sustantival; el uso de un presente
 *     indicativo, progresivo o habitual…). El asistente elige DE la lista.
 */

export const PARTICIPLE_FUNCTIONS = [
    'attributive', 'substantival', 'predicate',
    'temporal', 'means', 'manner', 'cause', 'condition', 'concession', 'purpose', 'result',
    'attendantCircumstance', 'complementary', 'periphrastic', 'genitiveAbsolute', 'redundant',
] as const;
export const INFINITIVE_FUNCTIONS = [
    'purpose', 'result', 'time', 'cause', 'means', 'complementary',
    'subject', 'directObject', 'indirectDiscourse', 'epexegetical', 'imperatival', 'absolute',
] as const;
export const SUBJUNCTIVE_FUNCTIONS = [
    'hortatory', 'deliberative', 'prohibition', 'emphaticNegation', 'inaClause', 'conditional', 'indefinite',
] as const;
export const IMPERATIVE_FUNCTIONS = ['command', 'prohibition', 'request', 'permissive', 'conditional'] as const;
export const OPTATIVE_FUNCTIONS = ['volitive', 'potential', 'oblique'] as const;

/** Usos del tiempo en el INDICATIVO, por tiempo (código de MorphGNT). */
export const TENSE_USES = {
    P: ['progressive', 'customary', 'iterative', 'gnomic', 'historical', 'futuristic', 'conative', 'extendingFromPast', 'instantaneous'],
    I: ['progressive', 'ingressive', 'iterative', 'customary', 'conative'],
    A: ['constative', 'ingressive', 'culminative', 'gnomic', 'epistolary', 'proleptic', 'dramatic'],
    F: ['predictive', 'imperatival', 'deliberative', 'gnomic'],
    X: ['intensive', 'extensive', 'proleptic', 'gnomic'],
    Y: ['intensive', 'extensive'],
} as const satisfies Record<string, readonly string[]>;

export type GreekVerbForm = 'participle' | 'infinitive' | 'subjunctive' | 'imperative' | 'optative' | 'indicative';
export type VerbFunctionId =
    | (typeof PARTICIPLE_FUNCTIONS)[number]
    | (typeof INFINITIVE_FUNCTIONS)[number]
    | (typeof SUBJUNCTIVE_FUNCTIONS)[number]
    | (typeof IMPERATIVE_FUNCTIONS)[number]
    | (typeof OPTATIVE_FUNCTIONS)[number];
export type TenseUseId = (typeof TENSE_USES)[keyof typeof TENSE_USES][number];

/** Por qué la regla decidió o acotó: se muestra («εἰς τό + infinitivo»). */
export type VerbRule =
    | 'articular' | 'periphrastic' | 'genitiveAbsolute'
    | 'eisTo' | 'prosTo' | 'enToi' | 'metaTo' | 'proTou' | 'diaTo' | 'tou' | 'articularNominal'
    | 'afterIna' | 'conditionalEan' | 'ouMe' | 'prohibition' | 'indefinite' | 'hortatory' | 'meGenoito' | 'presentProhibition';

export interface VerbCandidate {
    /** Posición en el versículo (0 = primera palabra). */
    readonly ordinal: number;
    readonly form: GreekVerbForm;
    /** Funciones posibles (vacío en el indicativo: su modo no tiene «función»). */
    readonly allowed: readonly VerbFunctionId[];
    /** Decidida por regla: el asistente sólo la explica. */
    readonly decided?: VerbFunctionId;
    readonly rule?: VerbRule;
    /** Usos del tiempo posibles (sólo indicativo). */
    readonly tenseUses: readonly TenseUseId[];
}

const MODO: Record<string, GreekVerbForm> = { P: 'participle', N: 'infinitive', S: 'subjunctive', D: 'imperative', O: 'optative', I: 'indicative' };
const modo = (w: StructureWord | undefined) => (w?.pos?.startsWith('V') ? w.parse?.[3] ?? '' : '');
const caso = (w: StructureWord | undefined) => w?.parse?.[4] ?? '';
const concuerda = (a: StructureWord, b: StructureWord) => !!a.parse && !!b.parse && a.parse.slice(4, 7) === b.parse.slice(4, 7);
const esArticulo = (w: StructureWord | undefined) => w?.pos === 'RA';

/** Infinitivo articular con preposición (Wallace, «infinitivo con preposición»). */
const PREPOSICION_INFINITIVO: Record<string, { rule: VerbRule; allowed: readonly VerbFunctionId[] }> = {
    'εἰς': { rule: 'eisTo', allowed: ['purpose', 'result'] },
    'πρός': { rule: 'prosTo', allowed: ['purpose'] },
    'ἐν': { rule: 'enToi', allowed: ['time'] },
    'μετά': { rule: 'metaTo', allowed: ['time'] },
    'πρό': { rule: 'proTou', allowed: ['time'] },
    'διά': { rule: 'diaTo', allowed: ['cause'] },
};

const decidir = (allowed: readonly VerbFunctionId[], rule: VerbRule) =>
    allowed.length === 1 ? { allowed, decided: allowed[0]!, rule } : { allowed, rule };

export function greekVerbCandidates(ch: ChapterStructure, verse: number): VerbCandidate[] {
    if (ch.lang !== 'gr') return [];
    const ws = verseWords(ch, verse);
    const filas = verseStructure(ch, verse);
    const clausulas = clausesOfVerse(ch, verse);
    /** La cláusula MACULA más profunda que contiene la palabra. */
    const indiceDe = (r: string): number | undefined => {
        let mejor: { index: number; depth: number } | undefined;
        for (const c of clausulas) if (c.words.includes(r) && (!mejor || c.depth >= mejor.depth)) mejor = c;
        return mejor?.index;
    };
    const clausulaDe = (r: string) => {
        const i = indiceDe(r);
        return i === undefined ? [] : ch.clauses[i]!.w;
    };
    /**
     * Las palabras de las cláusulas que CONTIENEN a la del verbo (madre, abuela…).
     * MACULA deja ἵνα, ἐάν, ἕως ἄν o el artículo en una cláusula envoltorio:
     * «ἵνα πᾶς … μὴ ἀπόληται ἀλλ’ ἔχῃ» (Jn 3:16) — ἔχῃ está bajo el ἵνα.
     */
    const ancestros = (r: string): StructureWord[][] => {
        const out: StructureWord[][] = [];
        let p = indiceDe(r) !== undefined ? ch.clauses[indiceDe(r)!]!.p : null;
        while (p !== null && p !== undefined) {
            out.push(ch.clauses[p]!.w.map(x => porRefCap.get(x)).filter((x): x is StructureWord => !!x));
            p = ch.clauses[p]!.p;
        }
        return out;
    };
    const porRefCap = new Map(ch.words.map(w => [w.r, w]));
    const filaDe = (r: string): StructureNode | undefined => filas.find(f => f.words.some(t => t.r === r));
    const porRef = new Map(ws.map(w => [w.r, w]));
    const out: VerbCandidate[] = [];

    ws.forEach((w, i) => {
        const m = modo(w);
        const form = MODO[m];
        if (!form) return;
        const tiempo = w.parse?.[1] ?? '';
        const tenseUses = form === 'indicative' ? [...(TENSE_USES[tiempo as keyof typeof TENSE_USES] ?? [])] : [];
        const antes = ws[i - 1];
        const antes2 = ws[i - 2];
        const enClausula = clausulaDe(w.r).map(r => porRef.get(r)).filter((x): x is StructureWord => !!x);
        let r: Pick<VerbCandidate, 'allowed' | 'decided' | 'rule'> = { allowed: [] };

        const arriba = ancestros(w.r);
        /** El conector de una cláusula que contiene al verbo (la propia o una madre). */
        const bajo = (lemas: readonly string[]) => [enClausula, ...arriba].some(c => c.some(x => !x.role && lemas.includes(x.l)));

        if (form === 'participle') {
            // El artículo ANTES del participio, en su cláusula o en la madre
            // (MACULA lo envuelve: «ὁ | πιστεύων»; «ὁ ὀπίσω μου ἐρχόμενος»),
            // sin un sustantivo entre medio que se lo lleve: «στραφεὶς δὲ ὁ
            // Ἰησοῦς» (Jn 1:38) NO es articular.
            const pos = (x: StructureWord) => ws.indexOf(x);
            const previos = [...enClausula, ...(arriba[0] ?? [])].filter(x => pos(x) >= 0 && pos(x) < i).sort((a, b) => pos(b) - pos(a));
            const art = previos.find(x => esArticulo(x) && concuerda(x, w));
            const articular = !!art && !ws.slice(pos(art) + 1, i).some(x => /^(N|RP|RD)/.test(x.pos ?? '') && concuerda(x, art));
            const eimi = enClausula.some(x => x !== w && x.l === 'εἰμί' && ['I', 'S', 'O', 'D'].includes(modo(x)));
            const sujetoGenitivo = enClausula.some(x => x !== w && x.role === 's' && caso(x) === 'G');
            if (articular) r = { allowed: ['attributive', 'substantival'], rule: 'articular' };
            else if (eimi) r = { allowed: ['periphrastic'], decided: 'periphrastic', rule: 'periphrastic' };
            else if (caso(w) === 'G' && sujetoGenitivo) r = { allowed: ['genitiveAbsolute'], decided: 'genitiveAbsolute', rule: 'genitiveAbsolute' };
            else r = { allowed: PARTICIPLE_FUNCTIONS.filter(f => !['attributive', 'substantival', 'periphrastic', 'genitiveAbsolute'].includes(f)) };
        } else if (form === 'infinitive') {
            const prep = antes2?.pos === 'P-' && esArticulo(antes) ? PREPOSICION_INFINITIVO[antes2.l] : undefined;
            if (prep) r = decidir(prep.allowed, prep.rule);
            else if (esArticulo(antes) && antes!.l === 'ὁ' && caso(antes) === 'G') r = { allowed: ['purpose', 'result', 'epexegetical', 'complementary'], rule: 'tou' };
            else if (esArticulo(antes)) r = { allowed: ['subject', 'directObject', 'epexegetical'], rule: 'articularNominal' };
            else r = { allowed: INFINITIVE_FUNCTIONS.filter(f => !['time', 'cause'].includes(f)) };
        } else if (form === 'subjunctive') {
            const fila = filaDe(w.r);
            const persona = w.parse?.[0] ?? '';
            const plural = w.parse?.[5] === 'P';
            const madre = arriba[0] ?? [];
            const conAn = [...enClausula, ...madre].some(x => x.l === 'ἄν') || ['ὅταν', 'ἕως'].includes(madre[0]?.l ?? '');

            if (antes?.l === 'μή' && antes2?.l === 'οὐ') r = { allowed: ['emphaticNegation'], decided: 'emphaticNegation', rule: 'ouMe' };
            else if (bajo(['ἵνα', 'ὅπως'])) r = { allowed: ['inaClause'], decided: 'inaClause', rule: 'afterIna' };
            else if (bajo(['ἐάν']) || fila?.relation === 'condition') r = { allowed: ['conditional'], decided: 'conditional', rule: 'conditionalEan' };
            else if (enClausula.some(x => x.l === 'μή') && tiempo === 'A' && persona === '2') r = { allowed: ['prohibition'], decided: 'prohibition', rule: 'prohibition' };
            else if (conAn || ['ὅταν', 'ἕως'].includes(enClausula[0]?.l ?? '')) r = { allowed: ['indefinite'], decided: 'indefinite', rule: 'indefinite' };
            else if (persona === '1' && plural) r = { allowed: ['hortatory', 'deliberative'], rule: 'hortatory' };
            else r = { allowed: ['hortatory', 'deliberative', 'prohibition', 'indefinite'] };
        } else if (form === 'imperative') {
            const conMe = enClausula.some(x => x.l === 'μή');
            r = conMe ? { allowed: ['prohibition'], decided: 'prohibition', rule: 'presentProhibition' } : { allowed: IMPERATIVE_FUNCTIONS.filter(f => f !== 'prohibition') };
        } else if (form === 'optative') {
            r = w.l === 'γίνομαι' && antes?.l === 'μή' ? { allowed: ['volitive'], decided: 'volitive', rule: 'meGenoito' } : { allowed: [...OPTATIVE_FUNCTIONS] };
        }
        out.push({ ordinal: i, form, tenseUses, ...r });
    });
    return out;
}

// ── Para el prompt: qué significa cada id (Wallace), en español ─────────────

const FUNCION_ES: Record<VerbFunctionId, string> = {
    attributive: 'adjetival atributivo (modifica a un sustantivo)', substantival: 'sustantival (funciona como sustantivo: «el que cree»)',
    predicate: 'predicativo', temporal: 'adverbial temporal («cuando/mientras/después de»)', means: 'adverbial de medio («mediante»)',
    manner: 'adverbial de modo («de manera que»)', cause: 'causal («porque»)', condition: 'condicional («si»)', concession: 'concesivo («aunque»)',
    purpose: 'de propósito («para»)', result: 'de resultado («de modo que»)', attendantCircumstance: 'circunstancia concomitante (acción coordinada con el verbo principal, se traduce como otro verbo)',
    complementary: 'complementario (completa a otro verbo)', periphrastic: 'perifrástico (εἰμί + participio = un solo tiempo verbal)',
    genitiveAbsolute: 'genitivo absoluto (cláusula circunstancial con su propio sujeto)', redundant: 'redundante o pleonástico («respondiendo dijo»)',
    time: 'temporal', subject: 'sujeto', directObject: 'objeto directo', indirectDiscourse: 'discurso indirecto', epexegetical: 'epexegético (explica a un sustantivo o adjetivo)',
    imperatival: 'imperativo (equivale a un mandato)', absolute: 'absoluto (saludo epistolar: χαίρειν)',
    hortatory: 'exhortativo («hagamos»)', deliberative: 'deliberativo (pregunta real o retórica: «¿qué haremos?»)', prohibition: 'prohibición',
    emphaticNegation: 'negación enfática (οὐ μή: «de ningún modo»)', inaClause: 'subjuntivo tras ἵνα/ὅπως', conditional: 'condicional (ἐάν)',
    indefinite: 'indefinido (con ἄν: relativo o temporal indefinido)', command: 'mandato', request: 'ruego o petición (a un superior)',
    permissive: 'permisivo («que sea así»)', volitive: 'volitivo (deseo: «ojalá»)', potential: 'potencial (con ἄν)', oblique: 'oblicuo (discurso indirecto)',
};

const USO_ES: Record<TenseUseId, string> = {
    progressive: 'progresivo (acción en curso)', customary: 'habitual («suele», acción repetida como costumbre)', iterative: 'iterativo (acción repetida)',
    gnomic: 'gnómico (verdad general, atemporal)', historical: 'histórico (presente que narra el pasado)', futuristic: 'futurístico (presente por un hecho futuro)',
    conative: 'conativo (intento: «procuran»)', extendingFromPast: 'que se extiende desde el pasado («he estado…»)', instantaneous: 'instantáneo (se cumple al decirlo)',
    ingressive: 'ingresivo (el comienzo de la acción)', constative: 'constativo (la acción vista en conjunto)', culminative: 'culminativo (el resultado final)',
    epistolary: 'epistolar (el autor se sitúa en el tiempo del lector)', proleptic: 'proléptico (lo futuro dado por hecho)', dramatic: 'dramático (algo recién ocurrido)',
    predictive: 'predictivo', imperatival: 'imperativo', deliberative: 'deliberativo',
    intensive: 'intensivo (destaca el estado resultante)', extensive: 'extensivo (destaca la acción cumplida)',
};

const FORMA_ES: Record<GreekVerbForm, string> = {
    participle: 'participio', infinitive: 'infinitivo', subjunctive: 'subjuntivo', imperative: 'imperativo', optative: 'optativo', indicative: 'indicativo',
};

const REGLA_ES: Record<VerbRule, string> = {
    articular: 'lleva artículo', periphrastic: 'εἰμί + participio en la misma cláusula', genitiveAbsolute: 'participio en genitivo con sujeto propio en genitivo',
    eisTo: 'εἰς τό + infinitivo', prosTo: 'πρὸς τό + infinitivo', enToi: 'ἐν τῷ + infinitivo (simultáneo)', metaTo: 'μετὰ τό + infinitivo (anterior)',
    proTou: 'πρὸ τοῦ + infinitivo (posterior)', diaTo: 'διὰ τό + infinitivo', tou: 'τοῦ + infinitivo', articularNominal: 'infinitivo con artículo',
    afterIna: 'dentro de una cláusula con ἵνα/ὅπως', conditionalEan: 'prótasis con ἐάν', ouMe: 'οὐ μή + subjuntivo', prohibition: 'μή + subjuntivo aoristo',
    indefinite: 'con ἄν (relativo o temporal indefinido)', hortatory: '1.ª persona plural', meGenoito: 'μὴ γένοιτο', presentProhibition: 'μή + imperativo',
};

/** El tramo del prompt con la tarea de los verbos. Vacío si no hay verbos. */
export function buildVerbFunctionTask(candidates: readonly VerbCandidate[], words: readonly string[]): string {
    if (!candidates.length) return '';
    const lineas = candidates.map(c => {
        const partes = [`${c.ordinal}. ${words[c.ordinal] ?? ''} — ${FORMA_ES[c.form]}`];
        if (c.decided) partes.push(`FUNCIÓN YA DECIDIDA por regla (${REGLA_ES[c.rule!]}): "${c.decided}" = ${FUNCION_ES[c.decided]}; sólo explícala en "verbNote"`);
        else if (c.allowed.length) partes.push(`"verbFunction", elige de: ${c.allowed.map(f => `"${f}" (${FUNCION_ES[f]})`).join('; ')}${c.rule ? ` [acotado porque ${REGLA_ES[c.rule]}]` : ''}`);
        if (c.tenseUses.length) partes.push(`"tenseUse", elige de: ${c.tenseUses.map(u => `"${u}" (${USO_ES[u]})`).join('; ')}`);
        return partes.join(' — ');
    });
    return `
Y para cada VERBO de la lista de abajo (por su POSICIÓN, empezando en 0), su
función según Wallace: "verbFunction" (participios, infinitivos, subjuntivos,
imperativos, optativos) y "tenseUse" (indicativos), ELIGIENDO el id EXACTO de
las opciones de esa palabra —no inventes etiquetas, devuelve "" si ninguna
encaja—, y "verbNote": UNA frase que diga por qué, apoyada en la forma y el
contexto (no repitas la morfología). Donde dice FUNCIÓN YA DECIDIDA, no la
cambies: explícala.

VERBOS:
${lineas.join('\n')}`;
}

/** Valida lo que devolvió el asistente para un verbo contra su candidato. */
export function readVerbFunction(raw: Record<string, unknown>, c: VerbCandidate | undefined): {
    verbFunction?: VerbFunctionId; verbRule?: VerbRule; tenseUse?: TenseUseId; verbNote?: string;
} {
    if (!c) return {};
    const fn = typeof raw.verbFunction === 'string' ? raw.verbFunction.trim() : '';
    const uso = typeof raw.tenseUse === 'string' ? raw.tenseUse.trim() : '';
    const nota = typeof raw.verbNote === 'string' ? raw.verbNote.trim().slice(0, 400) : '';
    const verbFunction = c.decided ?? (c.allowed.includes(fn as VerbFunctionId) ? (fn as VerbFunctionId) : undefined);
    const tenseUse = c.tenseUses.includes(uso as TenseUseId) ? (uso as TenseUseId) : undefined;
    return {
        ...(verbFunction ? { verbFunction } : {}),
        ...(c.decided && c.rule ? { verbRule: c.rule } : {}),
        ...(tenseUse ? { tenseUse } : {}),
        ...(nota && (verbFunction || tenseUse) ? { verbNote: nota } : {}),
    };
}
