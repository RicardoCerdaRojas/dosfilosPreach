/**
 * Escrituras que fallaron y el pastor tiene que saber (A2).
 *
 * Las escrituras a Firestore no se esperan —sin red la promesa no resuelve
 * hasta que el servidor confirma, y la caché local ya aplicó el cambio—, así
 * que un rechazo REAL (reglas, permiso) llegaba tarde y sólo a la consola: el
 * cambio desaparecía de la pantalla sin explicación.
 *
 * Los repositorios avisan acá; la raíz de la app escucha y muestra el aviso.
 * Así la capa de datos no conoce la de pantallas.
 */
export type WriteKind = 'sermon' | 'preaching_log' | 'annotation' | 'bible_mark';

type Listener = (kind: WriteKind, error: unknown) => void;
const listeners = new Set<Listener>();

export function onWriteFailure(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function reportWriteFailure(kind: WriteKind, error: unknown): void {
    console.warn(`[write:${kind}] failed:`, error);
    for (const l of listeners) l(kind, error);
}
