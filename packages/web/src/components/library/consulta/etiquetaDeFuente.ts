import { citationAnchorFor, type PageNumbering } from '@dosfilos/domain';
import type { FuenteDeConsulta } from '@dosfilos/infrastructure';
import { citaParaInsertar } from '@/components/exegesis/citation/citarDesdeVisor';
import { apellidoDelAutor } from '../apellidoDelAutor';
import { seccionDeLaFuente } from './seccionDeLaFuente';

/**
 * Cómo se cita una fuente de «Consultar» (fase «biblioteca consultable»), en
 * la pestaña de la Biblioteca y en «Preguntar a este libro» del visor: UNA
 * sola regla para los dos (revisión adversarial). «(Varner, p. 188)» sólo con
 * la numeración CONFIRMADA —la regla del análisis, `citationAnchorFor`—; sin
 * ella, «hoja N»; sin hoja, la sección (un libro compartido sin páginas, como
 * JFB, llega con hoja null y sección «JAS 3:17», A8c); sin las dos, «s. p.»
 * (nunca la página de la hoja 1). Si el libro se calibra después, la cita
 * guardada se corrige sola.
 */

/** Lo que hace falta saber del libro para citarlo. */
export interface LibroParaCitar {
    /** La clave con que ya se cita el libro (la del visor); si no, el apellido del autor. */
    clave?: string | null;
    author?: string | null;
    title?: string | null;
    pageNumbering?: PageNumbering | null;
}

/** «(Varner, p. 188)»: la clave es el apellido del autor; la página, la impresa si el libro está calibrado. */
export function etiquetaDeFuente(fuente: FuenteDeConsulta, libro: LibroParaCitar | undefined): string {
    const clave = libro?.clave?.trim() || apellidoDelAutor(libro?.author ?? fuente.autor) || libro?.title || fuente.titulo;
    // Sólo la numeración CONFIRMADA da página impresa: es la regla del visor
    // y del análisis (`DocumentPageNumberingReader`).
    const numeracion = libro?.pageNumbering?.origin === 'confirmed' ? libro.pageNumbering : null;
    // La sección solo sin hoja: con hoja, la cita ya ubica, y la ruta entera es larga.
    const seccion = fuente.hoja === null ? seccionDeLaFuente(fuente) : null;
    const ancla = citationAnchorFor({ sheet: fuente.hoja, section: seccion }, numeracion);
    return citaParaInsertar(clave, ancla || 's. p.');
}
