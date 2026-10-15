import { citationAnchorFor, type PageNumbering } from '@dosfilos/domain';
import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { citaParaInsertar } from '@/components/exegesis/citation/citarDesdeVisor';
import { apellidoDelAutor } from '../apellidoDelAutor';

/**
 * Las citas de una respuesta de «Consultar» (fase «biblioteca consultable»,
 * U3). El servidor guarda la respuesta con marcas de fragmento —`[F3]`— y la
 * hoja de cada fuente; acá se vuelven «(Varner, p. 188)» con la MISMA regla
 * del visor (`citationAnchorFor` con la numeración confirmada; sin ella,
 * «hoja N»). Si el libro se calibra después, la cita guardada se corrige sola.
 */

/** Lo que hace falta saber del libro para citarlo. */
export interface LibroParaCitar {
    author?: string | null;
    title?: string | null;
    pageNumbering?: PageNumbering | null;
}

/** Prefijo de los enlaces que marcan una cita dentro del markdown. */
export const PREFIJO_FUENTE = '#fuente-';

const MARCAS = /(?:\[F\d{1,3}\])+/g;

/** «(Varner, p. 188)»: la clave es el apellido del autor; la página, la impresa si el libro está calibrado. */
export function etiquetaDeFuente(fuente: FuenteDeConsulta, libro: LibroParaCitar | undefined): string {
    const clave = apellidoDelAutor(libro?.author ?? fuente.autor) || libro?.title || fuente.titulo;
    // Sólo la numeración CONFIRMADA da página impresa: es la regla del visor
    // y del análisis (`DocumentPageNumberingReader`).
    const numeracion = libro?.pageNumbering?.origin === 'confirmed' ? libro.pageNumbering : null;
    const ancla = citationAnchorFor({ sheet: fuente.hoja, section: null }, numeracion);
    return citaParaInsertar(clave, ancla || 's. p.');
}

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
    libros: ReadonlyMap<string, LibroParaCitar>,
): { markdown: string; enlaces: FuenteDeConsulta[][] } {
    const porNumero = new Map(fuentes.map(f => [f.n, f]));
    const enlaces: FuenteDeConsulta[][] = [];
    const markdown = respuesta.replace(MARCAS, corrida => {
        const citadas = fuentesDeLaCorrida(corrida, porNumero);
        if (citadas.length === 0) return '';
        enlaces.push(citadas);
        const texto = unirEtiquetas(citadas.map(f => etiquetaDeFuente(f, libros.get(f.resourceId))));
        return `[${texto.replace(/[[\]]/g, '\\$&')}](${PREFIJO_FUENTE}${enlaces.length - 1})`;
    });
    return { markdown, enlaces };
}

/** El texto para copiar o llevar a otro lado: las marcas, ya como citas. */
export function textoConCitas(
    respuesta: string,
    fuentes: ReadonlyArray<FuenteDeConsulta>,
    libros: ReadonlyMap<string, LibroParaCitar>,
): string {
    const porNumero = new Map(fuentes.map(f => [f.n, f]));
    return respuesta.replace(MARCAS, corrida => {
        const citadas = fuentesDeLaCorrida(corrida, porNumero);
        return citadas.length === 0 ? '' : unirEtiquetas(citadas.map(f => etiquetaDeFuente(f, libros.get(f.resourceId))));
    }).replace(/[ \t]{2,}/g, ' ');
}
