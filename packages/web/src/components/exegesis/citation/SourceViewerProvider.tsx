import { createContext, useCallback, useContext, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { CitationSourceModal, type CitationTarget } from './CitationSourceModal';
import { SourceViewerBody } from './SourceViewerBody';

/**
 * Un solo visor de fuente para toda la aplicación.
 *
 * Cualquier pantalla lo abre con `useSourceViewer().open(...)`, sin montar su
 * propio modal: la cita de un análisis, la tarjeta de una fuente del corpus,
 * la lista del trabajo, la Biblioteca. Se muestra de dos maneras (decisión del
 * fundador, fase F):
 *
 *   - `panel`: a la derecha, SIN bloquear el resto. El texto del trabajo sigue
 *     a la vista y editable, que es lo que hace falta para citar mientras se
 *     escribe. Es el mismo patrón que la ficha de palabra.
 *   - `full`: la ventana grande, para leer varias páginas seguidas.
 */
export interface SourceViewerTarget {
    /** `null` en la Biblioteca: se abre el libro sin trabajo. */
    paperId: string | null;
    citation: CitationTarget;
}

export type SourceViewerMode = 'panel' | 'full';

interface SourceViewerApi {
    open: (target: SourceViewerTarget, mode?: SourceViewerMode) => void;
    close: () => void;
}

interface SourceViewerState {
    target: SourceViewerTarget | null;
    mode: SourceViewerMode;
}

const ApiContext = createContext<SourceViewerApi | null>(null);
const StateContext = createContext<(SourceViewerState & { setMode: (m: SourceViewerMode) => void; close: () => void }) | null>(null);

export function SourceViewerProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SourceViewerState>({ target: null, mode: 'panel' });
    const open = useCallback((target: SourceViewerTarget, mode: SourceViewerMode = 'panel') => setState({ target, mode }), []);
    const close = useCallback(() => setState(s => ({ ...s, target: null })), []);
    const setMode = useCallback((mode: SourceViewerMode) => setState(s => ({ ...s, mode })), []);
    const api = useMemo(() => ({ open, close }), [open, close]);
    const full = useMemo(() => ({ ...state, setMode, close }), [state, setMode, close]);
    return (
        <ApiContext.Provider value={api}>
            <StateContext.Provider value={full}>{children}</StateContext.Provider>
        </ApiContext.Provider>
    );
}

/**
 * Abrir y cerrar el visor. Fuera del proveedor (pruebas de componentes
 * sueltos) no hace nada, en vez de romper la pantalla que lo usa.
 */
export function useSourceViewer(): SourceViewerApi {
    return useContext(ApiContext) ?? NOOP;
}
const NOOP: SourceViewerApi = { open: () => {}, close: () => {} };

/**
 * Donde se dibuja el visor. Va en el layout, al lado del contenido: en modo
 * panel ocupa su propia columna (el contenido se angosta, no queda tapado);
 * en el celular cubre la pantalla.
 */
export function SourceViewerSlot() {
    const { t } = useTranslation('exegesis');
    const ctx = useContext(StateContext);
    if (!ctx?.target) return null;
    const { target, mode, setMode, close } = ctx;

    if (mode === 'full') {
        return (
            <CitationSourceModal
                open
                onOpenChange={o => { if (!o) close(); }}
                paperId={target.paperId}
                citation={target.citation}
                actions={(
                    <button type="button" onClick={() => setMode('panel')} className={BOTON}>
                        <Minimize2 className="h-4 w-4" aria-hidden="true" />
                        <span>{t('sourceViewer.backToPanel')}</span>
                    </button>
                )}
            />
        );
    }

    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
        if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };

    return (
        <aside
            aria-label={t('sourceViewer.panelLabel')}
            onKeyDown={onKeyDown}
            className="fixed inset-0 z-50 flex flex-col bg-background md:sticky md:inset-auto md:top-0 md:z-auto md:h-svh md:max-h-full md:w-[min(600px,45vw)] md:shrink-0 md:self-start md:border-l md:border-border md:shadow-[-12px_0_32px_-16px_rgba(15,23,42,0.18)] print:hidden"
            data-testid="source-viewer-panel"
        >
            <SourceViewerBody
                paperId={target.paperId}
                target={target.citation}
                open
                layout="panel"
                actions={(
                    <>
                        <button type="button" onClick={() => setMode('full')} aria-label={t('sourceViewer.expand')} title={t('sourceViewer.expand')} className={ICONO}>
                            <Maximize2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={close} aria-label={t('sourceViewer.close')} title={t('sourceViewer.close')} className={ICONO}>
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </>
                )}
            />
        </aside>
    );
}

const ICONO = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const BOTON = 'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
