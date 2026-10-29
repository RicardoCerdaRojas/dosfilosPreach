/**
 * Los comentarios que dejó el profesor en el PDF del trabajo, leídos en el
 * navegador. Canvas (y Acrobat, Preview…) descargan el PDF corregido con las
 * anotaciones como anotaciones PDF estándar: cada comentario trae su texto,
 * su autor y su lugar en la hoja. Transcribirlos a mano al diálogo de la
 * devolución era lento y perdía DÓNDE los hizo (fundador, TI #1 del Salmo 23:
 * 15 comentarios anclados).
 *
 * El archivo no sale del navegador: pdf.js lo abre aquí y solo se guarda lo
 * que el estudiante confirma en el diálogo.
 *
 * La lógica pura (el ancla, la página impresa, las respuestas) va en
 * funciones exportadas que reciben objetos con la forma de pdf.js, para
 * probarlas sin pdf.js.
 */

/** Un comentario del PDF, listo para clasificar. */
export interface PdfFeedbackNote {
    /** La hoja del PDF (1 = la primera, sea portada o no). */
    sheet: number;
    /** La página impresa («2», «iv») o, si la hoja no la trae, «hoja N». */
    page: string;
    author: string | null;
    /** El comentario (con sus respuestas). Vacío: una marca sin texto. */
    text: string;
    /** La frase marcada o, para una nota al margen, la línea junto a la que está. */
    quote: string | null;
}

/** Un trozo de texto tal como lo da `getTextContent()`. */
export interface PdfTextItemLike {
    str: string;
    /** `[a, b, c, d, x, y]`: `x`, `y` es la línea base, en puntos PDF (origen abajo a la izquierda). */
    transform: ArrayLike<number>;
    width: number;
    height: number;
}

/** Una anotación tal como la da `getAnnotations()`. */
export interface PdfAnnotationLike {
    id?: string | null;
    subtype?: string | null;
    contents?: string | null;
    contentsObj?: { str?: string | null } | null;
    title?: string | null;
    titleObj?: { str?: string | null } | null;
    /** `[x0, y0, x1, y1]`. */
    rect?: ArrayLike<number> | null;
    /** Plano, 8 números por cuadrilátero (pdf.js ≥ 4); o, en versiones viejas, `[{x,y}×4]` por cuadrilátero. */
    quadPoints?: ArrayLike<number> | ReadonlyArray<ReadonlyArray<{ x: number; y: number }>> | null;
    inReplyTo?: string | null;
}

/** Lo que no es un comentario: enlaces del índice, campos de formulario y la ventanita de una nota. */
const NO_SON_COMENTARIOS = new Set(['Link', 'Widget', 'Popup']);

/** Tope de la frase guardada (el dominio acepta más; en la fila se lee una línea). */
export const PDF_QUOTE_MAX = 300;
/** Cuánto puede alejarse en vertical la línea de una nota al margen (pt). */
export const NOTE_LINE_TOLERANCE = 20;
/** La banda de arriba y de abajo donde va el número de página, como fracción del alto de la hoja. */
export const PAGE_NUMBER_BAND = 0.08;

// ── Líneas de texto ──────────────────────────────────────────────────────

interface Trozo { str: string; x: number; y: number; w: number; h: number; orden: number }

/** Una línea de la hoja: sus trozos en el orden del contenido (así el hebreo no sale al revés). */
export interface PdfLine {
    text: string;
    /** La línea base del trozo más alto (el texto, no la llamada de nota volada). */
    y: number;
    /** El alto del texto de la línea. */
    h: number;
    x0: number;
    x1: number;
    /** Los trozos con texto, de izquierda a derecha (para el número al extremo de un encabezado). */
    parts: Array<{ str: string; x0: number; x1: number }>;
}

const ALTO_POR_DEFECTO = 10;

function trozos(items: ReadonlyArray<PdfTextItemLike>): Trozo[] {
    return items.map((it, orden) => ({
        str: it.str ?? '',
        x: Number(it.transform[4]) || 0,
        y: Number(it.transform[5]) || 0,
        w: Math.abs(Number(it.width) || 0),
        h: Math.abs(Number(it.height) || 0),
        orden,
    }));
}

/**
 * Une los trozos de una línea: un espacio donde hay un hueco y ninguno de
 * los dos lo trae. El hueco se mide contra el trozo ya puesto más cercano,
 * no solo el anterior: después de un tramo hebreo (de derecha a izquierda)
 * la coma sigue al borde derecho del tramo, no a su última letra.
 */
