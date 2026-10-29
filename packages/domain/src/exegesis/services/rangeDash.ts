/**
 * «Santiago 4:11-17» → «Santiago 4:11–17»: en lo que se entrega, los rangos
 * van con raya corta (el profesor lo descuenta; TP #9, B44).
 *
 * Una sola regla para las dos salidas —el título del ensamble y la portada y
 * cabecera del Word—, que antes la escribían cada una a su modo. Cubre el
 * guion, los guiones Unicode (‐ ‑) y el signo menos (−), con o sin espacios.
 * No toca una fecha ISO («2026-10-28», «2026-10»): no es un rango.
 */
const FECHA_ISO = /(?<!\d)(?:1[5-9]|20)\d{2}-\d{1,2}(?:-\d{1,2})?(?!\d)/g;
const RANGO = /(\d)\s*[-‐‑−]\s*(\d)/g;

export function rangosConRaya(texto: string): string {
    let salida = '';
    let desde = 0;
    for (const m of texto.matchAll(FECHA_ISO)) {
        salida += texto.slice(desde, m.index).replace(RANGO, '$1–$2') + m[0];
        desde = m.index! + m[0].length;
    }
    return salida + texto.slice(desde).replace(RANGO, '$1–$2');
}
