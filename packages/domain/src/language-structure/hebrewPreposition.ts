import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';
import { sinAcentos } from './hebrewMorph.js';

/**
 * U3a (revisión del profesor 2026-11, Rut 2:1 וּלְנָעֳמִי / לְאִישָׁהּ, Rut 2:7
 * בָעֳמָרִים) — LA FUNCIÓN DE LA PREPOSICIÓN HEBREA, con las categorías de
 * Arnold y Choi (1.ª ed., 2003), §4.1. La ELIGE el asistente de la lista de su
 * preposición: como regla no se puede. Medido (2026-11-12): la ל de posesión
 * por forma (ל + predicado de MACULA en cláusula sin verbo, con sujeto
 * indefinido o אֵין/יֵשׁ/היה) acertaba 3 o 4 de 20 —títulos de salmos,
 * finalidad, listas, interés—.
 *
 * Rut 2:1 tiene las dos ל de A&C: «וּלְנָעֳמִי מוֹדַע» es POSESIÓN (f: «Noemí
 * tenía un pariente») y «מוֹדַע לְאִישָׁהּ» es GENITIVAL (g: la ל en lugar del
 * constructo cuando el poseído es indefinido; Putnam §1.5.1b(5)).
 *
 * Quedan fuera las que rigen un infinitivo constructo: su función la da el
 * módulo del infinitivo (R4).
 */

export type HebrewPreposition = 'b' | 'k' | 'l' | 'min' | 'al' | 'el' | 'ad' | 'im' | 'et' | 'achar' | 'tachat' | 'lemaan';

export type HebrewPrepositionFunction =
    | 'spatial' | 'temporal' | 'instrumental' | 'adversative' | 'specification' | 'causal' | 'accompaniment' | 'essence'
    | 'manner' | 'price' | 'agreement' | 'correspondence' | 'locative' | 'purpose' | 'quasiDatival' | 'interest' | 'product'
    | 'possession' | 'genitival' | 'normative' | 'estimative' | 'agent' | 'source' | 'material' | 'partitive' | 'privative'
    | 'comparative' | 'compound' | 'vertical' | 'horizontal' | 'duty' | 'rank' | 'emotive' | 'terminative' | 'declarative'
    | 'perceptual' | 'addition' | 'personalComplement' | 'restrictive' | 'degree' | 'metaphorical' | 'substitution'
    | 'staticPosition' | 'complement';

