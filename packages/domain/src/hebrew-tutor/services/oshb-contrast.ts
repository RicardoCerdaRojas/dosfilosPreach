import { Binyan, Gender, GrammaticalCategory, GrammaticalNumber, Person, VerbForm } from '../value-objects/grammar.js';
import type { OshbCorrection, VerbMorphology, VerseAnalysis, WordAnalysis } from '../entities/verse-analysis.js';
import { alignWordsToTokens } from './reconcile-words.js';

/**
 * OSHB decide la morfología del verbo.
 *
 * El tutor le pedía al asistente el tallo, la forma y la persona-género-número,
 * y le pasaba el código de OSHB «sólo para verificación, NO es autoridad». En
 * las formas ambiguas el asistente eligió mal y contradijo a OSHB en silencio
 * (bitácora del módulo de hebreo, Rut 1, 2026-10-07):
 *
 *   Rut 1:13 תֵּעָגֵנָה   tutor 3FP          OSHB HVNi2fp   (תִּ…נָה es 2FP o 3FP: decide el contexto)
 *   Rut 1:16 תִּפְגְּעִי  tutor imperfecto   OSHB HVqj2fs   (אַל + prefijo = yusivo)
 *
 * OSHB es un etiquetado hecho a mano que ya resolvió esas ambigüedades por
 * contexto. Aquí se compara palabra por palabra y, donde difiere, gana OSHB y
 * queda dicho qué se corrigió. Corre al LEER, así corrige también lo guardado.
 */

const TALLO: Readonly<Record<string, Binyan>> = {
    q: Binyan.QAL, N: Binyan.NIFAL, p: Binyan.PIEL, P: Binyan.PUAL,
    h: Binyan.HIFIL, H: Binyan.HOFAL, t: Binyan.HITPAEL,
};

const FORMA: Readonly<Record<string, VerbForm>> = {
    p: VerbForm.PERFECT, q: VerbForm.WEQATAL, i: VerbForm.IMPERFECT, w: VerbForm.WAYYIQTOL,
    h: VerbForm.COHORTATIVE, j: VerbForm.JUSSIVE, v: VerbForm.IMPERATIVE,
    a: VerbForm.INF_ABSOLUTE, c: VerbForm.INF_CONSTRUCT,
    r: VerbForm.PARTICIPLE_ACTIVE, s: VerbForm.PARTICIPLE_PASSIVE,
};

const PERSONA: Readonly<Record<string, Person>> = { '1': Person.FIRST, '2': Person.SECOND, '3': Person.THIRD };
const GENERO: Readonly<Record<string, Gender>> = { m: Gender.MASCULINE, f: Gender.FEMININE, c: Gender.COMMON, b: Gender.COMMON };
const NUMERO: Readonly<Record<string, GrammaticalNumber>> = { s: GrammaticalNumber.SINGULAR, p: GrammaticalNumber.PLURAL, d: GrammaticalNumber.DUAL };

export interface OshbVerbParse {
    /** `null` en tallos que no se nombran con seguridad (polel, hitpolel…). */
    binyan: Binyan | null;
    verbForm: VerbForm | null;
    person: Person | null;
    gender: Gender | null;
    number: GrammaticalNumber | null;
}

/**
 * El verbo de un código OSHB, o `null` si el código no trae verbo.
 *
 *   "HVNi2fp"   → nifal, imperfecto, 2, F, P
 *   "HC/Vqw3ms" → qal, wayyiqtol, 3, M, S   (el segmento del verbo, no la conjunción)
 *   "HVqrmsa"   → qal, participio activo, —, M, S   (participio: género, número, estado)
 *   "HVqc"      → qal, infinitivo constructo
 */
export function parseOshbVerb(code: string | null | undefined): OshbVerbParse | null {
    if (!code) return null;
    // El arameo (código con «A») tiene sus propios tallos: con la tabla
    // hebrea, el ithpaal salía pual. Ahí no se nombra el tallo.
    const arameo = code.startsWith('A');
    const segmentos = code.replace(/^[HA]/, '').split('/');
    const verbo = segmentos.find(s => s.startsWith('V') && s.length >= 3);
    if (!verbo) return null;
    const verbForm = FORMA[verbo[2]!] ?? null;
    const resto = verbo.slice(3);
    const esParticipio = verbForm === VerbForm.PARTICIPLE_ACTIVE || verbForm === VerbForm.PARTICIPLE_PASSIVE;
    const [p, g, n] = esParticipio ? ['', resto[0] ?? '', resto[1] ?? ''] : [resto[0] ?? '', resto[1] ?? '', resto[2] ?? ''];
    return {
        binyan: arameo ? null : TALLO[verbo[1]!] ?? null,
        verbForm,
        person: PERSONA[p] ?? null,
        gender: GENERO[g] ?? null,
        number: NUMERO[n] ?? null,
    };
}

