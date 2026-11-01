import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { CitationReview, VerifiedCitation } from '../entities/CitationVerification';
import { collectAnalysisClaims } from './analysisClaims';
import { findInlineCitations } from './inlineCitations';
import { isCitationAlarm, mapAllVerdictsByPath, mapVerdictsByPath } from './citationReview';
import { pagesOverlap } from './evidenceForCitation';

/**
 * «Revisión antes de entregar» (TP #8, fase 8b, E3).
 *
 * La prosa recompuesta con la lista del profesor arregló 6 puntos y dejó 7
 * (medido en el TP #8): volvió a decidir 4:3 por κακῶς cuando el análisis ya
 * usaba la concesión de Mayor 133, omitió Wallace 533 en 4:5, mantuvo la cita
 * de Adamson 171 que el análisis no pudo respaldar, dejó «διά τό» sin grave, el
 * cierre de 4:5 sin dividir y «provisionalmente» dos veces. En el Word quedaron
 * además «del cuerpo,, dato», «φονεύετε» en minúscula al abrir el párrafo y
 * «584-585» con guion.
 *
 * Esto son los controles FIJOS: reglas sobre la prosa y su análisis, sin
 * modelo. Avisan; nunca bloquean el Word. Los que dependen de leer el
 * argumento (criterios 3–7 del profesor) los hace el revisor con modelo
 * (`IProseReviewer`).
 */
export type ProseCheckKind =
    /** El criterio decisivo del análisis no aparece en la prosa. */
    | 'missing-criterion'
    /** El análisis cita la gramática del curso y la prosa no. */
    | 'missing-grammar'
    /** Una cita de la prosa que el verificador no respaldó y nadie revisó. */
    | 'unverified-citation'
    /** La prosa repite una cita del análisis que no se pudo respaldar. */
    | 'repeated-alert'
    /** El cierre del párrafo parece afirmar dos cosas. */
    | 'double-closing'
    /** Un rango con guion en vez de raya corta. */
    | 'hyphen-range'
    /** Un oxítono griego con agudo delante de otra palabra. */
    | 'greek-grave'
    /** Comas dobles o espacio antes de la coma. */
    | 'punctuation'
    /** Un párrafo que abre en minúscula. */
    | 'lowercase-start'
    /** La misma palabra o frase repetida (síntesis). */
    | 'repetition'
    /** La traducción que adopta el cierre no es la traducción final del análisis. */
    | 'translation-mismatch';

export interface ProseFinding {
    kind: ProseCheckKind;
    /** El tramo de la prosa donde está, tal como aparece. */
    excerpt: string;
    /** El reemplazo, cuando es mecánico («584–585»). */
    replacement?: string;
    /** Datos para armar el aviso: la pregunta, la cita, el criterio. */
    data?: Readonly<Record<string, string | number>>;
}

export interface ProseReviewContext {
    prose: string;
    analysis: CanonicalVerseAnalysis | null;
    verdicts?: ReadonlyArray<VerifiedCitation>;
    reviews?: ReadonlyArray<Pick<CitationReview, 'path'>>;
    /** Claves de las gramáticas del corpus (`grammar-syntax`). */
    grammarKeys?: ReadonlyArray<string>;
    /** Todas las claves de cita del trabajo, para leer las citas de la prosa. */
    citationKeys?: ReadonlyArray<string>;
}

/** Avisos de cada clase, como mucho: veinte avisos de guion no ayudan a leer. */
const MAX_POR_CLASE = 5;

export function reviewProseFixed(ctx: ProseReviewContext): ProseFinding[] {
    const prose = ctx.prose ?? '';
    if (!prose.trim()) return [];
    const keys = [...new Set([...(ctx.citationKeys ?? []), ...(ctx.grammarKeys ?? [])].filter(k => k?.trim()))];
    const citasDeLaProsa = findInlineCitations(prose, keys);
    const parrafos = paragraphsOf(prose);
    const out: ProseFinding[] = [
        ...missingCriteria(prose, ctx.analysis),
        ...missingGrammar(ctx.analysis, ctx.grammarKeys ?? [], citasDeLaProsa),
        ...citationAlarms(ctx, citasDeLaProsa),
        ...doubleClosings(parrafos),
        ...hyphenRanges(prose),
        ...greekGraves(prose),
        ...punctuation(prose),
        ...lowercaseStarts(parrafos),
        ...repetitions(parrafos, keys),
        ...translationMismatch(parrafos, ctx.analysis),
    ];
    const porClase = new Map<ProseCheckKind, number>();
    return out.filter(f => {
        const n = (porClase.get(f.kind) ?? 0) + 1;
        porClase.set(f.kind, n);
        return n <= MAX_POR_CLASE;
    });
}

