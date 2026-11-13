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
    'hortatory', 'deliberative', 'prohibition', 'emphaticNegation', 'inaClause', 'conditional', 'indefinite', 'lest',
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
    | 'afterIna' | 'conditionalEan' | 'ouMe' | 'prohibition' | 'indefinite' | 'indefiniteRelative' | 'lest' | 'hortatory' | 'meGenoito' | 'presentProhibition';

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
    /** Una regla acotó los usos del tiempo (el asistente elige entre ellos). */
    readonly tenseRule?: TenseRule;
    /**
     * Pista (no regla): perfecto de indicativo en la apódosis de una condición de 1.ª clase.
     * Medido en el NT (2026-11-12): 14 casos, 4 prolépticos o gnómicos (Stg 2:11, 1 Ti 5:8,
     * 1 Co 8:3, 2 P 2:20) y 10 intensivos o extensivos (1 Co 15:13); la forma no los separa.
     */
    readonly tenseHint?: 'prolepticFirstClass';
}

/**
 * Reglas que ACOTAN el uso del tiempo (no deciden): `prolepticPerfect` — el
 * perfecto en la apódosis de una condición «depende del tiempo del verbo de la
 * prótasis» (Wallace p. 581, con Stg 2:10 y Ro 14:23); con una prótasis
 * futura (ἐάN + subjuntivo) o un sujeto indefinido («ὅστις … τηρήσῃ»,
 * equivalente a una condición, Wallace p. 478), es proléptico; Wallace admite
 * también gnómico. Medido en el NT: 5 casos, los 5 revisados (1 Co 13:1, Stg
 * 2:10, Ro 2:25, 7:2, 14:23). La 1.ª clase (Stg 2:11, εἰ + indicativo) queda
 * fuera: ahí el perfecto suele ser el intensivo de siempre (1 Co 15:13, 16), y también
 * los perfectos con sentido de presente que salían sin ese filtro (1 Jn 5:15 οἴδαμεν).
 */
export type TenseRule = 'prolepticPerfect';

/** Los perfectos que significan un estado PRESENTE (lema de MorphGNT): ni regla ni pista de proléptico. */
const PERFECTO_DE_PRESENTE: ReadonlySet<string> = new Set(['οἶδα', 'ἔοικα', 'πείθω', 'ἵστημι', 'μιμνῄσκω']);

const MODO: Record<string, GreekVerbForm> = { P: 'participle', N: 'infinitive', S: 'subjunctive', D: 'imperative', O: 'optative', I: 'indicative' };
const modo = (w: StructureWord | undefined) => (w?.pos?.startsWith('V') ? w.parse?.[3] ?? '' : '');
const caso = (w: StructureWord | undefined) => w?.parse?.[4] ?? '';
const concuerda = (a: StructureWord, b: StructureWord) => !!a.parse && !!b.parse && a.parse.slice(4, 7) === b.parse.slice(4, 7);
const esArticulo = (w: StructureWord | undefined) => w?.pos === 'RA';

/** Lo que una regla puede mirar de un verbo: la forma, sus vecinos y sus cláusulas. */
interface Contexto {
    readonly w: StructureWord;
    readonly i: number;
    readonly ws: readonly StructureWord[];
    readonly antes?: StructureWord;
    readonly antes2?: StructureWord;
    /** Palabras de su cláusula MACULA (la más profunda). */
    readonly clausula: readonly StructureWord[];
    /** Palabras de las cláusulas que la contienen: madre, abuela… */
    readonly arriba: readonly (readonly StructureWord[])[];
    readonly fila?: StructureNode;
    /** Palabras de las cláusulas HIJAS de la suya (un sujeto puede estar ahí). */
    readonly hijas: readonly StructureWord[];
    /** Si la madre COORDINA cláusulas («A δέ B», `CLaCL`): las palabras de sus hermanas. */
    readonly coordinadas: readonly StructureWord[];
    /** El rol MACULA de su cláusula («o»: es objeto de otro verbo). */
    readonly rolClausula: string;
    /** La cláusula madre tiene verbo propio: la suya es subordinada. */
    readonly madreConVerbo: boolean;
    readonly tiempo: string;
    readonly persona: string;
    readonly plural: boolean;
}