function unir(ts: Trozo[], alto: number): string {
    let out = '';
    const puestos: Trozo[] = [];
    for (const t of ts) {
        if (puestos.length && out && !/\s$/.test(out) && !/^\s/.test(t.str)) {
            const hueco = Math.min(...puestos.map(p => Math.max(0, t.x - (p.x + p.w), p.x - (t.x + t.w))));
            if (hueco > alto * 0.2) out += ' ';
        }
        out += t.str;
        if (t.str.trim()) puestos.push(t);
    }
    return out.replace(/\s+/g, ' ').trim();
}

/**
 * Las líneas de una hoja. Dos trozos son de la misma línea si sus líneas
 * base están a menos de medio renglón: así la llamada de nota volada
 * («hebreo⁴», 4 pt más arriba) queda en su línea y no forma una aparte.
 */
export function groupLines(items: ReadonlyArray<PdfTextItemLike>): PdfLine[] {
    const grupos: Array<{ ts: Trozo[]; y: number; h: number }> = [];
    for (const t of trozos(items)) {
        if (!t.str.trim() && t.h === 0) {
            // Un espacio suelto: va con la línea a la que pertenece, si ya existe.
            const g = grupos.find(x => Math.abs(x.y - t.y) <= x.h * 0.45);
            if (g) g.ts.push(t);
            continue;
        }
        const h = t.h || ALTO_POR_DEFECTO;
        const g = grupos.find(x => Math.abs(x.y - t.y) <= Math.max(x.h, h) * 0.45);
        if (!g) { grupos.push({ ts: [t], y: t.y, h }); continue; }
        g.ts.push(t);
        // La línea base es la del texto más alto: la llamada volada no la mueve.
        if (h > g.h) { g.h = h; g.y = t.y; }
    }
    return grupos
        .map(g => {
            const ts = [...g.ts].sort((a, b) => a.orden - b.orden);
            const conTexto = ts.filter(t => t.str.trim());
            return {
                text: unir(ts, g.h),
                y: g.y,
                h: g.h,
                x0: Math.min(...conTexto.map(t => t.x)),
                x1: Math.max(...conTexto.map(t => t.x + t.w)),
                parts: conTexto.map(t => ({ str: t.str.trim(), x0: t.x, x1: t.x + t.w })).sort((a, b) => a.x0 - b.x0),
            };
        })
        .filter(l => !!l.text)
        // De arriba abajo, como se lee.
        .sort((a, b) => b.y - a.y);
}

/** El centro vertical de una línea: un tercio del alto sobre la línea base (donde está la x minúscula). */
const centroDe = (l: PdfLine) => l.y + l.h / 3;

// ── El ancla ─────────────────────────────────────────────────────────────

interface Caja { x0: number; x1: number; y0: number; y1: number }

/** Los cuadriláteros de un resaltado como cajas, en cualquiera de las dos formas de pdf.js. */
export function quadBoxes(q: PdfAnnotationLike['quadPoints']): Caja[] {
    if (!q || !q.length) return [];
    const cajas: Caja[] = [];
    const primero = (q as ArrayLike<unknown>)[0];
    if (Array.isArray(primero)) {
        for (const quad of q as ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>) {
            const xs = quad.map(p => p.x), ys = quad.map(p => p.y);
            cajas.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
        }
        return cajas;
    }
    const n = q as ArrayLike<number>;
    for (let i = 0; i + 7 < n.length; i += 8) {
        const xs = [n[i]!, n[i + 2]!, n[i + 4]!, n[i + 6]!], ys = [n[i + 1]!, n[i + 3]!, n[i + 5]!, n[i + 7]!];
        cajas.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
    }
    return cajas;
}

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * La parte de un trozo que cae dentro de la caja. Word suele dar la línea
 * entera en un solo trozo: el corte se estima por la proporción del ancho y
 * se lleva a palabras enteras. Un trozo hebreo va entero (no se reparte por
 * ancho sin el orden visual).
 */
