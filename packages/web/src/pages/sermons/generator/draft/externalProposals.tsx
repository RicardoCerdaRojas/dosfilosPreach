import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ProposedElement } from '@dosfilos/domain';
import { ExternalProposalsContext } from './externalProposalsContext';

/** Ver `externalProposalsContext`: lo que llega del chat de consulta a una sección. */
export function ExternalProposalsProvider({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState<Record<string, ProposedElement[]>>({});
    const send = useCallback((sectionId: string, proposal: ProposedElement) => {
        setPending(prev => ({ ...prev, [sectionId]: [...(prev[sectionId] ?? []), proposal] }));
    }, []);
    const clear = useCallback((sectionId: string) => {
        setPending(prev => {
            if (!prev[sectionId]) return prev;
            const { [sectionId]: _recibidas, ...resto } = prev;
            return resto;
        });
    }, []);
    const value = useMemo(() => ({ pending, send, clear }), [pending, send, clear]);
    return <ExternalProposalsContext.Provider value={value}>{children}</ExternalProposalsContext.Provider>;
}
