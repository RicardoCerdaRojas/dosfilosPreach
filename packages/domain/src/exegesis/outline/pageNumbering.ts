/**
 * Numeración impresa de un recurso, por tramos.
 *
 * `printedPageOffset` resuelve el caso corriente: un libro cuyas preliminares
 * corren la cuenta una cantidad fija. Este módulo existe porque ese modelo
 * —un número por libro— es falso para dos formas de libro que están en
 * cualquier biblioteca real, y ambas aparecieron al medir una:
 *
 *   1. **El desfase se corre a mitad del volumen.** En «Teología Sistemática,
 *      tomo II» las hojas 6-413 llevan desfase −1, las 414-575 llevan −3 y
 *      las 576-651 llevan −4. Calibrado con un solo punto en la hoja 100 se
 *      obtiene −1, y toda cita posterior a la 414 sale errada por dos o tres
 *      páginas sin que nada lo delate.
 *
 *   2. **Parte del libro no lleva numeración arábiga.** En el comentario de
 *      Mayor sobre Santiago, las hojas 5-271 son la introducción, paginada en
 *      romanos: 264 hojas sin un solo folio árabe. Recién desde la hoja 272
 *      empieza la cuenta que da el desfase −278. Un tramo sin numeración no
 *      es una detección pendiente, es un hecho del libro, y sus citas deben
 *      decir «hoja N» para siempre.
 *
 * De ahí que la unidad no sea el recurso sino el tramo, y que `offset: null`
 * sea un valor legítimo y no un error a resolver.
 */

import {
    detectPrintedPageOffsetStaged,
    type PageTextSample,
} from './printedPageOffset';

/** Un tramo de hojas que comparten una misma regla de numeración. */
export interface NumberingSegment {
    /** Primera hoja del tramo, inclusive. */
    fromSheet: number;
    /** Última hoja del tramo, inclusive. */
    toSheet: number;
    /**
     * `impresa = offset + step × hoja`. `null` cuando el tramo no lleva
     * numeración alguna —láminas, hojas de cortesía—, en cuyo caso la cita
     * honesta es «hoja N».
     */
    offset: number | null;
    /**
     * Hacia dónde corre la numeración a medida que avanza la hoja.
     *
     * Ausente equivale a `1`: la página impresa crece con la hoja, que es lo
     * que hace todo libro encuadernado de izquierda a derecha y lo que
     * describe toda la numeración guardada antes de este campo.
     *
     * `-1` existe porque un libro HEBREO se encuaderna al revés. Escaneado en
     * orden de hoja, sus folios DECRECEN: en la Biblia Hebraica Quinta la hoja
     * 148 imprime 155, la 190 imprime 113 y la 260 imprime 43. Con `step: 1`
     * eso es inexpresable —ningún desfase fijo lo produce— y el libro quedaba
     * condenado a citarse como «hoja N» o, peor, calibrado con un desfase que
     * acierta en una hoja y falla en todas las demás.
     *
     * Con `step: -1`, `offset` es la SUMA CONSTANTE hoja + folio: 303 en el
     * caso de BHQ. No es un número con significado editorial, y por eso no se
     * le pide a nadie que lo escriba: se deduce de dos respuestas de
     * calibración cuya suma coincide.
     */
    step?: NumberingStep;
    /**
     * Con qué cifras se imprime el número de este tramo.
     *
     * Ausente equivale a `'arabic'`, que es lo que describe toda la
     * numeración guardada antes de que existiera este campo.
     *
     * `'roman'` existe porque las páginas de un tramo romano SON PÁGINAS: la
     * introducción de Mayor sobre Santiago tiene 260, se citan a diario como
     * «p. ccxxii», y tratarlas como tramo sin numerar obligaba a citar «hoja
     * 240» —un número del archivo PDF que no existe en ningún ejemplar—. La
     * diferencia entre `offset: null` y un tramo romano es la diferencia
     * entre «esta hoja no tiene número» y «tiene número, y no es arábigo».
     */
    style?: NumberingStyle;
}

/** Cifras con las que se imprime un tramo. */
export type NumberingStyle = 'arabic' | 'roman';

