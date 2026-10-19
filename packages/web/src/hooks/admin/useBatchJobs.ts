import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';

export type EstadoDeTramo = 'pendiente' | 'ok' | 'fallo' | 'incompleto' | 'reemplazado' | 'abandonado';
export type EstadoDelLote = 'preparando' | 'en-curso' | 'listo' | 'cancelado' | 'fallido';

/** COPIA de `ResumenDeLote` (`functions/src/library/estadoDelLote.ts`): web no importa functions. */
export interface ResumenDeLote {
    id: string;
    estado: EstadoDelLote;
    motivo: string | null;
    creado: number;
    actualizado: number;
    creadoPorEmail: string | null;
    dueno: string;
    estimadoUsd: number;
    usd: number;
    paginas: number;
    rondas: Array<{ numero: number; estadoJob: string | null; leida: boolean; tramos: number }>;
    tramos: Record<EstadoDeTramo, number>;
    /** Páginas que «Reintentar» volvería a pedir, como mucho. */
    paginasConFallas: number;
    libros: Array<{
        rid: string; titulo: string; autor?: string | null; estado: 'por-preparar' | 'preparado' | 'saltado'; motivo: string | null; paginas: number | null;
        tramos: Record<EstadoDeTramo, number>;
        fallas: string[];
        listo: boolean;
        incompletos: number;
        comparacion: ComparacionDeLibro | null;
        comparacionVieja: boolean;
        aplicado: { fecha: number; reemplazado: boolean; motivo: string } | null;
    }>;
    puedeReintentar: boolean;
    puedeCancelar: boolean;
}

/** COPIA de `ComparacionGuardada` (`estadoDelLote.ts`). */
export interface ComparacionDeLibro {
    reemplazar: boolean;
    motivo: string;
    actual: { faltantes: number; hebreo: number; griego: number; textoVacio: boolean };
    nueva: { faltantes: number; hebreo: number; griego: number; textoVacio: boolean };
    rellenadas: number;
    /** Páginas que conservan el texto actual: el nuevo perdía griego o hebreo ahí. */
    conservadas?: Array<{ pagina: number; escritura: 'griego' | 'hebreo'; antes: number; despues: number }>;
    /** El total (la lista viene con tope de 40). */
    conservadasTotal?: number;
    rondasLeidas: number;
    calculada: number;
}

const CLAVE = ['admin', 'batchJobs'] as const;
const llamar = <I, O>(nombre: string) => async (datos: I) => (await httpsCallable<I, O>(getFunctions(), nombre)(datos)).data;

/**
 * Los lotes del reproceso (`getBatchJobs`, super admin). Mientras alguno está
 * en marcha se refresca cada minuto; el sondeo del servidor corre cada 10.
 */
export function useBatchJobs() {
    return useQuery({
        queryKey: CLAVE,
        queryFn: async () => (await llamar<Record<string, never>, { lotes: ResumenDeLote[] }>('getBatchJobs')({})).lotes,
        refetchInterval: q => ((q.state.data ?? []).some(l => l.estado === 'preparando' || l.estado === 'en-curso') ? 60_000 : false),
        staleTime: 30_000,
    });
}

export interface PedidoDeLote { nombre: string; ownerUid: string; ids: string[]; estimadoUsd: number }

/** Lanzar, reintentar, cancelar, comparar y aplicar: cada uno refresca la lista. */
export function useBatchActions() {
    const qc = useQueryClient();
    const refrescar = () => qc.invalidateQueries({ queryKey: CLAVE });
    return {
        lanzar: useMutation({ mutationFn: llamar<PedidoDeLote, { id: string; libros: number }>('launchBatch'), onSuccess: refrescar }),
        reintentar: useMutation({ mutationFn: llamar<{ loteId: string }, { ronda: number | null; libros: number; abandonadas: number }>('retryBatch'), onSuccess: refrescar }),
        cancelar: useMutation({ mutationFn: llamar<{ loteId: string }, { ok: boolean }>('cancelBatch'), onSuccess: refrescar }),
        comparar: useMutation({ mutationFn: llamar<{ loteId: string; rid: string }, Omit<ComparacionDeLibro, 'rondasLeidas' | 'calculada'>>('compareBatchBook'), onSettled: refrescar }),
        aplicar: useMutation({ mutationFn: llamar<{ loteId: string; rid: string; aceptarIncompletos: boolean }, { reemplazado: boolean; motivo: string }>('applyBatchBook'), onSettled: refrescar }),
    };
}
