/**
 * Los códigos morfológicos de OSHB, que morphhb trae con cada palabra.
 *
 * El hebreo del AT viene del Westminster Leningrad Codex con etiquetado
 * morfológico: cada palabra lleva un código como `HVhi3ms/Sp1cs`, que es
 * «verbo hifil imperfecto 3ª masculino singular + sufijo pronominal 1ª común
 * singular». Determinista, igual que MorphGNT para el griego, y hasta ahora
 * sin leer: al analizador del AT se le entregaba el texto corrido y se le
 * pedía deducir lo que estaba tabulado al lado.
 *
 * El mapeo NO se escribió de memoria. Se sacó el alfabeto real de cuatro
 * libros —Génesis, Salmos, Jonás y Amós, 11.639 segmentos verbales— y se
 * verificó contra el análisis que el autor había escrito A MANO para Salmo
 * 23:1-3:
 *
 *     יְשׁוֹבֵב   HVoi3ms        su trabajo dice «Polel»
 *     יַנְחֵנִי   HVhi3ms/Sp1cs  su trabajo dice «Hifíl»
 *     אֶחְסָר    HVqi1cs        su trabajo dice «qal imperfecto 1cs»
 *     יַרְבִּיצֵנִי HVhi3ms/Sp1cs  su encuadre dice «imperfecto 3ms + 1cs»
 *
 * Los tallos raros NO se traducen a un nombre inventado. Ocho tallos cubren
 * el 99,1 % de las formas medidas; el 0,9 % restante sale con su código
 * crudo, que es visible y comprobable, en vez de con una etiqueta que podría
 * estar mal. Inventar precisión sobre morfología es peor que no darla.
 */

/** Tallos verbales (binyanim) que se pueden nombrar con seguridad. */
const TALLO: Record<string, string> = {
    q: 'qal', N: 'nifal', p: 'piel', P: 'pual',
    h: 'hifil', H: 'hofal', t: 'hitpael', o: 'polel',
};

/** Tipo de forma verbal. Los once que aparecen en el corpus medido. */
const TIPO: Record<string, string> = {
    p: 'perfecto', q: 'perfecto consecutivo', i: 'imperfecto',
    w: 'imperfecto consecutivo', h: 'cohortativo', j: 'yusivo',
    v: 'imperativo', a: 'infinitivo absoluto', c: 'infinitivo constructo',
    r: 'participio', s: 'participio pasivo',
};

const PERSONA: Record<string, string> = { '1': '1ª', '2': '2ª', '3': '3ª' };
const GENERO: Record<string, string> = { m: 'masculino', f: 'femenino', b: 'ambos', c: 'común' };
const NUMERO: Record<string, string> = { s: 'singular', p: 'plural', d: 'dual' };
const ESTADO: Record<string, string> = { a: 'absoluto', c: 'constructo', d: 'determinado' };

const CATEGORIA: Record<string, string> = {
    N: 'sustantivo', V: 'verbo', A: 'adjetivo', R: 'preposición',
    C: 'conjunción', T: 'partícula', P: 'pronombre', D: 'adverbio', S: 'sufijo',
};

/** Persona + género + número, en el orden en que se leen en el código. */
function pgn(chars: string): string {
    return [...chars]
        .map(c => PERSONA[c] ?? GENERO[c] ?? NUMERO[c] ?? null)
        .filter(Boolean)
        .join(' ');
}

/**
 * Un segmento del código, ya legible. `null` cuando no se reconoce nada:
 * quien llama muestra el código crudo y no una etiqueta inventada.
 */
export function describeOshbSegment(segment: string): string | null {
    const seg = segment.trim();
    if (!seg) return null;
    const cat = seg[0]!;

    if (cat === 'V') {
        const tallo = TALLO[seg[1] ?? ''];
        const tipo = TIPO[seg[2] ?? ''];
        // Sin tallo conocido no se nombra la forma: el tallo es lo que el
        // trabajo discute, y equivocarlo es peor que no decirlo.
        if (!tallo || !tipo) return null;
        const resto = pgn(seg.slice(3));
        return [tallo, tipo, resto].filter(Boolean).join(' ');
    }

    if (cat === 'N') {
        const propio = seg[1] === 'p';
        if (propio) return 'sustantivo propio';
        const estado = ESTADO[seg[seg.length - 1] ?? ''];
        const medio = pgn(seg.slice(2, estado ? -1 : undefined));
        return ['sustantivo', medio, estado].filter(Boolean).join(' ');
    }

    if (cat === 'S') {
        const resto = pgn(seg.slice(2));
        return ['sufijo pronominal', resto].filter(Boolean).join(' ');
    }

    return CATEGORIA[cat] ?? null;
}

/**
 * La palabra entera, con todos sus morfemas.
 *
 * Una palabra hebrea lleva pegados sus prefijos y su sufijo —`HR/Ncfpc` es
 * preposición + sustantivo—, y el código los separa con `/`. Se describen
 * todos: el trabajo discute justamente esas junturas.
 */
export function describeOshbCode(code: string): string {
    const limpio = code.trim().replace(/^[HA]/, '');
    const partes = limpio.split('/')
        .map(seg => describeOshbSegment(seg) ?? seg)
        .filter(Boolean);
    return partes.join(' + ');
}

/**
 * Cuántas formas verbales hay de cada tipo, contando OCURRENCIAS.
 *
 * Mismo criterio que el recuento griego, y por el mismo motivo: una forma
 * repetida dos veces son dos, y contar formas distintas es lo que produjo
 * «cuatro» donde había cinco.
 */
export function countOshbVerbTypes(codes: ReadonlyArray<string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const code of codes) {
        for (const seg of code.trim().replace(/^[HA]/, '').split('/')) {
            if (seg[0] !== 'V') continue;
            const tipo = TIPO[seg[2] ?? ''];
            const tallo = TALLO[seg[1] ?? ''];
            if (!tipo || !tallo) continue;
            const nombre = `${tipo} ${tallo}`;
            out[nombre] = (out[nombre] ?? 0) + 1;
        }
    }
    return out;
}
