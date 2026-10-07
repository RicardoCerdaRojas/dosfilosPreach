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
    const segmentos = code.replace(/^[HA]/, '').split('/');
    const verbo = segmentos.find(s => s.startsWith('V') && s.length >= 3);
    if (!verbo) return null;
    const verbForm = FORMA[verbo[2]!] ?? null;
    const resto = verbo.slice(3);
    const esParticipio = verbForm === VerbForm.PARTICIPLE_ACTIVE || verbForm === VerbForm.PARTICIPLE_PASSIVE;
    const [p, g, n] = esParticipio ? ['', resto[0] ?? '', resto[1] ?? ''] : [resto[0] ?? '', resto[1] ?? '', resto[2] ?? ''];
    return {
        binyan: TALLO[verbo[1]!] ?? null,
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
        if (w.category !== GrammaticalCategory.VERB || !w.verbMorphology || !oshbVerb) {
            return { ...w, oshbReference: { ...base, agreesWithAnalysis: true, corrections: [] } };
        }
        const { verbMorphology, corrections } = contrastVerbWithOshb(w.verbMorphology, oshbVerb);
        return {
            ...w,
            verbMorphology,
            oshbReference: { ...base, agreesWithAnalysis: corrections.length === 0, corrections },
        };
    });

    const corregidas = words.filter(w => (w.oshbReference?.corrections.length ?? 0) > 0 && w.verbMorphology);
    const verbTable = analysis.verbTable.map(row => {
        const palabra = corregidas.find(w => esqueleto(w.hebrewText) === esqueleto(row.hebrewForm));
        if (!palabra?.verbMorphology) return row;
        return { ...row, binyan: palabra.verbMorphology.binyan, verbForm: palabra.verbMorphology.verbForm, pgn: pgnDe(palabra.verbMorphology) };
    });

    return { ...analysis, words, verbTable };
}
