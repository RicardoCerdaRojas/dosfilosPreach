/** El historial plegado se recuerda en este navegador (una comodidad: si el almacenamiento falla, abre desplegado). */
const CLAVE_PLEGADO = 'biblioteca.consultar.historialPlegado';
export function leerPlegado(): boolean {
    try { return window.localStorage.getItem(CLAVE_PLEGADO) === '1'; } catch { return false; }
}
export function guardarPlegado(v: boolean): void {
    try { window.localStorage.setItem(CLAVE_PLEGADO, v ? '1' : '0'); } catch { /* sin almacenamiento: no se recuerda */ }
}
