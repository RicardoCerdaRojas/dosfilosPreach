import type { ClauseRelation } from './verseStructure.js';
import type { GreekVerbForm, TenseUseId, VerbFunctionId, VerbRule } from './verbFunctions.js';
import type { TENSE_USES } from './verbFunctions.js';
import type { NominalRule } from './nominalFunctions.js';
import type { DiscourseRule } from './discourseFunctions.js';
import type { HebrewInfinitiveFunction } from './hebrewInfinitive.js';
import type { HebrewParticipleFunction } from './hebrewParticiple.js';
import type { HebrewKiFunction } from './hebrewKi.js';

/**
 * DE DÓNDE SALE CADA REGLA Y CADA CATEGORÍA — para que el pastor la pueda
 * citar (pedido del fundador, 2026-10-08).
 *
 * R0, honestidad de las citas (`docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md`):
 * las secciones se habían escrito DE MEMORIA y sólo 21 de 90 de Wallace
 * coincidían con un encabezado del libro («Present of Past Action Still in
 * Progress» se llama «Extending-from-Past Present»; la «waw disjunctive» de
 * Arnold y Choi apuntaba a las alternativas «o… o», no a «But Noah»). Desde
 * ahora:
 *   - cada fuente lleva un TEMA general («el participio»): es lo que se
 *     muestra mientras la sección no esté verificada;
 *   - la SECCIÓN es el encabezado tal como está impreso en la edición de
 *     `WORKS` (con el encabezado de arriba si hace falta, separados por «›»),
 *     y sólo se muestra VERIFICADA: con su página, cómo y cuándo;
 *   - una cita sin verificar nunca lleva sección ni página.
 *
 * Para agregar una fuente: la obra (con su edición) en `WORKS`, el tema, y la
 * sección con `verified` sólo después de cotejarla con el ejemplar.
 */

export type WorkId = 'wallace' | 'runge' | 'arnoldChoi' | 'professor';

export interface Work {
    readonly author: string;
    readonly title: string;
    /** El año de la EDICIÓN cotejada: las páginas son de esa edición. */
    readonly year: number;
    readonly publisher?: string;
    readonly isbn?: string;
}

export const WORKS: Readonly<Record<WorkId, Work>> = {
    wallace: { author: 'Daniel B. Wallace', title: 'Greek Grammar Beyond the Basics: An Exegetical Syntax of the New Testament', year: 1996, publisher: 'Zondervan', isbn: '978-0-310-21895-1' },
    runge: { author: 'Steven E. Runge', title: 'Discourse Grammar of the Greek New Testament', year: 2010, publisher: 'Hendrickson' },
    // 1.ª edición: la del ejemplar de la biblioteca (la 2.ª, de 2018, pagina distinto).
    arnoldChoi: { author: 'Bill T. Arnold y John H. Choi', title: 'A Guide to Biblical Hebrew Syntax', year: 2003, publisher: 'Cambridge University Press', isbn: '978-0-521-82609-9' },
    // Lo ven todos los usuarios: «profesor del fundador» no les dice nada.
    professor: { author: 'Revisión docente', title: 'Dos Filos Preach', year: 2026 },
};

/** Cómo se comprobó una sección contra el ejemplar. */
export interface Verification {
    /** Página impresa donde empieza la sección. */
    readonly page: string;
    /** `pdf`: encabezado y página leídos en el PDF del ejemplar; `person`: cotejada a mano con el libro. */
    readonly method: 'pdf' | 'person';
    /** Fecha (AAAA-MM-DD). */
    readonly on: string;
}

export interface RuleSource {
    readonly work: WorkId;
    /** El encabezado impreso (en el idioma de la obra). Sólo se muestra si está verificado. */
    readonly section: string;
    /** El tema general, en castellano: lo que se muestra sin verificación. */
    readonly topic: string;
    readonly verified?: Verification;
    /** Para `professor`: la fecha de la indicación y el versículo que la motivó. */
    readonly note?: string;
}

/** Cotejadas el 2026-10-09 con el PDF del ejemplar de la biblioteca (encabezado + página impresa). */
const PDF = (page: string): Verification => ({ page, method: 'pdf', on: '2026-10-09' });