// ── 1 · El criterio decisivo ──────────────────────────────────────────────

/**
 * Una respuesta cuyo criterio no deja rastro en la prosa. Se mide por las
 * palabras distintivas del criterio (seis letras o más, sin las de relleno):
 * si la prosa no trae ni la mitad, el criterio no está. Grueso a propósito:
 * el revisor con modelo lo vuelve a mirar con el argumento a la vista.
 */
function missingCriteria(prose: string, analysis: CanonicalVerseAnalysis | null): ProseFinding[] {
    const tokens = tokensOf(prose);
    const out: ProseFinding[] = [];
    for (const qa of analysis?.questionAnswers ?? []) {
        const criterio = qa.decisiveCriterion?.text?.trim();
        if (!criterio) continue;
        const palabras = [...new Set(tokensOf(criterio).filter(distintiva))];
        if (palabras.length < 3) continue;
        const halladas = palabras.filter(p => tokens.some(t => mismaRaiz(t, p))).length;
        if (halladas / palabras.length < 0.5) {
            out.push({ kind: 'missing-criterion', excerpt: '', data: { question: qa.questionNumber, criterion: criterio } });
        }
    }
    return out;
}

// ── 2 · La gramática del curso ────────────────────────────────────────────

/** Las citas de la gramática del curso en el análisis: «Wallace, p. 533». */
export function grammarCitationsOf(
    analysis: CanonicalVerseAnalysis | null,
    grammarKeys: ReadonlyArray<string>,
): Array<{ key: string; page: number }> {
    if (!analysis || grammarKeys.length === 0) return [];
    const out = new Map<string, { key: string; page: number }>();
    const add = (autor: string, page: number) => {
        const key = grammarKeys.find(k => normal(k) === normal(autor) || normal(autor).startsWith(`${normal(k)} `));
        if (key && Number.isInteger(page) && page > 0) out.set(`${key}|${page}`, { key, page });
    };
    for (const c of collectAnalysisClaims(analysis)) add(c.sourceKey, c.page);
    // La sintaxis cita dentro del texto: «… causal (Wallace, p. 597)».
    const sintaxis = stringsOf(analysis.syntacticAnalysis).join('\n');
    for (const m of findInlineCitations(sintaxis, grammarKeys)) {
        const page = parseInt((m.pages ?? '').replace(/^\D+/, ''), 10);
        add(m.author, page);
    }
    return [...out.values()];
}

function missingGrammar(
    analysis: CanonicalVerseAnalysis | null,
    grammarKeys: ReadonlyArray<string>,
    citasDeLaProsa: ReturnType<typeof findInlineCitations>,
): ProseFinding[] {
    return grammarCitationsOf(analysis, grammarKeys)
        // `pagesOverlap` y no una lista de páginas: lee «232, 236» y «559–61»
        // como el verificador (TP #9, B37).
        .filter(g => !citasDeLaProsa.some(c => normal(c.author).startsWith(normal(g.key)) && pagesOverlap(c.pages, String(g.page))))
        .map(g => ({ kind: 'missing-grammar' as const, excerpt: '', data: { key: g.key, page: g.page } }));
}

// ── 3 · Las citas sin respaldo ────────────────────────────────────────────

function citationAlarms(ctx: ProseReviewContext, citasDeLaProsa: ReturnType<typeof findInlineCitations>): ProseFinding[] {
    const verdicts = ctx.verdicts ?? [];
    const revisadas = new Set((ctx.reviews ?? []).map(r => r.path));
    const out: ProseFinding[] = [];
    const yaAvisadas = new Set<string>();

    // Las de la propia prosa (el verificador del documento ya las miró).
    for (const [path, v] of mapAllVerdictsByPath(ctx.analysis, verdicts)) {
        if (v.origin !== 'prose' || !isCitationAlarm(v.status) || revisadas.has(path)) continue;
        out.push({ kind: 'unverified-citation', excerpt: citaLegible(v.author, v.pages, v.raw), data: { status: v.status } });
        for (const p of pagesOf(v.pages)) yaAvisadas.add(`${normal(v.author)}|${p}`);
    }

    // Las del análisis que la prosa vuelve a citar (Adamson 171 en 4:5).
    if (ctx.analysis) {
        for (const [path, v] of mapVerdictsByPath(ctx.analysis, verdicts)) {
            if (!isCitationAlarm(v.status) || revisadas.has(path)) continue;
            const paginas = pagesOf(v.pages);
            const enLaProsa = citasDeLaProsa.find(c =>
                normal(c.author) === normal(v.author) && pagesOf(c.pages).some(p => paginas.includes(p)));
            if (!enLaProsa) continue;
            if (paginas.some(p => yaAvisadas.has(`${normal(v.author)}|${p}`))) continue;
            paginas.forEach(p => yaAvisadas.add(`${normal(v.author)}|${p}`));
            out.push({
                kind: 'repeated-alert',
                excerpt: citaLegible(enLaProsa.author, enLaProsa.pages, enLaProsa.raw),
                data: { status: v.status, ...(v.status === 'page-mismatch' && v.matchedPageLabel ? { foundAt: v.matchedPageLabel } : {}) },
            });
        }
    }
    return out;
}