/**
 * Qué páginas impresas cubre un tramo, y cuántas de sus hojas quedan sin
 * número.
 *
 * Existe para que NADIE MÁS calcule el folio por su cuenta. El previsualizador
 * de la calibración lo hacía con `hoja + offset` —su propia copia de la regla—
 * y con un tramo descendente habría mostrado un rango al revés mientras las
 * citas mostraban el correcto. Dos reglas que deben coincidir y viven aparte
 * terminan no coincidiendo.
 *
 * Devuelve `null` cuando el tramo no numera ninguna de sus hojas.
 */
export function printedRangeOf(
    segment: NumberingSegment,
): { from: string; to: string; unnumberedSheets: number } | null {
    if (segment.offset === null) return null;

    const numbering: PageNumbering = { segments: [segment], origin: 'confirmed' };

    // Se ROTULA, no se devuelve el número: un tramo romano tiene numeración y
    // hay que mostrarla con sus cifras. Usar `printedPageIn` acá haría que un
    // tramo romano se informara como «sin numeración arábiga» —esa función
    // calla ante los romanos a propósito, para que nadie escriba «p. 222» sobre
    // la página «ccxxii»— y la pantalla diría que no hay número donde sí lo hay.
    //
    // Y se RECORRE en vez de despejar: con `step: -1` el extremo numerado no es
    // necesariamente el primero, y una fórmula que lo suponga se equivoca justo
    // en el caso que este campo vino a resolver.
    let primera: string | null = null;
    let ultima: string | null = null;
    let numeradas = 0;
    for (let sheet = segment.fromSheet; sheet <= segment.toSheet; sheet++) {
        const rotulo = printedLabelIn(numbering, sheet);
        if (rotulo === null) continue;
        if (primera === null) primera = rotulo;
        ultima = rotulo;
        numeradas++;
    }
    if (primera === null || ultima === null) return null;

    return {
        from: primera,
        to: ultima,
        unnumberedSheets: Math.max(0, (segment.toSheet - segment.fromSheet + 1) - numeradas),
    };
}

/** Hacia dónde corre la numeración: `1` crece con la hoja, `-1` decrece. */
export type NumberingStep = 1 | -1;

/** Cómo se estableció la numeración de un recurso. */
export type NumberingOrigin =
    /** La propuso el detector y nadie la miró todavía. */
    | 'detected'
    /** Una persona la confirmó o la corrigió contra el ejemplar. */
    | 'confirmed';

export interface PageNumbering {
    segments: ReadonlyArray<NumberingSegment>;
    origin: NumberingOrigin;
}

/**
 * Hojas CON FOLIO LEGIBLE que se le pide a cada banda.
 *
 * Lo que limita el análisis no es cuántas hojas tiene el libro sino cuántas
 * conservan su folio tras la extracción, y las dos cantidades no guardan
 * relación. El comentario textual de Metzger tiene 900 fragmentos y sólo 13
 * hojas con folio legible: dimensionar las bandas por hojas totales le da una
 * muestra por banda, ninguna banda concluye, y un libro que el análisis
 * entero resuelve con acuerdo unánime queda sin numeración.
 *
 * Por eso las bandas se dimensionan sobre la densidad de folios medida, no
 * sobre el largo del libro.
 */
const MIN_NUMBERED_SHEETS_PER_BAND = 12;

/** Cota superior de bandas: más granularidad no compra precisión, sólo ruido. */
const MAX_BANDS = 12;

/**
 * Número impreso de una hoja según la numeración del recurso.
 *
 * `null` cuando la hoja cae fuera de todo tramo, cuando su tramo no tiene
 * numeración arábiga, o cuando la cuenta se va antes de la primera página.
 * En los tres casos la única lectura honesta es tratar el número como hoja y
 * rotularlo como tal.
 */
export function printedPageIn(
    numbering: PageNumbering | null | undefined,
    sheet: number,
): number | null {
    const found = segmentValueAt(numbering, sheet);
    // Un tramo romano devuelve `null` ACÁ a propósito. Su valor es un número
    // —101— pero su página es «ci», y quien llame a esta función va a
    // escribir «p. 101», que no existe en el libro. Devolver null hace que un
    // llamador no migrado degrade a «hoja N», que es falso pero honesto, en
    // vez de a una página inventada. Para rotular está `printedLabelIn`.
    if (!found || found.style === 'roman') return null;
    return found.value;
}

