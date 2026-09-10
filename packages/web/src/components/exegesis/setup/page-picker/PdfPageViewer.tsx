import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pdfjsLib } from '@/lib/pdfWorker';
import { Loader2, FileWarning } from 'lucide-react';
import { findQuoteInPageText } from '@dosfilos/domain';

/**
 * Una hoja del PDF, dibujada en canvas.
 *
 * El visor abre el archivo por URL firmada y deja que pdf.js pida rangos de
 * bytes: de un comentario de 24 MB baja solo las hojas que se miran. Por eso la
 * URL se firma en vez de servirse por la callable — proxear el archivo
 * rompería el pedido por rango y habría que bajarlo entero.
 *
 * El worker se empaqueta con la app en vez de traerse de un CDN. Hay un
 * precedente en el proyecto que lo carga desde unpkg; para una pieza central
 * del flujo de corpus, depender de un tercero para que la pantalla funcione es
 * una fragilidad que no hace falta aceptar.
 */

// Configurado una sola vez en `@/lib/pdfWorker`, importado abajo.

/**
 * Recursos que pdf.js pide por URL mientras renderiza. Los copia a `public/`
 * el script `copy-pdfjs-assets.mjs` antes de `dev` y de `build`.
 *
 * Faltando, no hay error: la hoja sale EN BLANCO. Medido contra la biblioteca
 * real — la mitad de los comentarios son escaneos que guardan cada página como
 * imagen JPEG 2000 con máscara JBIG2, y pdf.js decodifica las dos con
 * WebAssembly que busca acá. Y los cmaps y las fuentes estándar son lo que
 * hace que el griego y el hebreo salgan como letras y no como cajas vacías.
 */
const PDFJS_ASSETS = {
    wasmUrl: '/pdfjs/wasm/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
} as const;

interface Props {
    /** URL firmada del PDF. `null` mientras se está pidiendo. */
    url: string | null;
    /** Hoja física a mostrar, contada desde 1. */
    sheet: number;
    /** Marca visualmente que la hoja ya está en el carrito. */
    selected: boolean;
    /**
     * Frase a señalar dentro de la hoja. Cuando viene, el visor lee la
     * capa de texto y pinta bandas sobre los fragmentos que la componen.
     */
    highlightQuote?: string | null;
    /**
     * Si la frase se localizó o no. La interfaz lo necesita para poder
     * decir «abrí la página pero no encontré la cita» en vez de dejar al
     * lector buscando una marca que nunca va a aparecer — en una
     * biblioteca con medio catálogo escaneado, no encontrarla es un
     * resultado corriente y hay que nombrarlo.
     */
    onHighlightResolved?: (found: boolean) => void;
    /**
     * Ampliación. `'fit'` encaja la hoja entera —lo que hace falta al
     * recorrer un libro decidiendo qué sirve— y un número la amplía sobre
     * ese ajuste, que es lo que hace falta al leer una nota al pie.
     */
    zoom?: number | 'fit';
    /** Palabra a buscar en la hoja, además de la cita. */
    searchTerm?: string | null;
    /** Cuántas veces aparece el término buscado en esta hoja. */
    onSearchMatches?: (count: number) => void;
}

/** Banda a pintar sobre el canvas, en píxeles CSS relativos a la hoja. */
interface HighlightBox {
    left: number;
    top: number;
    width: number;
    height: number;
}

/**
 * Margen alrededor de la hoja dentro del panel, en píxeles.
 */
const STAGE_PADDING = 24;

/** Lo que necesitamos de un fragmento de la capa de texto de pdf.js. */
interface TextItemLike {
    str: string;
    width: number;
    height: number;
    transform: number[];
    hasEOL?: boolean;
}

/**
 * Rectángulo de un fragmento en píxeles CSS de la hoja dibujada.
 *
 * La matriz de pdf.js sitúa el fragmento por su LÍNEA BASE, así que la
 * altura se descuenta hacia arriba: usar la coordenada cruda pintaría la
 * banda bajo el texto en vez de sobre él.
 */
function boxFor(item: TextItemLike, viewport: pdfjsLib.PageViewport): HighlightBox | null {
    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2] ?? 0, tx[3] ?? 0);
    const width = item.width * viewport.scale;
    if (!Number.isFinite(width) || width <= 0 || fontHeight <= 0) return null;
    return {
        left: tx[4] ?? 0,
        top: (tx[5] ?? 0) - fontHeight,
        width,
        height: fontHeight,
    };
}

