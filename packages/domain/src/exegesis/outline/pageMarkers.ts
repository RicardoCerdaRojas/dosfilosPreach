/**
 * Páginas impresas leídas de las MARCAS del texto, no de un desfase.
 *
 * Algunas ediciones digitales no copian el libro hoja por hoja: el texto corre
 * seguido y la página impresa se marca dentro, «[p 667]». El Compendio de
 * Kittel (Libros Desafío) es así: 1.289 marcas en 1.119 hojas, del «[p 11]»
 * de la hoja 10 al «[p 1342]» de la 1070. En una hoja caben una, dos o tres
 * páginas impresas, de modo que ningún tramo con desfase la describe, y con
 * «desfase 0» la app citaba la hoja como página: el TP #10 dijo «Kittel 525»
 * donde el libro dice pp. 666–667 (A8, 2026-11-22).
 *
 * Cada hoja recibe el rango de páginas que contiene. Sin la posición exacta
 * de la cita dentro de la hoja, el rango es lo honesto: el lector la encuentra
 * en una de esas páginas.
 */

/** Las páginas impresas que contiene una hoja, de la primera a la última. */
export interface SheetPages {
    from: number;
    to: number;
}

/** La marca de página tal como la trae el texto: «[p 667]». */
const MARCA = /\[p (\d{1,5})\]/g;

/** Rango de una hoja como se escribe: «666» o «666–667». */
export function sheetPagesLabel(pages: SheetPages): string {
    return pages.from === pages.to ? String(pages.from) : `${pages.from}–${pages.to}`;
}

/**
 * Más páginas que esto en una hoja no es una hoja: es una marca perdida. En
 * Kittel una hoja trae hasta tres marcas, o sea hasta cuatro páginas.
 */
const MAX_PAGINAS_POR_HOJA = 4;

/**
 * Las páginas de cada hoja a partir de las marcas de su texto.
 *
 * Una hoja empieza en la última página marcada antes de ella —la página sigue
 * desde la hoja anterior— salvo que su texto abra con una marca, y termina en
 * su última marca. Una hoja SIN marcas va de la página que venía a la anterior
 * a la próxima marca: medido en Kittel, casi toda hoja sin marca es una marca
 * que la extracción perdió (entre «[p 460]» y «[p 462]» la hoja 364 no trae la
 * 461), no una página larga.
 *
 * Queda sin rango —y se cita como hoja— lo que no se puede acotar: antes de la
 * primera marca, después de la última (los índices del final) y todo rango de
 * más de cuatro páginas (las hojas 501–520 de Kittel perdieron 26 marcas
 * seguidas). Una marca que retrocede (un índice, una referencia) no cuenta: la
 * cuenta del libro solo avanza.
 */
export function sheetPagesFromMarkers(
    sheets: ReadonlyArray<{ sheet: number; text: string }>,
): Record<string, SheetPages> {
    const porHoja = new Map<number, string>();
    for (const { sheet, text } of sheets) {
        if (!Number.isInteger(sheet) || sheet < 1) continue;
        porHoja.set(sheet, porHoja.has(sheet) ? `${porHoja.get(sheet)}\n${text}` : text);
    }
    const hojas = [...porHoja.keys()].sort((a, b) => a - b);

    // Primera pasada: las marcas de cada hoja, solo las que avanzan.
    const leidas = new Map<number, { marcas: number[]; abre: boolean }>();
    let ultima: number | null = null;
    for (const sheet of hojas) {
        const texto = porHoja.get(sheet)!;
        const marcas: number[] = [];
        let abre = false;
        for (const m of texto.matchAll(MARCA)) {
            const page = Number(m[1]);
            if (ultima !== null && page <= ultima) continue;
            if (marcas.length === 0) abre = texto.slice(0, m.index ?? 0).trim() === '';
            marcas.push(page);
            ultima = page;
        }
        leidas.set(sheet, { marcas, abre });
    }

    // Segunda pasada: el rango de cada hoja, con la próxima marca a la vista.
    const out: Record<string, SheetPages> = {};
    const acotado = (sheet: number, from: number | null, to: number | null) => {
        if (from === null || to === null || to < from || to - from + 1 > MAX_PAGINAS_POR_HOJA) return;
        out[String(sheet)] = { from, to };
    };
    let actual: number | null = null;
    for (let i = 0; i < hojas.length; i++) {
        const sheet = hojas[i]!;
        const { marcas, abre } = leidas.get(sheet)!;
        if (marcas.length === 0) {
            const proxima = hojas.slice(i + 1).map(h => leidas.get(h)!).find(l => l.marcas.length > 0);
            // Termina antes de la próxima página marcada, abra o no su hoja con ella.
            if (proxima) acotado(sheet, actual, proxima.marcas[0]! - 1);
            continue;
        }
        acotado(sheet, abre ? marcas[0]! : actual, marcas[marcas.length - 1]!);
        actual = marcas[marcas.length - 1]!;
    }
    return out;
}