/**
 * El subordinante que manda sobre el verbo: el de la cláusula MÁS CERCANA que
 * tenga uno, subiendo desde la propia. «ἵνα … ὅταν φανερωθῇ» (1 Jn 2:28):
 * φανερωθῇ está bajo ὅταν, no bajo el ἵνα de más arriba (revisión de G2).
 */
const SUBORDINANTES: ReadonlySet<string> = new Set(['ἵνα', 'ὅπως', 'ἐάν', 'ὅταν', 'ἄν', 'ἕως', 'μέχρι', 'ἄχρι', 'πρίν', 'μήποτε', 'εἰ', 'ὅτι', 'ὡς', 'καθώς']);
function subordinanteCercano(c: Contexto): string | undefined {
    for (const cl of [c.clausula, ...c.arriba]) {
        // ἕως, μέχρι, ἄχρι pueden traer rol en MACULA («ἕως οὗ», Hch 23:14): cuentan igual.
        // El subordinante va ANTES del verbo: un «ἕως» detrás es otra cosa (Mt 17:9 «Μηδενὶ εἴπητε … ἕως
        // οὗ», Lc 2:15 «Διέλθωμεν δὴ ἕως Βηθλέεμ», preposición). Pendientes de la revisión, 2026-11-13.
        const antes = (x: StructureWord) => c.ws.indexOf(x) < c.i;
        const s = cl.find(x => SUBORDINANTES.has(x.l) && (!x.role || INDEFINIDOS.has(x.l)) && antes(x)) ?? cl.find(x => x.l === 'ἄν' && antes(x));
        // «ὃς ἐάν», «ὅσα ἐάν», «ὅπου ἐάν» (1 Jn 4:15, Mt 7:12): MorphGNT etiqueta ese ἐάν como PARTÍCULA (X-),
        // que hace de ἄν: relativo indefinido (Wallace p. 478), no condición. El ἐάν conjunción (C-) tras un
        // relativo sí es condición: Mt 21:24 «ὃν ἐὰν εἴπητέ μοι», Jn 21:25, Heb 13:23 (medido en el NT: ἐάν X-, 62 veces, 49 tras un
        // relativo y 13 tras ὁσάκις/ἡνίκα/καθό/ὅ τι; ἐάν C- tras un relativo, 3).
        if (s?.l === 'ἐάν' && s.pos === 'X-') return 'ἄν';
        if (s) return s.l;
        // Una cláusula con verbo propio (distinto) corta la búsqueda: ya es otra oración.
        if (cl !== c.clausula && cl.some(x => x.role === 'v' && x !== c.w)) return undefined;
    }
    return undefined;
}
const INDEFINIDOS: ReadonlySet<string> = new Set(['ὅταν', 'ἄν', 'ἕως', 'μέχρι', 'ἄχρι', 'πρίν']);

/** μή y sus compuestos de prohibición (1 Co 3:18 μηδείς, 1 Jn 3:7 μηδείς, μηκέτι, μηδέ). */
const NEGACION_DE_PROHIBICION: ReadonlySet<string> = new Set(['μή', 'μηδέ', 'μηδείς', 'μηκέτι', 'μήτε']);
const conProhibicion = (c: Contexto) => c.clausula.some(x => NEGACION_DE_PROHIBICION.has(x.l));

/**
 * Verbos de temor o advertencia que rigen un μή «no sea que» (Wallace p. 477,
 * «Subjunctive with Verbs of Fearing, Etc.»): «βλεπέτω μὴ πέσῃ» (1 Co 10:12),
 * «ἐφοβοῦντο … μὴ λιθασθῶσιν» (Hch 5:26), «Βλέπετε μὴ πλανηθῆτε» (Lc 21:8).
 */
const TEMOR_O_ADVERTENCIA: ReadonlySet<string> = new Set(['φοβέομαι', 'βλέπω', 'ὁράω', 'προσέχω', 'σκοπέω', 'φυλάσσω', 'εὐλαβέομαι', 'δείδω']);
const esFinito = (w: StructureWord | undefined) => ['I', 'S', 'D', 'O'].includes(modo(w));

/**
 * μή dependiente = «no sea que» SÓLO bajo un verbo de temor o advertencia: el
 * verbo finito más cercano ANTES del μή. Antes bastaba con que la cláusula
 * madre tuviera verbo, y una cita («εἶπεν· Μὴ φονεύσῃς», Stg 2:11; los
 * mandamientos de Lc 18:20 y Mc 10:19; Heb 3:8) salía «no sea que» cuando es
 * subjuntivo prohibitivo — Wallace p. 469 lista Stg 2:11 y Heb 3:8 ahí
 * (revisión del profesor, 2026-11). Se mira el más cercano y no toda la madre:
 * en Hch 18:9 «μὴ φοβοῦ, ἀλλὰ λάλει καὶ μὴ σιωπήσῃς» la madre tiene φοβέομαι
 * pero rige λάλει.
 */
