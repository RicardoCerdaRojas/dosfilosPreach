/**
 * ¿Las páginas que volvieron cubren el documento?
 *
 * Vivía dentro de `geminiExtraction`, que ya estaba muy por encima del límite
 * de tamaño del repo; sale aquí al agregarle a ese módulo la calibración de
 * tanda.
 *
 * Aquí vive TAMBIÉN la decisión de reintentar una tanda corta, y no en el
 * módulo del reintento, a propósito: las dos preguntas comparten la misma
 * tolerancia y separarlas fue justamente el defecto. Un piso aceptaba perder
 * 5% del libro mientras el reintento exigía el 100% de cada tanda, así que una
 * tanda de 43 páginas a la que le faltaba UNA pagaba 181 s para recuperar el
 * 2,3%.
 */

import { OVERLAP_PAGES } from './calibrarTanda';

/**
 * Proporción mínima de páginas que debe volver para dar la extracción por
 * buena.
 *
 * Estaba en 0,80 y dejó pasar un caso real: la gramática hebrea de Barrick, de
 * 170 páginas, volvió con 138 —81%, cortada en la 138 y sin las últimas 32— y
 * el libro entró al corpus como completo. Se citó 32 veces en un trabajo
 * entregado. Nadie se enteró, porque un 81% supera un piso de 80.
 *
 * Perder una de cada cinco páginas no es una extracción aceptable con un
 * defecto menor: es un libro distinto. El piso sube a 0,95 y, sobre todo, ya no
 * es lo único que se mira —ver `verificarCobertura`, que detecta el corte al
 * final aunque el total alcance—.
 */
export const MIN_PAGE_COVERAGE = 0.95;

/**
 * Verifica que las páginas devueltas cubran el documento, no sólo que sean
 * suficientes.
 *
 * La proporción sola no distingue dos cosas muy distintas: un libro al que le
 * faltan páginas sueltas —recuperable, y el resto sirve— de uno CORTADO, al que
 * le falta todo un final. Barrick fue lo segundo: 138 páginas seguidas y nada
 * después de la 138, con cero huecos internos. Una gramática sin su último
 * quinto es una gramática a la que le faltan los capítulos avanzados, que son
 * justamente los que se citan.
 */
export function verificarCobertura(
    paginas: ReadonlyArray<{ page: number }>,
    esperadas: number,
): { ok: true } | { ok: false; motivo: string } {
    // NO SABER cuántas páginas esperar no es una razón para certificar. Esta
    // línea decía `if (esperadas <= 0) return { ok: true }`, y `null <= 0` es
    // `true` en JavaScript: el 12-09-2026 un comentario de 392 páginas quedó
    // dado por bueno con 24, porque el total llegó `null` a quien ensambla y el
    // guard lo leyó como «no hay nada que comprobar».
    //
    // Un guard que ante la duda aprueba no es un guard. Ante la duda se niega:
    // este corpus se cita, y un libro con el 6% de su contenido entrando como
    // completo es peor que una extracción que falla y se reintenta.
    if (!Number.isFinite(esperadas) || esperadas <= 0) {
        return { ok: false, motivo: 'no se sabe cuántas páginas debía tener el documento' };
    }
    if (paginas.length === 0) return { ok: false, motivo: 'no volvió ninguna página' };

    const cobertura = paginas.length / esperadas;
    if (cobertura < MIN_PAGE_COVERAGE) {
        return {
            ok: false,
            motivo: `volvieron ${paginas.length} de ${esperadas} páginas (${Math.round(cobertura * 100)}%)`,
        };
    }

    // Corte al final: la última página con texto queda lejos del final del
    // documento. Se mira aunque la proporción alcance, porque un libro largo
    // puede perder su cierre y seguir pasando el porcentaje.
    const ultima = Math.max(...paginas.map(p => p.page));
    if (esperadas - ultima > Math.max(2, Math.ceil(esperadas * 0.02))) {
        return {
            ok: false,
            motivo: `cortada en la página ${ultima} de ${esperadas}: faltan las últimas ${esperadas - ultima}`,
        };
    }
    return { ok: true };
}

/**
 * ¿Vale la pena releer una tanda que volvió corta?
 *
 * Releerla cuesta lo mismo que leerla: medido sobre la gramática de Barrick,
 * 181 s por una tanda de 43 páginas. Así que sólo se paga cuando lo que falta
 * de verdad se va a perder.
 *
 * DOS RAZONES PARA NO RELEER, y las dos existían ya en el sistema sin que esta
 * decisión las consultara:
 *
 * 1. **El solapamiento ya cubre el final de la tanda.** La tanda siguiente
 *    arranca `OVERLAP_PAGES` páginas antes justamente para releer ese tramo,
 *    que es donde el modelo trunca. Si todo lo que falta cae ahí, reintentar
 *    paga por segunda vez algo que ya está pagado. No aplica a la última
 *    tanda: detrás de ella no hay ninguna que relea, y perder su final es
 *    perder el final del libro — que es el caso Barrick de las 138 páginas.
 *
 * 2. **El piso de cobertura tolera hasta un 5%.** Exigir el 100% de cada
 *    tanda cuando el libro entero se da por bueno con el 95% es una
 *    contradicción entre dos constantes del mismo módulo. Se resuelve
 *    consultando la misma.
 *
 * Caso real que lo destapó: tanda de 43 páginas, volvieron 42, reintento
 * completo. 181 s por una página que la tanda siguiente iba a releer igual.
 */
export function convieneReintentarTanda(
    paginasDevueltas: ReadonlyArray<number>,
    esperadas: number,
    /** Si existe una tanda posterior que va a releer el final de ésta. */
    laSiguienteRelee: boolean,
): boolean {
    if (esperadas <= 0) return false;
    if (paginasDevueltas.length >= esperadas) return false;
    // Nada que conservar: eso no es una tanda corta, es una tanda fallida.
    if (paginasDevueltas.length === 0) return true;

    if (laSiguienteRelee) {
        const primeraDelSolape = esperadas - OVERLAP_PAGES + 1;
        const vistas = new Set(paginasDevueltas);
        let faltaFueraDelSolape = false;
        for (let p = 1; p < primeraDelSolape; p++) {
            if (!vistas.has(p)) { faltaFueraDelSolape = true; break; }
        }
        if (!faltaFueraDelSolape) return false;
    }

    return paginasDevueltas.length / esperadas < MIN_PAGE_COVERAGE;
}
