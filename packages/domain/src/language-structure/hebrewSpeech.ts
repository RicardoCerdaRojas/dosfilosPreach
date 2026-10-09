import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';

/**
 * QUIÉN HABLA Y A QUIÉN, dentro de un versículo hebreo (bitácora del módulo
 * de hebreo, Rut 1:16: la tarjeta de תֵּלְכִי dijo «Rut como sujeto»; es 2.ª
 * femenina dentro del discurso de Rut: el sujeto es Noemí, a quien habla).
 *
 * Lo decide el texto: אָמַר con su HABLANTE nombrado en la cláusula (rol
 * «s» de MACULA: «וַתֹּאמֶר רוּת») abre un discurso; «לֵאמֹר» lo abre con el
 * hablante del verbo anterior («וַיְדַבֵּר יְהוָה אֶל־מֹשֶׁה לֵּאמֹר»). דִּבֶּר
 * solo NO: suele ser narración («וַיְדַבֵּר יְהוָה אֲלֵיכֶם», Dt 4:12, lo cuenta
 * Moisés: el «ustedes» no es a quien habla Dios — medido sobre el AT). La 2.ª
 * persona que sigue —verbo o sufijo— es a quien ese hablante se dirige, nunca
 * él mismo. Si el destinatario está escrito («אֶל־נָעֳמִי», «לִשְׁתֵּי
 * כַלֹּתֶיהָ»), se dice cuál es.
 *
 * Conservador a propósito: sólo dentro del mismo versículo, sólo con el
 * hablante nombrado, y un אָמַר nuevo corta el discurso anterior.
 */

export interface SpeechFact {
    /** Posición de la palabra en 2.ª persona. */
    readonly ordinal: number;
    /** La palabra, como está escrita (sin acentos de cantilación). */
    readonly text: string;
    /** `verb`: verbo en 2.ª persona; `suffix`: sufijo pronominal de 2.ª persona. */
    readonly kind: 'verb' | 'suffix';
    /** Quien habla, como está escrito («רוּת»). */
    readonly speaker: string;
    /** A quien habla, si está escrito en la cláusula del verbo de habla. */
    readonly addressee?: string;
    /** Posiciones del hablante y del destinatario en el versículo: la ficha los nombra con su traducción («Rut»). */
    readonly speakerOrdinals: readonly number[];
    readonly addresseeOrdinals?: readonly number[];
}

const AMAR = '559';

const lema = (w: StructureWord) => w.l.split('/').pop()!.split(' ')[0]!;
const segmentos = (w: StructureWord) => (w.m ?? '').replace(/^[HA]/, '').split('/');
const verboDe = (w: StructureWord) => segmentos(w).find(s => s.startsWith('V') && s.length >= 3);
/** Persona del verbo de OSHB (`Vqi2fs` → '2'); infinitivos y participios no llevan persona. */
const personaDelVerbo = (w: StructureWord) => {
    const v = verboDe(w);
    return v && v.length >= 4 && !'rsac'.includes(v[2]!) ? v[3] : undefined;
};
const sufijo2 = (w: StructureWord) => segmentos(w).some(s => /^Sp2/.test(s));
const limpio = (t: string) => t.replace(/[֑-ֽ֯׀׃]/g, '');
/** «לֵאמֹר»: לְ + infinitivo constructo de אָמַר, sin sufijo. */
const esLemor = (w: StructureWord) => lema(w) === AMAR && /^l\//.test(w.l) && /^R$/.test(segmentos(w)[0] ?? '') && segmentos(w).length === 2 && verboDe(w)?.[2] === 'c';
/** Pasivo (nifal, pual, hofal): «יֵאָמֵר עוֹד שִׁמְךָ» — el sujeto es lo dicho, no quien habla (Gn 32:29). */
const pasivo = (w: StructureWord) => 'NPH'.includes(verboDe(w)?.[1] ?? '');
/** אֲשֶׁר, כַּאֲשֶׁר, מָה / לָמָּה, פֶּן: un אָמַר subordinado no abre el discurso de ese hablante (Éx 32:12, Dt 5:27). */
const SUBORDINANTES: ReadonlySet<string> = new Set(['834', '4100', '6435']);
/**
 * Verbos de los que «לֵאמֹר» introduce un discurso: decir, mandar, llamar, enviar,
 * responder, jurar, preguntar, anunciar, bendecir, clamar. Con otro verbo
 * («וְאָזְנֶיךָ תִּשְׁמַעְנָה דָבָר … לֵאמֹר», Is 30:21; «פֶּן יִהְיֶה דָבָר … לֵאמֹר», Dt 15:9)
 * el sujeto no es quien habla.
 */