const W = (topic: string, section: string, page?: string): RuleSource => ({ work: 'wallace', section, topic, ...(page ? { verified: PDF(page) } : {}) });
const R = (topic: string, section: string): RuleSource => ({ work: 'runge', section, topic });
const AC = (topic: string, section: string, page?: string): RuleSource => ({ work: 'arnoldChoi', section, topic, ...(page ? { verified: PDF(page) } : {}) });
const P = (note: string): RuleSource => ({ work: 'professor', section: 'Indicación del profesor', topic: 'indicación docente', note });

// Temas generales (lo que se ve sin verificación).
const PART = 'el participio', INF = 'el infinitivo', SUBJ = 'el subjuntivo', OPT = 'el optativo', IMPV = 'el imperativo';
const COND = 'las oraciones condicionales', CONECT = 'los conectores', ENFASIS = 'el énfasis y el foco';
const PRES = 'el presente', IMPF = 'el imperfecto', AOR = 'el aoristo', FUT = 'el futuro', PERF = 'el perfecto', PLUP = 'el pluscuamperfecto';

// Wallace: los encabezados como están impresos (1996).
const ADV = 'Adverbial (or Circumstantial) › ';
const wPart = {
    adjectival: W(PART, 'Adjectival Participles › Adjectival Proper (Dependent)', '617'),
    predicate: W(PART, 'Adjectival Proper (Dependent) › Predicate Participles', '618'),
    substantival: W(PART, 'Adjectival Participles › Substantival (Independent)', '619'),
    temporal: W(PART, ADV + 'Temporal', '623'), manner: W(PART, ADV + 'Manner', '627'), means: W(PART, ADV + 'Means', '628'),
    cause: W(PART, ADV + 'Cause', '631'), condition: W(PART, ADV + 'Condition', '632'), concession: W(PART, ADV + 'Concession', '634'),
    purpose: W(PART, ADV + 'Purpose (Telic)', '635'), result: W(PART, ADV + 'Result', '637'),
    attendant: W(PART, 'Dependent Verbal Participles › Attendant Circumstance', '640'),
    complementary: W(PART, 'Dependent Verbal Participles › Complementary', '646'),
    periphrastic: W(PART, 'Dependent Verbal Participles › Periphrastic', '647'),
    redundant: W(PART, 'Dependent Verbal Participles › Redundant (a.k.a. Pleonastic)', '649'),
    genitiveAbsolute: W(PART, 'The Participle Absolute › Genitive Absolute', '654'),
};
const wInf = {
    purpose: W(INF, 'Adverbial Uses › Purpose', '590'), result: W(INF, 'Adverbial Uses › Result', '592'), time: W(INF, 'Adverbial Uses › Time', '594'),
    antecedent: W(INF, 'Time › Antecedent (μετὰ τό + infinitive)', '594'), contemporaneous: W(INF, 'Time › Contemporaneous (ἐν τῷ + infinitive)', '595'),
    subsequent: W(INF, 'Time › Subsequent (πρὸ τοῦ, πρίν, or πρὶν ἤ + infinitive)', '596'), cause: W(INF, 'Adverbial Uses › Cause', '596'),
    complementary: W(INF, 'Adverbial Uses › Complementary (Supplementary)', '598'), substantival: W(INF, 'Substantival Uses', '600'),
    subject: W(INF, 'Substantival Uses › Subject', '600'), directObject: W(INF, 'Substantival Uses › Direct Object', '601'),
    indirectDiscourse: W(INF, 'Substantival Uses › Indirect Discourse', '603'), epexegetical: W(INF, 'Substantival Uses › Epexegetical', '607'),
    imperatival: W(INF, 'Independent Uses › Imperatival', '608'), absolute: W(INF, 'Independent Uses › Absolute', '608'),
    means: W(INF, 'Adverbial Uses › Means (ἐν τῷ + infinitive)', '597'),
    // τοῦ + infinitivo: Wallace lo trae como pista estructural del propósito (no hay una sección propia;
    // la de p. 610 es una lista resumen sin tratamiento — revisión de R0).
    purposeClues: W(INF, 'Adverbial Uses › Purpose › Structural Clues', '591'),
};
const wSubj = {
    hortatory: W(SUBJ, 'Hortatory Subjunctive (a.k.a. Volitive)', '464'), deliberative: W(SUBJ, 'Deliberative Subjunctive (a.k.a. Dubitative)', '465'),
    emphaticNegation: W(SUBJ, 'Emphatic Negation Subjunctive', '468'), prohibitive: W(SUBJ, 'Prohibitive Subjunctive', '469'),
    // La sección general: Wallace da siete usos de ἵνα (p. 471); la regla cubre cualquier ἵνα/ὅπως.
    conditional: W(SUBJ, 'Subjunctive in Conditional Sentences', '469'), ina: W(SUBJ, 'Dependent Clauses › ἵνα + the Subjunctive', '471'),
    fearing: W(SUBJ, 'Subjunctive with Verbs of Fearing, Etc.', '477'), indefiniteRelative: W(SUBJ, 'Subjunctive in Indefinite Relative Clause', '478'),
    indefiniteTemporal: W(SUBJ, 'Subjunctive in Indefinite Temporal Clause', '479'),
};
const wMood = {
    voluntative: W(OPT, 'Voluntative Optative', '481'), oblique: W(OPT, 'Oblique Optative', '483'), potential: W(OPT, 'Potential Optative', '483'),
    command: W(IMPV, 'The Imperative Mood › Command', '485'), prohibition: W(IMPV, 'The Imperative Mood › Prohibition', '487'),
    request: W(IMPV, 'The Imperative Mood › Request (a.k.a. Entreaty, Polite Command)', '487'),
    permissive: W(IMPV, 'The Imperative Mood › Permissive Imperative (Imperative of Toleration)', '488'),
    conditional: W(IMPV, 'The Imperative Mood › Conditional Imperative', '489'),
};