/** Cada preposición: su forma, su sección de A&C (con la página del ejemplar) y sus funciones con la definición del libro. */
export const HEBREW_PREPOSITIONS: Readonly<Record<HebrewPreposition, {
    readonly forma: string;
    readonly base: string;
    readonly seccion: string;
    readonly pagina: string;
    readonly funciones: Readonly<Partial<Record<HebrewPrepositionFunction, string>>>;
}>> = {
    b: {
        forma: 'בְּ', base: '«en»', seccion: '4.1.5', pagina: '102', funciones: {
            spatial: 'lugar: «en», «sobre» un sitio', temporal: 'el momento en que ocurre algo', instrumental: 'el objeto con que se hace algo («con la espada»)',
            adversative: 'en contra de alguien (desventaja)', specification: 'aclara o detalla lo que se acaba de decir', causal: 'causa o razón («por»)',
            accompaniment: 'junto con, acompañado de', essence: 'identidad: «como», «en calidad de» (beth essentiae)',
            manner: 'el modo en que se hace algo, o lo que lo acompaña', price: 'el precio o lo que se da a cambio («por»)',
        },
    },
    k: {
        forma: 'כְּ', base: '«como»', seccion: '4.1.9', pagina: '109', funciones: {
            agreement: 'acuerdo en cantidad o medida («unos», «como de»)', correspondence: 'comparación que establece equivalencia («como»)',
        },
    },
    l: {
        forma: 'לְ', base: '«a», «para»', seccion: '4.1.10', pagina: '110', funciones: {
            spatial: 'dirección «a», «hacia»', locative: 'lugar «en», «junto a»', temporal: 'tiempo «en», «al», «durante»',
            purpose: 'finalidad («para»)', quasiDatival: 'objeto indirecto de dar, decir, oír o enviar', interest: 'para quien (a favor o en contra de quien) se hace algo',
            product: 'en lo que algo se convierte, con verbos de hacer («por esposa», «en nación»)', possession: 'el poseedor: «X tenía…», «de X es…», «el (que es) de X» (lo que pertenece a alguien)',
            genitival: 'en lugar del constructo, cuando poseído y poseedor no concuerdan en definición («un pariente de su marido»)',
            specification: 'con respecto a, en cuanto a', normative: 'según, por (clasifica o divide en partes)', manner: 'de acuerdo con una norma',
            estimative: 'en opinión de, a los ojos de', agent: 'el que hace la acción cuando el verbo es PASIVO (nifal, pual, hofal): «por»',
        },
    },
    min: {
        forma: 'מִן', base: '«de», «desde»', seccion: '4.1.13', pagina: '116', funciones: {
            source: 'origen: de dónde viene algo o alguien', temporal: 'desde cuándo', material: 'el material del que se hace algo',
            causal: 'causa o razón («a causa de»)', estimative: 'en opinión de quien juzga', partitive: 'una parte de un todo («algunos de»); suele hacer de sujeto u objeto sin otro sustantivo («comió del fruto» = algo del fruto)',
            privative: 'algo que falta o se quita («sin», «lejos de»)', comparative: 'comparación («más que»)',
            compound: 'unida a otra preposición (מִתַּחַת, מֵעַל)',
        },
    },
    al: {
        forma: 'עַל', base: '«sobre»', seccion: '4.1.16', pagina: '120', funciones: {
            vertical: 'lugar «sobre», «encima de»', horizontal: 'lugar «junto a», «al lado de»', duty: 'una carga o deber que recae sobre alguien',
            rank: 'autoridad sobre otro («sobre el ejército»)', causal: 'causa («por»)', manner: 'según una norma («según el orden de»)',
            adversative: 'contra alguien', accompaniment: 'junto con', interest: 'el objeto de un pensamiento o emoción («por», «acerca de»)',
            emotive: 'realza a quien siente la emoción',
        },
    },
    el: {
        forma: 'אֶל', base: '«a», «hacia»', seccion: '4.1.2', pagina: '97', funciones: {
            terminative: 'movimiento «a» o «hacia» un destino (con verbos de movimiento)', estimative: 'a favor o en contra de algo', declarative: 'a quien se habla: el destinatario de un verbo de decir, llamar o gritar',
            perceptual: 'hacia quien se dirige la atención o la inclinación', addition: '«además de»', spatial: 'lugar «junto a», «en»',
        },
    },
    ad: {
        forma: 'עַד', base: '«hasta»', seccion: '4.1.15', pagina: '120', funciones: {
            locative: 'el límite de un movimiento («hasta»)', temporal: 'la duración («hasta que»)', degree: 'grado extremo («en gran manera»)',
        },
    },
    im: {
        forma: 'עִם', base: '«con»', seccion: '4.1.17', pagina: '124', funciones: {
            accompaniment: 'compañía («con»)', personalComplement: 'el destinatario de la acción («hacer bondad con»)', locative: 'lugar («junto a»)',
            restrictive: 'excepción («fuera de»)',
        },
    },
    et: {
        forma: 'אֵת', base: '«con»', seccion: '4.1.4', pagina: '101', funciones: {
            accompaniment: 'compañía («con»)', possession: 'lo que alguien tiene consigo', complement: 'con verbos de hablar, tratar o hacer («con»)',
            spatial: 'cercanía («junto a»)',
        },
    },
    achar: {
        forma: 'אַחַר', base: '«detrás de», «después de»', seccion: '4.1.1', pagina: '96', funciones: {
            spatial: 'lugar «detrás de»', temporal: '«después de»', metaphorical: 'seguir el modo de otro o apoyarlo («ir en pos de»)',
        },
    },
    tachat: {
        forma: 'תַּחַת', base: '«debajo de»', seccion: '4.1.18', pagina: '125', funciones: {
            vertical: '«debajo de»', staticPosition: '«en el lugar», «allí mismo»', metaphorical: 'bajo la autoridad de otro',
            substitution: '«en lugar de»',
        },
    },
    lemaan: {
        forma: 'לְמַעַן', base: '«por», «a fin de»', seccion: '4.1.11', pagina: '115', funciones: {
            purpose: 'finalidad («para que»)', causal: 'causa («por amor de», «a causa de»)',
        },
    },
};

const PREFIJO: Readonly<Record<string, HebrewPreposition>> = { b: 'b', k: 'k', l: 'l', m: 'min' };
const LEMA: Readonly<Record<string, HebrewPreposition>> = {
    '4480': 'min', '5921': 'al', '413': 'el', '5704': 'ad', '5973': 'im', '854': 'et', '310': 'achar', '8478': 'tachat', '4616': 'lemaan',
};

export interface HebrewPrepositionCandidate {
    readonly ordinal: number;
    readonly text: string;
    readonly preposition: HebrewPreposition;
    readonly allowed: readonly HebrewPrepositionFunction[];
    readonly occurrence?: { readonly n: number; readonly of: number };
}