/** El verbo de una palabra contra el de OSHB: corrige donde OSHB dice otra cosa. */
export function contrastVerbWithOshb(
    vm: VerbMorphology,
    oshb: OshbVerbParse,
): { verbMorphology: VerbMorphology; corrections: OshbCorrection[] } {
    const corrections: OshbCorrection[] = [];
    const campo = <K extends 'binyan' | 'verbForm' | 'person' | 'gender' | 'number'>(k: K, valor: VerbMorphology[K] | null) => {
        if (valor === null || valor === undefined) return vm[k];
        if (vm[k] === valor) return vm[k];
        corrections.push({ field: k, analysis: vm[k] == null ? '' : String(vm[k]), oshb: String(valor) });
        return valor as VerbMorphology[K];
    };
    const verbMorphology: VerbMorphology = {
        ...vm,
        binyan: campo('binyan', oshb.binyan) as Binyan,
        verbForm: campo('verbForm', oshb.verbForm) as VerbForm,
        person: campo('person', oshb.person),
        gender: campo('gender', oshb.gender),
        number: campo('number', oshb.number),
    };
    return { verbMorphology, corrections };
}

/** «3ms» a partir del verbo, como lo guarda la tabla de verbos. */
function pgnDe(vm: VerbMorphology): string {
    return `${vm.person ?? ''}${(vm.gender ?? '').toLowerCase()}${(vm.number ?? '').toLowerCase()}`;
}

function esqueleto(text: string): string {
    return text.replace(/[^א-ת]/g, '').replace(/[ךםןףץ]/g, c => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]!);
}

/**
 * El análisis de un versículo con la morfología verbal de OSHB.
 *
 * Cada palabra queda con su `oshbReference` (código, si coincide, qué se
 * corrigió). La tabla de verbos se alinea con las palabras corregidas.
 */
export function applyOshbMorphology(
    analysis: VerseAnalysis,
    tokens: readonly { text: string; oshbMorphCode?: string; lemma?: string }[],
): VerseAnalysis {
    if (!tokens || tokens.length === 0) return analysis;
    const tramos = alignWordsToTokens(analysis.words, tokens);

    const words: WordAnalysis[] = analysis.words.map((w, i) => {
        const tramo = tramos[i];
        if (!tramo) return w;
        const propios = tokens.slice(tramo.start, tramo.start + tramo.count);
        const conCodigo = propios.find(t => parseOshbVerb(t.oshbMorphCode)) ?? propios[0];
        const code = conCodigo?.oshbMorphCode ?? '';
        if (!code) return w;
        const oshbVerb = parseOshbVerb(code);
        const base = { morphCode: code, strongNumber: conCodigo?.lemma ?? '' };
        // Sólo se compara —y sólo se muestra la insignia— cuando los dos lados
        // son verbo: en un sustantivo «coincide con OSHB» no diría nada.
        if (w.category !== GrammaticalCategory.VERB || !w.verbMorphology || !oshbVerb) return w;
        const { verbMorphology, corrections } = contrastVerbWithOshb(w.verbMorphology, oshbVerb);
        return {
            ...w,
            verbMorphology,
            oshbReference: { ...base, agreesWithAnalysis: corrections.length === 0, corrections },
        };
    });

    const verbTable = syncVerbTable(analysis.verbTable, words, (row, w) => ({
        ...row, binyan: w.verbMorphology!.binyan, verbForm: w.verbMorphology!.verbForm, pgn: pgnDe(w.verbMorphology!),
    }));

    return { ...analysis, words, verbTable };
}

/**
 * Cada fila de la tabla de verbos con SU palabra: en orden y usando cada
 * palabra una sola vez. Buscar «la primera con las mismas consonantes»
 * hacía que dos verbos iguales con análisis distinto (1 S 3:17 תְכַחֵד,
 * yusivo e imperfecto) tomaran los dos el mismo.
 */
function syncVerbTable<R extends { hebrewForm: string }>(
    rows: readonly R[],
    words: readonly WordAnalysis[],
    actualizar: (row: R, w: WordAnalysis) => R,
): R[] {
    let desde = 0;
    return rows.map(row => {
        const clave = esqueleto(row.hebrewForm);
        for (let i = desde; i < words.length; i++) {
            const w = words[i]!;
            if (!w.verbMorphology || esqueleto(w.hebrewText) !== clave) continue;
            desde = i + 1;
            return actualizar(row, w);
        }
        return row;
    });
}