/** Las reglas que DECIDEN algo en el código (verbos, G2). */
export const VERB_RULE_SOURCES: Readonly<Record<VerbRule, readonly RuleSource[]>> = {
    articular: [wPart.adjectival, wPart.substantival],
    periphrastic: [wPart.periphrastic],
    genitiveAbsolute: [wPart.genitiveAbsolute],
    eisTo: [wInf.purpose, wInf.result],
    prosTo: [wInf.purpose],
    enToi: [wInf.contemporaneous],
    metaTo: [wInf.antecedent],
    proTou: [wInf.subsequent],
    diaTo: [wInf.cause],
    tou: [wInf.purposeClues],
    articularNominal: [wInf.substantival],
    afterIna: [wSubj.ina],
    conditionalEan: [wSubj.conditional, W(COND, 'Semantic Categories › Third Class Condition', '696')],
    ouMe: [wSubj.emphaticNegation],
    prohibition: [wSubj.prohibitive],
    indefinite: [wSubj.indefiniteRelative, wSubj.indefiniteTemporal],
    lest: [wSubj.fearing],
    hortatory: [wSubj.hortatory, wSubj.deliberative],
    meGenoito: [wMood.voluntative],
    presentProhibition: [wMood.prohibition],
};

/** Las CATEGORÍAS que elige el asistente: su definición se puede citar igual. */
export const VERB_FUNCTION_SOURCES: Readonly<Record<VerbFunctionId, readonly RuleSource[]>> = {
    attributive: [wPart.adjectival], substantival: [wPart.substantival], predicate: [wPart.predicate],
    temporal: [wPart.temporal], means: [wPart.means, wInf.means], manner: [wPart.manner], cause: [wPart.cause],
    condition: [wPart.condition], concession: [wPart.concession], purpose: [wPart.purpose, wInf.purpose],
    result: [wPart.result, wInf.result], attendantCircumstance: [wPart.attendant],
    complementary: [wPart.complementary, wInf.complementary], periphrastic: [wPart.periphrastic],
    genitiveAbsolute: [wPart.genitiveAbsolute], redundant: [wPart.redundant],
    time: [wInf.time], subject: [wInf.subject], directObject: [wInf.directObject],
    indirectDiscourse: [wInf.indirectDiscourse], epexegetical: [wInf.epexegetical],
    imperatival: [wInf.imperatival], absolute: [wInf.absolute],
    hortatory: [wSubj.hortatory], deliberative: [wSubj.deliberative], prohibition: [wSubj.prohibitive, wMood.prohibition],
    emphaticNegation: [wSubj.emphaticNegation], inaClause: [wSubj.ina], conditional: [wSubj.conditional, wMood.conditional],
    indefinite: [wSubj.indefiniteRelative, wSubj.indefiniteTemporal], lest: [wSubj.fearing], command: [wMood.command], request: [wMood.request],
    permissive: [wMood.permissive], volitive: [wMood.voluntative], potential: [wMood.potential], oblique: [wMood.oblique],
};