/** Tramo y valor numérico de una hoja, sin decidir todavía cómo se escribe. */
function segmentValueAt(
    numbering: PageNumbering | null | undefined,
    sheet: number,
): { value: number; style: NumberingStyle } | null {
    if (!numbering || !Number.isFinite(sheet) || sheet < 1) return null;
    const segment = numbering.segments.find(s => sheet >= s.fromSheet && sheet <= s.toSheet);
    if (!segment || segment.offset === null) return null;
    // `offset + step × hoja` en vez de `hoja + offset`: con `step: -1` la
    // página decrece al avanzar la hoja, que es lo que hace un libro hebreo
    // escaneado en orden de hoja. Sin `step`, la fórmula es la de siempre.
    const value = segment.offset + (segment.step ?? 1) * sheet;
    if (value < 1) return null;
    return { value, style: segment.style ?? 'arabic' };
}

/**
 * Cómo se escribe el número impreso de una hoja: `"42"` o `"ccxxii"`.
 *
 * Es la función que deben usar todos los caminos que ROTULAN. `printedPageIn`
 * queda para los que COMPARAN cantidades, que no saben ni les importa con qué
 * cifras se imprime el número.
 */
export function printedLabelIn(
    numbering: PageNumbering | null | undefined,
    sheet: number,
): string | null {
    const found = segmentValueAt(numbering, sheet);
    if (!found) return null;
    return found.style === 'roman' ? toRomanNumeral(found.value) : String(found.value);
}

const ROMAN_UNITS: ReadonlyArray<readonly [number, string]> = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
];

/**
 * Romano en minúsculas, que es como los imprimen los preliminares de un libro
 * («ccxxii», no «CCXXII»).
 */
export function toRomanNumeral(value: number): string {
    if (!Number.isFinite(value) || value < 1 || value > 3999) return String(value);
    let rest = Math.floor(value);
    let out = '';
    for (const [amount, sign] of ROMAN_UNITS) {
        while (rest >= amount) {
            out += sign;
            rest -= amount;
        }
    }
    return out;
}

/**
 * Lee un romano y devuelve su valor, o `null` si no lo es.
 *
 * Se exige la forma CANÓNICA: `toRomanNumeral` de lo leído tiene que dar el
 * mismo texto. Sin eso «iiii» o «ic» pasarían por válidos y la calibración
 * guardaría un desfase deducido de un número que nadie imprime.
 */
export function parseRomanNumeral(raw: string): number | null {
    const text = (raw ?? '').trim().toLowerCase();
    if (!text || !/^[ivxlcdm]+$/.test(text)) return null;
    const digit: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
    let total = 0;
    for (let i = 0; i < text.length; i++) {
        const here = digit[text[i]!]!;
        const next = i + 1 < text.length ? digit[text[i + 1]!]! : 0;
        total += here < next ? -here : here;
    }
    if (total < 1 || total > 3999) return null;
    return toRomanNumeral(total) === text ? total : null;
}

/**
 * Numeración de un solo tramo. El caso corriente, y también la forma de
 * expresar el resultado de una calibración manual con un único punto.
 */
export function singleSegmentNumbering(
    offset: number | null,
    lastSheet: number,
    origin: NumberingOrigin,
): PageNumbering {
    return { segments: [{ fromSheet: 1, toSheet: Math.max(1, lastSheet), offset }], origin };
}

/**
 * Propone los tramos de numeración analizando el libro por bandas.
 *
 * Mirar el libro como un bloque promedia lo que hay que distinguir: en
 * «Teología Sistemática II» el desfase mayoritario gana con 59% de acuerdo y
 * el detector lo descarta por falta de consenso, cuando en realidad hay tres
 * consensos perfectos en tres regiones distintas.
 *
 * La propuesta es siempre `origin: 'detected'`. Confirmarla es de la persona
 * que tiene el libro: el detector puede decir dónde CREE que cambia la
 * cuenta, pero la frontera exacta cae entre dos bandas y adivinarla sería
 * inventar una precisión que no se midió.
 */
