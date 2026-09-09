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
     * `impresa = hoja + offset`. `null` cuando el tramo no lleva numeración
     * arábiga —preliminares en romanos, láminas, hojas de cortesía—, en cuyo
     * caso la cita honesta es «hoja N».
     */
    offset: number | null;
}

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
    if (!numbering || !Number.isFinite(sheet) || sheet < 1) return null;
    const segment = numbering.segments.find(s => sheet >= s.fromSheet && sheet <= s.toSheet);
    if (!segment || segment.offset === null) return null;
    const printed = sheet + segment.offset;
    return printed >= 1 ? printed : null;
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
        const offset = point.printed === null ? null : point.printed - point.sheet;
        const from = i === 0
            ? 1
            : Math.floor((sorted[i - 1]!.sheet + point.sheet) / 2) + 1;
        const to = i === sorted.length - 1
            ? end
            : Math.floor((point.sheet + sorted[i + 1]!.sheet) / 2);

        const last = segments[segments.length - 1];
        if (last && last.offset === offset) {
            last.toSheet = to;
            continue;
        }
        segments.push({ fromSheet: from, toSheet: to, offset });
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
 *   - Con numeración que resuelve esta hoja → `p. N`, la página impresa.
 *   - Sin numeración del recurso → `hoja N`, incompleto pero verdadero, y
 *     visible para quien revise el trabajo.
 *   - Con numeración pero en un tramo sin folio arábigo —las preliminares en
 *     romanos de Mayor son 271 hojas— → sólo la sección, porque ahí no hay
 *     página impresa que citar y decir «hoja N» invitaría a copiarla como si
 *     lo fuera.
 *
 * Vive en el dominio y no en cada caso de uso porque estaba duplicada en dos,
 * y una regla de citación repetida es una regla que se corrige en un solo
 * lugar de los dos.
 */
export function citationAnchorFor(
    chunk: { sheet: number | null; section: string | null },
    numbering: PageNumbering | null,
): string {
    const printed = chunk.sheet === null ? null : printedPageIn(numbering, chunk.sheet);
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