/**
 * El uso del tiempo, POR TIEMPO: «habitual» es una sección para el presente y
 * otra para el imperfecto; «gnómico», una para cada tiempo (revisión de G2:
 * un imperfecto habitual citaba «…Present»). El tipo exige cada uso de cada tiempo.
 */
export const TENSE_USE_SOURCES: { readonly [T in keyof typeof TENSE_USES]: Readonly<Record<(typeof TENSE_USES)[T][number], readonly RuleSource[]>> } = {
    P: {
        progressive: [W(PRES, 'Progressive Present (a.k.a. Descriptive Present)', '518')], customary: [W(PRES, 'Customary (Habitual or General) Present', '521'), P('2026-10-07 · Stg 2:7 βλασφημοῦσιν')],
        iterative: [W(PRES, 'Iterative Present', '520')], gnomic: [W(PRES, 'Gnomic Present', '523')], historical: [W(PRES, 'Historical Present (Dramatic Present)', '526')], futuristic: [W(PRES, 'Futuristic Present', '535')],
        conative: [W(PRES, 'Conative (Tendential, Voluntative) Present', '534')], extendingFromPast: [W(PRES, 'Extending-from-Past Present (Present of Past Action Still in Progress)', '519')],
        instantaneous: [W(PRES, 'Instantaneous Present (a.k.a. Aoristic or Punctiliar Present)', '517')],
    },
    I: {
        progressive: [W(IMPF, 'Progressive (Descriptive) Imperfect', '543')], ingressive: [W(IMPF, 'Ingressive (Inchoative, Inceptive) Imperfect', '544')], iterative: [W(IMPF, 'Iterative Imperfect', '546')],
        customary: [W(IMPF, 'Customary (Habitual or General) Imperfect', '548')], conative: [W(IMPF, 'Conative (Voluntative, Tendential) Imperfect', '550')],
    },
    A: {
        constative: [W(AOR, 'Constative (Complexive, Punctiliar, Comprehensive, Global)', '557')], ingressive: [W(AOR, 'Ingressive (Inceptive, Inchoative) Aorist', '558')],
        culminative: [W(AOR, 'Consummative (Culminative, Ecbatic, Effective) Aorist', '559')], gnomic: [W(AOR, 'Gnomic Aorist', '562')],
        epistolary: [W(AOR, 'Epistolary Aorist', '562')], proleptic: [W(AOR, 'Proleptic (Futuristic) Aorist', '563')], dramatic: [W(AOR, 'Immediate Past Aorist/Dramatic Aorist', '564')],
    },
    F: { predictive: [W(FUT, 'Predictive Future', '568')], imperatival: [W(FUT, 'Imperatival Future', '569')], deliberative: [W(FUT, 'Deliberative Future', '570')], gnomic: [W(FUT, 'Gnomic Future', '571')] },
    X: {
        intensive: [W(PERF, 'Intensive Perfect (a.k.a. Resultative Perfect)', '574')], extensive: [W(PERF, 'Extensive Perfect (a.k.a. Consummative Perfect)', '577')],
        proleptic: [W(PERF, 'Proleptic (Futuristic) Perfect', '581')], gnomic: [W(PERF, 'Gnomic Perfect', '580')],
    },
    Y: { intensive: [W(PLUP, 'Intensive Pluperfect (Resultative Pluperfect)', '584')], extensive: [W(PLUP, 'Extensive Pluperfect (Consummative Pluperfect)', '585')] },
};

