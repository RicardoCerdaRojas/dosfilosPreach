/**
 * El recorrido de un enfoque («Introducción empática → Promesas de Dios →
 * Aplicación») como pasos.
 *
 * La tarjeta lo mostraba en una línea en cursiva y el fundador no lo leía como
 * un camino (#31 del ejercicio de Jonás 4:5-11). Se parte por flechas; si el
 * modelo lo escribió numerado («1. … 2. …»), por los números. Un texto sin
 * ninguna de las dos marcas queda como un solo paso: inventar cortes sería
 * cambiar lo que dice.
 */
export function approachRoute(structure: string | undefined | null): string[] {
    const s = (structure ?? '').trim();
    if (!s) return [];
    const byArrows = s.split(/\s*(?:→|->|⇒|=>)\s*/);
    const pieces = byArrows.length > 1 ? byArrows : byNumbers(s);
    return pieces
        .map(p => p.replace(/^\d+[.)]\s+/, '').replace(/[.;,]\s*$/, '').trim())
        .filter(Boolean);
}

/**
 * Parte «1. … 2. … 3. …» sólo si los números van 1, 2, 3… en orden: un número
 * suelto en el texto («Salmo 23. El pastor…») no es un paso.
 */
function byNumbers(s: string): string[] {
    const marcas = [...s.matchAll(/(?:^|\s)(\d+)[.)]\s+/g)];
    const cortes: number[] = [];
    let siguiente = 1;
    for (const m of marcas) {
        if (Number(m[1]) !== siguiente) continue;
        cortes.push(m.index! + (m[0].length - m[0].trimStart().length));
        siguiente++;
    }
    if (cortes.length < 2 || cortes[0] !== s.search(/\S/)) return [s];
    return cortes.map((desde, i) => s.slice(desde, cortes[i + 1] ?? s.length));
}
