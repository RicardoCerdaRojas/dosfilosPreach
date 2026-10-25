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
 *
 * El arameo (Esd 4:8–6:18 y 7:12–26, Dn 2:4–7:28, Gn 31:47, Jer 10:11) usa
 * las mismas letras para OTROS tallos: su «h» es haphel, no hifil. Leído con
 * la tabla hebrea, el peal salía «qal» y el hishtaphel «hitpael», y eso se le
 * entregaba al analizador como DATO no negociable. Ahora tiene su tabla.
 */

/** Tallos verbales (binyanim) que se pueden nombrar con seguridad. */
const TALLO: Record<string, string> = {
    q: 'qal', N: 'nifal', p: 'piel', P: 'pual',
    h: 'hifil', H: 'hofal', t: 'hitpael', o: 'polel',
};

/**
 * Tallos del arameo bíblico: la tabla OFICIAL de OSHB entera, copiada de
 * https://hb.openscriptures.org/parsing/HebrewMorphologyCodes.html («Verb
 * stems (Aramaic)»). No es una selección hecha a mano: en morphhb los 1.092
 * verbos arameos usan solo letras de esta tabla. Una letra que no esté sale
 * con su código crudo, igual que en hebreo.
 */
const TALLO_ARAMEO: Record<string, string> = {
    q: 'peal', Q: 'peil', u: 'hithpeel', p: 'pael', P: 'ithpaal',
    M: 'hithpaal', a: 'aphel', h: 'haphel', s: 'saphel', e: 'shaphel',
    H: 'hophal', i: 'ithpeel', t: 'hishtaphel', v: 'ishtaphel', w: 'hithaphel',
    o: 'polel', z: 'ithpoel', r: 'hithpolel', f: 'hithpalpel', b: 'hephal',
    c: 'tiphel', m: 'poel', l: 'palpel', L: 'ithpalpel', O: 'ithpolel',
    G: 'ittaphal',
};

/**
 * ¿El código es de una palabra aramea?
 *
 * Mira el prefijo de idioma del código ENTERO: `A` + categoría en mayúscula
 * (`AVqp3ms`, `ANcmsa`, `AC/Np`). Exigir la mayúscula es lo que deja leer
 * también el paquete npm de morphhb, que quita la `H` del hebreo pero no la
 * `A` del arameo: allí un adjetivo hebreo es `Aampa` (tipo en minúscula) y
 * no debe pasar por arameo. Es la misma detección que `oshb-contrast.ts` y
 * `grammarSearchKeys.ts` (`startsWith('A')`) para el formato con prefijo.
 */
export function isAramaicOshbCode(code: string): boolean {
    return /^A[A-Z]/.test(code.trim());
}

/** El código sin su prefijo de idioma. Un código sin prefijo queda igual. */
function sinPrefijo(code: string): string {
    return code.trim().replace(/^(H|A(?=[A-Z]))/, '');
}

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
export function describeOshbSegment(segment: string, aramaic = false): string | null {
    const seg = segment.trim();
    if (!seg) return null;
    const cat = seg[0]!;

    if (cat === 'V') {
        const tallo = (aramaic ? TALLO_ARAMEO : TALLO)[seg[1] ?? ''];
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
 *
 * La palabra aramea lleva «(arameo)» al final: en Dn 2:4 el mismo versículo
 * pasa del hebreo al arameo, y un sustantivo no dice por sí solo su lengua.
 */
export function describeOshbCode(code: string): string {
    const arameo = isAramaicOshbCode(code);
    const partes = sinPrefijo(code).split('/')
        .map(seg => describeOshbSegment(seg, arameo) ?? seg)
        .filter(Boolean);
    const texto = partes.join(' + ');
    return arameo && texto ? `${texto} (arameo)` : texto;
}

/**
 * Cuántas formas verbales hay de cada tipo, contando OCURRENCIAS.
 *
 * Mismo criterio que el recuento griego, y por el mismo motivo: una forma
 * repetida dos veces son dos, y contar formas distintas es lo que produjo
 * «cuatro» donde había cinco.
 *
 * El arameo se cuenta aparte, con «arameo» en el nombre («perfecto peal
 * arameo»): sumarlo al hebreo mezclaría dos sistemas verbales. Va sin
 * paréntesis porque el resumen pluraliza la última palabra («2 perfecto peal
 * arameos»).
 */
export function countOshbVerbTypes(codes: ReadonlyArray<string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const code of codes) {
        const arameo = isAramaicOshbCode(code);
        for (const seg of sinPrefijo(code).split('/')) {
            if (seg[0] !== 'V') continue;
            const tipo = TIPO[seg[2] ?? ''];
            const tallo = (arameo ? TALLO_ARAMEO : TALLO)[seg[1] ?? ''];
            if (!tipo || !tallo) continue;
            const nombre = arameo ? `${tipo} ${tallo} arameo` : `${tipo} ${tallo}`;
            out[nombre] = (out[nombre] ?? 0) + 1;
        }
    }
    return out;
}