/** «Mayor, 134», sin el paréntesis ni la cita vecina de un grupo «(Mayor, 134; Adamson, 169)». */
function citaLegible(autor: string, paginas: string | null, raw: string): string {
    const a = autor.trim();
    const p = (paginas ?? '').trim();
    return a ? (p ? `${a}, ${p}` : a) : raw.replace(/^[\s(]+|[\s);]+$/g, '');
}

// ── 4 · El cierre doble (patrón 1 del profesor) ───────────────────────────

// `(?!\p{L})` y no `\b`: con `\b` (ASCII) «así» no cerraba nunca (revisión de 8b).
const ENLACE_DOBLE = /;|,\s+y\s+(?:además|también|por\s+(?:lo\s+)?tanto|por\s+eso|así)(?!\p{L})|,\s+and\s+(?:also|therefore|thus|so)(?!\p{L})/iu;

function doubleClosings(parrafos: ReadonlyArray<string>): ProseFinding[] {
    const out: ProseFinding[] = [];
    for (const p of parrafos) {
        const oraciones = sentencesOf(p);
        if (oraciones.length < 2) continue;
        const cierre = oraciones[oraciones.length - 1]!;
        // Lo citado o traducido entre « » no es del cierre: «…; entonces combaten…».
        // Y si la oración empieza dentro de una cita partida por un punto, desde donde cierra.
        const sinParentesis = cierre.replace(/^[^«]*»/, '').replace(/\([^)]*\)/g, '').replace(/«[^»]*»|“[^”]*”|"[^"]*"/g, '«»')
            // Ni el griego citado (su «;» es el signo de interrogación, Stg 4:1) ni la cursiva.
            .replace(/\*[^*]+\*|_[^_]+_/g, ' ')
            .replace(/[\p{Script=Greek}\p{M}]+(?:\s+[\p{Script=Greek}\p{M}]+)*\s*;/gu, ' ');
        const largo = sinParentesis.split(/\s+/).filter(Boolean).length;
        if (ENLACE_DOBLE.test(sinParentesis) || (largo >= 40 && /,\s+(?:y|and)\s/u.test(sinParentesis))) {
            out.push({ kind: 'double-closing', excerpt: cierre });
        }
    }
    return out;
}

// ── 5 · Raya corta, acentos griegos, puntuación ──────────────────────────

/**
 * Los controles mecánicos —rango con guion, grave del griego, coma doble—,
 * que corrigen sin leer el argumento. Los usa también la revisión antes de
 * exportar (`exportReview.ts`) sobre todo el documento.
 */
export function mechanicalProseFindings(prose: string): ProseFinding[] {
    return [...hyphenRanges(prose), ...greekGraves(prose), ...punctuation(prose)];
}

const RANGO_CON_GUION = /(?<![\p{L}\p{N}/.-])(\d+(?::\d+)?)\s?[-‐‑]\s?(\d+(?::\d+)?)(?![\p{L}\p{N}/-])/gu;

function hyphenRanges(prose: string): ProseFinding[] {
    const out: ProseFinding[] = [];
    for (const m of sinEnlaces(prose).matchAll(RANGO_CON_GUION)) {
        // «2026-10» es una fecha, no un rango.
        if (/^\d{4}$/.test(m[1]!) && /^\d{2}$/.test(m[2]!)) continue;
        out.push({ kind: 'hyphen-range', excerpt: m[0], replacement: `${m[1]}–${m[2]}` });
    }
    return out;
}

