import { citationAnchorFor, type PageNumbering } from '@dosfilos/domain';
import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { citaParaInsertar } from '@/components/exegesis/citation/citarDesdeVisor';
import { apellidoDelAutor } from '../apellidoDelAutor';

/**
 * Cómo cita la Biblioteca una fuente de «Consultar» (fase «biblioteca
 * consultable», U3): «(Varner, p. 188)» con la MISMA regla del visor
 * (`citationAnchorFor` con la numeración confirmada; sin ella, «hoja N»). Si
 * el libro se calibra después, la cita guardada se corrige sola.
 */

/** Lo que hace falta saber del libro para citarlo. */
export interface LibroParaCitar {
    author?: string | null;
    title?: string | null;
    pageNumbering?: PageNumbering | null;
}

/** «(Varner, p. 188)»: la clave es el apellido del autor; la página, la impresa si el libro está calibrado. */
export function etiquetaDeFuente(fuente: FuenteDeConsulta, libro: LibroParaCitar | undefined): string {
    const clave = apellidoDelAutor(libro?.author ?? fuente.autor) || libro?.title || fuente.titulo;
    // Sólo la numeración CONFIRMADA da página impresa: es la regla del visor
    // y del análisis (`DocumentPageNumberingReader`).
    const numeracion = libro?.pageNumbering?.origin === 'confirmed' ? libro.pageNumbering : null;
    const ancla = citationAnchorFor({ sheet: fuente.hoja, section: null }, numeracion);
    return citaParaInsertar(clave, ancla || 's. p.');
}
