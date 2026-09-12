import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { LibraryResourceEntity } from '@dosfilos/domain';
// El estado de índice lo produce `useLibraryResources`; se importa de
// ahí en vez de volver a declararlo. La copia que vivía en
// `ResourceCard` se había quedado sin `'indexing'`, así que la rama que
// atiende ese estado era inalcanzable para el compilador mientras el
// hook sí lo emitía.
import type { IndexStatus } from './hooks/useLibraryResources';

export type { IndexStatus };

export interface ResourceStatusPill {
    tone: string;
    icon: LucideIcon;
    iconClass: string;
    /** Clave de i18n del namespace `library`. */
    textKey: string;
    /**
     * Valores para interpolar en `textKey`.
     *
     * Existe por la extracción en cola: un libro largo puede pasar más de una
     * hora en `processing`, y «Procesando…» a secas es indistinguible de estar
     * colgado. Con el avance real la espera deja de parecer una falla.
     */
    textValues?: Record<string, string | number>;
}

/**
 * El estado de un recurso en una sola píldora: extracción e indexado
 * juntos.
 *
 * La palabra «indexar» no aparece a propósito. Bajo el capó es
 * chunking vectorial; para quien sube un libro sólo importa si ya se
 * puede buscar y citar desde un trabajo.
 *
 * Función pura sobre el recurso y el estado de índice — vive fuera de
 * la tarjeta para poder probarse sin montar el componente, y porque
 * `ResourceCard` ya estaba muy por encima del límite de tamaño.
 */
export function resolveResourceStatusPill(
    resource: Pick<LibraryResourceEntity, 'textExtractionStatus' | 'indexingWarning' | 'extractionProgress'>,
    indexStatus: IndexStatus,
): ResourceStatusPill | null {
    switch (resource.textExtractionStatus) {
        case 'pending':
            return { tone: 'bg-muted text-muted-foreground', icon: Loader2, iconClass: '', textKey: 'status.pending' };
        case 'processing': {
            const avance = resource.extractionProgress;
            const base = { tone: 'bg-info-subtle text-info-subtle-foreground', icon: Loader2, iconClass: 'animate-spin' };
            // Sin avance —la ruta de una sola pasada, o el instante entre
            // encolar y el primer rango— se dice lo de siempre. Inventar un 0%
            // ahí sería peor: un progreso que no se mueve asusta más que
            // ninguno.
            if (!avance || !avance.totalPaginas) {
                return { ...base, textKey: 'status.processing' };
            }
            return {
                ...base,
                textKey: 'status.processingProgress',
                textValues: {
                    porcentaje: avance.porcentaje,
                    hechas: avance.paginasHechas,
                    total: avance.totalPaginas,
                },
            };
        }
        case 'failed':
            return { tone: 'bg-destructive/10 text-destructive', icon: AlertCircle, iconClass: '', textKey: 'status.failed' };
        case 'ready':
        default:
            if (indexStatus === 'checking') {
                return { tone: 'bg-muted text-muted-foreground', icon: Loader2, iconClass: 'animate-spin', textKey: 'status.verifying' };
            }
            if (indexStatus === 'indexing') {
                return { tone: 'bg-info-subtle text-info-subtle-foreground', icon: Loader2, iconClass: 'animate-spin', textKey: 'status.indexing' };
            }
            // Un índice que llega a la página 433 de 711 tenía la misma
            // píldora verde que uno completo. Con aviso de cobertura la
            // tarjeta lo dice: lo que quedó fuera no aparece en las
            // búsquedas ni se puede citar.
            if (indexStatus === 'indexed' && resource.indexingWarning) {
                return { tone: 'bg-warning-subtle text-warning-subtle-foreground', icon: AlertCircle, iconClass: '', textKey: 'status.readyPartial' };
            }
            if (indexStatus === 'indexed') {
                return { tone: 'bg-success-subtle text-success-subtle-foreground', icon: CheckCircle2, iconClass: '', textKey: 'status.ready' };
            }
            if (indexStatus === 'not-indexed') {
                return { tone: 'bg-warning-subtle text-warning-subtle-foreground', icon: AlertCircle, iconClass: '', textKey: 'status.notReady' };
            }
            return null;
    }
}

/**
 * El motivo concreto detrás de la píldora, para el tooltip. `undefined`
 * cuando no hay nada que explicar.
 */
export function resolveResourceStatusTooltip(
    resource: Pick<LibraryResourceEntity, 'textExtractionStatus' | 'extractionError' | 'indexingError' | 'indexingWarning'>,
    indexStatus: IndexStatus,
): string | undefined {
    if (resource.textExtractionStatus === 'failed' && resource.extractionError) {
        return resource.extractionError;
    }
    if (indexStatus === 'not-indexed' && resource.indexingError) {
        return `Indexación: ${resource.indexingError}`;
    }
    if (indexStatus === 'indexed' && resource.indexingWarning) {
        return resource.indexingWarning;
    }
    return undefined;
}