/** Pronombres y verbos enclíticos: el oxítono que los precede conserva el agudo. */
const ENCLITICAS = new Set([
    'με', 'μου', 'μοι', 'σε', 'σου', 'σοι', 'τις', 'τι', 'τινος', 'τινι', 'τινα', 'τινες', 'τινων', 'τισι', 'τισιν', 'τινας',
    'εστι', 'εστιν', 'εισι', 'εισιν', 'ειμι', 'εσμεν', 'εστε', 'πως', 'ποτε', 'που', 'πω', 'γε', 'τε', 'τοι', 'περ',
]);
const PALABRA_GRIEGA = /[\p{Script=Greek}][\p{Script=Greek}\p{M}]*/gu;
const OXITONO = /[αεηιουω][̓̔̈]*́[̓̔̈ͅ]*[ςνρξψ]?$/u;

/**
 * «διά τό» → «διὰ τὸ»: un oxítono con agudo seguido de otra palabra griega,
 * sin puntuación en medio, lleva grave. Excepciones: el interrogativo τίς/τί
 * y una enclítica detrás.
 */
function greekGraves(prose: string): ProseFinding[] {
    const out: ProseFinding[] = [];
    const palabras = [...prose.matchAll(PALABRA_GRIEGA)];
    for (let i = 0; i < palabras.length - 1; i++) {
        const w = palabras[i]!;
        const sig = palabras[i + 1]!;
        const entre = prose.slice(w.index! + w[0].length, sig.index!);
        // Solo espacio en la misma línea: dos párrafos no son una frase.
        if (!/^[ \t\u00a0]+$/.test(entre)) continue;
        const nfd = w[0].normalize('NFD').toLowerCase();
        if (!OXITONO.test(nfd)) continue;
        const base = sinMarcas(w[0]);
        if (base === 'τις' || base === 'τι') continue;
        if (ENCLITICAS.has(sinMarcas(sig[0]))) continue;
        const corregida = nfd.replace(/́(?=[^́]*$)/u, '̀').normalize('NFC');
        const conMayuscula = w[0][0] !== w[0][0]!.toLowerCase()
            ? corregida[0]!.toUpperCase() + corregida.slice(1)
            : corregida;
        out.push({ kind: 'greek-grave', excerpt: `${w[0]} ${sig[0]}`, replacement: `${conMayuscula} ${sig[0]}` });
    }
    return out;
}

function punctuation(prose: string): ProseFinding[] {
    const out: ProseFinding[] = [];
    for (const m of prose.matchAll(/(\S{0,20}),\s*,(\s*\S{0,20})/gu)) {
        out.push({ kind: 'punctuation', excerpt: m[0].trim(), replacement: `${m[1]},${m[2]}`.trim() });
    }
    for (const m of prose.matchAll(/(\S{1,20})\s+,(\s*\S{0,20})/gu)) {
        out.push({ kind: 'punctuation', excerpt: m[0].trim(), replacement: `${m[1]},${m[2]}`.trim() });
    }
    return out;
}

function lowercaseStarts(parrafos: ReadonlyArray<string>): ProseFinding[] {
    const out: ProseFinding[] = [];
    for (const p of parrafos) {
        const primera = p.match(/[\p{L}]/u);
        if (primera && primera[0] !== primera[0].toUpperCase() && primera[0] === primera[0].toLowerCase()) {
            out.push({ kind: 'lowercase-start', excerpt: p.slice(0, 60).trim() });
        }
    }
    return out;
}

// ── 6 · Repeticiones (síntesis) ──────────────────────────────────────────

/**
 * «provisionalmente» dos veces, «paralelos más cercanos» en dos oraciones.
 * Un adverbio en -mente repetido, o tres palabras seguidas que vuelven en
 * otra oración (sin griego ni números: un término técnico se repite a
 * propósito).
 */
function repetitions(parrafos: ReadonlyArray<string>, keys: ReadonlyArray<string>): ProseFinding[] {
    // El nombre de una fuente se repite cada vez que se la cita: «Kittel y Friedrich».
    const nombres = keys.map(k => tokensOf(k).join(' ')).filter(Boolean);
    const out: ProseFinding[] = [];
    const oraciones = parrafos.flatMap(sentencesOf).map(o => o.replace(/\([^)]*\)/g, ' '));
    const adverbios = new Map<string, number>();
    for (const o of oraciones) {
        for (const w of o.toLowerCase().match(/\p{L}{4,}mente\b/gu) ?? []) adverbios.set(w, (adverbios.get(w) ?? 0) + 1);
    }
    for (const [w, n] of adverbios) if (n >= 2) out.push({ kind: 'repetition', excerpt: w, data: { count: n } });

    const vistas = new Map<string, { en: Set<number>; tal: string }>();
    oraciones.forEach((o, i) => {
        const ws = o.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
        for (let j = 0; j + 2 < ws.length; j++) {
            const tri = ws.slice(j, j + 3);
            if (tri.some(w => /[\p{Script=Greek}\p{N}]/u.test(w))) continue;
            const t = tri.map(w => sinMarcas(w));
            if (t[0]!.length < 4 || t[2]!.length < 4 || VACIAS.has(t[0]!) || VACIAS.has(t[2]!)) continue;
            if (t.filter(w => w.length >= 5).length < 2) continue;
            // La morfología se repite a propósito: dos verbos en «presente activo indicativo».
            if (t.filter(w => MORFOLOGIA.has(w)).length >= 2) continue;
            const clave = t.join(' ');
            if (nombres.some(n => n.includes(clave) || clave.includes(n))) continue;
            if (!vistas.has(clave)) vistas.set(clave, { en: new Set(), tal: tri.join(' ') });
            vistas.get(clave)!.en.add(i);
        }
    });
    for (const { en, tal } of vistas.values()) if (en.size >= 2) out.push({ kind: 'repetition', excerpt: tal, data: { count: en.size } });
    return out;
}