export function detectNumberingSegments(
    samples: ReadonlyArray<PageTextSample>,
): PageNumbering | null {
    const sorted = samples
        .filter(s => Number.isFinite(s.page) && s.page >= 1)
        .slice()
        .sort((a, b) => a.page - b.page);
    if (sorted.length === 0) return null;

    const lastSheet = sorted[sorted.length - 1]!.page;

    // El análisis del libro entero cumple dos papeles: mide cuántas hojas
    // conservan folio —que es lo que dimensiona las bandas— y queda como
    // respaldo para cuando bandear resulte peor que no bandear.
    const whole = detectPrintedPageOffsetStaged(sorted);
    const wholeBook = whole.offset === null || whole.offset > 0
        ? null
        : singleSegmentNumbering(whole.offset, lastSheet, 'detected');

    const bandCount = Math.min(
        MAX_BANDS,
        Math.max(1, Math.floor(whole.samples / MIN_NUMBERED_SHEETS_PER_BAND)),
    );

    // Con folios escasos no hay nada que segmentar: una sola banda es el
    // análisis de siempre, y devolverlo como tramo único mantiene el
    // comportamiento actual para la mayoría de los recursos.
    if (bandCount === 1) return wholeBook;

    const width = Math.ceil(sorted.length / bandCount);
    const bands: Array<{ from: number; to: number; offset: number | null }> = [];
    for (let i = 0; i < bandCount; i++) {
        const slice = sorted.slice(i * width, (i + 1) * width);
        if (slice.length === 0) continue;
        const detected = detectPrintedPageOffsetStaged(slice).offset;
        bands.push({
            from: slice[0]!.page,
            to: slice[slice.length - 1]!.page,
            // Un desfase positivo diría que el libro imprime un número MAYOR
            // que la hoja donde está, y las preliminares sólo pueden sumar
            // hojas, nunca restarlas. Cuando aparece es ruido: en la Biblia
            // Hebraica Quinta el detector leyó números del aparato crítico
            // como folios y propuso +15, que habría citado la hoja 28 como
            // página 43.
            //
            // Un PDF que arranque a mitad de un libro sí tendría desfase
            // positivo, pero es raro y una persona puede declararlo en la
            // calibración. Preferir el silencio acá cambia un dato falso por
            // uno faltante, que es el intercambio correcto.
            offset: detected !== null && detected > 0 ? null : detected,
        });
    }
    if (bands.length === 0) return wholeBook;

    // Una racha de bandas sin desfase encerrada entre dos que coinciden no es
    // un tramo sin numeración: es un tramo donde la extracción perdió los
    // folios. Que el desfase sea el mismo antes y después lo prueba — si la
    // racha fueran páginas realmente sin numerar, habría corrido la cuenta y
    // los dos lados no coincidirían. Se absorbe, porque partir el libro ahí
    // le daría al usuario un hueco que resolver sin que el libro tenga nada
    // raro.
    for (let i = 0; i < bands.length; i++) {
        if (bands[i]!.offset !== null) continue;
        let end = i;
        while (end + 1 < bands.length && bands[end + 1]!.offset === null) end++;
        const before = i > 0 ? bands[i - 1]!.offset : null;
        const after = end + 1 < bands.length ? bands[end + 1]!.offset : null;
        if (before !== null && before === after) {
            for (let j = i; j <= end; j++) bands[j]!.offset = before;
        }
        i = end;
    }

    const merged: NumberingSegment[] = [];
    for (const band of bands) {
        const last = merged[merged.length - 1];
        if (last && last.offset === band.offset) {
            last.toSheet = band.to;
            continue;
        }
        merged.push({ fromSheet: band.from, toSheet: band.to, offset: band.offset });
    }

    // Si ninguna banda concluyó, bandear salió peor que no bandear: se
    // devuelve el análisis del libro entero, que puede tener respaldo de
    // sobra aunque repartido en pocas hojas. Y si ése tampoco concluyó,
    // `null` deja al recurso caer en la calibración manual, en vez de
    // guardar una numeración vacía que se ve resuelta sin estarlo.
    if (merged.every(s => s.offset === null)) return wholeBook;

    merged[0]!.fromSheet = 1;
    merged[merged.length - 1]!.toSheet = lastSheet;
    return { segments: merged, origin: 'detected' };
}