function parteCubierta(t: Trozo, c: Caja): string {
    if (t.w <= 0 || RTL.test(t.str) || (c.x0 <= t.x + 0.5 && c.x1 >= t.x + t.w - 0.5)) return t.str;
    const n = t.str.length;
    let i = Math.max(0, Math.floor(((c.x0 - t.x) / t.w) * n));
    let j = Math.min(n, Math.ceil(((c.x1 - t.x) / t.w) * n));
    while (i > 0 && /\S/.test(t.str[i - 1]!)) i--;
    while (j < n && /\S/.test(t.str[j]!)) j++;
    return t.str.slice(i, j);
}

/** El texto que cubre un resaltado (o un recuadro): cada trozo cuyo centro cae en una caja. */
export function coveredText(items: ReadonlyArray<PdfTextItemLike>, cajas: ReadonlyArray<Caja>): string {
    const partes: string[] = [];
    for (const c of cajas) {
        const dentro = trozos(items).filter(t => {
            if (!t.str.trim()) return false;
            const cy = t.y + (t.h || ALTO_POR_DEFECTO) / 3;
            return cy >= c.y0 && cy <= c.y1 && t.x + t.w > c.x0 && t.x < c.x1;
        });
        const texto = dentro.map(t => parteCubierta(t, c)).join(' ').replace(/\s+/g, ' ').trim();
        if (texto) partes.push(texto);
    }
    return partes.join(' ').trim();
}

/**
 * La línea de una nota al margen (`Text`, un ícono): la más cercana en
 * vertical al centro del ícono, dentro de `NOTE_LINE_TOLERANCE`, y entre
 * dos igual de cerca la más cercana en horizontal. Si ninguna está tan cerca
 * (una nota en el hueco antes de las notas al pie), la más cercana de la
 * hoja. Canvas pone el CENTRO del ícono donde hizo clic el profesor (medido
 * en el TI #1: el apóstrofe de «O'Connor», la errata «afimar»).
 */
export function nearestLine(lines: ReadonlyArray<PdfLine>, rect: ArrayLike<number>, exclude: (l: PdfLine) => boolean = () => false): PdfLine | null {
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = Array.from(rect);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const candidatas = lines.filter(l => !exclude(l));
    const dx = (l: PdfLine) => (cx < l.x0 ? l.x0 - cx : cx > l.x1 ? cx - l.x1 : 0);
    const dy = (l: PdfLine) => Math.abs(centroDe(l) - cy);
    const cerca = candidatas.filter(l => dy(l) <= NOTE_LINE_TOLERANCE);
    if (cerca.length) return [...cerca].sort((a, b) => dy(a) - dy(b) || dx(a) - dx(b))[0]!;
    return [...candidatas].sort((a, b) => Math.hypot(dx(a), dy(a)) - Math.hypot(dx(b), dy(b)))[0] ?? null;
}

/** Corta la frase al tope, en una palabra, con «…». */
export function capQuote(s: string, max = PDF_QUOTE_MAX): string {
    const limpia = s.replace(/\s+/g, ' ').trim();
    if (limpia.length <= max) return limpia;
    const corte = limpia.slice(0, max - 1);
    const espacio = corte.lastIndexOf(' ');
    return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

/**
 * La frase de una anotación: con `quadPoints` (resaltado, subrayado,
 * tachado), el texto cubierto; con solo `rect`, la línea más cercana. Un
 * recuadro, una elipse o un trazo a mano alzada que encierra texto se ancla
 * en lo que encierra; una nota o un cuadro de texto, que van al margen, en
 * la línea de al lado.
 */
export function anchorQuote(
    ann: PdfAnnotationLike,
    items: ReadonlyArray<PdfTextItemLike>,
    lines: ReadonlyArray<PdfLine> = groupLines(items),
    exclude?: (l: PdfLine) => boolean,
): string | null {
    const cajas = quadBoxes(ann.quadPoints);
    if (cajas.length) {
        const t = coveredText(items, cajas);
        if (t) return capQuote(t);
    }
    if (!ann.rect || ann.rect.length < 4) return null;
    const [x0, y0, x1, y1] = Array.from(ann.rect) as [number, number, number, number];
    const caja = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1) };
    if (ann.subtype !== 'Text' && ann.subtype !== 'FreeText') {
        const t = coveredText(items, [caja]);
        if (t) return capQuote(t);
    }
    const l = nearestLine(lines, ann.rect, exclude);
    return l ? capQuote(l.text) : null;
}

// ── La página impresa ────────────────────────────────────────────────────

const ROMANO = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

/** Un número de página como se imprime: árabe («12») o romano («iv»). */
export function isPageNumberText(s: string): boolean {
    const t = s.trim();
    return /^\d{1,4}$/.test(t) || (t.length <= 7 && ROMANO.test(t));
}