const INTRODUCEN: ReadonlySet<string> = new Set(['559', '1696', '6680', '7121', '7971', '6030', '7650', '7592', '5046', '1288', '6817', '2199', '3034', '5749']);
/** Sin la conjunción pegada: «וְיוֹסֵף» → «יוֹסֵף». */
const sinConjuncion = (w: StructureWord) => (segmentos(w)[0] === 'C' ? limpio(w.t).replace(/^ו[\u05B0-\u05C7]*/, '') : limpio(w.t));
/** Sólo sustantivo, adjetivo, artículo o sufijo forman el nombre del hablante o del destinatario. */
const nominal = (w: StructureWord) => segmentos(w).some(g => /^(N|A|Td|S)/.test(g));
const soloPronombre = (ws: readonly StructureWord[]) => ws.every(w => segmentos(w).some(g => /^Pp/.test(g)) && !segmentos(w).some(g => /^N/.test(g)));

/**
 * El destinatario: DESPUÉS del verbo de habla, la frase con אֶל o לְ + sustantivo o
 * sufijo («אֶל דָּוִד», «לִשְׁתֵּי כַלֹּתֶיהָ», «אֵלָיו»), hasta la siguiente
 * preposición o una palabra que no sea nominal («לָמָּה», «לַאֲשֶׁר», «גַּם» no entran).
 */
function destinatarioDe(clausula: readonly StructureWord[], verbo: StructureWord): StructureWord[] | undefined {
    const desde = clausula.indexOf(verbo) + 1;
    for (let k = desde; k < clausula.length; k++) {
        const x = clausula[k]!;
        if (x.role !== 'pp' || verboDe(x)) continue;
        const g = segmentos(x);
        const conEl = lema(x) === '413';
        const conLe = /^(l\/|l$)/.test(x.l) && g[0] === 'R';
        if (!conEl && !conLe) continue;
        // אֶל solo («אֶל דָּוִד») lleva el sustantivo en la palabra siguiente; con sufijo («אֵלָיו»), en la misma.
        const propio = g.slice(1).some(s => /^(N|A|S)/.test(s));
        const frase = [x];
        for (const y of clausula.slice(k + 1)) {
            if (y.role !== 'pp' || segmentos(y)[0]?.startsWith('R') || !nominal(y)) break;
            frase.push(y);
        }
        if (!propio && frase.length === 1) return undefined;
        return frase;
    }
    return undefined;
}

/** El hablante: la primera tira seguida de palabras con rol «s» y nominales («כָּל הָעָם», Rut 4:11). */
function hablanteDe(clausula: readonly StructureWord[]): StructureWord[] {
    const k = clausula.findIndex(x => x.role === 's' && nominal(x) || x.role === 's' && segmentos(x).some(g => /^Pp/.test(g)));
    if (k < 0) return [];
    const tira: StructureWord[] = [];
    for (const x of clausula.slice(k)) {
        if (x.role !== 's' || (!nominal(x) && !segmentos(x).some(g => /^Pp/.test(g)))) break;
        tira.push(x);
    }
    return tira;
}

function clausulaDe(w: StructureWord, ch: ChapterStructure, porRef: ReadonlyMap<string, StructureWord>): { idx: number; palabras: StructureWord[] } | undefined {
    let mejor = -1;
    ch.clauses.forEach((c, i) => { if (c.w.includes(w.r) && (mejor < 0 || c.w.length < ch.clauses[mejor]!.w.length)) mejor = i; });
    if (mejor < 0) return undefined;
    return { idx: mejor, palabras: ch.clauses[mejor]!.w.map(r => porRef.get(r)).filter((x): x is StructureWord => !!x) };
}

