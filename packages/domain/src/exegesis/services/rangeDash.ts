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

/**
 * Un rango de PÁGINAS como lo pide la guía de TMS (2024–2025, «Números»):
 * raya corta y el segundo número abreviado sin ambigüedad.
 * - Si el primero es menor que 100, el segundo va entero: 2–4, 61–99, 92–137.
 * - Si es 100 o más, el segundo lleva al menos dos cifras: 162–75, 315–17,
 *   2156–89; y sin el cero inicial: 103–6, no 103–06.
 * - Un múltiplo de 100 va entero (100–104, 1100–1113), como Turabian y
 *   Chicago, de los que sale la regla de la guía: «100–4» sería ambiguo.
 * - Si el segundo es menor o tiene otra cantidad de cifras (987–1002), entero.
 *
 * Solo para PÁGINAS, también con tomo («2:457–58», como HALOT en la guía);
 * no se aplica a citas bíblicas («Sal 119:105–112»). El TI #1 los abrevió a
 * mano («563–64») y el exportador escribía «567–568».
 */
export function paginasAbreviadas(texto: string): string {
    return rangosConRaya(texto).replace(/(?<!\d)(\d+)–(\d+)(?![\d:])/g, (todo, a: string, b: string) => {
        const desde = Number(a);
        if (desde < 100 || desde % 100 === 0 || a.length !== b.length || Number(b) <= desde) return todo;
        let i = 0;
        while (a[i] === b[i]) i++;
        let resto = b.slice(i);
        if (resto.length < 2) resto = b.slice(-2);
        if (resto.length > 1 && resto.startsWith('0')) resto = resto.slice(1);
        return `${a}–${resto}`;
    });
}