/** Una hoja y el número que una persona leyó impreso en ella. */
export interface CalibrationPoint {
    /** Hoja física del archivo, contada desde 1. */
    sheet: number;
    /**
     * Número impreso al pie o en el encabezado. `null` cuando esa hoja no
     * lleva número arábigo —preliminares en romanos, láminas, cortesías—, que
     * es una respuesta legítima y no un dato faltante.
     */
    printed: number | null;
    /**
     * Con qué cifras estaba escrito lo que la persona leyó. Ausente equivale a
     * `'arabic'`.
     *
     * Va junto al valor y no aparte porque son un mismo dato: quien miró la
     * hoja 240 de Mayor no leyó «222», leyó «ccxxii», y perder eso convierte
     * una página real en un tramo sin numerar.
     */
    style?: NumberingStyle;
}

/**
 * Arma la numeración a partir de los puntos que una persona confirmó.
 *
 * Cada punto manda en su vecindario y las fronteras caen a mitad de camino
 * entre puntos consecutivos. Es una aproximación deliberada: el usuario
 * confirmó tres hojas, no las seiscientas del medio, y fingir que la frontera
 * está exactamente en una hoja concreta sería inventar una precisión que nadie
 * midió. La interfaz muestra los tramos resultantes antes de guardar, así que
 * la aproximación es visible y corregible en vez de silenciosa.
 *
 * Dos puntos con el mismo desfase colapsan en un solo tramo, que es el caso
 * corriente: la mayoría de los libros numeran igual de principio a fin.
 */
export function numberingFromCalibrationPoints(
    points: ReadonlyArray<CalibrationPoint>,
    lastSheet: number,
): PageNumbering | null {
    const sorted = points
        .filter(p => Number.isFinite(p.sheet) && p.sheet >= 1)
        .slice()
        .sort((a, b) => a.sheet - b.sheet);
    if (sorted.length === 0) return null;

    const end = Math.max(lastSheet, sorted[sorted.length - 1]!.sheet);
    const segments: NumberingSegment[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const point = sorted[i]!;
        const regla = reglaDelPunto(sorted, i);
        const offset = regla.offset;
        const from = i === 0
            ? 1
            : Math.floor((sorted[i - 1]!.sheet + point.sheet) / 2) + 1;
        const to = i === sorted.length - 1
            ? end
            : Math.floor((point.sheet + sorted[i + 1]!.sheet) / 2);

        const style: NumberingStyle = point.style ?? 'arabic';
        const last = segments[segments.length - 1];
        // Mismo desfase Y mismas cifras. Sin la segunda condición, la hoja 240
        // en romanos y la 500 en arábigo colapsarían en un tramo si sus
        // desfases coincidieran, y medio libro se citaría con las cifras del
        // otro medio.
        if (last && last.offset === offset && (last.style ?? 'arabic') === style
            && (last.step ?? 1) === regla.step) {
            last.toSheet = to;
            continue;
        }
        const base: NumberingSegment = { fromSheet: from, toSheet: to, offset };
        if (style !== 'arabic' && offset !== null) base.style = style;
        // `step: 1` no se escribe: es el valor por omisión y guardarlo en cada
        // tramo ensuciaría las 29 numeraciones que ya existen sin decir nada.
        if (regla.step === -1) base.step = -1;
        segments.push(base);
    }

    if (segments.every(s => s.offset === null)) {
        // Un libro entero sin numeración arábiga es un hecho válido, y hay que
        // guardarlo: sin esto la interfaz volvería a proponer la calibración
        // cada vez, y la persona ya respondió.
        return { segments: [{ fromSheet: 1, toSheet: end, offset: null }], origin: 'confirmed' };
    }
    return { segments, origin: 'confirmed' };
}

