import type { PassageReference } from '../../bible/canon/passage-reference';

/**
 * Cuántos versículos a cada lado del analizado entran como contexto.
 *
 * Cuatro, y el número sale de medir los casos que el defecto dejó pasar en el
 * trabajo de Santiago 2:1–13, no de redondear:
 *
 *   - `ἐάν` en 2:2 necesita su apódosis, que está en 2:4  → +2
 *   - `μέντοι` en 2:8 necesita el contraste de 2:6–7       → −2
 *   - `ἐλεγχόμενοι` en 2:9 necesita el argumento de 2:10–11 → +2
 *
 * Cuatro cubre los tres con margen. Más ancho no es gratis: cada versículo
 * griego ocupa lugar en un prompt que ya reparte presupuesto entre la guía de
 * estilo, las fuentes y el encuadre, y el contexto que no se usa desplaza
 * material que sí.
 */
export const RADIO_DE_CONTEXTO = 4;

export interface RangoDeVersiculos {
    from: number;
    to: number;
}

/**
 * Qué tramo del capítulo acompaña al versículo que se analiza.
 *
 * El analizador ve HOY sólo su propio versículo: `loadOriginalLanguageText`
 * pide el capítulo entero y lo recorta. El contexto ya está en memoria y se
 * tira, y con él se va la evidencia de toda construcción que cruce el corte
 * —que en griego son casi todas las interesantes—.
 *
 * El tramo se acota por los dos lados:
 *
 *   1. Al PASAJE DEL TRABAJO, cuando cae en el mismo capítulo. Lo que está
 *      fuera del pasaje el estudiante no lo está estudiando, y ofrecerlo
 *      invita a analizar lo que nadie pidió.
 *   2. Al radio, para que un trabajo sobre un capítulo entero no meta cincuenta
 *      versículos de griego en el prompt.
 *
 * El versículo analizado siempre está dentro, aunque quede fuera del pasaje
 * del trabajo: es el que hay que analizar.
 */
export function pericopeContextRange(
    paperPassage: PassageReference,
    verseRef: PassageReference,
    radio: number = RADIO_DE_CONTEXTO,
): RangoDeVersiculos {
    const objetivoDesde = verseRef.verseStart ?? 1;
    const objetivoHasta = verseRef.verseEnd ?? objetivoDesde;

    let from = objetivoDesde - radio;
    let to = objetivoHasta + radio;

    // El pasaje del trabajo sólo acota en el capítulo donde empieza o termina:
    // en un trabajo de varios capítulos, los del medio van enteros.
    const capitulo = verseRef.chapterStart;
    if (paperPassage.chapterStart === capitulo && paperPassage.verseStart != null) {
        from = Math.max(from, paperPassage.verseStart);
    }
    if (paperPassage.chapterEnd === capitulo && paperPassage.verseEnd != null) {
        to = Math.min(to, paperPassage.verseEnd);
    }

    // El versículo analizado manda sobre el recorte: si el paso quedó fuera del
    // pasaje —pasa al reencuadrar un trabajo ya empezado— igual hay que verlo.
    return {
        from: Math.max(1, Math.min(from, objetivoDesde)),
        to: Math.max(to, objetivoHasta),
    };
}

/**
 * El tramo, numerado, con el versículo analizado señalado.
 *
 * La marca importa tanto como el texto: sin ella el modelo recibe un bloque de
 * griego y no sabe cuál de esas oraciones tiene que analizar, que es peor que
 * no darle contexto.
 */
export function formatPericopeContext(
    versesByNumber: ReadonlyMap<number, string>,
    rango: RangoDeVersiculos,
    objetivo: RangoDeVersiculos,
    chapter: number,
): string {
    const lineas: string[] = [];
    let hayVecinos = false;
    for (let v = rango.from; v <= rango.to; v += 1) {
        const texto = versesByNumber.get(v);
        if (!texto) continue;
        const esObjetivo = v >= objetivo.from && v <= objetivo.to;
        if (!esObjetivo) hayVecinos = true;
        lineas.push(`${esObjetivo ? '►' : ' '} ${chapter}:${v} ${texto}`);
    }
    // Un entorno que es sólo el versículo analizado no es entorno: decirlo dos
    // veces gasta prompt, no agrega evidencia, y le pone al modelo un bloque
    // titulado «contexto» que no contiene ninguno.
    return hayVecinos ? lineas.join('\n') : '';
}