/** Cuánto puede pasar un número de página al total de hojas (un trabajo que es parte de otro empieza más adelante). */
export const PAGE_NUMBER_SLACK = 100;

export interface BandPageNumber {
    /** La línea de la banda donde está (no es una frase del trabajo). */
    line: PdfLine;
    number: string;
}

/**
 * El número impreso de la hoja, en la banda de arriba o de abajo: una línea
 * que es SOLO un número (árabe o romano), o un encabezado con el número en
 * un extremo y separado del resto («ANÁLISIS DE SALMO 23        3», APA).
 * La llamada de una nota al pie no cuenta: va pegada a su texto («10 Pedro
 * Ortiz…», a 84 pt del borde en el TI #1, fuera de la banda). Un árabe que
 * pasa de lejos el total de hojas no es página («2026» en una portada).
 * Entre dos, el más cercano al borde.
 */
export function pageNumberInBand(lines: ReadonlyArray<PdfLine>, view: ArrayLike<number>, numPages?: number): BandPageNumber | null {
    const [, vy0 = 0, , vy1 = 792] = Array.from(view);
    const banda = (vy1 - vy0) * PAGE_NUMBER_BAND;
    const borde = (l: PdfLine) => Math.min(vy1 - l.y, l.y - vy0);
    const creible = (s: string) => {
        const t = s.trim();
        if (!isPageNumberText(t)) return false;
        if (!/^\d+$/.test(t)) return true;
        const n = Number(t);
        return n >= 1 && (numPages === undefined || n <= numPages + PAGE_NUMBER_SLACK);
    };
    const numeroDe = (l: PdfLine): string | null => {
        if (creible(l.text)) return l.text.trim();
        const ps = l.parts;
        if (ps.length < 2) return null;
        // El primero o el último trozo, separado del resto por al menos un renglón de alto.
        const [p0, p1] = [ps[0]!, ps[1]!];
        const [u0, u1] = [ps[ps.length - 1]!, ps[ps.length - 2]!];
        if (creible(u0.str) && u0.x0 - u1.x1 >= l.h) return u0.str;
        if (creible(p0.str) && p1.x0 - p0.x1 >= l.h) return p0.str;
        return null;
    };
    return lines
        .filter(l => borde(l) <= banda)
        .map(l => ({ line: l, number: numeroDe(l) }))
        .filter((c): c is BandPageNumber => !!c.number)
        .sort((a, b) => borde(a.line) - borde(b.line))[0] ?? null;
}

/**
 * Las etiquetas de página sirven si dicen algo: un PDF que las trae como
 * «1, 2, 3…» igual a las hojas no informa la página impresa (la portada y
 * el índice desplazan la numeración), y entonces manda el número de la hoja.
 */
export function usablePageLabels(labels: ReadonlyArray<string> | null | undefined, numPages: number): ReadonlyArray<string> | null {
    if (!labels || labels.length !== numPages) return null;
    if (labels.every((l, i) => l.trim() === String(i + 1))) return null;
    return labels.every(l => l.trim()) ? labels : null;
}

/**
 * La hoja sin número impreso, NEUTRAL («h. 5»): se guarda así y la
 * pantalla la lee en el idioma de cada uno («hoja 5», «sheet 5»).
 */
export const defaultSheetLabel = (n: number) => `h. ${n}`;

/** La página impresa: la etiqueta del PDF, el número de la banda, o «hoja N». */
export function printedPage(input: {
    sheet: number;
    label?: string | null;
    lines: ReadonlyArray<PdfLine>;
    view: ArrayLike<number>;
    numPages?: number;
    sheetLabel?: (n: number) => string;
}): string {
    const etiqueta = input.label?.trim();
    if (etiqueta) return etiqueta;
    const enBanda = pageNumberInBand(input.lines, input.view, input.numPages);
    if (enBanda) return enBanda.number;
    return (input.sheetLabel ?? defaultSheetLabel)(input.sheet);
}

// ── Las anotaciones de una hoja y las respuestas ─────────────────────────

const textoDe = (a: PdfAnnotationLike) => (a.contentsObj?.str ?? a.contents ?? '').trim();
const autorDe = (a: PdfAnnotationLike) => (a.titleObj?.str ?? a.title ?? '').trim() || null;