// ── 7 · La traducción adoptada (TP #9, B31) ─────────────────────────────

/**
 * En 4:14 el análisis decidió «Aunque no saben lo que traerá el mañana…»
 * (relativo concesivo) y la prosa cerró «se adopta la traducción: «No saben lo
 * que traerá el mañana. ¿Qué es su vida?»»: perdió la concesión y nadie lo
 * vio. Se compara la traducción del cierre con `finalTranslation`, sin
 * puntuación, mayúsculas, tildes ni comillas.
 *
 * El cierre puede traducir solo una frase («el que puede salvar y destruir»):
 * basta con que esté en la traducción final. Si trae oraciones enteras (tiene
 * punto o signo de cierre adentro), además tiene que empezar y terminar donde
 * empieza y termina una oración de la final: si no, le falta un trozo, como
 * el «Aunque» de 4:14.
 */
function translationMismatch(parrafos: ReadonlyArray<string>, analysis: CanonicalVerseAnalysis | null): ProseFinding[] {
    const final = analysis?.finalTranslation?.trim();
    if (!final || parrafos.length === 0) return [];
    const adoptada = adoptedTranslation(parrafos[parrafos.length - 1]!);
    if (!adoptada) return [];
    return translationFits(adoptada, final)
        ? []
        : [{ kind: 'translation-mismatch', excerpt: adoptada, data: { analysis: final } }];
}

/** La traducción entre « » (o “ ”) que sigue a la última «traducción» del párrafo. */
export function adoptedTranslation(parrafo: string): string | null {
    const marcas = [...parrafo.matchAll(/traducci[oó]n|translation/giu)];
    for (let i = marcas.length - 1; i >= 0; i--) {
        const desde = marcas[i]!.index! + marcas[i]![0].length;
        const resto = parrafo.slice(desde);
        // La comilla abre cerca y sin cerrar la oración antes: «una traducción
        // que presenta la omisión del bien conocido como pecado: «…»» (4:17).
        const abre = resto.search(/[«“]/u);
        if (abre < 0 || abre > 160 || /[.!?]\s/u.test(resto.slice(0, abre))) continue;
        if (!adopta(parrafo.slice(0, marcas[i]!.index!))) continue;
        const contenido = balancedQuote(resto.slice(abre));
        if (contenido?.trim()) return contenido.trim();
    }
    return null;
}

/**
 * Si la oración, hasta «traducción», dice que la adopta: «se adopta la
 * traducción», «se prefiere expresar … mediante la traducción». La rechazada
 * no cuenta: «se prefiere «condenar» y no la traducción «juzgar» de la RVR60»
 * (revisión de B31).
 */
const VERBO_DE_ADOPCION = /(?<!\p{L})(?:adopt|prefier|prefer|propon|propuest|eleg|elig|opt[ao]|optamos|propos|choos|chose)\p{L}*/iu;

function adopta(antes: string): boolean {
    const fin = Math.max(-1, ...[...antes.matchAll(/[.!?]\s/gu)].map(m => m.index!));
    const oracion = antes.slice(fin + 1);
    if (/(?<!\p{L})(?:no|not|instead\s+of|en\s+lugar\s+de|antes\s+que|y\s+no)\s+(?:la|una|el|the|a)?\s*$/iu.test(oracion)) return false;
    return VERBO_DE_ADOPCION.test(oracion);
}

function balancedQuote(texto: string): string | null {
    const abre = texto[0]!;
    const cierra = abre === '«' ? '»' : '”';
    let nivel = 0;
    for (let i = 0; i < texto.length; i++) {
        if (texto[i] === abre) nivel++;
        else if (texto[i] === cierra && --nivel === 0) return texto.slice(1, i);
    }
    return null;
}

