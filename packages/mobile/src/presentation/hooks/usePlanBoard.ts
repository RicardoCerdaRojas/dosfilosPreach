import { nextInPlan, pickCurrentPlan, planOrder, planStatus, publishedForDraft } from '@dosfilos/domain';
import type { PlanStatus } from '@dosfilos/domain';

import { SermonSummary } from '@/domain/models/sermon.model';
import { usePublishedSermons } from '@/presentation/hooks/useSermons';
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
    const {
        data: groups,
        isLoading: loadingSermons,
        error: sermonsError,
        refetch: refetchSermons,
    } = usePublishedSermons();

    const published: SermonSummary[] = (groups ?? []).flatMap((group) => group.sermons);

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
                    // Predicado según el registro del propio sermón, que es el
                    // único lugar donde eso se marca.
                    preached: (sermon?.timesPreached ?? 0) > 0,
                };
            })
            .sort(planOrder);

        return {
            ...plan,
            items,
            status: planStatus(items),
            next: nextInPlan(items),
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