/**
 * La fórmula de juramento כֹּה יַעֲשֶׂה … וְכֹה יֹסִיף: sus dos verbos son
 * YUSIVOS, de valor volitivo («así me haga Dios, y aún me añada»).
 *
 * Medido en OSHB (2026-10-07): la fórmula aparece 12 veces y OSHB etiqueta
 * yusivo 11 (1 S 3:17; 14:44; 20:13; 25:22; 2 S 3:9, 35; 19:14; 1 R 2:23;
 * 19:2; 20:10; 2 R 6:31). La excepción es Rut 1:17, imperfecto, y el tutor
 * leyó «futuro, él hará» (bitácora del módulo de hebreo #5). Se reconoce por
 * los lemas: כֹּה (3541) + עשׂה (6213), y después וְכֹה + יסף (3254).
 */
export const OATH_FORMULA_VALUE = 'volitivo — fórmula de juramento («así me haga…»)';

/**
 * H7: en la fórmula el significado se sabe con certeza, así que la palabra se
 * traduce en el código (Rut 1:17 decía «él hará… él añadirá» con la etiqueta
 * ya en yusivo). Plural con sujeto plural: «כֹּה־יַעֲשׂוּן אֱלֹהִים», 1 R 19:2.
 */
export const OATH_FORMULA_TRANSLATION = {
    es: { asah: { singular: 'haga', plural: 'hagan' }, yasaf: { singular: 'añada', plural: 'añadan' } },
    // «May the LORD do so to me, and more also»: en inglés el subjuntivo no cambia con el número.
    en: { asah: { singular: 'do', plural: 'do' }, yasaf: { singular: 'add', plural: 'add' } },
} as const;

export function markOathFormula(
    analysis: VerseAnalysis,
    tokens: readonly { text: string; oshbMorphCode?: string; lemma?: string }[],
    /** Idioma del análisis: la traducción fijada de H7 va en ese idioma. */
    language: string = 'es',
): VerseAnalysis {
    if (!tokens || tokens.length < 4) return analysis;
    const lema = (t: { lemma?: string } | undefined) => (t?.lemma ?? '').trim();
    const indices: number[] = [];
    const deYasaf = new Set<number>();
    for (let i = 0; i + 1 < tokens.length; i++) {
        if (lema(tokens[i]) !== '3541' || !lema(tokens[i + 1]).startsWith('6213')) continue;
        const resto = tokens.slice(i + 2, i + 8);
        const yasaf = resto.findIndex(t => lema(t) === '3254');
        if (yasaf < 0 || !resto.slice(0, yasaf).some(t => lema(t) === 'c/3541')) continue;
        indices.push(i + 1, i + 2 + yasaf);
        deYasaf.add(i + 2 + yasaf);
    }
    if (indices.length === 0) return analysis;

    const tramos = alignWordsToTokens(analysis.words, tokens);
    const words = analysis.words.map((w, i) => {
        const tramo = tramos[i];
        if (!tramo || !w.verbMorphology) return w;
        const k = indices.find(k => k >= tramo.start && k < tramo.start + tramo.count);
        if (k === undefined) return w;
        const vm = w.verbMorphology;
        const forma = (language.startsWith('en') ? OATH_FORMULA_TRANSLATION.en : OATH_FORMULA_TRANSLATION.es)[deYasaf.has(k) ? 'yasaf' : 'asah'];
        const cambio: OshbCorrection[] = vm.verbForm === VerbForm.JUSSIVE
            ? []
            : [{ field: 'verbForm', analysis: String(vm.verbForm), oshb: VerbForm.JUSSIVE, reason: 'oath-formula' }];
        // La corrección de forma que ya hizo OSHB se conserva (en 11 de las 12
        // fórmulas OSHB ya dice yusivo y el error del asistente debe verse);
        // sólo se reemplaza si la regla cambia algo.
        const previas = (w.oshbReference?.corrections ?? []).filter(c => cambio.length === 0 || c.field !== 'verbForm');
        return {
            ...w,
            verbMorphology: { ...vm, verbForm: VerbForm.JUSSIVE, temporalValue: OATH_FORMULA_VALUE },
            translation: vm.number === GrammaticalNumber.PLURAL ? forma.plural : forma.singular,
            ...(w.oshbReference
                ? { oshbReference: { ...w.oshbReference, corrections: [...previas, ...cambio], agreesWithAnalysis: previas.length + cambio.length === 0 } }
                : {}),
        };
    });
    const verbTable = syncVerbTable(analysis.verbTable, words, (row, w) => (
        w.verbMorphology?.temporalValue === OATH_FORMULA_VALUE
            ? { ...row, verbForm: VerbForm.JUSSIVE, temporalValue: OATH_FORMULA_VALUE }
            : row
    ));
    return { ...analysis, words, verbTable };
}
