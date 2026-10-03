import { createContext, useContext, useEffect } from 'react';
import type { ProposedElement } from '@dosfilos/domain';

/**
 * Propuestas que llegan a una sección desde FUERA de su panel: hoy, «Llevar a
 * mis ideas» del chat de consulta (hallazgo 32 del ejercicio de Jonás).
 *
 * Entran a la lista de propuestas de la sección, no a sus decisiones: el
 * fundador pidió que lo que viene del chat entre como propuesta y no como idea
 * suya. Ahí se elige (`elegido`), se edita (`editado`) o se descarta, igual que
 * lo que trae «Propónme ideas».
 */
export interface ExternalProposals {
    pending: Readonly<Record<string, ProposedElement[]>>;
    send: (sectionId: string, proposal: ProposedElement) => void;
    /** Olvida las pendientes de una sección, una vez recibidas. */
    clear: (sectionId: string) => void;
}

export const ExternalProposalsContext = createContext<ExternalProposals | null>(null);

/** Fuera del proveedor no hay a dónde mandar: se devuelve `null` y el botón no aparece. */
export function useExternalProposals(): ExternalProposals | null {
    return useContext(ExternalProposalsContext);
}

/**
 * Recibe en una sección lo que le mandaron. Lee las pendientes del ESTADO ya
 * renderizado y recién después las borra: la versión anterior las sacaba con un
 * updater de `setState` que todavía no había corrido, y la propuesta se perdía
 * mientras el aviso decía que había entrado (revisión adversarial de R3).
 */
export function useArrivingProposals(sectionId: string, onArrive: (llegadas: ProposedElement[]) => void): void {
    const ext = useExternalProposals();
    const llegadas = ext?.pending[sectionId];
    useEffect(() => {
        if (!ext || !llegadas || llegadas.length === 0) return;
        onArrive(llegadas);
        ext.clear(sectionId);
        // `onArrive` cambia de identidad en cada render; lo que dispara es la llegada.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [llegadas, sectionId]);
}
