import type { PageNumbering } from '../outline/pageNumbering';

/**
 * Cómo numera sus páginas un recurso de la biblioteca.
 *
 * Los fragmentos anclan a la HOJA del archivo, que es lo único que el
 * extractor puede medir. Una cita académica habla de la página impresa, y las
 * dos cifras no coinciden: en el comentario de Adamson la hoja 32 imprime 28
 * y en el de Mayor la hoja 328 imprime 50. Rotular la hoja como «p.» —que es
 * lo que hacía `anchorFor`— manda al lector a otra página con la confianza de
 * un dato verificado.
 *
 * Medido sobre una biblioteca real de 49 recursos indexados: 21 declaran su
 * numeración de forma detectable y 28 no, porque la extracción perdió el
 * folio o porque los números que sobreviven son referencias bíblicas. Para
 * esos 28 la respuesta correcta es `null`, y quien la reciba debe rotular el
 * número como hoja y decirlo — nunca convertir a ciegas.
 *
 * Devuelve la numeración por tramos y no un desfase único porque un número
 * por libro es un modelo falso para dos formas corrientes: la cuenta que se
 * corre a mitad del volumen y las preliminares sin numeración arábiga. Ver
 * `pageNumbering`.
 */
export interface IPageNumberingReader {
    /** `null` cuando el recurso no declara una numeración utilizable. */
    numberingFor(resourceId: string): Promise<PageNumbering | null>;
}
