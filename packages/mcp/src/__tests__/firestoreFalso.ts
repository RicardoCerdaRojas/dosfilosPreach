/** Un Firestore en memoria con lo que usan las herramientas: doc, where (==), select, limit, get, add, transacciones. */
type Datos = Record<string, unknown>;

function campo(d: Datos, ruta: string): unknown {
    return ruta.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Datos)[k] : undefined), d);
}

export function firestoreFalso(colecciones: Record<string, Record<string, Datos>> = {}) {
    const consultas: Array<{ coleccion: string; filtros: Array<[string, unknown]> }> = [];
    const agregados: Array<{ coleccion: string; datos: Datos }> = [];
    const store = colecciones;
    const snapDoc = (coleccion: string, id: string) => {
        const d = store[coleccion]?.[id];
        return { id, exists: !!d, data: () => (d ? { ...d } : undefined), get: (k: string) => (d ? campo(d, k) : undefined), ref: { id } };
    };
    const consulta = (coleccion: string, filtros: Array<[string, unknown]>, tope: number | null): any => ({
        where: (c: string, _op: string, v: unknown) => consulta(coleccion, [...filtros, [c, v]], tope),
        select: () => consulta(coleccion, filtros, tope),
        limit: (n: number) => consulta(coleccion, filtros, n),
        get: async () => {
            consultas.push({ coleccion, filtros });
            const docs = Object.entries(store[coleccion] ?? {})
                .filter(([, d]) => filtros.every(([c, v]) => campo(d, c) === v))
                .slice(0, tope ?? undefined)
                .map(([id]) => snapDoc(coleccion, id));
            return { docs, size: docs.length, empty: docs.length === 0 };
        },
    });
    const db: any = {
        collection: (coleccion: string) => ({
            ...consulta(coleccion, [], null),
            doc: (id: string) => ({ id, get: async () => snapDoc(coleccion, id) }),
            add: async (datos: Datos) => { agregados.push({ coleccion, datos }); return { id: `n${agregados.length}` }; },
        }),
        runTransaction: async (fn: (tx: any) => Promise<unknown>) => fn({
            get: async (ref: { coleccion: string; id: string }) => snapDoc(ref.coleccion, ref.id),
            set: (ref: { coleccion: string; id: string }, datos: Datos) => {
                store[ref.coleccion] = store[ref.coleccion] ?? {};
                store[ref.coleccion]![ref.id] = { ...(store[ref.coleccion]![ref.id] ?? {}), ...datos };
            },
        }),
    };
    // Las referencias de doc que usan las transacciones llevan su colección.
    const coleccionOriginal = db.collection;
    db.collection = (coleccion: string) => {
        const c = coleccionOriginal(coleccion);
        return { ...c, doc: (id: string) => ({ id, coleccion, get: async () => snapDoc(coleccion, id) }) };
    };
    return { db, store, consultas, agregados };
}