export function PdfPageViewer({
    url,
    sheet,
    selected,
    highlightQuote = null,
    onHighlightResolved,
    zoom = 'fit',
    searchTerm = null,
    onSearchMatches,
}: Props) {
    const { t } = useTranslation('exegesis');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    // Cancela el render anterior cuando el usuario pasa hojas rápido: sin esto,
    // dos renders sobre el mismo canvas se pisan y pdf.js tira
    // "Cannot use the same canvas during multiple render() operations".
    const renderRef = useRef<pdfjsLib.RenderTask | null>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const [stage, setStage] = useState({ width: 0, height: 0 });
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [errorKind, setErrorKind] = useState<'load' | 'page' | null>(null);
    const [highlights, setHighlights] = useState<HighlightBox[]>([]);
    const [searchBoxes, setSearchBoxes] = useState<HighlightBox[]>([]);
    const [canvasBox, setCanvasBox] = useState({ width: 0, height: 0 });

    // La hoja se ajusta al panel para que entre ENTERA. Al recorrer un libro
    // decidiendo qué sirve, ver media página y tener que scrollear para ver el
    // resto convierte cada hoja en dos gestos.
    useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            const box = entries[0]?.contentRect;
            if (box) setStage({ width: box.width, height: box.height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!url) return;
        let cancelled = false;
        setStatus('loading');
        setErrorKind(null);

        const task = pdfjsLib.getDocument({
            url,
            disableAutoFetch: true,
            disableStream: false,
            ...PDFJS_ASSETS,
        });
        task.promise.then(
            doc => {
                if (cancelled) { void doc.destroy(); return; }
                docRef.current = doc;
                setStatus('ready');
            },
            (err: unknown) => {
                if (cancelled) return;
                console.error('[PdfPageViewer] no se pudo abrir el documento', err);
                setErrorKind('load');
                setStatus('error');
            },
        );

        return () => {
            cancelled = true;
            renderRef.current?.cancel();
            void task.destroy();
            docRef.current = null;
        };
    }, [url]);

    useEffect(() => {
        const doc = docRef.current;
        const canvas = canvasRef.current;
        if (status !== 'ready' || !doc || !canvas) return;
        if (sheet < 1 || sheet > doc.numPages) return;
        if (stage.width <= 0 || stage.height <= 0) return;

        let cancelled = false;
        renderRef.current?.cancel();

        doc.getPage(sheet).then(
            page => {
                if (cancelled) return;
                const base = page.getViewport({ scale: 1 });
                // Entra entera: se toma el menor de los dos ajustes, el de ancho
                // y el de alto.
                const fit = Math.min(
                    (stage.width - STAGE_PADDING * 2) / base.width,
                    (stage.height - STAGE_PADDING * 2) / base.height,
                );
                // Ampliar multiplica el ajuste, no lo reemplaza: así el
                // 100% significa «la hoja entera» en cualquier pantalla.
                const cssScale = Math.max(fit, 0.1) * (zoom === 'fit' ? 1 : zoom);
                // Se dibuja a la densidad real de la pantalla: en un retina, un
                // canvas a escala 1 se ve borroso justo donde el usuario está
                // leyendo tipografía chica para decidir.
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const viewport = page.getViewport({ scale: cssScale * dpr });
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                const cssWidth = Math.floor(base.width * cssScale);
                const cssHeight = Math.floor(base.height * cssScale);
                canvas.style.width = `${cssWidth}px`;
                canvas.style.height = `${cssHeight}px`;
                setCanvasBox({ width: cssWidth, height: cssHeight });

                // La capa de texto se lee aparte del dibujo: el canvas
                // pinta píxeles y no sabe dónde quedó cada palabra.
                void paintBands(page, page.getViewport({ scale: cssScale }));

                const task = page.render({ canvas, canvasContext: ctx, viewport });
                renderRef.current = task;
                task.promise.catch((err: unknown) => {
                    // Cancelar un render es normal al pasar hojas rápido.
                    if (err && (err as { name?: string }).name === 'RenderingCancelledException') return;
                    console.error('[PdfPageViewer] no se pudo dibujar la hoja', err);
                    if (!cancelled) { setErrorKind('page'); setStatus('error'); }
                });
            },
            (err: unknown) => {
                if (cancelled) return;
                console.error('[PdfPageViewer] no se pudo leer la hoja', err);
                setErrorKind('page');
                setStatus('error');
            },
        );

        /**
         * Busca la frase en la capa de texto y calcula sus bandas.
         *
         * pdf.js entrega la hoja como fragmentos sueltos con su propia
         * matriz de posición, así que se concatenan para poder buscar
         * sobre el texto corrido —que es como está escrita la cita— y
         * luego se traduce el rango encontrado de vuelta a los fragmentos
         * que lo contienen.
         */
        async function paintBands(
            page: pdfjsLib.PDFPageProxy,
            cssViewport: pdfjsLib.PageViewport,
        ) {
            const wantsQuote = !!highlightQuote?.trim();
            const wantsSearch = !!searchTerm?.trim();
            if (!wantsQuote && !wantsSearch) {
                setHighlights([]);
                setSearchBoxes([]);
                return;
            }
            try {
                const content = await page.getTextContent();
                if (cancelled) return;

                // Texto corrido + dónde empieza cada fragmento dentro de él.
                let pageText = '';
                const spans: Array<{ start: number; end: number; item: TextItemLike }> = [];
                for (const raw of content.items) {
                    const item = raw as TextItemLike;
                    if (typeof item.str !== 'string') continue;
                    const start = pageText.length;
                    pageText += item.str;
                    spans.push({ start, end: pageText.length, item });
                    // pdf.js marca el fin de renglón aparte del texto; sin
                    // este espacio, la última palabra de una línea y la
                    // primera de la siguiente quedarían pegadas.
                    if (item.hasEOL) pageText += '\n';
                }

                /** Bandas de un rango de caracteres del texto corrido. */
                const bandsFor = (from: number, to: number): HighlightBox[] => {
                    const out: HighlightBox[] = [];
                    for (const span of spans) {
                        if (span.end <= from || span.start >= to) continue;
                        const box = boxFor(span.item, cssViewport);
                        if (box) out.push(box);
                    }
                    return out;
                };

                if (wantsQuote) {
                    const match = findQuoteInPageText(highlightQuote!, pageText);
                    const boxes = match ? bandsFor(match.start, match.end) : [];
                    setHighlights(boxes);
                    onHighlightResolved?.(boxes.length > 0);
                } else {
                    setHighlights([]);
                }

                if (wantsSearch) {
                    // Busca TODAS las apariciones, no la primera: el lector
                    // que busca una palabra quiere ver si la página la usa
                    // una vez o cinco.
                    const boxes: HighlightBox[] = [];
                    let count = 0;
                    let from = 0;
                    while (from < pageText.length) {
                        const hit = findQuoteInPageText(searchTerm!, pageText.slice(from));
                        if (!hit) break;
                        boxes.push(...bandsFor(from + hit.start, from + hit.end));
                        count += 1;
                        from += hit.end;
                        if (count > 200) break;
                    }
                    setSearchBoxes(boxes);
                    onSearchMatches?.(count);
                } else {
                    setSearchBoxes([]);
                    onSearchMatches?.(0);
                }
            } catch (err) {
                if (cancelled) return;
                console.warn('[PdfPageViewer] no se pudo leer la capa de texto', err);
                setHighlights([]);
                setSearchBoxes([]);
                onHighlightResolved?.(false);
                onSearchMatches?.(0);
            }
        }

        return () => { cancelled = true; renderRef.current?.cancel(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheet, status, stage.width, stage.height, highlightQuote, zoom, searchTerm]);

    if (status === 'error') {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <FileWarning className="h-5 w-5 text-warning" aria-hidden="true" />
                <p className="text-sm text-muted-foreground max-w-xs">
                    {errorKind === 'load'
                        ? t('paperSetup.subSteps.corpus.picker.viewer.loadFailed')
                        : t('paperSetup.subSteps.corpus.picker.viewer.pageFailed')}
                </p>
            </div>
        );
    }

    const zoomed = zoom !== 'fit' && zoom > 1;
    return (
        <div
            ref={stageRef}
            className={`relative flex h-full w-full justify-center ${
                zoomed ? 'items-start overflow-auto p-6' : 'items-center overflow-hidden'
            }`}
        >
            {status !== 'ready' && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span className="text-sm">{t('paperSetup.subSteps.corpus.picker.viewer.loading')}</span>
                </div>
            )}
            <div className="relative" style={{ width: canvasBox.width || undefined }}>
                <canvas
                    ref={canvasRef}
                    aria-label={t('paperSetup.subSteps.corpus.picker.viewer.sheetLabel', { sheet })}
                    className={`rounded-sm bg-card shadow-md transition-opacity ${
                        status === 'ready' ? 'opacity-100' : 'opacity-0'
                    } ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                />
                {/* Bandas sobre el texto, no debajo: el canvas ya está
                    pintado y esta capa solo lo señala. `mix-blend-multiply`
                    deja leer las letras a través del color. */}
                {status === 'ready' && searchBoxes.map((box, i) => (
                    <div
                        key={`s-${i}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-[2px] bg-info/40 mix-blend-multiply"
                        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                    />
                ))}
                {status === 'ready' && highlights.map((box, i) => (
                    <div
                        key={i}
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-[2px] bg-warning/40 mix-blend-multiply"
                        style={{
                            left: box.left,
                            top: box.top,
                            width: box.width,
                            height: box.height,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
