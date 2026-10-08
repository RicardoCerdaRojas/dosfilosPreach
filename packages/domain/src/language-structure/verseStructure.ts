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
     * Constituyentes antes del verbo, en orden (sujeto, objeto, adverbial…):
     * `r` es la primera palabra y `rs` todas las del constituyente.
     */
    readonly fronted: readonly { readonly r: string; readonly rs: readonly string[]; readonly role: ConstituentRole }[];
}

const ROLES: ReadonlySet<string> = new Set(['s', 'v', 'o', 'o2', 'io', 'adv', 'pp', 'p', 'vc', 'aux']);
const rolDe = (r: string): ConstituentRole => (ROLES.has(r) ? (r as ConstituentRole) : '');

// ── Griego ────────────────────────────────────────────────────────────────────

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
                } else if (conector.l === 'ἐάν' && antes && (antes.pos === 'RR' || RELATIVOS.has(antes.l))) {
                    // «ὃ ἐάν»: relativo indefinido («lo que»), no condición (1 Jn 3:22).
                    // El conector es el relativo, que MACULA deja en la hija: así se funden.
                    relation = 'relative';
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
        // una cláusula nominal: su verbo está en las hijas.
        const verbless = ch.lang === 'gr'
            ? !sub.some(w => w.pos?.startsWith('V'))
            : !sub.some(w => piezas(w).some(x => esVerboHe(x.m)));
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
    return fundirEnvoltorios(ch, parcial, posicion).map(f => ({
        index: f.index,
        depth: f.depth,
        words: f.tokens,
        connector: f.connector,
        relation: f.relation,
        ...(f.conditionalClass ? { conditionalClass: f.conditionalClass } : {}),
        isApodosis: f.isApodosis,
        verbless: f.verbless,
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

function fundirEnvoltorios(ch: ChapterStructure, filas: Fila[], posicion: ReadonlyMap<string, number>): Fila[] {
    const lemaDe = new Map(ch.words.map(w => [w.r, w.l]));
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
    let cambio = true;
    while (cambio) {
        cambio = false;
        for (const madre of filas) {
            const hijas = filas.filter(f => f.parent === madre.index);
            if (!hijas.length) continue;
            const enHijas = new Set(hijas.flatMap(h => h.tokens.map(t => t.r)));
            const propias = madre.tokens.filter(t => !enHijas.has(t.r));
            if (propias.some(t => t.role && t.r !== madre.connector)) continue;
            const ultima = propias[propias.length - 1];
            const sigue = ultima ? siguiente(ultima.r) : madre.tokens[0]?.r;
            const hija = sigue === undefined ? undefined : hijas.find(h => h.tokens.some(t => t.r === sigue));
            if (!hija) continue;
            // Dos conectores distintos («δέ» sobre «Εἰ») no caben en una fila.
            if (madre.connector && hija.connector && madre.connector !== hija.connector) continue;
            hija.tokens = [...propias, ...hija.tokens].sort(orden);
            // La relación por forma (participio, infinitivo) cede ante el conector;
            // la asíndeton (lo que queda sin conector) cede ante el discurso de la madre.
            if (madre.relation !== 'main' && (madre.connector || hija.relation === 'main' || hija.relation === 'asyndetic')) {
                hija.relation = madre.relation;
                hija.connector = madre.connector;
                hija.conditionalClass = madre.conditionalClass;
            }
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
    filas.sort((a, b) => clave(a) - clave(b));
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