interface TokenDeTraduccion { palabra: string; corteAntes: boolean; corteDespues: boolean }

/**
 * Las palabras sin marcas, con si las separa un fin de oración (. ? ! ; :).
 * «¿» y «¡» abren una: «pero tú, ¿quién eres…?» empieza en «quién».
 */
function tokensDeTraduccion(s: string): TokenDeTraduccion[] {
    const out: TokenDeTraduccion[] = [];
    let corte = true;
    for (const m of s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().matchAll(/[\p{L}\p{N}]+|[.?!;:¿¡]/gu)) {
        if (m[0] === '¿' || m[0] === '¡') {
            corte = true;
            continue;
        }
        if (/^[.?!;:]$/.test(m[0])) {
            corte = true;
            if (out.length > 0) out[out.length - 1]!.corteDespues = true;
            continue;
        }
        out.push({ palabra: m[0], corteAntes: corte, corteDespues: false });
        corte = false;
    }
    if (out.length > 0) out[out.length - 1]!.corteDespues = true;
    return out;
}

export function translationFits(adoptada: string, final: string): boolean {
    const a = tokensDeTraduccion(adoptada).map(t => t.palabra);
    const f = tokensDeTraduccion(final);
    if (a.length === 0) return true;
    // Un punto solo al final no hace oración: «el que puede salvar y destruir.»
    // sigue siendo una frase (revisión de B31).
    const oraciones = /[.?!]/u.test(adoptada.trim().replace(/[.!?…]+$/u, ''));
    for (let i = 0; i + a.length <= f.length; i++) {
        if (!a.every((w, j) => f[i + j]!.palabra === w)) continue;
        if (!oraciones || (f[i]!.corteAntes && f[i + a.length - 1]!.corteDespues)) return true;
    }
    return false;
}

/** Términos de la morfología: describir dos formas iguales no es repetirse. */
const MORFOLOGIA = new Set([
    'presente', 'aoristo', 'imperfecto', 'perfecto', 'pluscuamperfecto', 'futuro', 'activo', 'activa', 'medio', 'media',
    'pasivo', 'pasiva', 'indicativo', 'subjuntivo', 'imperativo', 'infinitivo', 'participio', 'optativo', 'primera',
    'segunda', 'tercera', 'persona', 'singular', 'plural', 'nominativo', 'genitivo', 'dativo', 'acusativo', 'vocativo',
    'masculino', 'femenino', 'neutro', 'present', 'aorist', 'imperfect', 'perfect', 'future', 'active', 'middle',
    'passive', 'indicative', 'subjunctive', 'imperative', 'infinitive', 'participle', 'optative', 'first', 'second',
    'third', 'person', 'nominative', 'genitive', 'dative', 'accusative', 'masculine', 'feminine', 'neuter',
]);

// ── La indicación para recomponer ────────────────────────────────────────

/** Un hallazgo del revisor con modelo, en la forma que la tarjeta muestra. */
export interface ProseReviewerFinding {
    /** El número del criterio (de `proseReviewCriteria`). */
    criterion: number;
    /** La frase de la prosa, textual. Vacía si el revisor no la copió bien. */
    quote: string;
    problem: string;
    fix: string;
}

/**
 * Los criterios con que se lee la prosa (patrones del profesor, TP #7), más
 * las reglas de la guía del curso. El 0 es el que la recomposición perdió en
 * 4:3: la prosa decide con el criterio que el análisis ya resolvió.
 */
export function proseReviewCriteria(language: 'es' | 'en', courseRules: ReadonlyArray<string> = []): string[] {
    const base = language === 'en' ? CRITERIA_EN : CRITERIA_ES;
    // Una regla del curso que dice lo mismo que una de serie (las nueve del
    // profesor son, casi todas, la misma lista con otras palabras) no se
    // suma: el revisor informaría la misma falla con dos números.
    const propias = courseRules.map(r => r.trim()).filter(r => r && !base.some(b => parecidas(b, r)));
    return [...base, ...propias];
}

/** Dos reglas que comparten la mayoría de sus palabras distintivas. */
function parecidas(a: string, b: string): boolean {
    const pa = [...new Set(tokensOf(a).filter(w => w.length >= 5 && !VACIAS.has(w)))];
    const pb = [...new Set(tokensOf(b).filter(w => w.length >= 5 && !VACIAS.has(w)))];
    if (pa.length === 0 || pb.length === 0) return normal(a) === normal(b);
    const comunes = pa.filter(w => pb.some(x => mismaRaiz(w, x))).length;
    return comunes / Math.min(pa.length, pb.length) >= 0.6;
}