function bajoTemor(c: Contexto): boolean {
    // El μή abre la cláusula, o MACULA lo deja solo en una madre (`PtclCL`): «Βλέπετε μή τις ὑμᾶς
    // πλανήσῃ» (Mt 24:4, Mc 13:5), «φοβούμενοί τε μή που … ἐκπέσωμεν» (Hch 27:29).
    const mhPalabra = c.clausula[0]?.l === 'μή' ? c.clausula[0]
        : c.arriba[0]?.length === 1 && c.arriba[0][0]!.l === 'μή' ? c.arriba[0][0] : undefined;
    if (!mhPalabra) return false;
    // El verbo que rige es el más cercano antes del μή, finito o PARTICIPIO (φοβούμενοι). Una cita queda
    // fuera porque su verbo más cercano es el de decir. No se exige que esté en una cláusula madre: en
    // el NT eso sólo cambiaba Heb 12:25 «Βλέπετε μὴ παραιτήσησθε», y lo dejaba sin regla.
    const mh = c.ws.indexOf(mhPalabra);
    for (let k = mh - 1; k >= 0; k--) {
        const v = c.ws[k]!;
        if (esFinito(v) || modo(v) === 'P') return TEMOR_O_ADVERTENCIA.has(v.l);
    }
    return false;
}

/**
 * ὅστις antes del verbo: relativo indefinido aunque falte ἄν (Wallace p. 478). Se sube por las
 * madres, como con ἵνα: el coordinado «πταίσῃ δέ» (Stg 2:10) está en otra cláusula de MACULA.
 * Una madre con otro verbo propio corta la búsqueda: ya es otra oración.
 */
function relativoIndefinido(c: Contexto): boolean {
    for (const cl of [c.clausula, c.coordinadas, ...c.arriba]) {
        if (cl.some(x => x.l === 'ὅστις' && c.ws.indexOf(x) >= 0 && c.ws.indexOf(x) < c.i)) return true;
        if (cl !== c.clausula && cl !== c.coordinadas && cl.some(x => x.role === 'v' && x !== c.w && !SUBORDINANTES.has(x.l))) return false;
    }
    return false;
}

/** οὐ μή delante del verbo, aunque haya palabras entre medio («οὐ μή με ἴδητε», Mt 23:39). */
function ouMe(c: Contexto): boolean {
    for (let k = Math.max(0, c.i - 5); k < c.i - 1; k++) if (c.ws[k]!.l === 'οὐ' && c.ws[k + 1]!.l === 'μή') return true;
    return false;
}

/**
 * El artículo de un participio: el más cercano HACIA ATRÁS (hasta 8 palabras)
 * que concuerda, sin otra palabra que se lo lleve entre medio — un sustantivo,
 * pronombre, adjetivo u otro participio que concuerde con el artículo.
 * «στραφεὶς δὲ ὁ Ἰησοῦς» (Jn 1:38), «ὁ Ἰωάννης λέγων» (Jn 1:26), «Οἱ …
 * συνελθόντες … λέγοντες» (Hch 1:6) NO son articulares; «ὁ ὀπίσω μου
 * ἐρχόμενος» (Jn 1:15) y «ὁ λέγων» (1 Jn 2:4, el artículo dos cláusulas
 * arriba en MACULA) sí. Lineal en el texto: MACULA anida el artículo a
 * distinta profundidad.
 */
function articular(c: Contexto): boolean {
    for (let k = c.i - 1; k >= Math.max(0, c.i - 8); k--) {
        const x = c.ws[k]!;
        if (esArticulo(x)) {
            if (!concuerda(x, c.w)) continue;
            return !c.ws.slice(k + 1, c.i).some(y => /^(N|RP|RD|A|V)/.test(y.pos ?? '') && concuerda(y, x) && (y.pos !== 'V-' || modo(y) === 'P'));
        }
        // Un verbo finito entre medio: ya es otra cláusula.
        if (y_finito(x)) return false;
    }
    return false;
}
const y_finito = (x: StructureWord) => ['I', 'S', 'O', 'D'].includes(modo(x));

