import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useLocation, useInRouterContext } from 'react-router-dom';
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

/**
 * Adónde va una cita hecha en el visor: el editor abierto (el lápiz de un paso
 * o del ensamble). Se registra mientras está abierto; sin ninguno, «Citar»
 * copia al portapapeles (decisión del fundador, fase F).
 */
export interface CitationSink {
    /** Dónde se va a insertar, para decirlo antes de hacerlo («Santiago 3:18»). */
    label: string;
    insert: (cita: string) => void;
}

const ApiContext = createContext<SourceViewerApi | null>(null);
const SinkContext = createContext<{ sink: CitationSink | null; setSinks: Dispatch<SetStateAction<CitationSink[]>> } | null>(null);
const StateContext = createContext<(SourceViewerState & { setMode: (m: SourceViewerMode) => void; close: () => void }) | null>(null);

export function SourceViewerProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SourceViewerState>({ target: null, mode: 'panel' });
    const open = useCallback((target: SourceViewerTarget, mode: SourceViewerMode = 'panel') => setState({ target, mode }), []);
    const close = useCallback(() => setState(s => ({ ...s, target: null })), []);
    const setMode = useCallback((mode: SourceViewerMode) => setState(s => ({ ...s, mode })), []);
    const api = useMemo(() => ({ open, close }), [open, close]);
    const full = useMemo(() => ({ ...state, setMode, close }), [state, setMode, close]);
    // Una PILA y no un solo destino: con dos editores abiertos, cerrar el
    // segundo devuelve el destino al primero en vez de dejar ninguno.
    const [pila, setSinks] = useState<CitationSink[]>([]);
    const sinks = useMemo(() => ({ sink: pila.at(-1) ?? null, setSinks }), [pila]);
    return (
        <ApiContext.Provider value={api}>
            <SinkContext.Provider value={sinks}>
                <StateContext.Provider value={full}>{children}</StateContext.Provider>
            </SinkContext.Provider>
        </ApiContext.Provider>
    );
}

/** El editor que recibe las citas, si hay uno abierto. */
export function useCitationSink(): CitationSink | null {
    return useContext(SinkContext)?.sink ?? null;
}

/**
 * Un editor se ofrece como destino de las citas mientras está abierto. El
 * último abierto es el destino; pasar `null` (o desmontarse) lo retira y el
 * destino vuelve al anterior que siga abierto.
 * El objeto tiene que ser estable (`useMemo`): cada objeto nuevo es otro
 * registro.
 */
export function useRegisterCitationSink(sink: CitationSink | null) {
    const setSinks = useContext(SinkContext)?.setSinks;
    useEffect(() => {
        if (!sink || !setSinks) return;
        setSinks(pila => [...pila.filter(s => s !== sink), sink]);
        return () => setSinks(pila => pila.filter(s => s !== sink));
    }, [sink, setSinks]);
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
    const enRouter = useInRouterContext();
    const ctx = useContext(StateContext);
    if (!ctx?.target) return null;
    return (
        <>
            {enRouter && <CerrarAlSalirDelTrabajo paperId={ctx.target.paperId} onClose={ctx.close} />}
            <Visor />
        </>
    );
}

/**
 * Al ir a OTRO trabajo (o a otra pantalla, si se abrió desde la Biblioteca)
 * el visor se cierra: abierto, mostraba el libro del trabajo anterior y
 * «Citar» insertaba en el nuevo una clave que no es fuente suya (revisión
 * adversarial, fase F). Dentro del mismo trabajo (configuración, revisión de
 * citas, página del trabajo) sigue abierto.
 */
function CerrarAlSalirDelTrabajo({ paperId, onClose }: { paperId: string | null; onClose: () => void }) {
    const { pathname } = useLocation();
    const inicial = useRef(pathname);
    useEffect(() => {
        if (pathname === inicial.current) return;
        if (!paperId || !pathname.includes(paperId)) onClose();
    }, [pathname, paperId, onClose]);
    return null;
}

function Visor() {
    const { t } = useTranslation('exegesis');
    const ctx = useContext(StateContext)!;
    const { target, mode, setMode, close } = ctx;
    // Al abrirse (o al cambiar de libro), el foco entra al panel: así Escape
    // lo cierra y el teclado puede recorrerlo sin buscarlo.
    const panelRef = useRef<HTMLElement>(null);
    useEffect(() => {
        if (mode === 'panel') panelRef.current?.focus();
    }, [mode, target]);
    if (!target) return null;

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
            ref={panelRef}
            tabIndex={-1}
            aria-label={t('sourceViewer.panelLabel')}
            onKeyDown={onKeyDown}
            // Alto = la ventana menos el encabezado de la app (h-16): con 100svh
            // la barra «Citar» quedaba 64 px bajo el borde en las páginas que
            // hacen scroll de ventana (medido en la revisión adversarial).
            className="fixed inset-0 z-50 flex flex-col bg-background outline-none md:sticky md:inset-auto md:top-0 md:z-auto md:h-[calc(100svh-4rem)] md:w-[min(600px,45vw)] md:shrink-0 md:self-start md:border-l md:border-border md:shadow-[-12px_0_32px_-16px_rgba(15,23,42,0.18)] print:hidden"
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
