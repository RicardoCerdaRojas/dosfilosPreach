/**
 * Sube el tope de espera del `fetch` de Node, que por omisión corta a los 300 s.
 *
 * EL DEFECTO QUE CORRIGE. Una extracción por visión de un rango denso tarda más
 * que eso, y el `fetch` la aborta a mitad de camino con un `TypeError: fetch
 * failed` que no dice nada:
 *
 *     04:06:34  📦 páginas 66-94 de 425
 *     04:11:35  ERROR  TypeError: fetch failed
 *                 at node:internal/deps/undici
 *                 at generateContent (@google/generative-ai)
 *
 * 301 segundos exactos. No es la API del modelo cortando, ni el tope de la
 * función: es `headersTimeout`, que el `fetch` global trae en 300 s y nadie
 * había tocado. Un comentario de 425 páginas murió así tras llegar al 16%,
 * y Cloud Tasks reintentó tres veces contra el mismo muro.
 *
 * Los libros que sí terminaron —Barrick, Sasson, Hebreo Bíblico, BHQ— tenían
 * rangos más rápidos y nunca cruzaron el umbral. Por eso el defecto tardó
 * cuatro libros en aparecer.
 *
 * POR QUÉ ESTO FUNCIONA. Node trae su propia copia de undici y el paquete
 * instalado es otra instancia; que una configure a la otra depende de que
 * compartan el símbolo global. **Comprobado antes de escribir esto**, bajando
 * el tope a 3 s y verificando que una llamada de 6 s muriera a los 3,3.
 *
 * POR QUÉ SUBIR Y NO QUITAR. Sin tope, una conexión colgada retendría la
 * invocación hasta el techo de la función sin producir nada. Quince minutos
 * cubre el rango más lento medido —352 s— con margen de sobra, y sigue habiendo
 * un final.
 */
import { setGlobalDispatcher, Agent } from 'undici';

/** Quince minutos. El rango más lento medido fue de 352 s. */
export const ESPERA_MAXIMA_MS = 15 * 60 * 1000;

let aplicado = false;

/**
 * Se llama una vez por proceso, al cargar el módulo que hace las llamadas
 * largas. Es idempotente: reemplazar el despachador en cada invocación tiraría
 * las conexiones que la instancia tenga abiertas.
 */
export function permitirEsperasLargas(): void {
    if (aplicado) return;
    aplicado = true;
    setGlobalDispatcher(new Agent({
        headersTimeout: ESPERA_MAXIMA_MS,
        bodyTimeout: ESPERA_MAXIMA_MS,
    }));
}
