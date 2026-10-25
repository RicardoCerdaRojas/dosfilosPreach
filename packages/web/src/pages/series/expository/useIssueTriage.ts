import { useState } from 'react';

/**
 * Pase 5 issue triage. Indices into fidelityReview.issues. The two sets are
 * mutually exclusive (toggling one removes the other) — an issue is either
 * acted upon or actively dismissed, never both. The page persists them with
 * the draft so triage decisions survive a tab close.
 *
 * Sacado de `ExpositoryAssistantPage` tal cual, para que la página no siga
 * creciendo (revisión de la fase del encuadre).
 */
export function useIssueTriage() {
    const [addressedIssues, setAddressedIssues] = useState<Set<number>>(new Set());
    const [ignoredIssues, setIgnoredIssues] = useState<Set<number>>(new Set());
    const toggleIssueAddressed = (idx: number) => {
        setAddressedIssues((prev) => toggled(prev, idx));
        setIgnoredIssues((prev) => without(prev, idx));
    };
    const toggleIssueIgnored = (idx: number) => {
        setIgnoredIssues((prev) => toggled(prev, idx));
        setAddressedIssues((prev) => without(prev, idx));
    };
    return { addressedIssues, setAddressedIssues, ignoredIssues, setIgnoredIssues, toggleIssueAddressed, toggleIssueIgnored };
}

function toggled(prev: Set<number>, idx: number): Set<number> {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    return next;
}

/** Sin cambio devuelve el mismo Set: React no re-renderiza. */
function without(prev: Set<number>, idx: number): Set<number> {
    if (!prev.has(idx)) return prev;
    const next = new Set(prev);
    next.delete(idx);
    return next;
}
