import { clausesOfVerse, verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';

/**
 * G3 — LO QUE EL TEXTO DECIDE EN LOS NOMBRES Y LAS PREPOSICIONES griegas:
 *
 *   - el TIPO DE AGENCIA de una preposición con verbo pasivo (Wallace,
 *     «Expression of Agency»; profesor #G5, Stg 2:9 «ἐλεγχόμενοι ὑπὸ τοῦ
 *     νόμου»: el tutor decía «agente» sin el tipo);
 *   - el ARTÍCULO ANAFÓRICO: el artículo cuyo sustantivo ya apareció en el
 *     versículo anterior o antes en el mismo (profesor #G6, Stg 2:9 τοῦ νόμου
 *     → νόμον βασιλικόν de 2:8: el tutor dijo «de lo conocido» aunque tenía la
 *     opción y el versículo anterior).
 *
 * Se aplica AL MOSTRAR (como los verbos de G2): una regla mejorada llega a lo
 * ya guardado. El asistente explica; no decide esto.
 */

export type AgencyKind = 'ultimate' | 'intermediate' | 'impersonal';
export type NominalRule = 'agentHypo' | 'agentDia' | 'anaphoraLemma' | 'autosIntensive' | 'autosIdentical';
/** Usos de αὐτός que decide la posición (Wallace): «él mismo» o «el mismo». */
export type AutosUse = 'intensive' | 'identical';

export interface AgencyFact {
    /** Posición de la preposición en el versículo. */
    readonly ordinal: number;
    readonly kind: AgencyKind;
    readonly rule: NominalRule;
    /** El verbo pasivo del que es agente. */
    readonly verbOrdinal: number;
    /** El término de la preposición (el agente o el medio). */
    readonly termOrdinal: number;
}

export interface AnaphoraFact {
    /** Posición del artículo. */
    readonly ordinal: number;
    /** El sustantivo que el artículo acompaña. */
    readonly headOrdinal: number;
    /** Lo que retoma: la forma y su versículo («νόμον», 8). */
    readonly antecedent: { readonly text: string; readonly verse: number };
}

export interface AutosFact {
    readonly ordinal: number;
    readonly use: AutosUse;
    readonly rule: Extract<NominalRule, 'autosIntensive' | 'autosIdentical'>;
    /** Lo que αὐτός realza o identifica («κύριος» en «αὐτὸς ὁ κύριος»). */
    readonly headOrdinal?: number;
    /** «ἐπὶ τὸ αὐτό»: modismo, «juntos, en el mismo lugar» (Hch 2:1), no «sobre lo mismo». */
    readonly together?: true;
}

/** Todos los hechos nominales de un versículo, como viajan al prompt y a la ficha. */
export interface NominalFacts {
    readonly agency: readonly AgencyFact[];
    readonly anaphora: readonly AnaphoraFact[];
    readonly autos?: readonly AutosFact[];
}

const caso = (w: StructureWord | undefined) => w?.parse?.[4] ?? '';
const voz = (w: StructureWord) => (w.pos?.startsWith('V') ? w.parse?.[2] ?? '' : '');
const concuerda = (a: StructureWord, b: StructureWord) => !!a.parse && !!b.parse && a.parse.slice(4, 7) === b.parse.slice(4, 7);
const limpio = (t: string) => t.replace(/[,.;·’]/g, '');

/**
 * Sólo las que el corpus sostiene. Medido sobre el NT (2026-10-08): ἐν +
 * dativo con pasiva salía 505 veces y casi nunca es «medio» («ἐν Χριστῷ
 * ἡγιασμένοις», 1 Co 1:2, es esfera); ἀπό con pasiva suele ser separación
 * («χωρισθῆναι ἀπὸ ἀνδρός», 1 Co 7:10). Esos dos quedan para el asistente.
 */
const AGENCIA: Readonly<Record<string, { caso: string; kind: AgencyKind; rule: NominalRule }>> = {
    'ὑπό': { caso: 'G', kind: 'ultimate', rule: 'agentHypo' },
    'παρά': { caso: 'G', kind: 'ultimate', rule: 'agentHypo' },
    'διά': { caso: 'G', kind: 'intermediate', rule: 'agentDia' },
};

/** Pasivos de forma que no son pasivos («ἐγενήθη», «ἐπορεύθη», «ἀπεκρίθη»): no tienen agente. */
const DEPONENTES: ReadonlySet<string> = new Set(['γίνομαι', 'πορεύομαι', 'ἀποκρίνομαι', 'φαίνομαι', 'φοβέομαι', 'δύναμαι', 'βούλομαι', 'διαλέγομαι', 'ἀρνέομαι', 'ἐνθυμέομαι']);

/** Persona: pronombre, nombre propio o un sustantivo de persona. */
const PERSONAS: ReadonlySet<string> = new Set(['ἄνθρωπος', 'ἀνήρ', 'γυνή', 'ἀπόστολος', 'προφήτης', 'ἄγγελος', 'πατήρ', 'υἱός', 'κύριος', 'θεός', 'Χριστός', 'μαθητής', 'ἀδελφός', 'δοῦλος', 'διάκονος', 'πρεσβύτερος', 'γραμματεύς', 'βασιλεύς']);
const esPersona = (w: StructureWord) =>
    /^(RP|RR|RD)/.test(w.pos ?? '') || PERSONAS.has(w.l) || (!!w.l[0] && w.l[0] === w.l[0].toUpperCase() && w.l[0] !== w.l[0].toLowerCase());

/** El término de una preposición: la primera palabra con caso que sigue (saltando el artículo). */
function terminoDe(ws: readonly StructureWord[], i: number): number | undefined {
    for (let k = i + 1; k < ws.length && k <= i + 4; k++) {
        const w = ws[k]!;
        if (w.pos === 'RA') continue;
        return caso(w) ? k : undefined;
    }
    return undefined;
}

export function greekAgency(ch: ChapterStructure, verse: number): AgencyFact[] {
    if (ch.lang !== 'gr') return [];
    const ws = verseWords(ch, verse);
    const clausulas = clausesOfVerse(ch, verse);
    const porRef = new Map(ch.words.map(w => [w.r, w]));
    const out: AgencyFact[] = [];
    ws.forEach((w, i) => {
        const regla = w.pos === 'P-' ? AGENCIA[w.l] : undefined;
        if (!regla) return;
        const t = terminoDe(ws, i);
        if (t === undefined || caso(ws[t]) !== regla.caso) return;
        // διά + genitivo es AGENTE sólo con una persona; con una cosa es medio,
        // tiempo o lugar («διὰ πίστεως», 1 P 1:5; «διὰ νυκτός», Hch 16:9): eso
        // lo lee el asistente (revisión de G3). ὑπό sí, aunque sea impersonal:
        // «ὑπὸ τοῦ νόμου» es la ley personificada (profesor, Stg 2:9).
        if (regla.kind === 'intermediate' && !esPersona(ws[t]!)) return;
        // El verbo PASIVO más cercano de la MISMA cláusula; la madre sólo si la
        // propia no tiene verbo (1 P 2:5 «διὰ Ἰησοῦ» se ataba a un pasivo a 11 palabras).
        const propia = clausulas.filter(c => c.words.includes(w.r)).sort((a, b) => b.depth - a.depth)[0];
        const palabrasDe = (c: number) => ch.clauses[c]!.w.map(r => porRef.get(r)).filter((x): x is StructureWord => !!x);
        const enPropia = propia ? palabrasDe(propia.index) : [];
        const madre = propia && !enPropia.some(x => x.pos === 'V-') && ch.clauses[propia.index]!.p !== null ? palabrasDe(ch.clauses[propia.index]!.p!) : [];
        const pasivos = [...enPropia, ...madre].filter(x => voz(x) === 'P' && !DEPONENTES.has(x.l)).map(x => ws.indexOf(x)).filter(k => k >= 0);
        const v = pasivos.sort((a, b) => Math.abs(a - i) - Math.abs(b - i))[0] ?? -1;
        if (v < 0) return;
        out.push({ ordinal: i, kind: regla.kind, rule: regla.rule, verbOrdinal: v, termOrdinal: t });
    });
    return out;
}

const PRONOMBRES_1_2: ReadonlySet<string> = new Set(['ἐγώ', 'σύ']);
const POSPOSITIVAS: ReadonlySet<string> = new Set(['δέ', 'γάρ', 'οὖν', 'τέ', 'τε', 'μέν']);
/**
 * Lo que hace de αὐτός + artículo otra cosa que un intensivo, si va pegado (sin puntuación):
 * tras un sustantivo, el genitivo POSESIVO («γονεῖς αὐτοῦ τοῦ ἀναβλέψαντος», Jn 9:18); tras un
 * verbo o un pronombre, su objeto («παραδιδοὺς αὐτὸν τὸν τόπον», Jn 18:2). Tras «θαῦμα,» o
 * «ὑσσώπου αὐτό τε τὸ βιβλίον» (2 Co 11:14, Heb 9:19) sí es intensivo.
 */
const bloquea = (prev: StructureWord | undefined, w: StructureWord) =>
    !!prev && !conPuntuacion(prev) && ((prev.pos?.startsWith('N') && caso(w) === 'G') || /^(V|RP)/.test(prev.pos ?? ''));
/** «αὐτῇ τῇ ὥρᾳ» tras un verbo sigue siendo «en esa misma hora» (Lc 24:33, Hch 16:18). */
const TIEMPO: ReadonlySet<string> = new Set(['ὥρα', 'ἡμέρα', 'καιρός', 'νύξ']);
const conPuntuacion = (w: StructureWord) => /[,.;·]$/.test(w.t);
const esPropio = (w: StructureWord) => !!w.l[0] && w.l[0] === w.l[0].toUpperCase() && w.l[0] !== w.l[0].toLowerCase();

/**
 * El uso de αὐτός que decide su POSICIÓN (Wallace, «αὐτός»; prueba del
 * fundador, 1 Ts 4:16):
 *   - con el artículo delante y concordando («ὁ αὐτός», «τὸ αὐτὸ πνεῦμα»):
 *     IDENTIFICADOR, «el mismo»;
 *   - fuera del artículo, junto a un sustantivo con artículo: INTENSIVO, «él
 *     mismo» — delante («αὐτὸς ὁ κύριος», «ἐν αὐτῇ τῇ ὥρᾳ») o, en nominativo,
 *     detrás («ἡ φύσις αὐτή», 1 Co 11:14) —, o junto a ἐγώ/σύ («αὐτὸς ἐγώ»).
 *
 * Medido sobre el NT (2026-10-08): delante de artículo es posesivo o un
 * objeto si va tras un sustantivo o un verbo («γονεῖς αὐτοῦ τοῦ
 * ἀναβλέψαντος», Jn 9:18; «παραδιδοὺς αὐτὸν τὸν τόπον», Jn 18:2; «ἐστὶν αὐτῇ
 * τῇ καλουμένῃ», Lc 1:36); detrás, no tras puntuación
 * («ὁ βαπτιστής· αὐτὸς ἠγέρθη», Mt 14:2). Esos quedan sin regla.
 */
export function autosUseAt(ws: readonly StructureWord[], i: number): { use: AutosUse; head?: number; together?: true } | undefined {
    const w = ws[i];
    if (w?.l !== 'αὐτός' || !w.parse) return undefined;
    // Una pospositiva en medio no cambia la posición: «ὁ γὰρ αὐτὸς κύριος» (Ro 10:12),
    // «Αὐτὸς δὲ ὁ θεός» (1 Ts 3:11, 5:23; Jn 16:27 «αὐτὸς γὰρ ὁ πατήρ»). Revisión de #757.
    const a = POSPOSITIVAS.has(ws[i - 1]?.l ?? '') ? i - 2 : i - 1;
    const d = POSPOSITIVAS.has(ws[i + 1]?.l ?? '') && !conPuntuacion(w) ? i + 2 : i + 1;
    const prev = ws[a];
    const next = ws[d];
    if (prev?.pos === 'RA' && concuerda(prev, w)) {
        const nucleo = next?.pos?.startsWith('N') && concuerda(next, w) ? d : undefined;
        // «ἐπὶ τὸ αὐτό» (Hch 2:1) y «κατὰ τὸ αὐτό» (Hch 14:1): «juntos». El plural «κατὰ τὰ αὐτά»
        // (Lc 6:23) es «de la misma manera»: sigue como identificador.
        const juntos = nucleo === undefined && ['ἐπί', 'κατά'].includes(ws[a - 1]?.l ?? '') && w.parse.slice(4, 7) === 'ASN';
        return { use: 'identical', ...(nucleo !== undefined ? { head: nucleo } : {}), ...(juntos ? { together: true as const } : {}) };
    }
    // Delante de artículo + SUSTANTIVO que concuerda: intensivo. Con un adjetivo detrás del
    // artículo es un pronombre con aposición («αὐτοῖς δὲ τοῖς κλητοῖς», 1 Co 1:24).
    const tras = ws[d + 1];
    const tiempo = caso(w) === 'D' && TIEMPO.has(tras?.l ?? '');
    if (!conPuntuacion(w) && next?.pos === 'RA' && concuerda(next, w) && tras?.pos?.startsWith('N') && concuerda(tras, w)
        && (tiempo || !bloquea(prev, w))) {
        return { use: 'intensive', head: d + 1 };
    }
    if (caso(w) !== 'N') return undefined;
    if (ws[i - 1]?.pos?.startsWith('N') && concuerda(ws[i - 1]!, w) && !conPuntuacion(ws[i - 1]!)) return { use: 'intensive', head: i - 1 };
    // Nombre propio sin artículo: «αὐτὸς Δαυίδ» (Mc 12:36), «αὐτὸς Ἰησοῦς» (Lc 24:15). Un sustantivo
    // común detrás suele ser el PREDICADO («αὐτὸς ἱλασμός ἐστιν», 1 Jn 2:2): eso no.
    if (!conPuntuacion(w) && next?.pos?.startsWith('N') && concuerda(next, w) && esPropio(next)) return { use: 'intensive', head: d };
    // «Αὐτὸς δὲ ἐγὼ Παῦλος» (2 Co 10:1), «αὐτοὶ γὰρ ὑμεῖς» (1 Ts 4:9).
    const pron = [i - 1, d].find(k => PRONOMBRES_1_2.has(ws[k]?.l ?? '') && caso(ws[k]) === 'N');
    if (pron !== undefined) return { use: 'intensive', head: pron };
    return undefined;
}

export function greekAutos(ch: ChapterStructure, verse: number): AutosFact[] {
    if (ch.lang !== 'gr') return [];
    const ws = verseWords(ch, verse);
    const out: AutosFact[] = [];
    ws.forEach((_w, i) => {
        const u = autosUseAt(ws, i);
        if (u) out.push({ ordinal: i, use: u.use, rule: u.use === 'intensive' ? 'autosIntensive' : 'autosIdentical', ...(u.head !== undefined ? { headOrdinal: u.head } : {}), ...(u.together ? { together: true as const } : {}) });
    });
    return out;
}

const MONADICOS: ReadonlySet<string> = new Set(['θεός', 'κύριος']);

/** El sustantivo al que acompaña un artículo: el primero que concuerda, antes de otro artículo. */
function nucleoDe(ws: readonly StructureWord[], i: number): number | undefined {
    const art = ws[i]!;
    for (let k = i + 1; k < ws.length && k <= i + 4; k++) {
        const w = ws[k]!;
        if (w.pos === 'RA') return undefined;
        if (w.pos?.startsWith('N') && concuerda(w, art)) return k;
    }
    return undefined;
}

export function greekAnaphora(ch: ChapterStructure, verse: number): AnaphoraFact[] {
    if (ch.lang !== 'gr') return [];
    const ws = verseWords(ch, verse);
    const anterior = verse > 1 ? verseWords(ch, verse - 1) : [];
    const out: AnaphoraFact[] = [];
    ws.forEach((w, i) => {
        if (w.pos !== 'RA') return;
        const n = nucleoDe(ws, i);
        if (n === undefined) return;
        const lema = ws[n]!.l;
        // Nombre propio: su artículo es otra cosa (familiaridad), no anáfora.
        if (lema[0] && lema[0] === lema[0].toUpperCase() && lema[0] !== lema[0].toLowerCase()) return;
        // Sustantivos monádicos (Wallace): ὁ θεός, ὁ κύριος llevan artículo por ser únicos, no por retomar.
        if (MONADICOS.has(lema)) return;
        const enEste = [...ws.slice(0, i)].reverse().find(x => x.l === lema && x.pos?.startsWith('N'));
        const enAnterior = [...anterior].reverse().find(x => x.l === lema && x.pos?.startsWith('N'));
        const ante = enEste ?? enAnterior;
        if (!ante) return;
        out.push({ ordinal: i, headOrdinal: n, antecedent: { text: limpio(ante.t), verse: enEste ? verse : verse - 1 } });
    });
    return out;
}

/** Los usos que la regla NO corrige: los que el profesor dijo respetar. */
const USOS_QUE_SE_RESPETAN: ReadonlySet<string> = new Set(['monadic', 'parExcellence', 'withProperName', 'deictic', 'substantivizer', 'possessive', 'abstract']);

/**
 * Los hechos de G3 aplicados al mostrar sobre las palabras del análisis: la
 * agencia en la preposición y el artículo anafórico (salvo que el asistente
 * haya elegido un uso que se respeta).
 */
export function applyNominalRules<T extends { text?: string; articleUse?: string; antecedent?: string; agency?: AgencyKind; nominalRule?: NominalRule; autosUse?: AutosUse; autosHeadText?: string; autosTogether?: boolean; translation?: string; autosHeadTranslation?: string }>(
    words: readonly T[],
    agency: readonly AgencyFact[],
    anaphora: readonly AnaphoraFact[],
    autos: readonly AutosFact[] = [],
): T[] {
    const porAgencia = new Map(agency.map(a => [a.ordinal, a]));
    const porArticulo = new Map(anaphora.map(a => [a.ordinal, a]));
    const porAutos = new Map(autos.map(a => [a.ordinal, a]));
    return words.map((w, i) => {
        const { agency: _a, nominalRule: _r, autosUse: _u, autosHeadText: _h, autosTogether: _j, autosHeadTranslation: _ht, ...resto } = w;
        const ag = porAgencia.get(i);
        const an = porArticulo.get(i);
        const au = porAutos.get(i);
        let out = { ...resto } as T;
        if (ag) out = { ...out, agency: ag.kind, nominalRule: ag.rule };
        if (au) {
            const h = au.headOrdinal !== undefined ? words[au.headOrdinal] : undefined;
            const cabeza = h?.text ? limpio(h.text) : undefined;
            // La traducción de lo realzado, para decirlo en español («el Señor mismo»), no «κύριος mismo».
            const traduccion = h?.translation?.trim();
            out = {
                ...out,
                autosUse: au.use,
                nominalRule: au.rule,
                ...(cabeza ? { autosHeadText: cabeza } : {}),
                ...(cabeza && traduccion ? { autosHeadTranslation: traduccion } : {}),
                ...(au.together ? { autosTogether: true } : {}),
            };
        }
        if (an && !(w.articleUse && USOS_QUE_SE_RESPETAN.has(w.articleUse))) {
            out = { ...out, articleUse: 'anaphoric', antecedent: `${an.antecedent.text}, v. ${an.antecedent.verse}`, nominalRule: 'anaphoraLemma' };
        }
        return out;
    });
}

/** Los hechos para el prompt: el asistente los EXPLICA, no los decide. */
export function buildNominalFactsTask(agency: readonly AgencyFact[], anaphora: readonly AnaphoraFact[], words: readonly string[], autos: readonly AutosFact[] = []): string {
    if (!agency.length && !anaphora.length && !autos.length) return '';
    const AUTOS: Record<AutosUse, (h: string) => string> = {
        intensive: h => `αὐτός INTENSIVO (fuera del artículo${h ? `, junto a ${h}` : ''}): «él mismo»${h ? `, realza a ${h}` : ''}; NO es el pronombre «él». En su "translation" pon «mismo/misma/mismos/mismas» concordando con la palabra ESPAÑOLA${h ? ` que traduce ${h}` : ''}, y explícalo así.`,
        identical: h => `αὐτός IDENTIFICADOR (con el artículo delante): «el mismo». En su "translation" pon «el mismo/la misma/los mismos/las mismas/lo mismo» concordando con la palabra ESPAÑOLA${h ? ` que traduce ${h}` : ''}, y explícalo así.`,
    };
    const TIPO: Record<AgencyKind, string> = {
        ultimate: 'AGENTE ÚLTIMO (quien realmente hace la acción del verbo pasivo)',
        intermediate: 'AGENTE INTERMEDIO (por medio de quien actúa otro)',
        impersonal: 'MEDIO IMPERSONAL (con qué se hace)',
    };
    const lineas = [
        ...agency.map(a => `- ${a.ordinal + 1}. ${words[a.ordinal]} ${words[a.termOrdinal]}: ${TIPO[a.kind]} de la pasiva ${words[a.verbOrdinal]}. En el "syntacticFunction" de la preposición nómbralo así; si el agente es impersonal (una cosa, la ley, el pecado), explica la PERSONIFICACIÓN.`),
        ...autos.map(a => `- ${a.ordinal + 1}. ${words[a.ordinal]}: ${a.together ? '«ἐπὶ τὸ αὐτό» es MODISMO: «juntos, en el mismo lugar». Tradúcelo así, no «sobre lo mismo».' : AUTOS[a.use](a.headOrdinal !== undefined ? limpio(words[a.headOrdinal] ?? '') : '')}`),
        ...anaphora.map(a => `- ${a.ordinal + 1}. ${words[a.ordinal]}: artículo ANAFÓRICO — retoma ${a.antecedent.text} (v. ${a.antecedent.verse}). Devuelve "articleUse": "anaphoric" y "antecedent": "${a.antecedent.text}, v. ${a.antecedent.verse}", salvo que sea monádico o por antonomasia.`),
    ];
    return `
HECHOS QUE DA EL TEXTO (no los cambies; explícalos donde corresponda):
${lineas.join('\n')}`;
}
