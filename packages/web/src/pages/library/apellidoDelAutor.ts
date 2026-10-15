/**
 * El apellido del primer autor. «McCartney, Dan G.» → «McCartney»; «John A
 * Motyer» → «Motyer»; «Eberhard Nestle, Kurt Aland» → «Nestle» (la coma separa
 * autores cuando lo de antes ya es un nombre completo); «John Smith Jr.» →
 * «Smith». Un apellido doble español sin coma da el último: es una propuesta,
 * la clave se puede corregir en el trabajo.
 */
export function apellidoDelAutor(author: string | null | undefined): string {
    const primero = ((author ?? '').split(/;| y | and | & /)[0] ?? '').trim();
    const antesDeLaComa = (primero.split(',')[0] ?? '').trim();
    // «Apellido, Nombre»: lo de antes de la coma es una sola palabra.
    if (primero.includes(',') && !/\s/.test(antesDeLaComa)) return antesDeLaComa;
    // «Nombre Apellido[, Otro Autor]»: la última palabra, sin «Jr.» y similares.
    const palabras = antesDeLaComa.split(/\s+/).filter(p => !/^(jr|sr|ii|iii|iv)\.?$/i.test(p));
    return palabras.at(-1) ?? '';
}
