/**
 * Citar desde el visor (fase F, F2): armar la cita y meterla donde está el
 * cursor del editor.
 *
 * La cita sale con la forma que el resto del sistema reconoce —«(Clave,
 * p. N)»—, con el ancla de `citationAnchorFor`: la página impresa si el libro
 * tiene numeración que resuelve esa hoja, «hoja N» si no. Escribirla a mano
 * fallaba de dos maneras que se vieron en los TP #6 y #7: sin «p.» no se
 * ancla ni se verifica, y con la hoja en lugar de la página impresa cita una
 * página que el lector del trabajo no encuentra en el libro.
 */

/**
 * «(McCartney, p. 204)».
 *
 * El ancla del análisis lleva además la sección («p. 204, § 3:18», «hoja 8,
 * § Series Preface»): al modelo le sirve para ubicarse, pero en el texto del
 * trabajo la cita es autor y página. La sección sólo queda cuando es lo único
 * que hay (un libro sin páginas impresas se cita por sección).
 */
export function citaParaInsertar(clave: string, ancla: string): string {
    const limpia = /^(p\.|hoja)\s/.test(ancla.trim()) ? ancla.trim().replace(/,\s*§.*$/, '') : ancla.trim();
    return `(${clave.trim()}, ${limpia})`;
}

/**
 * El texto con la cita metida en la posición del cursor (o en lugar de lo
 * seleccionado), y dónde queda el cursor después.
 *
 * Pone un espacio antes cuando la cita quedaría pegada a una palabra
 * («agente(McCartney…» no se lee), y ninguno al principio del texto, de un
 * renglón o detrás de un espacio o un paréntesis abierto.
 */
export function insertarEnCursor(
    valor: string,
    inicio: number,
    fin: number,
    cita: string,
): { valor: string; cursor: number } {
    const desde = Math.max(0, Math.min(inicio, valor.length));
    const hasta = Math.max(desde, Math.min(fin, valor.length));
    const antes = valor.slice(0, desde);
    const ultimo = antes.slice(-1);
    const pegada = ultimo !== '' && !/[\s(\[«“]/.test(ultimo);
    const texto = `${pegada ? ' ' : ''}${cita}`;
    return { valor: antes + texto + valor.slice(hasta), cursor: desde + texto.length };
}