/**
 * Con qué regla numera un punto de calibración, mirando a sus vecinos.
 *
 * POR QUÉ HACE FALTA MIRAR AL VECINO. Un punto suelto —«la hoja 148 imprime
 * 155»— no dice hacia dónde corre la numeración: encaja igual con un libro que
 * sube y con uno que baja. Lo que sí lo dice es un PAR.
 *
 * En un libro encuadernado al revés —todo texto hebreo— los folios decrecen
 * mientras las hojas avanzan, y entonces `hoja + folio` es CONSTANTE. Medido
 * sobre la Biblia Hebraica Quinta:
 *
 *     hoja 148 → folio 155      148 + 155 = 303
 *     hoja 190 → folio 113      190 + 113 = 303
 *     hoja 260 → folio  43      260 +  43 = 303
 *
 * Esa constancia es una PRUEBA, no una corazonada: si dos respuestas la
 * cumplen, describen un tramo descendente; si no, son dos tramos ascendentes
 * distintos y no se infiere nada. Por eso la dirección se deduce en vez de
 * preguntarse — nadie puede marcar mal una casilla que no existe, y una
 * suposición equivocada se cae sola al no cumplirse la suma.
 */
function reglaDelPunto(
    puntos: ReadonlyArray<CalibrationPoint>,
    i: number,
): { offset: number | null; step: NumberingStep } {
    const punto = puntos[i]!;
    // Se copia a una local para que el estrechamiento sobreviva al cierre de
    // más abajo: dentro de una función anidada, TypeScript no puede saber que
    // el campo sigue siendo no-nulo.
    const impreso = punto.printed;
    if (impreso === null) return { offset: null, step: 1 };

    const suma = punto.sheet + impreso;
    const desciendeCon = (otro: CalibrationPoint | undefined): boolean => (
        !!otro && otro.printed !== null
        && otro.sheet !== punto.sheet
        && otro.sheet + otro.printed === suma
        // Un par que sube NO puede cumplir la suma constante salvo que sea el
        // mismo punto repetido, ya descartado arriba. Se comprueba igual: el
        // costo es una comparación y lo que evita es invertir un libro entero.
        && (otro.sheet > punto.sheet ? otro.printed < impreso : otro.printed > impreso)
    );

    if (desciendeCon(puntos[i - 1]) || desciendeCon(puntos[i + 1])) {
        return { offset: suma, step: -1 };
    }
    return { offset: impreso - punto.sheet, step: 1 };
}

/**
 * Ancla de citación de un fragmento, en la convención del corpus.
 *
 * El ancla es literalmente lo que el modelo copia dentro del paréntesis, así
 * que rotular «p. 32» sobre la hoja 32 no produce una etiqueta imprecisa:
 * produce una CITA FALSA, que el lector sigue hasta una página que habla de
 * otra cosa. En el comentario de Adamson la hoja 32 imprime 28; en el de
 * Mayor, la hoja 328 imprime 50.
 *
 * De ahí las tres salidas:
 *
 *   - Con numeración que resuelve esta hoja → `p. N`, la página impresa. El
 *     tramo decide con qué cifras: `p. 42` o `p. ccxxii`.
 *   - Sin numeración del recurso → `hoja N`, incompleto pero verdadero, y
 *     visible para quien revise el trabajo.
 *   - Con numeración pero en un tramo sin folio —láminas, cortesías— → sólo
 *     la sección, porque ahí no hay página impresa que citar y decir «hoja N»
 *     invitaría a copiarla como si lo fuera.
 *
 * Vive en el dominio y no en cada caso de uso porque estaba duplicada en dos,
 * y una regla de citación repetida es una regla que se corrige en un solo
 * lugar de los dos.
 */
export function citationAnchorFor(
    chunk: { sheet: number | null; section: string | null },
    numbering: PageNumbering | null,
): string {
    // `printedLabelIn` y no `printedPageIn`: en un tramo romano el valor es
    // 222 y la página es «ccxxii», y acá se escribe la página.
    const printed = chunk.sheet === null ? null : printedLabelIn(numbering, chunk.sheet);
    const page = printed !== null
        ? `p. ${printed}`
        : numbering === null && chunk.sheet
            ? `hoja ${chunk.sheet}`
            : '';

    if (page && chunk.section) return `${page}, § ${chunk.section}`;
    if (page) return page;
    if (chunk.section) return `§ ${chunk.section}`;
    return '';
}

/** Cuántos puntos se piden como mínimo, pase lo que pase. */
const MIN_CALIBRATION_POINTS = 3;

/** Tope, para que un libro muy segmentado no se vuelva un cuestionario. */
const MAX_CALIBRATION_POINTS = 4;