export function hebrewSpeechFacts(ch: ChapterStructure, verse: number): SpeechFact[] {
    if (ch.lang !== 'he') return [];
    const ws = verseWords(ch, verse);
    const porRef = new Map(ch.words.map(w => [w.r, w]));
    const out: SpeechFact[] = [];
    let actual: { speaker: string; speakerOrdinals: number[]; addressee?: string; addresseeOrdinals?: number[]; hasta: Set<string> } | null = null;
    const texto = (palabras: readonly StructureWord[]) => palabras.map((x, n) => (n === 0 ? sinConjuncion(x) : limpio(x.t))).join(' ');
    const posiciones = (palabras: readonly StructureWord[]) => palabras.map(x => ws.indexOf(x)).filter(k => k >= 0);
    /** ¿Subordinado? (אֲשֶׁר, מָה / לָמָּה, פֶּן antes, en la cláusula o justo antes en el versículo; Éx 32:12, Dt 5:27.) */
    const subordinado = (clausula: readonly StructureWord[], v: StructureWord) => {
        const antes = clausula.slice(0, clausula.indexOf(v));
        const previa = ws[ws.indexOf(v) - 1];
        return [...antes, previa].some(x => x && SUBORDINANTES.has(lema(x)));
    };
    const abrir = (clausula: readonly StructureWord[], introductor: StructureWord, extra: StructureWord) => {
        if (subordinado(clausula, introductor)) return null;
        const quien = hablanteDe(clausula);
        // Sin hablante nombrado, o sólo un pronombre («אָנֹכִי מְצַוְּךָ לֵאמֹר»): no se dice nada.
        if (!quien.length || soloPronombre(quien)) return null;
        const destino = destinatarioDe(clausula, introductor);
        return {
            speaker: texto(quien), speakerOrdinals: posiciones(quien),
            ...(destino ? { addressee: texto(destino), addresseeOrdinals: posiciones(destino) } : {}),
            hasta: new Set([...clausula.map(x => x.r), extra.r]),
        };
    };
    ws.forEach((w, i) => {
        if (lema(w) === AMAR) {
            // Todo אָמַר corta el discurso anterior; sólo algunos abren uno nuevo.
            actual = null;
            const propia = clausulaDe(w, ch, porRef);
            if (!propia) return;
            if (esLemor(w)) {
                // «לֵאמֹר» cuelga del verbo que introduce el discurso: la cláusula madre (Dt 15:11).
                const madre = ch.clauses[propia.idx]!.p;
                if (madre === null || madre === undefined) return;
                const palabras = ch.clauses[madre]!.w.map(r => porRef.get(r)).filter((x): x is StructureWord => !!x);
                // También la fórmula profética «וַיְהִי דְבַר־יְהוָה אֶל־אַבְרָם … לֵאמֹר» (Gn 15:1): הָיָה con «דָּבָר» de sujeto.
                const formulaProfetica = (x: StructureWord) => lema(x) === '1961' && palabras.some(y => y.role === 's' && lema(y) === '1697');
                const introductor = palabras.find(x => verboDe(x) && x !== w && (INTRODUCEN.has(lema(x)) || formulaProfetica(x)));
                if (introductor) actual = abrir(palabras, introductor, w);
                return;
            }
            // Participio («הָאֹמֵר אֵלַי», Gn 32:10), pasivo, subordinado o «אָמַר לְ + infinitivo» (= se propuso, Dt 9:25): no abre.
            if (!personaDelVerbo(w) || pasivo(w)) return;
            // «אָמַר יְהוָה לְהַשְׁמִיד» = se propuso (Dt 9:25): un לְ + infinitivo en su cláusula.
            const despues = propia.palabras.slice(propia.palabras.indexOf(w) + 1);
            if (despues.some(x => /^l\//.test(x.l) && verboDe(x)?.[2] === 'c' && !esLemor(x))) return;
            actual = abrir(propia.palabras, w, w);
            return;
        }
        if (!actual || actual.hasta.has(w.r)) return;
        const kind = personaDelVerbo(w) === '2' ? 'verb' : sufijo2(w) ? 'suffix' : null;
        if (kind) out.push({
            ordinal: i, text: limpio(w.t), kind, speaker: actual.speaker, speakerOrdinals: actual.speakerOrdinals,
            ...(actual.addressee ? { addressee: actual.addressee, addresseeOrdinals: actual.addresseeOrdinals } : {}),
        });
    });
    return out;
}

/** Los hechos para el prompt: el asistente los EXPLICA, no los decide. */
export function buildSpeechFactsTask(facts: readonly SpeechFact[]): string {
    if (!facts.length) return '';
    const lineas = facts.map(f => `- ${f.text}: ${f.kind === 'verb' ? 'verbo en 2.ª persona' : 'sufijo de 2.ª persona'} dentro del discurso de ${f.speaker}: se refiere a ${f.addressee ? `a quien ${f.speaker} habla (${f.addressee})` : `la persona a quien ${f.speaker} habla`}, NUNCA a ${f.speaker}.`);
    return `
## QUIÉN HABLA (decidido por el texto; no lo cambies)
${lineas.join('\n')}
En "syntacticFunction" y "explanation" de esas palabras, el sujeto (o el «tú») es el DESTINATARIO del discurso, no quien habla.`;
}
