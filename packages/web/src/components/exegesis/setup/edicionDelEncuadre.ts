import { ASSIGNMENT_BRIEF_MAX_CHARS } from '@dosfilos/domain';

/**
 * Qué pasaría si se guardara el borrador del encuadre de un trabajo ya creado.
 *
 * - `sinCambios`: el borrador dice lo mismo que el trabajo (espacios en los
 *   bordes aparte). Guardar no haría nada.
 * - `excedido`: pasa el tope. NO se recorta en silencio: un encuadre escrito
 *   fuera de la app puede venir más largo, y recortarlo al primer tecleo
 *   borraría el final —justo donde suele estar el formato de citas— sin que
 *   nadie lo note. Se avisa y se bloquea el guardado.
 * - `listo`: `valor` es lo que se va a guardar; `null` si quedó vacío, que es
 *   la forma de decir «sin encuadre» (el caso de uso normaliza igual).
 */
export type EdicionDelEncuadre =
    | { tipo: 'sinCambios' }
    | { tipo: 'excedido'; sobran: number }
    | { tipo: 'listo'; valor: string | null };

export function evaluarEdicionDelEncuadre(
    original: string | null | undefined,
    borrador: string,
): EdicionDelEncuadre {
    const nuevo = borrador.trim();
    if (nuevo === (original ?? '').trim()) return { tipo: 'sinCambios' };
    if (nuevo.length > ASSIGNMENT_BRIEF_MAX_CHARS) {
        return { tipo: 'excedido', sobran: nuevo.length - ASSIGNMENT_BRIEF_MAX_CHARS };
    }
    return { tipo: 'listo', valor: nuevo.length > 0 ? nuevo : null };
}
