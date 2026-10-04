import {
    nextByCalendar,
    pickCurrentPlan,
    planOrder,
    planStatus,
    publishedForDraft,
    timesPreachedForDraft,
} from '@dosfilos/domain';
import type { PlanStatus } from '@dosfilos/domain';

import { SermonSummary } from '@/domain/models/sermon.model';
import { usePublishedSummaries } from '@/presentation/hooks/useSermons';
import { useSeriesPlans, type PlannedSermonItem, type SeriesPlan } from '@/presentation/hooks/useSeriesPlans';

/** Una semana del plan con lo que la app sabe del sermón que hay detrás. */
export interface PlanBoardItem extends PlannedSermonItem {
    /** Hay un sermón publicado detrás: se puede predicar hoy. */
    ready: boolean;
    preached: boolean;
    sermon?: SermonSummary;
}

export interface PlanBoard extends Omit<SeriesPlan, 'items'> {
    items: PlanBoardItem[];
    status: PlanStatus;
    /** Lo que toca predicar, esté escrito o no. */
    next: PlanBoardItem | null;
    readyCount: number;
    preachedCount: number;
}

/**
 * Los planes con su estado y su próximo sermón resueltos.
 *
 * ACÁ SE CRUZAN LAS DOS MITADES: el plan sabe qué semanas tiene y a qué
 * sermón apunta cada una; la lista de publicados sabe cuáles están escritos y
 * cuáles ya se predicaron. Ninguna de las dos alcanza sola, y hacer el cruce
 * en cada pantalla era garantizar que dos pantallas dieran respuestas
 * distintas a la misma pregunta.
 */
export function usePlanBoard() {
    const { data: plans, isLoading, error: plansError, refetch: refetchPlans } = useSeriesPlans();
    // TODAS las copias publicadas, no la lista agrupada: esa ya descartó
    // copias y el plan elegía la versión equivocada (revisión de A6).
    const {
        data: summaries,
        isLoading: loadingSermons,
        error: sermonsError,
        refetch: refetchSermons,
    } = usePublishedSummaries();

    const published: SermonSummary[] = summaries ?? [];

    const boards: PlanBoard[] = (plans ?? []).map((plan) => {
        const items: PlanBoardItem[] = plan.items
            .map((item) => {
                // El plan guarda el BORRADOR; la lista trae la COPIA publicada,
                // que apunta a él (A6, mismo defecto que #728 en la web).
                const sermon = item.draftId ? publishedForDraft(item.draftId, published) : undefined;
                return {
                    ...item,
                    sermon,
                    ready: !!sermon,
                    // Predicado si CUALQUIER copia del borrador se predicó:
                    // republicar crea una copia con el historial vacío.
                    preached: item.draftId ? timesPreachedForDraft(item.draftId, published) > 0 : false,
                };
            })
            .sort(planOrder);

        return {
            ...plan,
            items,
            status: planStatus(items),
            // Por calendario: lo predicado sin registrar no es lo que toca el
            // domingo (lo vio el fundador: el inicio le ofrecía la semana 2).
            next: nextByCalendar(items),
            readyCount: items.filter((i) => i.ready).length,
            preachedCount: items.filter((i) => i.preached).length,
        };
    });

    return {
        isLoading: isLoading || loadingSermons,
        /** Falló alguna de las dos lecturas: la pantalla lo dice en vez de «sin planes» (A2). */
        error: plansError ?? sermonsError ?? null,
        refetch: () => {
            refetchPlans();
            refetchSermons();
        },
        plans: boards,
        /** El plan que la app debe mostrar: el activo, o el que va a empezar. */
        current: pickCurrentPlan(boards, (plan) => plan.status),
    };
}