/**
 * Perifrástico: εἰμί + participio, concordando en número. Con εἰμί finito, el
 * participio va en nominativo (Hb 11:1 «ἐλπιζομένων» no lo es); con el
 * infinitivo εἶναι, en acusativo («ἐν τῷ εἶναι αὐτὸν προσευχόμενον», Lc 9:18).
 * El εἰμί puede estar en la cláusula madre si la del participio no tiene sujeto
 * ni verbo propio (Mc 1:6 «ἦν … ἐνδεδυμένος … καὶ ἔσθων»).
 */
function perifrastico(c: Contexto): boolean {
    // Wallace: el perifrástico usa participio PRESENTE o PERFECTO, casi nunca aoristo
    // («ἦν προσδοκῶν…, συγκαλεσάμενος», Hch 10:24: el aoristo no es parte de la perífrasis).
    if (!['P', 'X'].includes(c.tiempo)) return false;
    const numero = c.w.parse?.[5];
    // La primera cláusula de arriba con verbo (las de coordinación, «καί», no tienen).
    const madre = c.clausula.some(x => x.role === 's' || (x !== c.w && y_finito(x))) ? [] : (c.arriba.find(cl => cl.some(x => x.pos === 'V-')) ?? []);
    // Si εἰμί ya tiene su predicado («ψεύστης ἐστίν», 1 Jn 2:4; «ἐστιν ἐν δεξιᾷ», 1 P 3:22),
    // el participio no lo completa: no es perifrástico.
    const sinPredicado = (cl: readonly StructureWord[]) => !cl.some(y => y.role === 'p');
    const conEimi = [c.clausula, madre].filter(cl => cl.length && sinPredicado(cl)).flat();
    return conEimi.some(x => {
        if (x === c.w || x.l !== 'εἰμί' || x.parse?.[5] !== numero && modo(x) !== 'N') return false;
        if (y_finito(x)) return caso(c.w) === 'N' && x.parse?.[5] === numero;
        return modo(x) === 'N' && caso(c.w) === 'A';
    });
}

/**
 * Genitivo absoluto: participio en genitivo con sujeto propio en genitivo, en
 * su cláusula o en una hija (Hch 23:30 «μηνυθείσης … ἐπιβουλῆς»). NO si la
 * cláusula es el OBJETO de otro verbo: «ἠκούσαμεν αὐτοῦ λέγοντος» (Mc 14:58)
 * es el genitivo de un verbo de oír.
 */
function genitivoAbsoluto(c: Contexto): boolean {
    if (caso(c.w) !== 'G' || c.rolClausula === 'o') return false;
    return [...c.clausula, ...c.hijas].some(x => x !== c.w && x.role === 's' && caso(x) === 'G');
}

/**
 * El artículo neutro del infinitivo, aunque haya palabras entre medio («διὰ τὸ
 * μὴ ἔχειν», Mc 4:5; «πρὸ τοῦ τὸν κόσμον εἶναι», Jn 17:5): el más cercano
 * hacia atrás (hasta 5 palabras), sin un verbo entre medio. Y la preposición
 * justo antes de él.
 */
function articuloDelInfinitivo(c: Contexto): { articulo: StructureWord; preposicion?: string } | undefined {
    for (let k = c.i - 1; k >= Math.max(0, c.i - 5); k--) {
        const x = c.ws[k]!;
        if (x.pos === 'V-') return undefined;
        if (esArticulo(x) && x.parse?.[5] === 'S' && x.parse?.[6] === 'N') {
            const antes = c.ws[k - 1];
            return { articulo: x, ...(antes?.pos === 'P-' ? { preposicion: antes.l } : {}) };
        }
    }
    return undefined;
}
const CON_PREPOSICION: ReadonlySet<string> = new Set(['εἰς', 'πρός', 'ἐν', 'μετά', 'πρό', 'διά']);
const preposicionDelInfinitivo = (c: Contexto) => {
    const p = articuloDelInfinitivo(c)?.preposicion;
    return p && CON_PREPOSICION.has(p) ? p : undefined;
};

/**
 * Circunstancia concomitante (Wallace): participio AORISTO, ANTES de un verbo
 * principal en AORISTO, indicativo o imperativo. Stg 2:9 «ἁμαρτίαν ἐργάζεσθε,
 * ἐλεγχόμενοι» (presente, después del verbo) no lo cumple; el asistente lo
 * había elegido.
 */
