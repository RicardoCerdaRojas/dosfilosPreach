/**
 * Qué archivos acepta la biblioteca, en un solo sitio.
 *
 * Estaba escrito dos veces: el formulario de la biblioteca comprobaba
 * tipo y tamaño antes de subir, y el botón para subir un texto propio no
 * comprobaba nada —el archivo viajaba entero para morir en
 * `storage.rules` con un error de permisos que no explica nada—. Al
 * arreglarlo apareció una segunda constante de 250 MB, que es la trampa
 * que la revisión adversarial persigue: dos números que gobiernan la
 * misma cantidad terminan no coincidiendo.
 *
 * Estos valores reflejan `storage.rules` para
 * `users/{userId}/library/{resourceId}/{fileName}`: PDF o EPUB, hasta
 * 250 MB. Si allá cambian, acá también, y la prueba lo dice.
 */

/** Tope duro. El mismo de la regla de almacenamiento. */
export const MAX_UPLOAD_SIZE_MB = 250;

/** Tipos que la regla admite. El EPUB llega con dos MIME distintos. */
export const TIPOS_DE_SUBIDA_ACEPTADOS = ['application/pdf', 'application/epub+zip', 'application/epub'];

export type MotivoDeRechazo = 'tipo' | 'tamano' | 'consentimiento';

/**
 * Por qué no se puede subir este archivo, o `null` si se puede.
 *
 * El consentimiento manda sobre lo demás: es la puerta que el flujo
 * normal exige antes de tocar el archivo, y no tiene sentido decirle a
 * alguien que su PDF es muy grande cuando todavía no aceptó las
 * condiciones.
 *
 * El tipo se acepta por MIME o por extensión: los navegadores no siempre
 * rotulan un EPUB como `application/epub+zip`, y rechazar por eso un
 * archivo que la regla sí admite sería inventar un límite.
 */
export function motivoDeRechazo(
    file: { name: string; type: string; size: number },
    consentimientoDado: boolean,
): MotivoDeRechazo | null {
    if (!consentimientoDado) return 'consentimiento';

    const tipoConocido = TIPOS_DE_SUBIDA_ACEPTADOS.includes(file.type)
        || /\.(pdf|epub)$/i.test(file.name);
    if (!tipoConocido) return 'tipo';

    if (file.size / (1024 * 1024) > MAX_UPLOAD_SIZE_MB) return 'tamano';
    return null;
}