const CRITERIA_ES = [
    'La prosa decide con el criterio decisivo del análisis y conserva las citas de la gramática del curso; si el análisis ya resolvió algo, la prosa no vuelve a una razón más débil. Si el estudiante corrigió el análisis a propósito (lo dice una nota de revisión), la prosa sigue al estudiante.',
    'Cada oración de cierre afirma una sola cosa; dos afirmaciones van en dos oraciones.',
    'La categoría gramatical coincide con la traducción, y se dice qué sustantivo califica a cuál.',
    'Una lectura rival se refuta con una razón del contexto, no repitiendo la definición de la categoría.',
    'Si se anuncia un respaldo, se dice qué aporta cada dato.',
    'El criterio decisivo distingue entre las lecturas: si se cumple con las dos, no decide.',
    'Toda afirmación muestra su relevancia para la pregunta, o se quita.',
    'No se usa la clasificación de un elemento para decidir otro sin mostrar la relación entre los dos.',
    'Se responde a cómo clasifica la gramática del curso la construcción, con su página.',
    'La conclusión no contradice lo argumentado; concordancia y tildes correctas; sin repeticiones (síntesis).',
];

const CRITERIA_EN = [
    'The prose decides with the analysis\'s decisive criterion and keeps the course grammar\'s citations; if the analysis already settled something, the prose does not fall back to a weaker reason. If the student corrected the analysis on purpose (a review note says so), the prose follows the student.',
    'Each closing sentence states one thing only; two claims go in two sentences.',
    'The grammatical category matches the translation, and it says which noun qualifies which.',
    'A rival reading is refuted with a reason from the context, not by restating the category\'s definition.',
    'When support is announced, say what each piece of evidence contributes.',
    'The decisive criterion distinguishes between the readings: if both satisfy it, it does not decide.',
    'Every claim shows its relevance to the question, or it is removed.',
    'The classification of one element is not used to decide another without showing how they relate.',
    'Answer how the course grammar classifies the construction, with its page.',
    'The conclusion does not contradict the argument; agreement and accents are correct; no repetition (synthesis).',
];

/**
 * La indicación para [Recomponer con estas observaciones]: cada hallazgo como
 * una corrección concreta. Va al compositor como `guidance`.
 */
export function proseReviewGuidance(
    fixed: ReadonlyArray<ProseFinding>,
    reviewer: ReadonlyArray<ProseReviewerFinding>,
    language: 'es' | 'en',
): string {
    const en = language === 'en';
    const lineas: string[] = [];
    for (const f of fixed) {
        const l = guidanceLine(f, en);
        if (l) lineas.push(`- ${l}`);
    }
    for (const r of reviewer) {
        const donde = r.quote ? (en ? ` In "${r.quote}":` : ` En «${r.quote}»:`) : '';
        lineas.push(`-${donde} ${r.problem.trim()}${r.fix.trim() ? ` → ${r.fix.trim()}` : ''}`);
    }
    if (lineas.length === 0) return '';
    const cabeza = en
        ? 'Correct these points from the pre-delivery review, without losing anything else the analysis says:'
        : 'Corrige estos puntos de la revisión antes de entregar, sin perder nada más de lo que dice el análisis:';
    return [cabeza, ...[...new Set(lineas)]].join('\n');
}

function guidanceLine(f: ProseFinding, en: boolean): string | null {
    const d = f.data ?? {};
    switch (f.kind) {
        case 'missing-criterion':
            return en
                ? `Question ${d.question}: decide with the analysis's decisive criterion: "${d.criterion}".`
                : `Pregunta ${d.question}: decide con el criterio decisivo del análisis: «${d.criterion}».`;
        case 'missing-grammar':
            return en
                ? `If it applies, include how the course grammar classifies it (${d.key}, p. ${d.page}), as the analysis says.`
                : `Si corresponde, incluye cómo lo clasifica la gramática del curso (${d.key}, p. ${d.page}), como dice el análisis.`;
        case 'unverified-citation':
        case 'repeated-alert':
            return en
                ? `The citation ${f.excerpt} could not be verified${d.foundAt ? ` (found at ${d.foundAt})` : ''}: fix it or remove it.`
                : `La cita ${f.excerpt} no se pudo verificar${d.foundAt ? ` (se halló en ${d.foundAt})` : ''}: corrígela o quítala.`;
        case 'double-closing':
            return en
                ? `Split this closing sentence in two: "${f.excerpt}".`
                : `Divide este cierre en dos oraciones: «${f.excerpt}».`;
        case 'repetition':
            return en ? `Do not repeat "${f.excerpt}".` : `No repitas «${f.excerpt}».`;
        case 'translation-mismatch':
            return en
                ? `The closing adopts "${f.excerpt}", but the analysis's final translation is "${d.analysis}": close with the analysis's translation.`
                : `El cierre adopta «${f.excerpt}», pero la traducción final del análisis es «${d.analysis}»: cierra con la traducción del análisis.`;
        // Las mecánicas (raya, grave, comas, mayúscula) se corrigen a mano:
        // recomponer para cambiar un acento reescribe todo lo demás.
        default:
            return null;
    }
}