/** La preposición de la palabra (la primera, si trae varias), o ninguna. */
export function prepositionOf(w: StructureWord): HebrewPreposition | undefined {
    if (!w.m?.startsWith('H')) return undefined;
    // OSHB tiene que marcarla preposición (un segmento R): por el lema solo, אַחַר ADVERBIO («después»,
    // `HD`) recibía la lista (48 de 52.777 candidatas, revisión adversarial 2026-11-12).
    if (!w.m.slice(1).split('/').some(x => x.startsWith('R'))) return undefined;
    const partes = w.l.split('/');
    const lema = partes[partes.length - 1]!.trim().split(' ')[0]!;
    if (LEMA[lema]) return LEMA[lema];
    for (const p of partes.slice(0, -1)) if (PREFIJO[p]) return PREFIJO[p];
    // «לוֹ», «בּוֹ»: la preposición sola con sufijo (OSHB: lema «l»/«b», morfología R + S).
    if (PREFIJO[lema] && /\bR/.test(w.m.replace(/^H/, ''))) return PREFIJO[lema];
    return undefined;
}

/** Rige un infinitivo constructo («לֵאמֹר», «בְּיוֹם אֲכָלְךָ»): lo cubre el módulo del infinitivo. */
const rigeInfinitivo = (w: StructureWord) => (w.parts ?? []).some(p => /^V.c/.test(p.m)) || /\/V.c/.test(w.m ?? '');
/** Compuestas con nombre que no están en la lista (לִפְנֵי, לְמַעַן va aparte, בְּתוֹךְ…): la de פָּנִים no se elige aquí. */
const FUERA: ReadonlySet<string> = new Set(['6440', '8432', '5869', '3027']);

export function hebrewPrepositionCandidates(ch: ChapterStructure, verse: number): HebrewPrepositionCandidate[] {
    if (ch.lang !== 'he') return [];
    const ws = verseWords(ch, verse);
    const out: HebrewPrepositionCandidate[] = [];
    ws.forEach((w, i) => {
        const p = prepositionOf(w);
        if (!p || rigeInfinitivo(w)) return;
        const lema = w.l.split('/').pop()!.trim().split(' ')[0]!;
        if (p !== 'lemaan' && FUERA.has(lema)) return;
        const text = sinAcentos(w.t);
        const iguales = ws.map(x => sinAcentos(x.t)).map((t, k) => (t === text ? k : -1)).filter(k => k >= 0);
        out.push({
            ordinal: i, text, preposition: p, allowed: Object.keys(HEBREW_PREPOSITIONS[p].funciones) as HebrewPrepositionFunction[],
            ...(iguales.length > 1 ? { occurrence: { n: iguales.indexOf(i) + 1, of: iguales.length } } : {}),
        });
    });
    return out;
}

export function buildHebrewPrepositionTask(candidates: readonly HebrewPrepositionCandidate[]): string {
    if (!candidates.length) return '';
    const presentes = [...new Set(candidates.map(c => c.preposition))];
    const listas = presentes.map(p => {
        const d = HEBREW_PREPOSITIONS[p];
        return `- ${d.forma} (sentido base ${d.base}): ${Object.entries(d.funciones).map(([id, def]) => `"${id}" = ${def}`).join('; ')}.`;
    });
    const lineas = candidates.map(c => {
        const cual = c.occurrence ? ` (${c.occurrence.n}.ª aparición de ${c.occurrence.of} en el versículo)` : '';
        return `- ${c.text}${cual}: preposición ${HEBREW_PREPOSITIONS[c.preposition].forma}, elige "prepositionFunction" SÓLO de la lista de ${HEBREW_PREPOSITIONS[c.preposition].forma}.`;
    });
    return `
## PREPOSICIONES: SU FUNCIÓN (campo "prepositionFunction" de cada palabra)
Las funciones de cada preposición (Arnold y Choi §4.1), con su definición:
${listas.join('\n')}
Elige por el contexto y explica la elección en la "syntacticFunction" de la palabra.
${lineas.join('\n')}`;
}

/** Lo que muestra la ficha: la preposición y la función elegida, si está en su lista. */
export interface HebrewPrepositionView {
    readonly candidate: HebrewPrepositionCandidate;
    readonly fn?: HebrewPrepositionFunction;
}

export function applyHebrewPreposition(candidate: HebrewPrepositionCandidate, choice: string | undefined): HebrewPrepositionView {
    return choice && (candidate.allowed as readonly string[]).includes(choice)
        ? { candidate, fn: choice as HebrewPrepositionFunction }
        : { candidate };
}