/**
 * Hojas que conviene mostrarle a una persona para confirmar la numeración.
 *
 * Siempre al menos tres, repartidas a lo ancho del libro, y esto no es
 * negociable ni siquiera cuando el detector cree que la numeración es
 * constante. La razón es que confirmar tiene que ser INDEPENDIENTE de lo que
 * el detector concluyó: si el libro corre su cuenta a mitad de camino y el
 * detector no lo vio —porque el folio no sobrevivió en esa banda—, preguntar
 * un solo punto confirmaría un desfase único que es falso para media obra, y
 * lo haría con el aval de una persona.
 *
 * A esos tres se suman los interiores de cada tramo detectado, que es donde el
 * detector cree que la cuenta cambia. El interior importa: los bordes de un
 * tramo son justamente donde la frontera es incierta, así que preguntar ahí
 * invitaría a confirmar un dato dudoso.
 */
export function calibrationSheets(numbering: PageNumbering | null, lastSheet: number): number[] {
    const span = Math.max(1, lastSheet);
    const clamp = (n: number) => Math.min(span, Math.max(1, Math.round(n)));

    const spread = [span * 0.2, span * 0.5, span * 0.8].map(clamp);
    const interiors = (numbering?.segments ?? [])
        .map(s => clamp((s.fromSheet + s.toSheet) / 2));

    // Los interiores primero: llevan la información de dónde cambia la cuenta.
    // El reparto uniforme rellena hasta el mínimo cuando hay un tramo solo.
    const picked: number[] = [];
    for (const sheet of [...interiors, ...spread]) {
        if (picked.length >= MAX_CALIBRATION_POINTS) break;
        // Dos preguntas sobre hojas contiguas no aportan una segunda medición.
        if (picked.some(p => Math.abs(p - sheet) < Math.max(1, span * 0.05))) continue;
        picked.push(sheet);
    }
    while (picked.length < Math.min(MIN_CALIBRATION_POINTS, span)) {
        const next = clamp(span * (picked.length + 1) / (MIN_CALIBRATION_POINTS + 1));
        if (picked.includes(next)) break;
        picked.push(next);
    }
    return picked.sort((a, b) => a - b);
}

/**
 * Ancla de un extracto ya guardado, reescrita contra la numeración del libro.
 *
 * Los extractos guardan su ancla como TEXTO YA FORMATEADO —«p. 282», «p. 47,
 * § III.2»— porque el extractor la armó al momento de recuperar el fragmento,
 * cuando la numeración del recurso todavía no existía. Ese texto dice «p.»
 * sobre la hoja del archivo, y es lo que el modelo copia dentro del paréntesis
 * cuando una fuente inlinea sus extractos guardados en vez de consultar el
 * corpus.
 *
 * Reetiquetar acá y no en el extractor tiene una razón concreta: los trabajos
 * ya empezados llevan sus extractos escritos, y arreglar sólo el extractor
 * dejaría mal a todo paper existente. El precio es tener que parsear una
 * cadena, que es feo pero acotado —el extractor sólo emite tres formas— y
 * conservador: si no reconoce la forma, devuelve el ancla intacta en vez de
 * arriesgar una conversión.
 */
export function relabelExcerptAnchor(
    sourceLocation: string,
    numbering: PageNumbering | null,
    /**
     * Hoja y sección guardadas aparte, cuando el extracto las trae. Se
     * prefieren al parseo: son el dato, no su rótulo.
     */
    explicit?: { sheet?: number; section?: string },
): string {
    if (typeof explicit?.sheet === 'number' && Number.isFinite(explicit.sheet)) {
        return citationAnchorFor({ sheet: explicit.sheet, section: explicit.section ?? null }, numbering);
    }
    const raw = (sourceLocation ?? '').trim();
    if (!raw) return raw;

    // `p. 47`, `pp. 47`, `p.47` — con o sin una sección detrás.
    const match = raw.match(/^pp?\.\s*(\d{1,4})\s*(?:,\s*§\s*(.*))?$/);
    if (!match) return raw;

    const sheet = Number(match[1]);
    if (!Number.isFinite(sheet) || sheet < 1) return raw;
    const section = match[2]?.trim() || null;

    return citationAnchorFor({ sheet, section }, numbering);
}
