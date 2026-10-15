import type { FuenteDeConsulta } from '@dosfilos/infrastructure';

/**
 * Las citas de una respuesta de «Consultar» (fase «biblioteca consultable»).
 * El servidor guarda la respuesta con marcas de fragmento —`[F3]`— y la hoja
 * de cada fuente; quien muestra la respuesta dice cómo se cita cada fuente
 * (`etiquetar`): la Biblioteca, con la numeración del libro; el visor, con la
 * misma regla de su «Copiar la cita».
 */

/** Cómo se cita una fuente: «(Varner, p. 188)». */
export type EtiquetarFuente = (fuente: FuenteDeConsulta) => string;

/** Prefijo de los enlaces que marcan una cita dentro del markdown. */
export const PREFIJO_FUENTE = '#fuente-';

const MARCAS = /(?:\[F\d{1,3}\])+/g;

/** Las fuentes de una corrida de marcas («[F1][F4]»), en el orden escrito. */
function fuentesDeLaCorrida(corrida: string, porNumero: ReadonlyMap<number, FuenteDeConsulta>): FuenteDeConsulta[] {
    return [...corrida.matchAll(/\[F(\d{1,3})\]/g)]
        .map(m => porNumero.get(Number(m[1])))
        .filter((f): f is FuenteDeConsulta => !!f);
}

/** Varias citas seguidas en un solo paréntesis: «(Varner, p. 190; Moo, p. 12)». */
function unirEtiquetas(etiquetas: string[]): string {
    const unicas = [...new Set(etiquetas)];
    return unicas.length === 1 ? unicas[0]! : `(${unicas.map(e => e.replace(/^\(|\)$/g, '')).join('; ')})`;
}

/**
 * El markdown con cada corrida de marcas convertida en un enlace
 * `[(Varner, p. 188)](#fuente-<i>)`, y la lista de fuentes de cada enlace.
 */
export function enlazarFuentes(
    respuesta: string,
    fuentes: ReadonlyArray<FuenteDeConsulta>,
    etiquetar: EtiquetarFuente,
): { markdown: string; enlaces: FuenteDeConsulta[][] } {
    const porNumero = new Map(fuentes.map(f => [f.n, f]));
    const enlaces: FuenteDeConsulta[][] = [];
    const markdown = respuesta.replace(MARCAS, corrida => {
        const citadas = fuentesDeLaCorrida(corrida, porNumero);
        if (citadas.length === 0) return '';
        enlaces.push(citadas);
        const texto = unirEtiquetas(citadas.map(etiquetar));
        return `[${texto.replace(/[[\]]/g, '\\$&')}](${PREFIJO_FUENTE}${enlaces.length - 1})`;
    });
    return { markdown, enlaces };
}

/** El texto para copiar o llevar a otro lado: las marcas, ya como citas. */
export function textoConCitas(
    respuesta: string,
    fuentes: ReadonlyArray<FuenteDeConsulta>,
    etiquetar: EtiquetarFuente,
): string {
    const porNumero = new Map(fuentes.map(f => [f.n, f]));
    return respuesta.replace(MARCAS, corrida => {
        const citadas = fuentesDeLaCorrida(corrida, porNumero);
        return citadas.length === 0 ? '' : unirEtiquetas(citadas.map(etiquetar));
    }).replace(/[ \t]{2,}/g, ' ');
}