/** Las fuentes de un uso del tiempo para el tiempo del verbo (código de MorphGNT). */
export function tenseUseSources(use: TenseUseId, tense: string | undefined): readonly RuleSource[] {
    const porTiempo = tense && tense in TENSE_USE_SOURCES ? (TENSE_USE_SOURCES[tense as keyof typeof TENSE_USES] as Record<string, readonly RuleSource[]>) : undefined;
    return porTiempo?.[use] ?? [];
}

/**
 * Las fuentes de una función según la forma: «propósito» es una sección para
 * el participio y otra para el infinitivo (Lc 5:17 εἰς τὸ ἰᾶσθαι citaba las dos).
 */
const TEMA_DE_FORMA: Partial<Record<GreekVerbForm | 'other', string>> = { participle: PART, infinitive: INF, subjunctive: SUBJ, imperative: IMPV, optative: OPT };
const TEMAS_DE_MODO: ReadonlySet<string> = new Set(Object.values(TEMA_DE_FORMA));
export function verbFunctionSources(id: VerbFunctionId, form?: GreekVerbForm | 'other'): readonly RuleSource[] {
    const todas = VERB_FUNCTION_SOURCES[id];
    const tema = form ? TEMA_DE_FORMA[form] : undefined;
    // Una fuente de OTRO modo no se cita: un imperativo condicional no es «Subjunctive in
    // Conditional Sentences» (revisión de R0).
    return tema ? todas.filter(s => !TEMAS_DE_MODO.has(s.topic) || s.topic === tema) : todas;
}

/** Las reglas de G4: conectores y partículas (Runge) y el pronombre explícito (#G1). */
export const DISCOURSE_RULE_SOURCES: Readonly<Record<DiscourseRule, readonly RuleSource[]>> = {
    // Runge no está en la biblioteca: sin cotejar, sólo el tema (R0).
    deDevelopment: [R(CONECT, 'Development (δέ)')], garSupport: [R(CONECT, 'Strengthening/Support (γάρ)')],
    kaiContinuity: [R(CONECT, 'Continuity (καί)')], kaiAdditive: [R(CONECT, 'Thematic Addition (adverbial καί)')], teContinuity: [R(CONECT, 'Continuity (τε)')],
    ounInference: [R(CONECT, 'Inference and Resumption (οὖν)')], inferential: [R(CONECT, 'Inferential Connectives')],
    allaAfterNegation: [R(CONECT, 'Correction (ἀλλά)')], allaCorrection: [R(CONECT, 'Correction (ἀλλά)')], menPoint: [R(CONECT, 'Point/Counterpoint Sets (μέν … δέ)')],
    idouAttention: [R(ENFASIS, 'Attention-Getters (ἰδού)')], mononRestrictive: [R(ENFASIS, 'Restrictive Focus')], intensiveParticle: [R(ENFASIS, 'Emphasis')],
    overtPronoun: [W('los pronombres personales', 'Personal Pronouns › Nominative Uses › Emphasis', '321'), R(ENFASIS, 'Emphasis'), P('2026-10-07 · Stg 2:7 αὐτοὶ βλασφημοῦσιν')],
};

/** Las reglas de G3: agencia (#G5) y artículo anafórico (#G6). */
export const NOMINAL_RULE_SOURCES: Readonly<Record<NominalRule, readonly RuleSource[]>> = {
    agentHypo: [W('la voz pasiva y el agente', 'Passive Voice › With Agency Expressed › Ultimate Agent', '433'), P('2026-10-07 · Stg 2:9 ὑπὸ τοῦ νόμου')],
    agentDia: [W('la voz pasiva y el agente', 'Passive Voice › With Agency Expressed › Intermediate Agent', '433')],
    anaphoraLemma: [W('el artículo', 'The Article › Anaphoric (Previous Reference)', '217'), P('2026-10-07 · Stg 2:9 τοῦ νόμου → νόμον, v. 8')],
    autosIntensive: [W('el pronombre αὐτός', 'Intensive Pronoun › As an Intensive Pronoun', '349')],
    autosIdentical: [W('el pronombre αὐτός', 'Intensive Pronoun › As an Identifying Adjective', '349')],
};

/** Notas de «Estructura» que salen de una regla: condicionales, conectores, orden. */
export type StructureRuleKey = 'class1' | 'class2' | 'class3' | 'class4' | 'fronted' | Extract<ClauseRelation, 'development' | 'chain' | 'conjunctive' | 'disjunctive' | 'asyndetic'>;

