/**
 * «(Varner, p. 187)» → «p. 187»: la página de una cita armada. Se busca el
 * ANCLA al final («p.», «pp.», «hoja», «s. p.», «§»), no lo que sigue a la
 * primera coma: sin autor, la clave es el título, que puede tener comas
 * («(Santiago: comentario, tomo 2, p. 5)»; revisión adversarial).
 */
export function paginaDeCita(cita: string): string {
    const s = cita.trim().replace(/^\(|\)$/g, '');
    const ancla = s.match(/(?:^|,\s*)((?:pp?\.|hoja|§)\s*[^,]+|s\.\s*p\.)$/i);
    if (ancla) return ancla[1]!.trim();
    const partes = s.split(/,\s*/);
    return (partes[partes.length - 1] ?? s).trim();
}
