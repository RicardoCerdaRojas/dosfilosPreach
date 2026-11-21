/**
 * Adónde se calibra la numeración de un libro. Una sola definición: la
 * revisión de citas la armaba sin `/dashboard` y el enlace llevaba a una
 * página inexistente (hallado al preparar la fase F), mientras las otras tres
 * pantallas la escribían bien.
 */
export function rutaCalibracion(resourceId: string): string {
    return `/dashboard/library/${resourceId}/numeracion`;
}

/** La bandeja de revisión de un libro (A7): obra, edición, páginas y copia. */
export function rutaRevisionPdf(resourceId: string): string {
    return `/dashboard/library/${resourceId}/revision`;
}