// ── Utilidades ───────────────────────────────────────────────────────────

const VACIAS = new Set([
    'que', 'para', 'como', 'pero', 'porque', 'cuando', 'donde', 'desde', 'hasta', 'sobre', 'entre', 'segun',
    'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'tambien', 'solo', 'cada', 'sino', 'aunque',
    'mismo', 'misma', 'otro', 'otra', 'otros', 'otras', 'todos', 'todas', 'puede', 'pueden', 'tiene', 'tienen',
    'del', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'por', 'con', 'sin', 'mas', 'muy', 'sus',
    'that', 'this', 'these', 'those', 'which', 'with', 'from', 'into', 'about', 'there', 'their', 'would',
    'should', 'could', 'because', 'while', 'where', 'when', 'than', 'then', 'also', 'only', 'other', 'have',
    'the', 'and', 'for', 'not', 'but',
]);

function sinMarcas(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/ς/g, 'σ').toLowerCase().replace(/σ$/u, 'ς');
}

function normal(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokensOf(s: string): string[] {
    return s.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean).map(sinMarcas);
}

function distintiva(w: string): boolean {
    return w.length >= 6 && !VACIAS.has(w);
}

/**
 * Misma palabra salvo la desinencia: «activa»/«activas». Seis letras como
 * mínimo: con cinco, «concesión» valía por «concede» e «incluir» por
 * «incluso», y un criterio ausente pasaba por presente (revisión de 8b).
 */
function mismaRaiz(a: string, b: string): boolean {
    const n = Math.max(6, Math.min(a.length, b.length) - 2);
    return a.slice(0, n) === b.slice(0, n);
}

/** Las páginas de «170–171», «203, 206» o «p. 533». */
function pagesOf(pages: string | null | undefined): number[] {
    const out: number[] = [];
    for (const m of (pages ?? '').matchAll(/(\d+)(?:\s*[-–]\s*(\d+))?/g)) {
        const a = parseInt(m[1]!, 10);
        const b = m[2] ? parseInt(m[2], 10) : a;
        for (let p = a; p <= Math.min(b, a + 10); p++) out.push(p);
    }
    return out;
}

function stringsOf(x: unknown): string[] {
    if (typeof x === 'string') return [x];
    if (Array.isArray(x)) return x.flatMap(stringsOf);
    if (x && typeof x === 'object') return Object.values(x).flatMap(stringsOf);
    return [];
}

/** Los párrafos de texto: sin títulos, citas en bloque, listas ni separadores. */
function paragraphsOf(prose: string): string[] {
    return prose.split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p && !/^(#{1,6}\s|>|---|\*\*\*|\||[-*+]\s|\d+[.)]\s)/.test(p));
}

/** Abreviaturas que terminan en punto sin cerrar la oración. */
const ABREVIATURAS = /(?<![\p{L}\p{M}])(pp?|cf|vv?|ed|eds|trad|vol|cap|n|nn|ss|etc|lit|esp|ca|e\.g|i\.e|Gn|Ex|Lv|Nm|Dt|Is|Jr|Ez|Sal|Pr|Mt|Mc|Lc|Jn|Ro|Stg|Ef|Heb|Ap)\.(?=\s)/giu;

function sentencesOf(parrafo: string): string[] {
    const protegido = parrafo.replace(ABREVIATURAS, m => m.slice(0, -1) + '\u0000');
    return protegido
        .split(/(?<=[.!?])\s+(?=[«"“(¿¡\p{Lu}\p{Script=Greek}])/u)
        .map(o => o.replace(/\u0000/g, '.').trim())
        .filter(Boolean);
}

/** El texto sin las direcciones web, donde un guion no es un rango. */
function sinEnlaces(s: string): string {
    return s.replace(/https?:\/\/\S+/g, m => ' '.repeat(m.length));
}
