import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { recargarSiLaVersionCambio } from '../versionNueva';

/**
 * Lo que se prueba es el TOPE, no la recarga.
 *
 * Recargar es una línea; lo que puede salir mal es recargar para siempre. Una
 * pestaña cuyo trozo siga fallando después de recargar —red caída, despliegue a
 * medio propagar— no puede quedar en un ciclo.
 */
function dispararFalloDeCarga(): boolean {
    const evento = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(evento);
    return evento.defaultPrevented;
}

describe('recargarSiLaVersionCambio', () => {
    let recargas = 0;

    // Se registra UNA vez: el módulo no sabe darse de baja, y registrarlo en
    // cada caso dejaría varios oyentes atendiendo el mismo evento — con eso,
    // «recargó una vez» podría ser un oyente recargando y los otros callando.
    beforeAll(() => {
        vi.spyOn(window.location, 'reload').mockImplementation(() => { recargas++; });
        recargarSiLaVersionCambio();
    });

    beforeEach(() => {
        recargas = 0;
        sessionStorage.clear();
    });

    it('recarga cuando un trozo de la versión vieja ya no existe', () => {
        const atendido = dispararFalloDeCarga();

        expect(recargas).toBe(1);
        // Se frena el error: la pestaña se va a recargar y el mensaje sólo
        // ensuciaría la consola del pastor.
        expect(atendido).toBe(true);
    });

    it('no recarga dos veces seguidas', () => {
        dispararFalloDeCarga();
        const segundo = dispararFalloDeCarga();

        expect(recargas).toBe(1);
        // El error se deja pasar: al menos se puede leer y reportar.
        expect(segundo).toBe(false);
    });

    it('se rinde después del tope en vez de ciclar', () => {
        // Se simulan dos recargas ya gastadas y el tiempo de espera cumplido.
        sessionStorage.setItem(
            'preach:recargas-por-version',
            JSON.stringify({ veces: 2, ultima: Date.now() - 60_000 }),
        );

        expect(dispararFalloDeCarga()).toBe(false);
        expect(recargas).toBe(0);
    });

    it('sí recarga de nuevo pasada la espera, si quedan intentos', () => {
        sessionStorage.setItem(
            'preach:recargas-por-version',
            JSON.stringify({ veces: 1, ultima: Date.now() - 60_000 }),
        );

        expect(dispararFalloDeCarga()).toBe(true);
        expect(recargas).toBe(1);
    });
});