function concomitantePosible(c: Contexto): boolean {
    if (c.tiempo !== 'A') return false;
    const pos = (x: StructureWord) => c.ws.indexOf(x);
    return [...c.clausula, ...(c.arriba[0] ?? [])].some(x =>
        x !== c.w && pos(x) > c.i && x.role === 'v' && ['I', 'D'].includes(modo(x)) && x.parse?.[1] === 'A');
}

/** Un sustantivo, pronombre o adjetivo que concuerda con el participio, en su cláusula o la madre. */
const hayNominalQueConcuerda = (c: Contexto) =>
    [...c.clausula, ...(c.arriba[0] ?? [])].some(x => x !== c.w && /^(N|RP|RD|A)/.test(x.pos ?? '') && concuerda(x, c.w));

interface ReglaVerbo {
    /** El nombre: une la regla con su fuente (`VERB_RULE_SOURCES`) y su texto. */
    readonly rule: VerbRule;
    readonly form: GreekVerbForm;
    readonly when: (c: Contexto) => boolean;
    /** Lo que permite. Con UNA sola opción, la regla decide. */
    readonly allowed: readonly VerbFunctionId[];
}

/**
 * LAS REGLAS DE LOS VERBOS, EN ORDEN: gana la primera que se cumple. El orden
 * importa (οὐ μή antes que μή; el subordinante más cercano antes que la
 * prohibición). Para agregar una: aquí, con su fuente en `ruleSources.ts`, su
 * texto en `greekTutor.json` y un versículo de prueba.
 */
export const VERB_RULES: readonly ReglaVerbo[] = [
    // Participio
    { rule: 'articular', form: 'participle', when: articular, allowed: ['attributive', 'substantival'] },
    { rule: 'periphrastic', form: 'participle', when: perifrastico, allowed: ['periphrastic'] },
    { rule: 'genitiveAbsolute', form: 'participle', when: genitivoAbsoluto, allowed: ['genitiveAbsolute'] },
    // Infinitivo con preposición y artículo
    { rule: 'eisTo', form: 'infinitive', when: c => preposicionDelInfinitivo(c) === 'εἰς', allowed: ['purpose', 'result'] },
    // πρὸς τό y ἐν τῷ: Wallace les da más de un uso (p. 611: πρὸς τό «Purpose, Result»; ἐν τῷ
    // «Result (rare), Contemporaneous Time, Means»): la regla acota, no decide (revisión de R0).
    { rule: 'prosTo', form: 'infinitive', when: c => preposicionDelInfinitivo(c) === 'πρός', allowed: ['purpose', 'result'] },
    { rule: 'enToi', form: 'infinitive', when: c => preposicionDelInfinitivo(c) === 'ἐν', allowed: ['time', 'means'] },
    { rule: 'metaTo', form: 'infinitive', when: c => preposicionDelInfinitivo(c) === 'μετά', allowed: ['time'] },
    { rule: 'proTou', form: 'infinitive', when: c => preposicionDelInfinitivo(c) === 'πρό', allowed: ['time'] },
    { rule: 'diaTo', form: 'infinitive', when: c => preposicionDelInfinitivo(c) === 'διά', allowed: ['cause'] },
    // Infinitivo articular sin una de esas preposiciones
    { rule: 'tou', form: 'infinitive', when: c => !preposicionDelInfinitivo(c) && caso(articuloDelInfinitivo(c)?.articulo) === 'G', allowed: ['purpose', 'result', 'epexegetical', 'complementary', 'time'] },
    { rule: 'articularNominal', form: 'infinitive', when: c => !preposicionDelInfinitivo(c) && !!articuloDelInfinitivo(c), allowed: ['subject', 'directObject', 'epexegetical'] },
    // Subjuntivo: el subordinante MÁS CERCANO manda
    { rule: 'ouMe', form: 'subjunctive', when: ouMe, allowed: ['emphaticNegation'] },
    { rule: 'afterIna', form: 'subjunctive', when: c => ['ἵνα', 'ὅπως'].includes(subordinanteCercano(c) ?? ''), allowed: ['inaClause'] },
    { rule: 'conditionalEan', form: 'subjunctive', when: c => subordinanteCercano(c) === 'ἐάν' || subordinanteCercano(c) === 'εἰ', allowed: ['conditional'] },
    { rule: 'indefinite', form: 'subjunctive', when: c => INDEFINIDOS.has(subordinanteCercano(c) ?? ''), allowed: ['indefinite'] },
    // ὅστις + subjuntivo, con o sin ἄν (Wallace p. 478: «ὅστις (ἄν/ἐάν)»): Stg 2:10 «ὅστις … τηρήσῃ,
    // πταίσῃ δέ» no tenía regla y la ficha no mostraba la función (revisión del profesor, 2026-11).
    // Regla propia: la ficha decía «con ἄν» donde no hay ἄν (prueba del fundador).
    { rule: 'indefiniteRelative', form: 'subjunctive', when: relativoIndefinido, allowed: ['indefinite'] },
    { rule: 'lest', form: 'subjunctive', when: c => subordinanteCercano(c) === 'μήποτε' || bajoTemor(c), allowed: ['lest'] },
    { rule: 'prohibition', form: 'subjunctive', when: c => conProhibicion(c) && c.tiempo === 'A' && c.persona === '2', allowed: ['prohibition'] },
    { rule: 'hortatory', form: 'subjunctive', when: c => c.persona === '1' && c.plural && !c.clausula.some(x => x.pos === 'RR'), allowed: ['hortatory', 'deliberative'] },
    // Imperativo y optativo
    { rule: 'presentProhibition', form: 'imperative', when: conProhibicion, allowed: ['prohibition'] },
    { rule: 'meGenoito', form: 'optative', when: c => c.w.l === 'γίνομαι' && c.antes?.l === 'μή', allowed: ['volitive'] },
];

