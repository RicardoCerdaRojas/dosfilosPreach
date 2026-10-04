import { useState } from 'react';

/**
 * Deshacer y rehacer de la tinta (T-5).
 *
 * Cada acción guarda cómo deshacerse y cómo rehacerse. La conoce quien la
 * hizo (el hook de la tinta del sermón o el de la Biblia), porque sólo él
 * sabe cómo se guarda. El historial dura mientras el pastor está en la
 * pantalla: no se guarda.
 */
export interface InkAction {
    undo: () => void;
    redo: () => void;
}

export interface InkHistoryState {
    past: InkAction[];
    future: InkAction[];
}

/** Hasta dónde se puede deshacer. Suficiente para un domingo; no crece sin fin. */
export const INK_HISTORY_LIMIT = 50;

export const emptyInkHistory: InkHistoryState = { past: [], future: [] };

/** Algo nuevo: entra al pasado y el futuro se pierde (como en cualquier editor). */
export function recordInk(state: InkHistoryState, action: InkAction): InkHistoryState {
    return { past: [...state.past, action].slice(-INK_HISTORY_LIMIT), future: [] };
}

export function undoInk(state: InkHistoryState): { action: InkAction | null; state: InkHistoryState } {
    const action = state.past[state.past.length - 1];
    if (!action) return { action: null, state };
    return { action, state: { past: state.past.slice(0, -1), future: [action, ...state.future] } };
}

export function redoInk(state: InkHistoryState): { action: InkAction | null; state: InkHistoryState } {
    const action = state.future[0];
    if (!action) return { action: null, state };
    return { action, state: { past: [...state.past, action], future: state.future.slice(1) } };
}

export function useInkHistory() {
    const [history, setHistory] = useState<InkHistoryState>(emptyInkHistory);
    return {
        record: (action: InkAction) => setHistory((h) => recordInk(h, action)),
        undo: () => {
            const { action, state } = undoInk(history);
            if (!action) return;
            setHistory(state);
            action.undo();
        },
        redo: () => {
            const { action, state } = redoInk(history);
            if (!action) return;
            setHistory(state);
            action.redo();
        },
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
    };
}
