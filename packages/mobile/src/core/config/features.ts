/**
 * Funciones que la v1 de las tiendas deja apagadas.
 *
 * EDITAR EN LA TABLET (decisión D5 del fundador, 2026-10-04): el editor de hoy
 * escribe sobre la COPIA PUBLICADA, no sobre el borrador, y renombrar un `##`
 * deja huérfanas las marcas de esa sección. «Llevar al sermón» desde la Biblia
 * agrega texto por el mismo camino. Vuelven con el Redactor (F4), bien hecho.
 * Las rutas siguen existiendo pero redirigen: se podía llegar por enlace.
 */
export const TABLET_EDITING = false;

/** Rutas de desarrollo (`/dev/*`): sólo en desarrollo, nunca en la tienda. */
export const DEV_ROUTES = __DEV__;

/**
 * Días entre pedir el borrado de la cuenta y el borrado definitivo. Copia de
 * `ACCOUNT_DELETION_GRACE_DAYS` del servidor (functions no comparte código con
 * la app); una prueba de paridad las ata.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;