export interface SheetInput {
    sheet: number;
    page: string;
    annotations: ReadonlyArray<PdfAnnotationLike>;
    items: ReadonlyArray<PdfTextItemLike>;
    /** La línea del número de página: no es una frase del trabajo. */
    pageNumberLine?: PdfLine | null;
}

/**
 * Los comentarios de todas las hojas, en orden de lectura (hoja a hoja, de
 * arriba abajo). Una respuesta (`inReplyTo`) se pega al comentario que
 * responde: «el profesor: … / el ayudante: …» es una sola observación. Si
 * el padre no está, la respuesta vale sola.
 */
export function collectNotes(sheets: ReadonlyArray<SheetInput>): PdfFeedbackNote[] {
    const notas: Array<PdfFeedbackNote & { id: string | null; y: number }> = [];
    const respuestas: Array<{ a: PdfAnnotationLike; sheet: SheetInput }> = [];
    for (const s of sheets) {
        const lines = groupLines(s.items);
        const numero = s.pageNumberLine;
        const exclude = numero ? (l: PdfLine) => Math.abs(l.y - numero.y) < 0.5 && l.text === numero.text : undefined;
        for (const a of s.annotations) {
            if (!a.subtype || NO_SON_COMENTARIOS.has(a.subtype)) continue;
            if (a.inReplyTo) { respuestas.push({ a, sheet: s }); continue; }
            const r = a.rect ? Array.from(a.rect) : [];
            notas.push({
                id: a.id ?? null,
                sheet: s.sheet,
                page: s.page,
                author: autorDe(a),
                text: textoDe(a),
                quote: anchorQuote(a, s.items, lines, exclude),
                y: r.length >= 4 ? Math.max(r[1]!, r[3]!) : 0,
            });
        }
    }
    for (const { a, sheet } of respuestas) {
        const texto = textoDe(a);
        const padre = notas.find(n => n.id && n.id === a.inReplyTo);
        if (!padre) {
            notas.push({ id: a.id ?? null, sheet: sheet.sheet, page: sheet.page, author: autorDe(a), text: texto, quote: anchorQuote(a, sheet.items), y: 0 });
            continue;
        }
        if (!texto) continue;
        const autor = autorDe(a);
        const linea = autor && autor !== padre.author ? `${autor}: ${texto}` : texto;
        padre.text = padre.text ? `${padre.text}\n${linea}` : linea;
    }
    return notas
        .sort((a, b) => a.sheet - b.sheet || b.y - a.y)
        .map(({ id: _id, y: _y, ...n }) => n);
}

// ── pdf.js ───────────────────────────────────────────────────────────────

/** Los mismos recursos que el visor de páginas: sin ellos el griego sale en cajas. */
const PDFJS_ASSETS = {
    wasmUrl: '/pdfjs/wasm/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
} as const;

/**
 * Lee los comentarios de un PDF anotado. pdf.js se carga recién aquí (la
 * pantalla no lo necesita para abrir), con el worker de `@/lib/pdfWorker`.
 */
export async function readPdfAnnotations(data: ArrayBuffer, opts: { sheetLabel?: (n: number) => string } = {}): Promise<PdfFeedbackNote[]> {
    const { pdfjsLib } = await import('../pdfWorker');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(data), ...PDFJS_ASSETS }).promise;
    try {
        const etiquetas = usablePageLabels(await doc.getPageLabels().catch(() => null), doc.numPages);
        const hojas: SheetInput[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
            const page = await doc.getPage(n);
            const annotations = ((await page.getAnnotations()) as PdfAnnotationLike[])
                .filter(a => !!a.subtype && !NO_SON_COMENTARIOS.has(a.subtype));
            // Una hoja sin comentarios no necesita su texto.
            if (!annotations.length) continue;
            const items = (await page.getTextContent()).items.filter((i): i is typeof i & PdfTextItemLike => 'str' in i);
            const lines = groupLines(items);
            const pageNumberLine = etiquetas ? null : pageNumberInBand(lines, page.view, doc.numPages)?.line ?? null;
            hojas.push({
                sheet: n,
                page: printedPage({ sheet: n, label: etiquetas?.[n - 1], lines, view: page.view, numPages: doc.numPages, sheetLabel: opts.sheetLabel }),
                annotations,
                items,
                pageNumberLine,
            });
        }
        return collectNotes(hojas);
    } finally {
        await doc.destroy();
    }
}
