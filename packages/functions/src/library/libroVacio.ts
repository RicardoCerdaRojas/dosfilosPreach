/**
 * Un libro que volvió vacío no está listo.
 *
 * El léxico de Ortiz —807 páginas— terminó una extracción «con éxito» y con
 * 10.381 caracteres: TRECE por página. El modelo había recibido páginas en
 * blanco (el recortador copió flujos que no supo descifrar), devolvió nada,
 * y la cadena lo dio por bueno: cobró las 807 páginas y pisó el texto que
 * el recurso ya tenía.
 *
 * La cobertura de páginas no lo vio porque cuenta PÁGINAS DEVUELTAS, y
 * todas volvieron; lo que no volvió fue el texto. Este piso mira lo otro:
 * cuánto texto trae cada página.
 *
 * No juzga calidad ni idioma —para eso está el censo de alfabetos—: separa
 * «hay un libro» de «no hay nada». Por eso el piso es bajísimo. Una página
 * de un libro real trae cientos o miles de caracteres; las medidas de esta
 * biblioteca van de 1.500 a 2.500. Con 40 no se confunde un libro escueto
 * con una extracción muerta.
 */
export const MIN_CARACTERES_POR_PAGINA = 40;

/**
 * Cuántas páginas hacen falta para que el promedio signifique algo. Un
 * extracto de tres páginas puede ser legítimamente corto.
 */
const MIN_PAGINAS_PARA_JUZGAR = 10;

export interface LibroEnsamblado {
    pageCount: number;
    textLength: number;
}

/**
 * `null` cuando el libro sirve; un motivo legible cuando volvió vacío.
 */
export function motivoDeLibroVacio(libro: LibroEnsamblado): string | null {
    if (libro.pageCount < MIN_PAGINAS_PARA_JUZGAR) return null;

    const porPagina = libro.textLength / libro.pageCount;
    if (porPagina >= MIN_CARACTERES_POR_PAGINA) return null;

    return `La extracción devolvió ${libro.textLength.toLocaleString('es')} caracteres para `
        + `${libro.pageCount.toLocaleString('es')} páginas: el documento llegó en blanco. `
        + 'Suele pasar con PDF protegidos o escaneados sin texto. '
        + 'El contenido anterior del recurso se conserva.';
}