export const STRUCTURE_RULE_SOURCES: Readonly<Record<StructureRuleKey, readonly RuleSource[]>> = {
    class1: [W(COND, 'Semantic Categories › First Class Condition (Assumed True for Argument’s Sake)', '690'), P('2026-10-07 · Stg 2:9 εἰ δὲ προσωπολημπτεῖτε')],
    class2: [W(COND, 'Semantic Categories › Second Class Condition (Contrary to Fact)', '694')],
    class3: [W(COND, 'Semantic Categories › Third Class Condition', '696')],
    class4: [W(COND, 'Semantic Categories › Fourth Class Condition (Less Probable Future)', '699')],
    fronted: [R(ENFASIS, 'Emphasis'), R(ENFASIS, 'Frames of Reference'), P('2026-10-07 · Stg 2:9 ἁμαρτίαν ἐργάζεσθε')],
    development: [R(CONECT, 'Development (δέ)')],
    chain: [AC('la waw consecutiva', '3.5.1 Imperfect plus waw Consecutive', '84')],
    // También llega aquí el weqatal (OSHB ≠ wayyiqtol): A&C lo trata en 3.5.2 (revisión de R0).
    conjunctive: [AC('la conjunción waw', '4.3.3 ו › (b) Conjunctive', '146'), AC('la waw consecutiva', '3.5.2 Perfect plus waw Consecutive', '87')],
    // Waw + no verbo («But Noah found favor», Gn 6:8). NO es «5.2.14 Disjunctive Clause»: esa es «o… o».
    disjunctive: [AC('la conjunción waw', '4.3.3 ו › (a) Adversative', '146'), AC('la conjunción waw', '4.3.3 ו › (e) Circumstantial', '147'), AC('las cláusulas subordinadas', '5.2.11 Circumstantial Clause', '182'), P('2026-10-07 · Rut 1:14 וְרוּת')],
    asyndetic: [P('2026-10-07 · Rut 1:16 עַמֵּךְ עַמִּי')],
};

/**
 * La cita. Corta, la que se ve; completa, la que se copia (con la obra y el
 * año de la edición). VERIFICADA: «Wallace, «Adverbial (or Circumstantial) ›
 * Cause», p. 631». SIN VERIFICAR: sólo la obra y el tema, «Runge, sobre los
 * conectores» — nada que parezca una cita textual (R0).
 */
export function formatCitation(s: RuleSource, forma: 'short' | 'full' = 'short'): string {
    const w = WORKS[s.work];
    if (s.work === 'professor') return `${w.author} de ${w.title} (${s.note ?? w.year})`;
    const apellido = w.author.split(' y ').map(a => a.split(' ').slice(-1)[0]).join(' y ');
    const obra = forma === 'full' ? `${apellido}, ${w.title} (${w.year})` : apellido;
    if (!s.verified) return `${obra}, sobre ${s.topic}`;
    return `${obra}, «${s.section}», p. ${s.verified.page}`;
}

/** ¿Se puede citar con sección y página? (La indicación docente es registro propio.) */
export const isVerified = (s: RuleSource): boolean => s.work === 'professor' || !!s.verified;

/**
 * R4 — las funciones del infinitivo hebreo, en Arnold y Choi (2003): §3.4.1
 * (constructo), §3.4.2 (absoluto) y, para בְּ y לְמַעַן, §4.1.5 y §4.1.11.
 * Páginas tomadas de la capa del ejemplar (R1) y cotejadas como en R0.
 */
