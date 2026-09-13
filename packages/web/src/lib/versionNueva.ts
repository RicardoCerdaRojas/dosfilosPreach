/**
 * Qué hacer cuando la versión que el navegador tiene abierta ya no existe.
 *
 * EL PROBLEMA, medido en producción. Cada despliegue publica los trozos de
 * código con un hash nuevo —`ApproachDevelopmentPromptBuilder-PtwbT-eD.js` pasa
 * a ser `…-C5cjo7K9.js`— y los viejos dejan de existir. Una pestaña abierta
 * desde antes sigue pidiendo los nombres viejos, y sólo lo hace cuando llega a
 * una parte de la app que se carga bajo demanda: el paso 2 del asistente de
 * sermón, por ejemplo.
 *
 * El servidor, que reescribe todo a `index.html` para que funcionen las rutas
 * del navegador, responde HTML donde se esperaba JavaScript. El navegador lo
 * rechaza por tipo —«Expected a JavaScript-or-Wasm module script but the server
 * responded with a MIME type of text/html»— y la acción del pastor muere con un
 * error que no dice nada de lo que pasó de verdad.
 *
 * Le pasó al fundador redactando un sermón, veinte minutos después de un
 * despliegue: «Error en generación de sermón».
 *
 * LA DECISIÓN. Se recarga, no se avisa. La parte de la app que hace falta NO
 * está en el servidor: no hay forma de seguir sin traerla, así que un cartel
 * sólo agregaría un clic a lo inevitable.
 *
 * Lo que sí se cuida es el ciclo. Una primera versión de esto olvidaba la marca
 * al terminar de cargar, y con eso una pestaña cuyo trozo siguiera fallando
 * —red caída, despliegue a medio propagar— se habría recargado sin parar. Acá
 * el tope es duro: DOS recargas por pestaña como máximo, y treinta segundos
 * entre una y otra. Agotadas, el error se deja pasar: al menos se puede leer y
 * reportar.
 */

const MARCA = 'preach:recargas-por-version';
const MAXIMO = 2;
const ESPERA_MINIMA_MS = 30_000;

interface Intentos { veces: number; ultima: number }

function leer(): Intentos | null {
    try {
        const crudo = sessionStorage.getItem(MARCA);
        if (!crudo) return { veces: 0, ultima: 0 };
        const v = JSON.parse(crudo) as Intentos;
        return typeof v?.veces === 'number' && typeof v?.ultima === 'number' ? v : { veces: 0, ultima: 0 };
    } catch {
        // Una pestaña sin almacenamiento (modo privado estricto) no puede
        // recordar cuántas veces recargó. Se prefiere no recargar a arriesgar
        // un ciclo: `null` significa «no sé, no toco».
        return null;
    }
}

export function recargarSiLaVersionCambio(): void {
    window.addEventListener('vite:preloadError', (evento) => {
        const intentos = leer();
        if (!intentos) return;

        const ahora = Date.now();
        if (intentos.veces >= MAXIMO || ahora - intentos.ultima < ESPERA_MINIMA_MS) {
            console.warn('[versión] el trozo sigue sin cargar; no se insiste con la recarga');
            return;
        }

        // Evita que Vite propague el error: la pestaña se va a recargar y el
        // error sólo ensuciaría la consola del usuario.
        evento.preventDefault();
        try {
            sessionStorage.setItem(MARCA, JSON.stringify({ veces: intentos.veces + 1, ultima: ahora }));
        } catch { /* si no se puede recordar, igual se recarga esta vez */ }
        console.info('[versión] hay una versión nueva desplegada; recargando');
        window.location.reload();
    });
}
