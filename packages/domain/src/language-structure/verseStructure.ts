import { clausesOfVerse, verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';

/**
 * Lo que dibuja la vista «Estructura» de un versículo (fase módulos de idioma,
 * G1 + G5): cada cláusula con su conector, su relación con la que la contiene
 * y lo que va adelantado al verbo.
 *
 * Todo lo que aquí se decide sale del DATO (MACULA + MorphGNT / OSHB) y de
 * reglas que se pueden mostrar: la conjunción y su sentido, la clase de una
 * condicional por el modo de su verbo, el orden de los constituyentes. Lo que
 * el dato no alcanza a decidir (ἵνα de propósito o de resultado; כִּי causal o
 * de contenido) queda NOMBRADO como ambiguo, para que lo resuelva el asistente
 * o el estudiante, no adivinado.
 */

export const CLAUSE_RELATIONS = [
    'main',             // independiente, sin conector que analizar
    'addition',         // καί
    'development',      // δέ (Runge: desarrollo)
    'contrast',         // ἀλλά, πλήν
    'alternative',      // ἤ
    'ground',           // γάρ, διότι, ἐπεί
    'inference',        // οὖν, לָכֵן
    'condition',        // εἰ, ἐάν, אִם — la prótasis
    'question',         // εἰ interrogativo («si…», Mc 15:44)
    'exception',        // εἰ μή sin verbo («sino», «excepto»)
    'purpose',          // ὅπως, לְמַעַן
    'negativePurpose',  // פֶּן
    'result',           // ὥστε
    'purposeOrResult',  // ἵνα: lo decide el contexto
    'groundOrContent',  // ὅτι, כִּי: lo decide el contexto
    'comparison',       // ὡς, καθώς
    'time',             // ὅτε, ὅταν, ἕως
    'relative',         // ὅς, אֲשֶׁר
    'participial',      // cláusula de participio
    'infinitival',      // cláusula de infinitivo
    'speech',           // comienzo de discurso directo
    'chain',            // hebreo: וַ + wayyiqtol
    'conjunctive',      // hebreo: וְ + verbo (también weqatal, וְלֹא + verbo)
    'disjunctive',      // hebreo: וְ + NO verbo (Rut 1:14 וְרוּת)
    'asyndetic',        // hebreo: sin conjunción (Rut 1:16 עַמֵּךְ עַמִּי)
] as const;

export type ClauseRelation = (typeof CLAUSE_RELATIONS)[number];

/** `pp`: complemento preposicional (sólo MACULA hebreo). */
export type ConstituentRole = 's' | 'v' | 'o' | 'o2' | 'io' | 'adv' | 'pp' | 'p' | 'vc' | 'aux' | '';

export interface StructureToken {
    readonly r: string;
    readonly t: string;
    readonly role: ConstituentRole;
}

export interface StructureNode {
    /** Índice en `ch.clauses`. */
    readonly index: number;
    readonly depth: number;
    readonly words: readonly StructureToken[];
    /** La palabra que hace de conector («verso!n»), o `null`. */
    readonly connector: string | null;
    readonly relation: ClauseRelation;
    /** Sólo en una condicional griega: 1.ª a 4.ª clase. */
    readonly conditionalClass?: 1 | 2 | 3 | 4;
    /** Esta cláusula es la apódosis de una condicional que contiene. */
    readonly isApodosis: boolean;
    /** Sin verbo finito ni participio ni infinitivo: cláusula nominal. */
    readonly verbless: boolean;
    /**
     * U11 (Stg 2:14 «ἐὰν … λέγῃ τις ἔχειν / ἔργα δὲ μὴ ἔχῃ»): la prótasis de varios
     * miembros. Todas sus filas llevan el mismo número; la primera es la condición.
     */
    readonly conditionGroup?: number;
    /**
     * Constituyentes antes del verbo, en orden (sujeto, objeto, adverbial…):
     * `r` es la primera palabra y `rs` todas las del constituyente.
     */
    readonly fronted: readonly { readonly r: string; readonly rs: readonly string[]; readonly role: ConstituentRole }[];
}

const ROLES: ReadonlySet<string> = new Set(['s', 'v', 'o', 'o2', 'io', 'adv', 'pp', 'p', 'vc', 'aux']);
const rolDe = (r: string): ConstituentRole => (ROLES.has(r) ? (r as ConstituentRole) : '');

// ── Griego ────────────────────────────────────────────────────────────────────

/** Antes de un ἐάν partícula, lo hacen temporal indefinido («cada vez que»). */
const TEMPORAL_INDEFINIDO: ReadonlySet<string> = new Set(['ὁσάκις', 'ἡνίκα', 'ὅτε', 'ὡς']);
/** Antes de ἐάν hacen de él un relativo indefinido («ὃ ἐάν», «ὅπου ἐάν»). */
const RELATIVOS: ReadonlySet<string> = new Set(['ὅς', 'ὅστις', 'ὅσος', 'ὅπου', 'οἷος', 'ὁποῖος', 'ὅθεν']);

const CONECTOR_GRIEGO: Readonly<Record<string, ClauseRelation>> = {
    'καί': 'addition', 'τε': 'addition', 'δέ': 'development', 'ἀλλά': 'contrast', 'πλήν': 'contrast', 'ἤ': 'alternative',
    'οὐδέ': 'addition', 'μηδέ': 'addition',
    'γάρ': 'ground', 'διότι': 'ground', 'ἐπεί': 'ground', 'οὖν': 'inference', 'διό': 'inference', 'ἄρα': 'inference',
    'εἰ': 'condition', 'ἐάν': 'condition', 'ὅπως': 'purpose', 'ὥστε': 'result', 'ἵνα': 'purposeOrResult', 'ὅτι': 'groundOrContent',
    'ὡς': 'comparison', 'καθώς': 'comparison', 'ὥσπερ': 'comparison', 'καθάπερ': 'comparison',
    'ὅτε': 'time', 'ὅταν': 'time', 'ἕως': 'time', 'πρίν': 'time', 'ἡνίκα': 'time',
};

/** Modo del verbo en el código de MorphGNT (posición 4): I, S, O, D, N (infinitivo), P (participio). */
const modo = (w: StructureWord) => (w.pos?.startsWith('V') ? w.parse?.[3] ?? '' : '');
const tiempo = (w: StructureWord) => w.parse?.[1] ?? '';

/**
 * Clase de una condicional griega por el modo (y tiempo) de su primer verbo
 * finito, y por la partícula ἄν en la apódosis (Wallace):
 *   εἰ + indicativo = 1.ª · εἰ + indicativo pasado con ἄν en la apódosis = 2.ª
 *   ἐάν (o εἰ) + subjuntivo = 3.ª · εἰ + optativo = 4.ª
 */
function claseCondicional(prot: readonly StructureWord[], apodosis: readonly StructureWord[]): 1 | 2 | 3 | 4 | undefined {
    const finito = prot.find(w => ['I', 'S', 'O'].includes(modo(w)));
    if (!finito) return undefined;
    const m = modo(finito);
    if (m === 'O') return 4;
    if (m === 'S') return 3;
    const pasado = ['I', 'A', 'Y'].includes(tiempo(finito));
    return pasado && apodosis.some(w => w.l === 'ἄν') ? 2 : 1;
}

// ── Hebreo ────────────────────────────────────────────────────────────────────

const LEMA = { ki: '3588', im: '518', lemaan: '4616', pen: '6435', ken: '3651', al_: '5921', o: '176', amar: '559', lo: '3808', al: '408' } as const;
/** «c/d/776 a» → «776»: sin prefijos (waw, preposición, artículo) ni homónimo. */
const lemaBase = (l: string) => l.replace(/^([a-z]+\/)+/, '').replace(/\s.*$/, '');
/** OSHB marca la waw prefijada con «c/» en el lema. */
const conWaw = (w: StructureWord) => w.l.startsWith('c/');
const SUBORDINANTE: Readonly<Record<string, ClauseRelation>> = {
    [LEMA.ki]: 'groundOrContent', [LEMA.im]: 'condition', [LEMA.lemaan]: 'purpose', [LEMA.pen]: 'negativePurpose', [LEMA.o]: 'alternative',
};
const piezas = (w: StructureWord) => w.parts ?? [];
const esVerboHe = (m: string) => m.startsWith('V');

function relacionHebrea(
    ws: readonly StructureWord[],
    anterior: readonly StructureWord[] | null,
    previa: StructureWord | null,
    abreHija: (r: string) => boolean,
): { relation: ClauseRelation; connector: string | null } {
    // La palabra justo antes de la cláusula: si es אֲשֶׁר, esta cláusula es la
    // RELATIVA (MACULA deja אֲשֶׁר en la madre: «אֶל אֲשֶׁר | תֵּלְכִי»).
    if (previa && piezas(previa).some(x => x.m === 'Tr')) return { relation: 'relative', connector: previa.r };
    const [p, segunda] = ws;
    if (!p) return { relation: 'main', connector: null };
    const ps = piezas(p);
    // Si su אֲשֶׁר abre una hija («בַּאֲשֶׁר | תָּמוּתִי | אָמוּת»), la relativa es
    // la hija y esta es la principal.
    const relativa = ps.some(x => x.m === 'Tr') && ps.findIndex(x => x.m === 'Tr') <= 1 && !abreHija(p.r);
    const lema = lemaBase(p.l);
    // כִּי אִם: «sino» (tras negación) o «excepto»; no es causa ni contenido.
    if (lema === LEMA.ki && segunda && lemaBase(segunda.l) === LEMA.im) return { relation: 'contrast', connector: p.r };
    // לָכֵן y עַל כֵּן: «por tanto». כֵּן solo es «así» y no conecta (revisión de G1 + G5).
    if ((lema === LEMA.ken && /(^|\/)l\/3651/.test(p.l)) || (lema === LEMA.al_ && segunda && lemaBase(segunda.l) === LEMA.ken))
        return { relation: 'inference', connector: p.r };
    // אִם, כִּי, לְמַעַן… también son «C» en OSHB: se miran antes que la waw.
    if (SUBORDINANTE[lema] && (!conWaw(p) || ps.length > 1)) return { relation: SUBORDINANTE[lema]!, connector: p.r };
    if (conWaw(p)) {
        // וְ / וַ: decide lo que viene después de la waw.
        if (relativa) return { relation: 'relative', connector: p.r };
        const resto = ps.slice(1);
        const siguienteM = resto[0]?.m ?? (segunda ? piezas(segunda)[0]?.m ?? '' : '');
        const siguienteLema = resto.length ? lema : lemaBase(segunda?.l ?? '');
        if (esVerboHe(siguienteM)) return { relation: siguienteM[2] === 'w' ? 'chain' : 'conjunctive', connector: p.r };
        if (siguienteLema === LEMA.lo || siguienteLema === LEMA.al) return { relation: 'conjunctive', connector: p.r };
        return { relation: 'disjunctive', connector: p.r };
    }
    if (relativa) return { relation: 'relative', connector: p.r };
    // Sin conjunción después de «dijo»: comienza el discurso directo.
    if (anterior?.some(w => lemaBase(w.l) === LEMA.amar)) return { relation: 'speech', connector: null };
    // Infinitival sólo si el VERBO de la cláusula es infinitivo (la palabra con
    // ל- puede figurar también en la madre por su preposición).
    const infinitivo = (w: StructureWord) => piezas(w).some(x => /^V.c/.test(x.m));
    const verbo = ws.find(w => w.role === 'v');
    if (verbo ? infinitivo(verbo) : ws.some(infinitivo)) return { relation: 'infinitival', connector: null };
    return { relation: 'asyndetic', connector: null };
}

// ── Común ─────────────────────────────────────────────────────────────────────

/**
 * U11 (revisión del profesor, Stg 2:18 «Ἀλλ’ ἐρεῖ τις· Σὺ πίστιν ἔχεις…»): los
 * verbos de decir cuyo OBJETO es una cláusula sin conector. Esa cláusula es lo
 * dicho (discurso directo), no una «Principal».
 */
const DECIR_GRIEGO: ReadonlySet<string> = new Set(['λέγω', 'φημί', 'ἀποκρίνομαι', 'κράζω', 'λαλέω']);

/**
 * Revisión del profesor (Stg 2:18, 2026-11): «δεῖξόν μοι τὴν πίστιν σου… κἀγώ σοι δείξω…» va al margen, como
 * coordinada. Son καί + pronombre o adverbio en una palabra (crasis); κἄν (καὶ ἐάν) no, que es condición.
 */
const CRASIS_KAI: ReadonlySet<string> = new Set(['κἀγώ', 'κἀκεῖ', 'κἀκεῖθεν', 'κἀκεῖνος']);

const NEGACIONES: ReadonlySet<string> = new Set(['μή', 'οὐ', 'οὐκ', 'οὐχ', LEMA.lo, LEMA.al]);

function adelantados(
    tokens: readonly StructureToken[],
    noCuenta: (r: string) => boolean,
    finito: (r: string) => boolean,
): StructureNode['fronted'] {
    const iv = tokens.findIndex(t => t.role === 'v' || t.role === 'vc');
    // Sólo ante un verbo FINITO el orden es elección del autor. Delante de un
    // infinitivo o un participio todo va «antes» por construcción (Stg 1:1, el
    // saludo «Ἰάκωβος… ταῖς δώδεκα φυλαῖς… χαίρειν»).
    if (iv <= 0 || !finito(tokens[iv]!.r)) return [];
    const out: { r: string; rs: string[]; role: ConstituentRole }[] = [];
    for (const t of tokens.slice(0, iv)) {
        // El conector sin rol no cuenta; el que lo tiene sí: en hebreo la waw va
        // pegada a lo antepuesto («וְהָאָרֶץ הָיְתָה», Gn 1:2).
        if (!t.role || t.role === 'v' || noCuenta(t.r)) continue;
        const ultimo = out[out.length - 1];
        if (ultimo?.role === t.role) ultimo.rs.push(t.r);
        else out.push({ r: t.r, rs: [t.r], role: t.role });
    }
    return out;
}

export function verseStructure(ch: ChapterStructure, verse: number): StructureNode[] {
    const porRef = new Map(ch.words.map(w => [w.r, w]));
    const lemas = new Map(ch.words.map(w => [w.r, lemaBase(w.l)]));
    const posicion = new Map(ch.words.map((w, i) => [w.r, i]));
    const nodos = clausesOfVerse(ch, verse);
    const delVerso = verseWords(ch, verse);
    const enElVerso = new Set(delVerso.map(w => w.r));
    const palabrasDe = (rs: readonly string[]) => rs.map(r => porRef.get(r)).filter((w): w is StructureWord => !!w && !w.ketiv);
    const hijas = new Map<number, number[]>();
    ch.clauses.forEach((c, i) => { if (c.p !== null) hijas.set(c.p, [...(hijas.get(c.p) ?? []), i]); });
    /** Las palabras de una cláusula y de todas las que contiene. */
    const subarbol = (i: number): StructureWord[] => {
        const out = new Set<string>();
        const pila = [i];
        while (pila.length) { const c = pila.pop()!; ch.clauses[c]?.w.forEach(r => out.add(r)); pila.push(...(hijas.get(c) ?? [])); }
        return palabrasDe([...out].sort((a, b) => (posicion.get(a) ?? 0) - (posicion.get(b) ?? 0)));
    };
    /** La palabra anterior DEL MISMO versículo (la conjunción del final del anterior no es de este). */
    const previaDe = (r: string | undefined): StructureWord | null => {
        const i = r === undefined ? -1 : (posicion.get(r) ?? -1);
        for (let k = i - 1; k >= 0; k--) {
            const w = ch.words[k]!;
            if (!enElVerso.has(w.r)) return null;
            if (!w.ketiv) return w;
        }
        return null;
    };
    const esTr = (w: StructureWord | null) => !!w && piezas(w).some(x => x.m === 'Tr');
    const trQueAbren = new Set(nodos.map(n => previaDe(palabrasDe(n.words)[0]?.r)).filter(esTr).map(w => w!.r));
    // Antes del verbo por gramática, no por énfasis: la negación y, en griego,
    // las conjunciones y partículas con función adverbial («εἰ καὶ πάσχοιτε»).
    /**
     * El relativo y el interrogativo (y la preposición que los rige) van
     * siempre al comienzo de su cláusula: es gramática, no énfasis. «δι’ οὗ
     * ἐκλήθητε» (1 Co 1:9) salía «antepuesto: foco» (prueba del fundador).
     */
    const relativoOInterrogativo = (w: StructureWord | undefined) => !!w && (w.pos === 'RR' || w.l === 'τίς');
    const posVerso = new Map(verseWords(ch, verse).map((w, i, ws) => [w.r, ws[i + 1]]));
    const noCuenta = (r: string) => {
        const w = porRef.get(r);
        if (ch.lang === 'gr' && (relativoOInterrogativo(w) || (w?.pos === 'P-' && relativoOInterrogativo(posVerso.get(r))))) return true;
        // καί adverbial («aun», «también»): MorphGNT lo marca D-, pero no es un constituyente adelantado.
        return NEGACIONES.has(lemas.get(r) ?? '') || (ch.lang === 'gr' && (w?.l === 'καί' || (!!w?.pos && /^[CX]/.test(w.pos))));
    };

    // Palabras del versículo que MACULA no puso en ninguna cláusula (1 Co 16:13
    // Γρηγορεῖτε; לָכֵן, עַל כֵּן, עַתָּה). Un tramo sin verbo justo antes de una
    // cláusula es su conector o su marco; si no, va en una fila propia.
    const cubiertas = new Set(nodos.flatMap(n => n.words));
    const tramos: StructureWord[][] = [];
    const verbal = (w: StructureWord) => w.role === 'v' || w.role === 'vc';
    for (const w of delVerso) {
        if (cubiertas.has(w.r)) { if (tramos[tramos.length - 1]?.length) tramos.push([]); continue; }
        const actual = tramos[tramos.length - 1];
        // Un verbo suelto más es otra cláusula («ἀνδρίζεσθε, κραταιοῦσθε», 1 Co 16:13).
        if (!actual || (verbal(w) && actual.some(verbal))) tramos.push([]);
        tramos[tramos.length - 1]!.push(w);
    }
    const prefijo = new Map<number, StructureWord[]>();
    const sueltos: StructureWord[][] = [];
    for (const tramo of tramos.filter(t => t.length)) {
        const ultima = tramo[tramo.length - 1]!;
        const sigue = delVerso[delVerso.indexOf(ultima) + 1];
        const conVerbo = tramo.some(verbal);
        const destino = sigue && !conVerbo
            ? nodos.filter(n => palabrasDe(n.words)[0]?.r === sigue.r).sort((a, b) => a.depth - b.depth)[0]
            : undefined;
        if (destino) prefijo.set(destino.index, tramo);
        else sueltos.push(tramo);
    }

    const apodosis = new Set<number>();
    const conFila = new Set(nodos.map(n => n.index));
    const relacion = (ws: readonly StructureWord[], i: number, regla: string | null, madre: number | null) => {
        let relation: ClauseRelation = 'main';
        let connector: string | null = null;
        let conditionalClass: StructureNode['conditionalClass'];
        const sub = i >= 0 ? subarbol(i) : [...ws];
        if (ch.lang === 'gr') {
            // El conector va sin rol (un καί o ἤ dentro de una frase lo hereda: 1 Co
            // 11:19 «ἵνα καὶ οἱ δόκιμοι»); el relativo sí lo trae y puede ir tras
            // una preposición (Ef 1:7 «ἐν ᾧ»).
            const primera = ws.find(w => w.pos === 'RR' || (!w.role && (w.pos === 'C-' || CONECTOR_GRIEGO[w.l])));
            const conector = primera && ws.indexOf(primera) <= 1 ? primera : undefined;
            if (conector && conector.pos !== 'RR' && CONECTOR_GRIEGO[conector.l]) {
                relation = CONECTOR_GRIEGO[conector.l]!;
                connector = conector.r;
            } else if (conector?.pos === 'RR') {
                relation = 'relative';
                connector = conector.r;
            } else if (ws.some(w => verbal(w) && modo(w) === 'P')) {
                relation = 'participial';
            } else if (ws.some(w => verbal(w) && modo(w) === 'N')) {
                relation = 'infinitival';
            }
            if (relation === 'condition' && conector) {
                const tras = delVerso[delVerso.indexOf(conector) + 1];
                const antes = previaDe(conector.r);
                if (regla === 'PtclCL' && conector.l === 'εἰ') {
                    // MACULA marca así el εἰ interrogativo («si ya había muerto», Mc 15:44).
                    relation = 'question';
                } else if (conector.l === 'ἐάν' && (conector.pos === 'X-' || (antes && (antes.pos === 'RR' || RELATIVOS.has(antes.l))))) {
                    // ἐάν PARTÍCULA (MorphGNT X-) hace de ἄν: «ὃ ἐάν» relativo indefinido («lo que», 1 Jn 3:22),
                    // «ὁσάκις ἐάν» temporal indefinido («cada vez que», 1 Co 11:25, Ap 11:6; en 1 Co 11:26 la fila
                    // lleva la relación de su γάρ, y 2 Co 3:16 la de su ἡνίκα). No es
                    // condición. El ἐάν conjunción (C-) tras un relativo (Mt 21:24, Jn 21:25, Heb 13:23) se lee
                    // condición en la ficha del verbo, pero aquí sigue en la fila de su relativa: MACULA deja el
                    // relativo en la hija y una fila de sólo «ἐάν» se leía peor. Pendientes de la revisión, 2026-11-13.
                    relation = antes && TEMPORAL_INDEFINIDO.has(antes.l) ? 'time' : 'relative';
                    connector = null;
                } else if (conector.l === 'εἰ' && tras?.l === 'μή' && !sub.some(w => ['I', 'S', 'O'].includes(modo(w)))) {
                    // «εἰ μή» sin verbo: «sino», «excepto» (Mt 12:4).
                    relation = 'exception';
                } else {
                    // MACULA suele poner εἰ en una cláusula envoltorio y el verbo en
                    // una hija: la clase se mira en todo el subárbol.
                    if (madre !== null) apodosis.add(madre);
                    conditionalClass = claseCondicional(sub, madre !== null ? subarbol(madre) : []);
                }
            }
        } else {
            ({ relation, connector } = relacionHebrea(ws, null, previaDe(ws[0]?.r), r => trQueAbren.has(r)));
            if (relation === 'condition' && madre !== null) apodosis.add(madre);
        }
        // Un nodo que sólo trae su conector (envoltorio de coordinación) no es
        // una cláusula nominal: su verbo está en las hijas. Pero si la fila trae
        // su PREDICADO (rol «p») y ningún verbo propio, es nominal aunque una
        // hija tenga verbo: «ἡ γὰρ κρίσις ἀνέλεος τῷ μὴ ποιήσαντι» (Stg 2:13) no
        // salía nominal por el participio de la hija, ni «πιστὸς ὁ θεός, δι’ οὗ
        // ἐκλήθητε» (1 Co 1:9) por su relativa (revisión del profesor, 2026-11).
        const conVerbo = (xs: readonly StructureWord[]) => ch.lang === 'gr'
            ? xs.some(w => w.pos?.startsWith('V'))
            : xs.some(w => piezas(w).some(x => esVerboHe(x.m)));
        const verbless = !conVerbo(ws) && (ws.some(w => w.role === 'p') || !conVerbo(sub));
        return { relation, connector, conditionalClass, verbless };
    };
    // Una palabra hebrea de varias piezas lleva el rol de la primera (לְ = Prep);
    // si una de sus piezas es el verbo de la cláusula (לְעָזְבֵךְ), es «V».
    /** Indicativo, subjuntivo, optativo, imperativo (MorphGNT); en OSHB, perfecto, imperfecto, wayyiqtol, weqatal, volitivos e imperativo. */
    const finito = (r: string) => {
        const w = porRef.get(r);
        if (!w) return false;
        return ch.lang === 'gr' ? ['I', 'S', 'O', 'D'].includes(modo(w)) : piezas(w).some(x => /^V.[pqiwhjv]/.test(x.m));
    };
    const token = (w: StructureWord): StructureToken =>
        ({ r: w.r, t: w.t, role: piezas(w).some(x => x.role === 'v') ? 'v' : rolDe(w.role) });

    const parcial: Fila[] = nodos.map((n, i) => {
        const ws = [...(prefijo.get(n.index) ?? []), ...palabrasDe(n.words)];
        let r = relacion(ws, n.index, n.clause.rule, n.clause.p);
        // Sin conjunción después de «dijo»: comienza el discurso directo.
        if (ch.lang === 'he' && r.relation === 'asyndetic' && i > 0 && palabrasDe(nodos[i - 1]!.words).some(w => lemaBase(w.l) === LEMA.amar))
            r = { ...r, relation: 'speech' };
        // Griego (U11, Stg 2:18): el objeto sin conector de un verbo de decir es lo dicho.
        const madre = n.clause.p === null ? undefined : nodos.find(x => x.index === n.clause.p);
        if (ch.lang === 'gr' && r.relation === 'main' && !r.connector && (n.clause.role === 'o' || n.clause.role === 'o2')
            && madre && palabrasDe(madre.words)[0]?.pos !== 'RR' && palabrasDe(madre.words).some(w => w.pos?.startsWith('V') && DECIR_GRIEGO.has(w.l)))
            r = { ...r, relation: 'speech' };
        return { index: n.index, parent: n.clause.p, depth: n.depth, tokens: ws.map(token), ...r, isApodosis: false };
    });
    const base = nodos.length ? Math.min(...nodos.map(n => n.depth)) : 0;
    sueltos.forEach((tramo, k) => {
        parcial.push({ index: -1 - k, parent: null, depth: base, tokens: tramo.map(token), ...relacion(tramo, -1 - k, null, null), isApodosis: false });
    });
    for (const f of parcial) {
        // Si la madre de la prótasis no tiene palabras propias (Rut 3:13: la
        // oración condicional es sólo un contenedor), la apódosis son sus otras hijas.
        f.isApodosis = apodosis.has(f.index)
            || (f.relation !== 'condition' && f.parent !== null && apodosis.has(f.parent) && !conFila.has(f.parent));
    }
    // La madre, para fundir, es la cláusula más cercana CON fila en el versículo. MACULA puede poner entre
    // las dos un nodo sin palabras aquí (1 Co 10:3: el «καὶ» de una coordinación de cuatro, con la cláusula
    // colgando de un nodo que sólo tiene palabras en otro versículo); así la fila de sólo «καὶ» no hallaba
    // a su hija y quedaba sola (pendientes de «Estructura», 2026-11-13).
    const conFilaArriba = (p: number | null) => {
        while (p !== null && !conFila.has(p)) p = ch.clauses[p]?.p ?? null;
        return p;
    };
    // Sólo en griego: en hebreo la conjunción va pegada a su cláusula y no queda fila de sólo conector; ahí
    // el mismo cambio movía la sangría de 4.000 versículos y la empeoraba (Dt 26:5, Is 65:14).
    if (ch.lang === 'gr') for (const f of parcial) f.parent = conFilaArriba(f.parent);
    return fundirEnvoltorios(ch, parcial, posicion).map(f => ({
        index: f.index,
        depth: f.depth,
        words: f.tokens,
        connector: f.connector,
        relation: f.relation,
        ...(f.conditionalClass ? { conditionalClass: f.conditionalClass } : {}),
        isApodosis: f.isApodosis,
        verbless: f.verbless,
        ...(f.conditionGroup !== undefined ? { conditionGroup: f.conditionGroup } : {}),
        fronted: adelantados(f.tokens, noCuenta, finito),
    }));
}

interface Fila {
    index: number;
    parent: number | null;
    depth: number;
    tokens: StructureToken[];
    connector: string | null;
    relation: ClauseRelation;
    conditionalClass: StructureNode['conditionalClass'];
    isApodosis: boolean;
    verbless: boolean;
    conditionGroup?: number;
}

/**
 * MACULA envuelve muchas cláusulas en otra que sólo trae la partícula
 * (`PtclCL` «οὐκ»), el artículo (`DetCL` «τὸ ἐπικληθέν»), la conjunción
 * (`Conj-CL` «Εἰ», `ClCl` «καί» entre dos coordinadas) o la waw separada de su
 * verbo (`וַ|תִּבְכֶּינָה`). Como fila propia no dicen nada y desordenan la
 * lectura (la «καί» de una coordinación queda arriba de la primera
 * coordinada). Se funden en la hija donde sigue el texto: ella recibe sus
 * palabras y, si no tenía conector, su relación; las demás hijas suben un
 * nivel y heredan la apódosis.
 *
 * NO se funde si la palabra que sigue no está en una hija directa (Stg 2:9
 * «εἰ δὲ προσωπολημπτεῖτε, ἁμαρτίαν…»: δέ se lee antes que la prótasis) ni si
 * madre e hija traen cada una su conector (Stg 1:5 «Εἰ δέ…»): ahí la fila del
 * conector se queda y lo de abajo va sangrado.
 */
const POSPOSITIVOS: ReadonlySet<string> = new Set(['δέ', 'γάρ', 'οὖν', 'τε', 'μέν']);
const ESPERA = 'espera' as const;

function fundirEnvoltorios(ch: ChapterStructure, filas: Fila[], posicion: ReadonlyMap<string, number>): Fila[] {
    const lemaDe = new Map(ch.words.map(w => [w.r, w.l]));
    const posDe = new Map(ch.words.map(w => [w.r, w.pos ?? '']));
    const palabraDe = new Map(ch.words.map(w => [w.r, w]));
    const modoDe = (r: string) => { const w = palabraDe.get(r); return w ? modo(w) : ''; };
    /** Una fila con algo más que conectores y partículas (1 Co 12:5 «καὶ ὁ αὐτὸς κύριος» no trae roles, pero es cláusula). */
    const deVerdad = (f: Fila) => f.tokens.some(t => t.role || (!CONECTOR_GRIEGO[lemaDe.get(t.r) ?? ''] && !/^[CX]/.test(posDe.get(t.r) ?? '')));
    const desciendeDe = (i: number, ancestro: number) => {
        for (let p = ch.clauses[i]?.p ?? null; p !== null; p = ch.clauses[p]?.p ?? null) if (p === ancestro) return true;
        return false;
    };
    // La palabra que sigue, saltando la pospositiva («Εἰ δέ τις»: tras Εἰ sigue τις).
    const siguiente = (r: string): string | undefined => {
        for (let k = (posicion.get(r) ?? -2) + 1; k < ch.words.length; k++) {
            const w = ch.words[k]!;
            if (!w.ketiv && !POSPOSITIVOS.has(w.l)) return w.r;
        }
        return undefined;
    };
    const orden = (a: StructureToken, b: StructureToken) => (posicion.get(a.r) ?? 0) - (posicion.get(b.r) ?? 0);
    // La fila que empieza con una pospositiva se lee ANTES de la palabra que la
    // precede: «Εἰ δέ…» es «δέ: Εἰ…».
    const clave = (f: Fila) => {
        const t = f.tokens[0];
        if (!t) return Infinity;
        const pos = posicion.get(t.r) ?? 0;
        return POSPOSITIVOS.has(lemaDe.get(t.r) ?? '') ? pos - 1.5 : pos;
    };
    // U11 (revisión del profesor, Stg 2:14 «ἐὰν πίστιν λέγῃ τις ἔχειν»): una hija
    // DISCONTINUA (sus palabras envuelven a las de la madre) va EN LÍNEA con la
    // madre. Como fila aparte salía antes que su verbo («πίστιν ἔχειν» arriba de
    // «λέγῃ τις») y rompía el orden del texto. Se mira sólo la hija sin conector.
    const pos = (t: StructureToken) => posicion.get(t.r) ?? 0;
    let enLinea = true;
    while (enLinea) {
        enLinea = false;
        for (const hija of filas) {
            const madre = filas.find(f => f.index === hija.parent);
            // La madre es una cláusula de verdad (con constituyentes), no un envoltorio de sólo
            // conector («δέ» de Stg 2:14): esos los funde `fundirEnvoltorios` más abajo.
            // Lo dicho va en su fila aunque lo corte el verbo de decir (Hch 25:5 «Οἱ οὖν ἐν ὑμῖν, φησίν,
            // δυνατοὶ…»; 1 S 28:13): revisión adversarial, 2026-11-12.
            if (!madre || hija.connector || hija.relation === 'speech' || hija.tokens.length < 2 || !madre.tokens.some(t => t.role)) continue;
            const ps = hija.tokens.map(pos);
            const desde = Math.min(...ps), hasta = Math.max(...ps);
            // Lo que interrumpe a la hija es un CONSTITUYENTE de la madre, no su conector
            // pospositivo (Jn 5:7 «ἐν ᾧ δὲ ἔρχομαι»: el δέ va dentro de la relativa).
            // Un vocativo (`aux`) en medio no cuenta (Heb 1:8 «Ὁ θρόνος σου ὁ θεὸς εἰς τὸν αἰῶνα»).
            const interrumpen = madre.tokens.filter(t => t.role && t.role !== 'aux' && t.r !== madre.connector && pos(t) > desde && pos(t) < hasta);
            if (!interrumpen.length) continue;
            // Un «φησίν» parentético dentro de la cita no la vuelve parte de la frase del narrador.
            if (interrumpen.every(t => t.role === 'v' && DECIR_GRIEGO.has(lemaDe.get(t.r) ?? ''))) continue;
            // Una palabra hebrea de varias piezas puede estar en las dos (לְ|דַבֵּר): va una vez.
            const yaEsta = new Set(madre.tokens.map(t => t.r));
            madre.tokens = [...madre.tokens, ...hija.tokens.filter(t => !yaEsta.has(t.r))].sort(orden);
            madre.isApodosis ||= hija.isApodosis;
            for (const f of filas) if (f.parent === hija.index) f.parent = madre.index;
            for (const f of filas) if (desciendeDe(f.index, hija.index)) f.depth -= 1;
            filas = filas.filter(f => f !== hija);
            enLinea = true;
            break;
        }
    }
    const DE_FORMA_FILA: ReadonlySet<ClauseRelation> = new Set(['main', 'asyndetic', 'participial', 'infinitival']);
    const COORDINANTE: ReadonlySet<ClauseRelation> = new Set(['addition', 'development', 'contrast', 'alternative', 'ground', 'inference']);
    // Griego: una coordinación de varios miembros cuyo ÚLTIMO miembro es la propia cláusula (`Conj4CL`, Mc 10:34
    // «καὶ ἐμπτύσουσιν αὐτῷ καὶ μαστιγώσουσιν αὐτὸν καὶ ἀποκτενοῦσιν») trae todos los καί: «καὶ καὶ καὶ
    // ἀποκτενοῦσιν». Cada καί va a la hija cuya palabra sigue; la madre se queda con el suyo (pendientes de
    // «Estructura», 2026-11-13: Mt 13:15, Jn 12:40, Hch 28:27).
    if (ch.lang === 'gr') for (const madre of filas) {
        if (!madre.tokens.some(t => t.role)) continue;
        for (const c of [...madre.tokens]) {
            // Sólo los que coordinan: el εἰ de «Κύριε, εἰ…» (Hch 1:6) se queda con su vocativo.
            if (c.role || !COORDINANTE.has(CONECTOR_GRIEGO[lemaDe.get(c.r) ?? ''] ?? 'main')) continue;
            // El pospositivo va con la palabra que lo PRECEDE: si ésa no está en la hija, se queda (Lc 11:35
            // «σκόπει οὖν», revisión adversarial).
            const r = POSPOSITIVOS.has(lemaDe.get(c.r) ?? '') ? ch.words[pos(c) - 1]?.r : siguiente(c.r);
            const hija = filas.find(f => f.parent === madre.index && f.tokens.some(t => t.r === r));
            if (!hija || hija.connector) continue;
            madre.tokens = madre.tokens.filter(t => t !== c);
            hija.tokens = [c, ...hija.tokens].sort(orden);
            hija.connector = c.r;
            if (DE_FORMA_FILA.has(hija.relation)) hija.relation = CONECTOR_GRIEGO[lemaDe.get(c.r)!]!;
            if (madre.connector === c.r) {
                const propio = madre.tokens.find(t => !t.role && CONECTOR_GRIEGO[lemaDe.get(t.r) ?? '']);
                madre.connector = propio?.r ?? null;
                // Sin su conector, la madre vuelve a la relación por su forma («διωκόμενοι ἀλλ’ οὐκ
                // ἐγκαταλειπόμενοι», 2 Co 4:9: «διωκόμενοι» es participio, no «contraste»).
                if (!propio && madre.conditionalClass === undefined) {
                    const modos = madre.tokens.filter(t => t.role === 'v').map(t => modoDe(t.r));
                    madre.relation = modos.includes('P') ? 'participial' : modos.includes('N') ? 'infinitival' : 'main';
                }
            }
            // La coordinada que va DESPUÉS de la madre queda a su mismo nivel (2 Co 4:9, Mt 21:21 «Ἄρθητι καὶ
            // βλήθητι»): MACULA la cuelga del primer miembro.
            // Sólo si la madre es de verdad el primer miembro (trae verbo); en Ef 6:4 «Καὶ οἱ πατέρες, μὴ
            // παροργίζετε… ἀλλὰ ἐκτρέφετε…» es el vocativo que envuelve a los dos.
            const miembro = madre.tokens.some(t => t.role === 'v' || t.role === 'vc');
            if (miembro && pos(hija.tokens[0]!) > Math.max(...madre.tokens.map(pos)) && hija.depth > madre.depth) {
                const baja = hija.depth - madre.depth;
                const sub = new Set([hija.index]);
                for (const f of filas) if (desciendeDe(f.index, hija.index)) sub.add(f.index);
                for (const f of filas) if (sub.has(f.index)) f.depth -= baja;
                hija.parent = madre.parent;
            }
        }
    }
    // Griego: primero los envoltorios que subordinan (ἐάν, ὅτι, ἵνα…) y después los que coordinan (καί, δέ,
    // γάρ, οὖν…). Así «Νῦν δέ, … ἐὰν ἔλθω» (1 Co 14:6) recibe primero su ἐάν y queda condición; el δέ se
    // suma después a una fila que ya tiene relación.
    // Fase 3: lo que quedó esperando un envoltorio que nunca se funde (Hch 4:32 «καὶ οὐδὲ … ἀλλ’») va a su
    // palabra igual.
    let fase: 1 | 2 | 3 = ch.lang === 'gr' ? 1 : 2;
    let cambio = true;
    while (cambio || fase < 3) {
        if (!cambio) fase = fase === 1 ? 2 : 3;
        cambio = false;
        for (const madre of filas) {
            if (fase === 1 && COORDINANTE.has(madre.relation)) continue;
            const hijas = filas.filter(f => f.parent === madre.index);
            if (!hijas.length) continue;
            const enHijas = new Set(hijas.flatMap(h => h.tokens.map(t => t.r)));
            const propias = madre.tokens.filter(t => !enHijas.has(t.r));
            if (propias.some(t => t.role && t.r !== madre.connector)) continue;
            // La palabra que sigue al conector puede estar en una NIETA (el participio sujeto: Lc 11:10 «καὶ ὁ
            // ζητῶν εὑρίσκει»; la prótasis antepuesta: Mc 3:24 «καὶ ἐὰν βασιλεία… μερισθῇ, οὐ δύναται…»). La
            // CABEZA es la hija de la que cuelga esa fila; el conector va a la fila donde está la palabra, para
            // que se lea en el orden del texto (pendientes de «Estructura», 2026-11-13: 2.612 filas griegas de
            // sólo conector, como «καὶ» sobre 1 Co 10:3).
            /** El pospositivo va con la palabra que lo precede («Θέλω δὲ», «ὅστις γὰρ ἄν», «Ὅτε οὖν»). */
            const previaDe = (t: StructureToken) =>
                ch.lang === 'gr' && POSPOSITIVOS.has(lemaDe.get(t.r) ?? '') ? ch.words[pos(t) - 1]?.r : undefined;
            const filaDe = (r: string | undefined) => (r === undefined ? undefined : filas.find(x => x !== madre && x.tokens.some(t => t.r === r)));
            /** La hija de la que cuelga `f`. */
            const cabezaDe = (f: Fila | undefined) => {
                while (f && !hijas.includes(f)) f = filas.find(x => x.index === f!.parent);
                return f;
            };
            /**
             * El griego busca también en las nietas, si la cabeza es una cláusula de verdad: si es otro
             * envoltorio de sólo conector («ἐὰν» sobre «… δὲ …», Mt 16:26), se espera a que ése se funda
             * primero. El hebreo, como antes, sólo en las hijas.
             */
            const bajoMadre = (f: Fila) => {
                for (let x: Fila | undefined = f; x; x = filas.find(y => y.index === x!.parent)) if (hijas.includes(x)) return true;
                return false;
            };
            /** La fila destino; `ESPERA` si cuelga de la madre pero hay un envoltorio por fundir en el camino. */
            const destinoDe = (r: string | undefined): Fila | typeof ESPERA | undefined => {
                if (r === undefined) return undefined;
                if (ch.lang !== 'gr') return hijas.find(h => h.tokens.some(t => t.r === r));
                const f = filaDe(r);
                if (!f || !bajoMadre(f)) return undefined;
                const c = cabezaDe(f);
                if (fase === 3) return deVerdad(f) ? f : undefined;
                // La fila destino también es una cláusula de verdad: un «γάρ» no entra al envoltorio «ἢ … ἢ»
                // antes de que éste reparta sus conectores (Mt 6:24 «ἢ γὰρ τὸν ἕνα μισήσει»). Y el pospositivo
                // espera a su palabra, no cae en la que sigue (Hch 8:35 «ἀνοίξας δὲ … ὁ Φίλιππος»).
                return c && deVerdad(f) && (c === f || deVerdad(c)) ? f : ESPERA;
            };
            /**
             * Pone los conectores `cs` en la fila `t`. Si `t` es hija directa, toma la relación del conector,
             * como antes; si es una nieta, la toma la CABEZA, que es la oración que el conector une. La relación
             * por forma (participio, infinitivo) cede ante el conector; la asíndeton, ante el discurso.
             */
            const DE_FORMA = DE_FORMA_FILA;
            /** Devuelve la fila que recibió la relación, si alguna. */
            const poner = (cs: readonly StructureToken[], t: Fila, relation: ClauseRelation, connector: string | null, clase: Fila['conditionalClass']): Fila | undefined => {
                t.tokens = [...cs, ...t.tokens].sort(orden);
                // En una nieta, la relación va a la CABEZA si es una oración con verbo y sin conector propio
                // (Mc 3:24 «καὶ ἐὰν … μερισθῇ, οὐ δύναται»; Mt 18:31 «ἰδόντες οὖν … ἐλυπήθησαν»; Lc 11:10 «καὶ ὁ
                // ζητῶν εὑρίσκει»); si no, a la fila misma (1 Co 12:5, donde la cabeza ya trae su καί; Hch 13:41,
                // donde la «cabeza» es el sustantivo suelto «ἔργον»).
                const apta = (f: Fila) => !f.connector && DE_FORMA.has(f.relation);
                const cabeza = hijas.includes(t) ? t : cabezaDe(t);
                const conVerbo = !!cabeza?.tokens.some(x => x.role === 'v' || x.role === 'vc');
                // Un participio o infinitivo no la toma si su cabeza ya trae conector (Gá 2:17 «εἰ δὲ ζητοῦντες …
                // εὑρέθημεν»: el «desarrollo» caía en el participio y la prótasis quedaba en otra fila).
                const tToma = apta(t) && (!cabeza?.connector || t.relation === 'main' || t.relation === 'asyndetic');
                const recibe = cabeza === t ? t : cabeza && apta(cabeza) && conVerbo ? cabeza : tToma ? t : undefined;
                if (!recibe) return undefined;
                // Un conector que subordina (εἰ, ἐάν, ὅτι…) pasa por encima del que coordina: MACULA deja a veces
                // el καί de la coordinación en la fila del primer miembro (Jn 14:3 «ἐὰν πορευθῶ καὶ ἑτοιμάσω»,
                // Hch 25:11 «εἰ μὲν οὖν ἀδικῶ καὶ…»), y esa fila es la prótasis.
                const subordina = relation !== 'main' && !COORDINANTE.has(relation);
                if (recibe.connector && recibe.connector !== connector && !(subordina && COORDINANTE.has(recibe.relation))) return undefined;
                if (relation !== 'main' && (connector || recibe.relation === 'main' || recibe.relation === 'asyndetic')) {
                    recibe.relation = relation;
                    recibe.connector = connector;
                    recibe.conditionalClass = clase;
                    return recibe;
                }
                return undefined;
            };
            // Una coordinación de tres o más (`Conj3CL`, Mc 12:19 «ἀποθάνῃ καὶ καταλίπῃ γυναῖκα καὶ μὴ ἀφῇ
            // τέκνον») trae VARIOS conectores: cada uno va a la cláusula que lo sigue. Juntos en la última
            // («καὶ καὶ μὴ ἀφῇ») la fila se ordenaba por el primer καί, antes de «καταλίπῃ» (pendientes de la
            // revisión, 2026-11-13).
            // También el par «μέν … δέ» (1 Co 1:18 «τοῖς μὲν ἀπολλυμένοις … τοῖς δὲ σῳζομένοις»): cada
            // pospositivo va con la palabra que lo precede. μέν no tiene relación propia: sólo se pone.
            const reparte = (t: StructureToken) => !t.role && (!!CONECTOR_GRIEGO[lemaDe.get(t.r) ?? ''] || (ch.lang === 'gr' && lemaDe.get(t.r) === 'μέν'));
            if (propias.length > 1 && propias.every(reparte)) {
                const destinos = propias.map(p => destinoDe(previaDe(p)) ?? destinoDe(siguiente(p.r)));
                if (destinos.includes(ESPERA)) continue;
                const listos = destinos as (Fila | undefined)[];
                if (listos.every(Boolean) && new Set(listos.map(cabezaDe)).size === listos.length) {
                    propias.forEach((p, k) => poner([p], listos[k]!, CONECTOR_GRIEGO[lemaDe.get(p.r)!] ?? 'main', p.r, undefined));
                    for (const h of hijas) {
                        h.parent = madre.parent;
                        if (madre.isApodosis && h.relation !== 'condition') h.isApodosis = true;
                    }
                    for (const f of filas) if (desciendeDe(f.index, madre.index)) f.depth -= 1;
                    filas = filas.filter(f => f !== madre);
                    cambio = true;
                    break;
                }
            }
            // Lo propio de la madre va junto: si está repartido por el versículo (Mt 7:22 «οὐ … καὶ … καὶ», Ap 1:5
            // «Τῷ … καὶ»), no es un prefijo y no se funde.
            const contiguas = propias.every((t, k) => k === 0 || pos(t) === pos(propias[k - 1]!) + 1);
            if (ch.lang === 'gr' && !contiguas) {
                // Salvo que cada una vaya a la MISMA fila: «Οὐκ ἐγράφη δὲ» (Ro 4:23), el δέ con su ἐγράφη.
                const cada = propias.map(p => destinoDe(previaDe(p)) ?? destinoDe(siguiente(p.r)));
                const una = cada[0];
                if (!una || una === ESPERA || cada.some(d => d !== una) || !propias.every(t => CONECTOR_GRIEGO[lemaDe.get(t.r) ?? ''] || /^[CX]/.test(posDe.get(t.r) ?? '') || NEGACIONES.has(lemaDe.get(t.r) ?? ''))) continue;
            }
            const primera = propias[0];
            const ultima = propias[propias.length - 1];
            // El pospositivo va con la palabra que lo precede; si esa palabra no cuelga de la madre, con la que sigue.
            const sigue = ultima ? siguiente(ultima.r) : madre.tokens[0]?.r;
            const antes = primera ? destinoDe(previaDe(primera)) : undefined;
            const hija = antes ?? destinoDe(sigue);
            if (!hija || hija === ESPERA) continue;
            // A una nieta sólo bajan conectores y partículas. Lo que trae palabras («πρὸς δὲ τὸν υἱόν», Heb 1:8)
            // es una cláusula: no se pega a la cita que sigue.
            const particulas = propias.every(t => CONECTOR_GRIEGO[lemaDe.get(t.r) ?? ''] || /^[CX]/.test(posDe.get(t.r) ?? ''));
            if (!hijas.includes(hija) && !particulas) continue;
            // Hebreo: dos conectores distintos no caben en una fila (decisión de G1 + G5). En griego sí, como los
            // escribe el profesor: «ὃς γὰρ ἐὰν ἐπαισχυνθῇ» (Mc 8:38), «ἢ γὰρ τὸν ἕνα μισήσει» (Mt 6:24), «Εἰ δέ
            // τις» (Stg 1:5). La fila conserva su relación (relativa, alternativa, condición).
            if (madre.connector && hija.connector && madre.connector !== hija.connector) {
                if (ch.lang !== 'gr') continue;
                // Sólo si lo propio de la madre son conectores y partículas: «οὐδὲ τοῖς μετ’ αὐτοῦ» (Mt 12:4)
                // es una cláusula, no se pega a su «εἰ μή».
                if (propias.some(t => !CONECTOR_GRIEGO[lemaDe.get(t.r) ?? ''] && !/^[CX]/.test(posDe.get(t.r) ?? ''))) continue;
            }
            const recibio = poner(propias, hija, madre.relation, madre.connector, madre.conditionalClass);
            // Si nadie la recibió (la hija ya traía su conector), la relación de la madre va a la otra hija que es
            // la oración que une (Stg 1:5 «Εἰ δέ τις … λείπεται σοφίας, αἰτείτω»: «αἰτείτω» es desarrollo y
            // apódosis). Si ya la recibió la cabeza, no: un conector rotula UNA fila (revisión adversarial: Mc 16:16).
            if (ch.lang === 'gr' && !recibio && madre.connector && madre.relation !== 'main') {
                const cabezas = hijas.filter(h => h !== hija && !h.connector && DE_FORMA_FILA.has(h.relation));
                if (cabezas.length === 1) { cabezas[0]!.relation = madre.relation; cabezas[0]!.connector = madre.connector; }
            }
            for (const h of hijas) {
                h.parent = madre.parent;
                if (madre.isApodosis && h.relation !== 'condition') h.isApodosis = true;
            }
            // U11 (Stg 2:14): la condición que envolvía a varias hijas es UNA prótasis de varios miembros.
            // En griego, ἐάN/εἰ envuelve sólo la prótasis: sus hijas no son apódosis (Ap 3:20 «καὶ
            // ἀνοίξῃ», Mc 12:19 «καταλίπῃ γυναῖκα» salían «apódosis»). En hebreo, אִם puede envolver
            // la oración condicional entera (Am 9:3): la apódosis queda fuera del grupo.
            if (madre.relation === 'condition' && hijas.length > 1) {
                for (const h of hijas) if (ch.lang === 'gr' || !h.isApodosis) h.conditionGroup = madre.index;
            }
            for (const f of filas) if (desciendeDe(f.index, madre.index)) f.depth -= 1;
            filas = filas.filter(f => f !== madre);
            cambio = true;
            break;
        }
    }
    // Griego: κἀγώ, κἀκεῖ, κἀκεῖνος son καί + otra palabra (crasis): la fila que abren es una coordinada.
    // Después de fundir, y sólo si la fila quedó sin conector: en «κἀγὼ δέ σοι λέγω» (Mt 16:18) el conector es
    // el δέ y el καί es «también» (revisión adversarial). Tras «καθώς» tampoco: «καθὼς γινώσκει με ὁ πατὴρ κἀγὼ
    // γινώσκω τὸν πατέρα» (Jn 10:15) es la principal del correlativo («así también yo»).
    if (ch.lang === 'gr') for (const f of filas) {
        const w0 = f.tokens[0];
        if (!w0 || f.connector || f.relation !== 'main' || !CRASIS_KAI.has(lemaDe.get(w0.r) ?? '')) continue;
        if (filas.some(g => g.relation === 'comparison' && g.tokens[0] && pos(g.tokens[0]) < pos(w0))) continue;
        f.relation = 'addition';
        f.connector = w0.r;
    }
    // U11 (revisión del profesor, Stg 2:19 «καὶ τὰ δαιμόνια πιστεύουσιν καὶ
    // φρίσσουσιν»): MACULA coordina con un nodo que trae el SEGUNDO miembro y
    // cuelga el primero de él. Una hija que va entera ANTES de una madre que
    // empieza con su conector de coordinación es una coordinada: va a su mismo nivel.
    const COORDINA: ReadonlySet<ClauseRelation> = new Set(['addition', 'development', 'contrast', 'alternative', 'conjunctive']);
    const porIndice = new Map(filas.map(f => [f.index, f]));
    /** ¿`f` cuelga (fila por fila) de `ancestro`? */
    const bajoFila = (f: Fila, ancestro: Fila) => {
        for (let p = porIndice.get(f.parent ?? NaN); p; p = porIndice.get(p.parent ?? NaN)) if (p === ancestro) return true;
        return false;
    };
    for (const madre of filas) {
        if (!madre.connector || !COORDINA.has(madre.relation) || madre.tokens[0]?.r !== madre.connector) continue;
        const inicio = pos(madre.tokens[0]!);
        for (const hija of filas.filter(f => f.parent === madre.index)) {
            // La prótasis no es una coordinada: conserva su sangría (2 Ti 2:12 «εἰ ἀρνησόμεθα, κἀκεῖνος ἀρνήσεται»).
            if (Math.max(...hija.tokens.map(pos)) >= inicio || hija.relation === 'condition') continue;
            const sube = hija.depth - madre.depth;
            if (sube <= 0) continue;
            for (const f of filas) if (f === hija || bajoFila(f, hija)) f.depth -= sube;
            hija.parent = madre.parent;
            // La primera coordinada de una apódosis también es apódosis (Mt 12:11 «οὐχὶ κρατήσει αὐτὸ καὶ ἐγερεῖ»).
            if (ch.lang === 'gr' && madre.isApodosis) hija.isApodosis = true;
        }
    }
    // Revisión del profesor (Stg 2:18): MACULA cuelga «κἀγώ σοι δείξω» de «δεῖξόν μοι» como su OBJETO, y el
    // profesor la pone al margen: es la coordinada que sigue. Medido en el NT (2026-11-13): las 13 filas con
    // crasis de καί que MACULA marca objeto son coordinadas (Jn 20:15 «εἰπέ μοι… κἀγὼ αὐτὸν ἀρῶ», Jn 11:54
    // «κἀκεῖ ἔμεινεν», 2 Co 12:20); van al nivel de la cláusula de la que colgaban.
    if (ch.lang === 'gr') for (const f of filas) {
        const w0 = f.tokens[0];
        // Lo dicho ya está a su nivel, dentro de la cita (Stg 2:18 «Σὺ πίστιν ἔχεις κἀγὼ ἔργα ἔχω»).
        if (!w0 || f.relation === 'speech' || !CRASIS_KAI.has(lemaDe.get(w0.r) ?? '') || !['o', 'o2'].includes(ch.clauses[f.index]?.role ?? '')) continue;
        const madre = porIndice.get(f.parent ?? NaN);
        if (!madre || f.depth <= madre.depth) continue;
        const sube = f.depth - madre.depth;
        for (const g of filas) if (g === f || bajoFila(g, f)) g.depth -= sube;
        f.parent = madre.parent;
        if (madre.isApodosis) f.isApodosis = true;
    }
    filas.sort((a, b) => clave(a) - clave(b));
    // El grupo de prótasis (revisión adversarial, 2026-11-12): la condición PRIMERO y, después, sus
    // miembros coordinados. No entra lo que va antes de la condición (2 S 14:32) ni, en griego, lo que
    // no coordina («ἄρα», 1 Co 15:14: es la apódosis). Un miembro no es apódosis, aunque una fusión
    // lo haya marcado (en hebreo, 40 filas: 1 S 17:9 וְהִכָּנִי). Sin la condición y otro miembro, no hay grupo.
    const MIEMBRO_GR: ReadonlySet<ClauseRelation> = new Set(['condition', 'addition', 'development', 'contrast', 'alternative', 'main']);
    const miembros = new Map<number, Fila[]>();
    for (const f of filas) if (f.conditionGroup !== undefined) miembros.set(f.conditionGroup, [...(miembros.get(f.conditionGroup) ?? []), f]);
    for (const fs of miembros.values()) {
        const cond = fs.find(f => f.relation === 'condition');
        const quedan = cond ? fs.filter(f => f === cond || (filas.indexOf(f) > filas.indexOf(cond) && (ch.lang !== 'gr' || MIEMBRO_GR.has(f.relation)))) : [];
        for (const f of fs) if (!quedan.includes(f)) delete f.conditionGroup;
        if (quedan.length < 2) for (const f of quedan) delete f.conditionGroup;
        else for (const f of quedan) f.isApodosis = false;
    }
    // Una palabra hebrea de varias piezas (לְ|עָזְבֵךְ) puede estar en dos
    // cláusulas: la madre por su preposición y la hija por su verbo, o dos
    // hermanas (Is 6:8 הִנְנִי). Se muestra una vez: en la más profunda y, entre
    // iguales, en la primera.
    const duena = new Map<string, Fila>();
    for (const f of filas) for (const t of f.tokens) {
        const d = duena.get(t.r);
        if (!d || f.depth > d.depth) duena.set(t.r, f);
    }
    for (const f of filas) f.tokens = f.tokens.filter(t => duena.get(t.r) === f);
    return filas.filter(f => f.tokens.length);
}
