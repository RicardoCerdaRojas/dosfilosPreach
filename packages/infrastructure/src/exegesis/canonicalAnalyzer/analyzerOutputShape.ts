/**
 * Si el analizador escribe el criterio con `inference` y `premises` (P2).
 *
 * **Se desplegó en dos pasos.** Los veredictos van por posición en la lista de citas,
 * y las premisas la cambian: una pestaña abierta con el código anterior leería mal un
 * análisis nuevo, y dejaría aceptar una cita no encontrada (reproducido en la revisión
 * adversarial). La lectura salió el 2026-11-03 (#825); el analizador lo escribe desde
 * aquí. Medido con el modelo real sobre Santiago 4:12 y 4:14.
 */
export const ANALYZER_WRITES_PREMISES = true;
