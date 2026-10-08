import type { ClauseRelation } from './verseStructure.js';
import type { TenseUseId, VerbFunctionId, VerbRule } from './verbFunctions.js';
import type { NominalRule } from './nominalFunctions.js';

/**
 * DE DÓNDE SALE CADA REGLA Y CADA CATEGORÍA — para que el pastor la pueda
 * citar (pedido del fundador, 2026-10-08).
 *
 * Un registro, no comentarios sueltos: cada regla del código y cada categoría
 * de las listas cerradas lleva su fuente (obra + sección) y, cuando está
 * VERIFICADA contra el libro, la página. Una página sin verificar NO se
 * muestra: una cita equivocada que el pastor repite en clase es peor que una
 * cita sin página.
 *
 * Para agregar una fuente: la obra en `WORKS`, la sección en la regla o
 * categoría, y `pages` sólo con el libro en la mano.
 */

export type WorkId = 'wallace' | 'runge' | 'arnoldChoi' | 'professor';

export interface Work {
    readonly author: string;
    readonly title: string;
    readonly year: number;
    readonly publisher?: string;
}

export const WORKS: Readonly<Record<WorkId, Work>> = {
    wallace: { author: 'Daniel B. Wallace', title: 'Greek Grammar Beyond the Basics: An Exegetical Syntax of the New Testament', year: 1996, publisher: 'Zondervan' },
    runge: { author: 'Steven E. Runge', title: 'Discourse Grammar of the Greek New Testament', year: 2010, publisher: 'Hendrickson' },
    arnoldChoi: { author: 'Bill T. Arnold y John H. Choi', title: 'A Guide to Biblical Hebrew Syntax', year: 2018, publisher: 'Cambridge University Press' },
    // Lo ven todos los usuarios: «profesor del fundador» no les dice nada.
    professor: { author: 'Revisión docente', title: 'Dos Filos Preach', year: 2026 },
};

export interface RuleSource {
    readonly work: WorkId;
    /** La sección tal como se llama en la obra (en su idioma): así se encuentra. */
    readonly section: string;
    /** Sólo verificada contra el libro; sin ella la cita no lleva página. */
    readonly pages?: string;
    /** Para `professor`: la fecha de la indicación y el versículo que la motivó. */
    readonly note?: string;
}

const W = (section: string, pages?: string): RuleSource => ({ work: 'wallace', section, ...(pages ? { pages } : {}) });
const R = (section: string, pages?: string): RuleSource => ({ work: 'runge', section, ...(pages ? { pages } : {}) });
const AC = (section: string, pages?: string): RuleSource => ({ work: 'arnoldChoi', section, ...(pages ? { pages } : {}) });
const P = (note: string): RuleSource => ({ work: 'professor', section: 'Indicación del profesor', note });

/** Las reglas que DECIDEN algo en el código (verbos, G2). */
export const VERB_RULE_SOURCES: Readonly<Record<VerbRule, readonly RuleSource[]>> = {
    articular: [W('The Adjectival Participle'), W('The Substantival Participle')],
    periphrastic: [W('Periphrastic Participle')],
    genitiveAbsolute: [W('Genitive Absolute Participle')],
    eisTo: [W('Infinitive of Purpose'), W('Infinitive of Result')],
    prosTo: [W('Infinitive of Purpose')],
    enToi: [W('Temporal Infinitive (contemporaneous time)')],
    metaTo: [W('Temporal Infinitive (antecedent time)')],
    proTou: [W('Temporal Infinitive (subsequent time)')],
    diaTo: [W('Causal Infinitive')],
    tou: [W('The Articular Infinitive')],
    articularNominal: [W('Substantival Uses of the Infinitive')],
    afterIna: [W('Subjunctive in Purpose Clauses')],
    conditionalEan: [W('Subjunctive in Conditional Sentences'), W('Third Class Condition')],
    ouMe: [W('Emphatic Negation Subjunctive')],
    prohibition: [W('Prohibitive Subjunctive')],
    indefinite: [W('Subjunctive in Indefinite Relative Clause'), W('Subjunctive in Indefinite Temporal Clause')],
    hortatory: [W('Hortatory Subjunctive'), W('Deliberative Subjunctive')],
    meGenoito: [W('Voluntative Optative')],
    presentProhibition: [W('Imperative of Prohibition')],
};

/** Las CATEGORÍAS que elige el asistente: su definición se puede citar igual. */
export const VERB_FUNCTION_SOURCES: Readonly<Record<VerbFunctionId, readonly RuleSource[]>> = {
    attributive: [W('Adjectival Participle (attributive)')], substantival: [W('The Substantival Participle')], predicate: [W('Adjectival Participle (predicate)')],
    temporal: [W('Temporal Participle')], means: [W('Participle of Means')], manner: [W('Participle of Manner')], cause: [W('Causal Participle')],
    condition: [W('Conditional Participle')], concession: [W('Concessive Participle')], purpose: [W('Participle of Purpose'), W('Infinitive of Purpose')],
    result: [W('Participle of Result'), W('Infinitive of Result')], attendantCircumstance: [W('Attendant Circumstance Participle')],
    complementary: [W('Complementary Participle'), W('Complementary Infinitive')], periphrastic: [W('Periphrastic Participle')],
    genitiveAbsolute: [W('Genitive Absolute Participle')], redundant: [W('Redundant (Pleonastic) Participle')],
    time: [W('Temporal Infinitive')], subject: [W('Infinitive as Subject')], directObject: [W('Infinitive as Direct Object')],
    indirectDiscourse: [W('Infinitive in Indirect Discourse')], epexegetical: [W('Epexegetical Infinitive')],
    imperatival: [W('Imperatival Infinitive')], absolute: [W('Absolute Infinitive')],
    hortatory: [W('Hortatory Subjunctive')], deliberative: [W('Deliberative Subjunctive')], prohibition: [W('Prohibitive Subjunctive'), W('Imperative of Prohibition')],
    emphaticNegation: [W('Emphatic Negation Subjunctive')], inaClause: [W('Subjunctive in Purpose Clauses')], conditional: [W('Subjunctive in Conditional Sentences')],
    indefinite: [W('Subjunctive in Indefinite Relative Clause')], command: [W('Imperative of Command')], request: [W('Imperative of Request (Entreaty)')],
    permissive: [W('Permissive Imperative (Imperative of Toleration)')], volitive: [W('Voluntative Optative')], potential: [W('Potential Optative')], oblique: [W('Oblique Optative')],
};

