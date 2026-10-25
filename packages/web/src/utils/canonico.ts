/**
 * La forma canónica de un valor, para decidir si lo de pantalla difiere de
 * lo guardado («Cambios sin guardar»).
 *
 * Con `JSON.stringify` a secas el aviso quedaba pegado (prueba del fundador,
 * fase «Encuadre de la serie»): elegir una guía y volver a «Ninguna» deja
 * `styleGuideId: null` donde lo guardado no tenía la clave, y Firestore
 * devuelve las claves en otro orden que el escrito. Aquí:
 *   - las claves de un objeto van ordenadas;
 *   - `null`, `undefined` y `''` cuentan como ausentes (la clave se quita);
 *   - un objeto que queda vacío también cuenta como ausente;
 *   - los arreglos conservan su orden y su largo (un elemento vacío sigue
 *     ocupando su lugar: quitar una ficha es un cambio).
 */
export function canonico(valor: unknown): string {
    return JSON.stringify(normalizar(valor) ?? null);
}

/** Si dos valores son iguales en su forma canónica. */
export function igualesCanonicos(a: unknown, b: unknown): boolean {
    return canonico(a) === canonico(b);
}

function normalizar(v: unknown): unknown {
    if (v === null || v === undefined || v === '') return undefined;
    if (Array.isArray(v)) return v.map(x => normalizar(x) ?? null);
    if (typeof v === 'object') {
        if (v instanceof Date) return v.toISOString();
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(v).sort()) {
            const n = normalizar((v as Record<string, unknown>)[k]);
            if (n !== undefined) out[k] = n;
        }
        return Object.keys(out).length ? out : undefined;
    }
    return v;
}
