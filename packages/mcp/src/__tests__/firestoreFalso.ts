/** Un Firestore en memoria con lo que usan el servidor y las herramientas. */
type Datos = Record<string, any>;

function campo(d: Datos, ruta: string): unknown {
    return ruta.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Datos)[k] : undefined), d);
}

export function firestoreFalso(colecciones: Record<string, Record<string, Datos>> = {}) {
    const consultas: Array<{ coleccion: string; filtros: Array<[string, unknown]> }> = [];
    const agregados: Array<{ coleccion: string; datos: Datos }> = [];
    const store = colecciones;
    const escribir = (c: string, id: string, d: Datos, merge: boolean) => {
        store[c] = store[c] ?? {};
        store[c]![id] = merge ? { ...(store[c]![id] ?? {}), ...d } : { ...d };
    };
    const snapDoc = (c: string, id: string) => {
        const d = store[c]?.[id];
        return { id, exists: !!d, data: () => (d ? { ...d } : undefined), get: (k: string) => (d ? campo(d, k) : undefined), ref: refDe(c, id) };
    };
    const refDe = (c: string, id: string): any => ({
        id, coleccion: c,
        get: async () => snapDoc(c, id),
        set: async (d: Datos, o?: { merge?: boolean }) => escribir(c, id, d, !!o?.merge),
        update: async (d: Datos) => { if (!store[c]?.[id]) throw new Error('NOT_FOUND'); escribir(c, id, d, true); },
    });
    const consulta = (c: string, filtros: Array<[string, unknown]>, tope: number | null): any => ({
        where: (k: string, _op: string, v: unknown) => consulta(c, [...filtros, [k, v]], tope),
        select: () => consulta(c, filtros, tope),
        limit: (n: number) => consulta(c, filtros, n),
        get: async () => {
            consultas.push({ coleccion: c, filtros });
            const docs = Object.entries(store[c] ?? {})
                .filter(([, d]) => filtros.every(([k, v]) => campo(d, k) === v))
                .slice(0, tope ?? undefined)
                .map(([id]) => snapDoc(c, id));
            return { docs, size: docs.length, empty: docs.length === 0 };
        },
    });
    let n = 0;
    const db: any = {
        collection: (c: string) => ({
            ...consulta(c, [], null),
            doc: (id?: string) => refDe(c, id ?? `auto${++n}`),
            add: async (d: Datos) => { agregados.push({ coleccion: c, datos: d }); return refDe(c, `auto${++n}`); },
        }),
        runTransaction: async (fn: (tx: any) => Promise<unknown>) => {
            // Lecturas antes que escrituras, como Firestore.
            let escrito = false;
            const pendientes: Array<() => void> = [];
            const r = await fn({
                get: async (ref: any) => { if (escrito) throw new Error('lectura después de escritura en la transacción'); return snapDoc(ref.coleccion, ref.id); },
                set: (ref: any, d: Datos, o?: { merge?: boolean }) => { escrito = true; pendientes.push(() => escribir(ref.coleccion, ref.id, d, !!o?.merge)); },
                update: (ref: any, d: Datos) => { escrito = true; pendientes.push(() => escribir(ref.coleccion, ref.id, d, true)); },
            });
            pendientes.forEach(p => p());
            return r;
        },
    };
    return { db, store, consultas, agregados };
}