export const TENSE_USE_SOURCES: Readonly<Record<TenseUseId, readonly RuleSource[]>> = {
    progressive: [W('Progressive (Descriptive) Present')], customary: [W('Customary (Habitual or General) Present'), P('2026-10-07 · Stg 2:7 βλασφημοῦσιν')],
    iterative: [W('Iterative Present')], gnomic: [W('Gnomic Present')], historical: [W('Historical Present')], futuristic: [W('Futuristic Present')],
    conative: [W('Conative Present')], extendingFromPast: [W('Present of Past Action Still in Progress')], instantaneous: [W('Instantaneous Present')],
    ingressive: [W('Ingressive Aorist'), W('Ingressive Imperfect')], constative: [W('Constative Aorist')], culminative: [W('Consummative (Culminative) Aorist')],
    epistolary: [W('Epistolary Aorist')], proleptic: [W('Proleptic (Futuristic) Aorist')], dramatic: [W('Dramatic Aorist')],
    predictive: [W('Predictive Future')], imperatival: [W('Imperatival Future')], deliberative: [W('Deliberative Future')],
    intensive: [W('Intensive (Resultative) Perfect')], extensive: [W('Extensive (Consummative) Perfect')],
};

/**
 * Las fuentes de una función según la forma: «propósito» es una sección para
 * el participio y otra para el infinitivo (Lc 5:17 εἰς τὸ ἰᾶσθαι citaba las dos).
 */
export function verbFunctionSources(id: VerbFunctionId, form?: 'participle' | 'infinitive' | 'other'): readonly RuleSource[] {
    const todas = VERB_FUNCTION_SOURCES[id];
    if (form === 'participle') return todas.filter(s => !/Infinitive/.test(s.section));
    if (form === 'infinitive') return todas.filter(s => !/Participle/.test(s.section));
    return todas;
}

/** Las reglas de G3: agencia (#G5) y artículo anafórico (#G6). */
export const NOMINAL_RULE_SOURCES: Readonly<Record<NominalRule, readonly RuleSource[]>> = {
    agentHypo: [W('Ultimate Agent'), P('2026-10-07 · Stg 2:9 ὑπὸ τοῦ νόμου')],
    agentDia: [W('Intermediate Agent')],
    anaphoraLemma: [W('Anaphoric (Previous Reference)'), P('2026-10-07 · Stg 2:9 τοῦ νόμου → νόμον, v. 8')],
};

/** Notas de «Estructura» que salen de una regla: condicionales, conectores, orden. */
export type StructureRuleKey = 'class1' | 'class2' | 'class3' | 'class4' | 'fronted' | Extract<ClauseRelation, 'development' | 'chain' | 'conjunctive' | 'disjunctive' | 'asyndetic'>;

export const STRUCTURE_RULE_SOURCES: Readonly<Record<StructureRuleKey, readonly RuleSource[]>> = {
    class1: [W('First Class Condition'), P('2026-10-07 · Stg 2:9 εἰ δὲ προσωπολημπτεῖτε')],
    class2: [W('Second Class Condition')],
    class3: [W('Third Class Condition')],
    class4: [W('Fourth Class Condition')],
    fronted: [R('Emphasis'), R('Frames of Reference'), P('2026-10-07 · Stg 2:9 ἁμαρτίαν ἐργάζεσθε')],
    development: [R('Development (δέ)')],
    chain: [AC('Waw consecutive (wayyiqtol)')],
    conjunctive: [AC('Waw conjunctive')],
    disjunctive: [AC('Waw disjunctive'), P('2026-10-07 · Rut 1:14 וְרוּת')],
    asyndetic: [P('2026-10-07 · Rut 1:16 עַמֵּךְ עַמִּי')],
};

/**
 * La cita. Corta, la que se ve: «Wallace, «Periphrastic Participle»» (pedido
 * del fundador: autor y sección bastan para encontrarla). Completa, la que se
 * copia: con la obra y el año, como va en un trabajo. La página, en las dos,
 * sólo verificada.
 */
export function formatCitation(s: RuleSource, forma: 'short' | 'full' = 'short'): string {
    const w = WORKS[s.work];
    if (s.work === 'professor') return `${w.author} de ${w.title} (${s.note ?? w.year})`;
    const apellido = w.author.split(' y ').map(a => a.split(' ').slice(-1)[0]).join(' y ');
    const pagina = s.pages ? `, p. ${s.pages}` : '';
    return forma === 'full' ? `${apellido}, ${w.title} (${w.year}), «${s.section}»${pagina}` : `${apellido}, «${s.section}»${pagina}`;
}