/** Sin regla que se cumpla: lo que cada forma puede ser (menos lo que sólo una regla otorga). */
const SIN_REGLA: Readonly<Record<GreekVerbForm, readonly VerbFunctionId[]>> = {
    participle: PARTICIPLE_FUNCTIONS.filter(f => !['attributive', 'substantival', 'periphrastic', 'genitiveAbsolute'].includes(f)),
    infinitive: INFINITIVE_FUNCTIONS.filter(f => !['time', 'cause'].includes(f)),
    subjunctive: ['hortatory', 'deliberative', 'prohibition', 'indefinite', 'lest'],
    imperative: IMPERATIVE_FUNCTIONS.filter(f => f !== 'prohibition'),
    optative: [...OPTATIVE_FUNCTIONS],
    indicative: [],
};

export function greekVerbCandidates(ch: ChapterStructure, verse: number): VerbCandidate[] {
    if (ch.lang !== 'gr') return [];
    const ws = verseWords(ch, verse);
    const filas = verseStructure(ch, verse);
    const clausulas = clausesOfVerse(ch, verse);
    const porRef = new Map(ch.words.map(w => [w.r, w]));
    const palabras = (rs: readonly string[]) => rs.map(r => porRef.get(r)).filter((x): x is StructureWord => !!x);
    /** La cláusula MACULA más profunda que contiene la palabra. */
    const indiceDe = (r: string): number | undefined => {
        let mejor: { index: number; depth: number } | undefined;
        for (const c of clausulas) if (c.words.includes(r) && (!mejor || c.depth >= mejor.depth)) mejor = c;
        return mejor?.index;
    };
    /** Las cláusulas que contiene una (para el sujeto que es una relativa indefinida). */
    const hijasDe = new Map<number, number[]>();
    ch.clauses.forEach((cl, k) => { if (cl.p !== null) hijasDe.set(cl.p, [...(hijasDe.get(cl.p) ?? []), k]); });
    const subarbol = (k: number): StructureWord[] => {
        const out: StructureWord[] = [];
        for (const pila = [k]; pila.length;) { const x = pila.pop()!; out.push(...palabras(ch.clauses[x]!.w)); pila.push(...(hijasDe.get(x) ?? [])); }
        return out;
    };
    /** Su sujeto es una cláusula con ὅστις / ἄν / ἐάν y un subjuntivo: una condición implícita (Stg 2:10). */
    const sujetoIndefinido = (propia: number | undefined) => propia !== undefined
        && (hijasDe.get(propia) ?? []).some(k => ch.clauses[k]!.role === 's' && ((s) => s.some(x => ['ὅστις', 'ἄν', 'ἐάν'].includes(x.l)) && s.some(x => modo(x) === 'S'))(subarbol(k)));
    /** Las hermanas de una cláusula cuya madre sólo coordina (`CLaCL`, `aCLaCL`…). */
    const coordinadasDe = (propia: number | undefined): StructureWord[] => {
        const p = propia === undefined ? null : ch.clauses[propia]!.p;
        if (p === null || !/CL.*CL/.test(ch.clauses[p]!.rule)) return [];
        return ch.clauses.flatMap((cl, k) => (cl.p === p && k !== propia ? palabras(cl.w) : []));
    };
    const out: VerbCandidate[] = [];
    ws.forEach((w, i) => {
        const form = MODO[modo(w)];
        if (!form) return;
        const propia = indiceDe(w.r);
        const arriba: StructureWord[][] = [];
        for (let p = propia === undefined ? null : ch.clauses[propia]!.p; p !== null; p = ch.clauses[p]!.p) arriba.push(palabras(ch.clauses[p]!.w));
        const c: Contexto = {
            w, i, ws, antes: ws[i - 1], antes2: ws[i - 2],
            clausula: propia === undefined ? [] : palabras(ch.clauses[propia]!.w).filter(x => ws.includes(x)),
            arriba,
            fila: filas.find(f => f.words.some(t => t.r === w.r)),
            hijas: propia === undefined ? [] : ch.clauses.flatMap(cl => (cl.p === propia ? palabras(cl.w) : [])),
            coordinadas: coordinadasDe(propia),
            rolClausula: propia === undefined ? '' : ch.clauses[propia]!.role,
            madreConVerbo: (arriba[0] ?? []).some(x => x.role === 'v' && y_finito(x)),
            tiempo: w.parse?.[1] ?? '', persona: w.parse?.[0] ?? '', plural: w.parse?.[5] === 'P',
        };
        // Perfecto con sentido de presente (οἶδα «sé», ἔοικα «se parece», πέποιθα «confío», ἕστηκα
        // «estoy de pie», μέμνημαι «recuerdo»): no es proléptico (revisión adversarial, Stg 1:23 ἔοικεν).
        const perfectoDePresente = PERFECTO_DE_PRESENTE.has(w.l);
        const proleptico = form === 'indicative' && c.tiempo === 'X' && !perfectoDePresente
            && ((!!c.fila?.isApodosis && filas.some(f => f.relation === 'condition' && f.conditionalClass === 3)) || sujetoIndefinido(propia));
        const tenseUses = proleptico
            ? (['proleptic', 'gnomic'] as TenseUseId[])
            : form === 'indicative' ? [...(TENSE_USES[c.tiempo as keyof typeof TENSE_USES] ?? [])] : [];
        const acota = proleptico ? { tenseRule: 'prolepticPerfect' as const }
            : form === 'indicative' && c.tiempo === 'X' && !perfectoDePresente && !!c.fila?.isApodosis && filas.some(f => f.relation === 'condition' && f.conditionalClass === 1)
                ? { tenseHint: 'prolepticFirstClass' as const } : {};
        const regla = VERB_RULES.find(r => r.form === form && r.when(c));
        // «Predicativo» sólo si hay un sustantivo o pronombre del que predicar,
        // en su cláusula o en la madre. Con el sujeto implícito en el verbo
        // (Stg 2:9 «ἁμαρτίαν ἐργάζεσθε, ἐλεγχόμενοι…») el participio es adverbial.
        const sinRegla = form === 'participle'
            ? SIN_REGLA.participle.filter(f => (f !== 'predicate' || hayNominalQueConcuerda(c)) && (f !== 'attendantCircumstance' || concomitantePosible(c)))
            : SIN_REGLA[form];
        out.push(
            regla
                ? { ordinal: i, form, tenseUses, ...acota, allowed: regla.allowed, rule: regla.rule, ...(regla.allowed.length === 1 ? { decided: regla.allowed[0]! } : {}) }
                : { ordinal: i, form, tenseUses, ...acota, allowed: sinRegla },
        );
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
    indefinite: 'indefinido (relativo o temporal: con ἄν, ὅταν, ἕως u ὅστις)', lest: 'temor o propósito negativo («no sea que», con μή o μήποτε)', command: 'mandato', request: 'ruego o petición (a un superior)',
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
    indefinite: 'con ἄν, ὅταν, ἕως, ἄχρι, μέχρι o πρίν (relativo o temporal indefinido)', indefiniteRelative: 'ὅστις + subjuntivo, con o sin ἄν: «quienquiera que…»; plantea un caso general, como una condición', lest: 'μήποτε, o μή tras un verbo de temor o advertencia (βλέπω, φοβέομαι)', hortatory: '1.ª persona plural', meGenoito: 'μὴ γένοιτο', presentProhibition: 'μή + imperativo',
};

/** El tramo del prompt con la tarea de los verbos. Vacío si no hay verbos. */
export function buildVerbFunctionTask(candidates: readonly VerbCandidate[], words: readonly string[]): string {
    if (!candidates.length) return '';
    const lineas = candidates.map(c => {
        // Numerados COMO la lista de palabras del prompt (desde 1).
        const partes = [`${c.ordinal + 1}. ${words[c.ordinal] ?? ''} — ${FORMA_ES[c.form]}`];
        if (c.decided) partes.push(`FUNCIÓN YA DECIDIDA por regla (${REGLA_ES[c.rule!]}): "${c.decided}" = ${FUNCION_ES[c.decided]}; sólo explícala en "verbNote"`);
        else if (c.allowed.length) partes.push(`"verbFunction", elige de: ${c.allowed.map(f => `"${f}" (${FUNCION_ES[f]})`).join('; ')}${c.rule ? ` [acotado porque ${REGLA_ES[c.rule]}]` : ''}`);
        if (c.tenseUses.length) partes.push(`"tenseUse", elige de: ${c.tenseUses.map(u => `"${u}" (${USO_ES[u]})`).join('; ')}`);
        if (c.tenseHint) partes.push('PISTA: perfecto en la apódosis de una condición de 1.ª clase. Si la prótasis plantea un caso general (τις, un «tú» que vale para cualquiera) y el perfecto dice el estado que de ahí resulta, es "proleptic" (Wallace p. 581); si afirma un hecho ya ocurrido, es "intensive" o "extensive"');
        return partes.join(' — ');
    });
    return `
Y para cada VERBO de la lista de abajo (con el MISMO número que en la lista de palabras), su
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

/**
 * Las reglas de los verbos aplicadas AL MOSTRAR, sobre un análisis guardado
 * (como hace el hebreo): si una regla mejora, el cambio llega a los versículos
 * ya analizados sin re-analizar. Lo decidido por regla manda; una elección del
 * asistente que la regla de hoy ya no permite se quita (con su nota).
 */
export function applyVerbRules<T extends {
    verbFunction?: VerbFunctionId; verbRule?: VerbRule; tenseUse?: TenseUseId; verbNote?: string;
    tenseRule?: TenseRule; tenseUseOptions?: readonly TenseUseId[]; tenseUseOutside?: TenseUseId;
}>(
    words: readonly T[],
    candidates: readonly VerbCandidate[],
): T[] {
    const porPos = new Map(candidates.map(c => [c.ordinal, c]));
    return words.map((w, i) => {
        const c = porPos.get(i);
        const { verbFunction, verbRule: _regla, tenseUse, verbNote, tenseRule: _tr, tenseUseOptions: _to, tenseUseOutside: _tf, ...resto } = w;
        const fn = c?.decided ?? (c && verbFunction && c.allowed.includes(verbFunction) ? verbFunction : undefined);
        const uso = c && tenseUse && c.tenseUses.includes(tenseUse) ? tenseUse : undefined;
        return {
            ...resto,
            ...(fn ? { verbFunction: fn } : {}),
            ...(c?.decided && c.rule ? { verbRule: c.rule } : {}),
            ...(uso ? { tenseUse: uso } : {}),
            // Una regla que ACOTA el uso del tiempo (proléptico o gnómico, Wallace p. 581): sin
            // elección válida quedan las opciones, y lo que eligió el asistente fuera de ellas,
            // como «otra lectura» (Stg 2:10 γέγονεν: un análisis guardado decía «intensivo»).
            ...(c?.tenseRule ? { tenseRule: c.tenseRule } : {}),
            ...(c?.tenseRule && !uso ? { tenseUseOptions: c.tenseUses } : {}),
            ...(c?.tenseRule && tenseUse && !uso ? { tenseUseOutside: tenseUse } : {}),
            // La nota explica lo que el asistente eligió: si hoy la regla decide OTRA
            // función, la nota vieja contradiría la ficha (revisión de G2).
            ...(verbNote && (fn || uso) && (!fn || fn === verbFunction) ? { verbNote } : {}),
        } as T;
    });
}