const INFH = 'el infinitivo hebreo';
const IC = '3.4.1 Infinitive Construct › ';
const IA = '3.4.2 Infinitive Absolute › ';
export const HEBREW_INFINITIVE_SOURCES: Readonly<Record<HebrewInfinitiveFunction, readonly RuleSource[]>> = {
    subject: [AC(INFH, IC + '(a) Nominal', '68'), AC(INFH, IA + '(a) Nominal', '74')],
    genitive: [AC(INFH, IC + '(a) Nominal', '68'), AC(INFH, IA + '(a) Nominal', '74')],
    object: [AC(INFH, IC + '(a) Nominal', '68'), AC(INFH, IA + '(a) Nominal', '74')],
    temporalWhile: [AC(INFH, IC + '(b.1) The preposition בְּ plus the infinitive', '69'), AC(INFH, '4.1.5 בְּ › (b) Temporal', '103')],
    temporalAsSoonAs: [AC(INFH, IC + '(b.2) The preposition כְּ plus the infinitive', '69')],
    temporalUntil: [AC(INFH, IC + '(b.3) The preposition עַד plus the infinitive', '70')],
    temporalAfter: [AC(INFH, IC + '(b.4) The preposition אַחֲרֵי plus the infinitive', '70')],
    // כְּ + infinitivo también compara («like»): §4.1.9 (a). Revisión de R4.
    comparative: [AC(INFH, '4.1.9 כְּ › (a) Agreement', '109')],
    causal: [AC(INFH, '4.1.5 בְּ › (f) Causal', '105')],
    instrumental: [AC(INFH, '4.1.5 בְּ › (c) Instrumental', '104')],
    purpose: [AC(INFH, IC + '(c) Purpose', '71'), AC(INFH, '4.1.11 לְמַעַן › (a) Purpose', '115')],
    result: [AC(INFH, IC + '(d) Result', '71')],
    obligation: [AC(INFH, IC + '(e) Obligation', '71')],
    imminence: [AC(INFH, IC + '(f) Imminence', '72')],
    specification: [AC(INFH, IC + '(g) Specification', '72')],
    emphatic: [AC(INFH, IA + '(b) Emphatic', '74')],
    manner: [AC(INFH, IA + '(c) Manner', '76')],
    verbalSubstitute: [AC(INFH, IA + '(d) Verbal substitute', '77')],
};

const PTCH = 'el participio hebreo';
const PT = '3.4.3 Participle › ';
export const HEBREW_PARTICIPLE_SOURCES: Readonly<Record<HebrewParticipleFunction, readonly RuleSource[]>> = {
    attributive: [AC(PTCH, PT + '(a) Attributive', '78')],
    predicatePresent: [AC(PTCH, PT + '(b.1) Present', '79')],
    predicatePast: [AC(PTCH, PT + '(b.2) Past', '80')],
    predicateFuture: [AC(PTCH, PT + '(b.3) Future', '81')],
    substantive: [AC(PTCH, PT + '(c) Substantive', '82')],
};

const KIH = 'la partícula כִּי';
const KI = '4.3.4 כִּי › ';
export const HEBREW_KI_SOURCES: Readonly<Record<HebrewKiFunction, readonly RuleSource[]>> = {
    causal: [AC(KIH, KI + '(a) Causal', '149')],
    evidential: [AC(KIH, KI + '(b) Evidential', '149')],
    clarification: [AC(KIH, KI + '(c) Clarification', '150')],
    result: [AC(KIH, KI + '(d) Result', '150')],
    temporal: [AC(KIH, KI + '(e) Temporal', '151')],
    conditional: [AC(KIH, KI + '(f) Conditional', '151')],
    adversative: [AC(KIH, KI + '(g) Adversative', '152')],
    concessive: [AC(KIH, KI + '(h) Concessive', '152')],
    asseverative: [AC(KIH, KI + '(i) Asseverative', '153')],
    perceptual: [AC(KIH, KI + '(j) Perceptual', '154')],
    subject: [AC(KIH, KI + '(k) Subject', '154')],
    recitative: [AC(KIH, KI + '(l) Recitative', '154')],
    exceptive: [AC(KIH, KI + '(m) Exceptive', '155')],
    interrogative: [AC(KIH, KI + '(n) Interrogative', '155')],
};

/** Las fuentes de una función según la forma: «Nominal» es una sección para el constructo y otra para el absoluto. */
export function hebrewInfinitiveSources(fn: HebrewInfinitiveFunction, form: 'construct' | 'absolute'): readonly RuleSource[] {
    const todas = HEBREW_INFINITIVE_SOURCES[fn];
    const propias = todas.filter(x => !x.section.startsWith(form === 'construct' ? IA : IC));
    return propias.length ? propias : todas;
}
