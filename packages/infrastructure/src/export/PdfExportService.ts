import { jsPDF } from 'jspdf';
import anclas from './hebrewMarkAnchors.json';
import {
    IExportService,
    SermonEntity,
    aggregateRequiredAttributions,
    parseSermonDocument,
    sermonBibliographyEntries,
    type InlineRun,
} from '@dosfilos/domain';

/**
 * El sermón en PDF, con fuentes incrustadas.
 *
 * El exportador anterior imprimía el markdown crudo (`**Puntos:**`, `* I.`,
 * `<br />`), adivinaba los títulos por el largo de la línea y usaba las fuentes
 * estándar de jsPDF, que no tienen hebreo: las etiquetas salían como
 * «™,¾ê°ä…» (sermón 6 de Jonás, 2026-10-03). Ahora dibuja el mismo modelo que
 * el Word (`parseSermonDocument`) con Noto Serif (latín y griego) y Noto Serif
 * Hebrew (decisión del fundador: archivo con fuentes incrustadas).
 *
 * jsPDF no ordena de derecha a izquierda ni aplica el posicionamiento de
 * marcas: el hebreo se invierte aquí por grupos (letra + sus vocales) y cada
 * vocal va en el ancla de su letra (`hebrewMarkAnchors.json`). La puntuación
 * pegada a una palabra hebrea va con la fuente latina, en su lugar.
 */

const ANCLAS = anclas as unknown as {
    upm: number;
    marks: Record<string, Array<[number, number, number, number]>>;
    bases: Record<string, Record<string, Record<string, [number, number]>>>;
};

/** Las cinco fuentes, en base64. Inyectable: el navegador las pide, la prueba las lee del disco. */
export type PdfFontLoader = (file: string) => Promise<string>;

const FUENTES = {
    normal: 'NotoSerif-Regular.ttf',
    bold: 'NotoSerif-Bold.ttf',
    italic: 'NotoSerif-Italic.ttf',
    bolditalic: 'NotoSerif-BoldItalic.ttf',
    hebreo: 'NotoSerifHebrew-Regular.ttf',
} as const;

/** Las pide al sitio la primera vez que se exporta; quedan en memoria. */
const cache = new Map<string, Promise<string>>();
export const fetchPdfFont: PdfFontLoader = file => {
    const hit = cache.get(file);
    if (hit) return hit;
    const p = fetch(`/fonts/pdf/${file}`)
        .then(r => {
            if (!r.ok) throw new Error(`No se pudo cargar la fuente ${file}`);
            return r.arrayBuffer();
        })
        .then(buf => {
            let bin = '';
            const bytes = new Uint8Array(buf);
            for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return btoa(bin);
        });
    cache.set(file, p);
    p.catch(() => cache.delete(file));
    return p;
};

const HEBREO = /[֐-׿יִ-ﭏ]/;
/** Sólo signos que se combinan con su letra: maqaf, paseq y sof pasuq son letras de pleno derecho. */
const MARCAS = '\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7';
const MARCA = new RegExp(`[${MARCAS}]`);
/** Una letra con sus vocales y acentos: la unidad que se invierte y se dibuja. */
const GRUPO = new RegExp(`[^${MARCAS}][${MARCAS}]*`, 'g');

/** El hebreo en orden visual: grupos (letra + marcas) al revés. */
export function visualHebrew(word: string): string {
    const grupos: string[] = [];
    for (const ch of word) {
        if (MARCA.test(ch) && grupos.length > 0) grupos[grupos.length - 1] += ch;
        else grupos.push(ch);
    }
    return grupos.reverse().join('');
}

interface Pieza {
    text: string; font: 'serif' | 'hebreo'; bold: boolean; italic: boolean; hebreo: boolean; espacio: boolean;
    /** Sigue pegada a la próxima pieza (misma palabra): no se corta la línea entre ellas. */
    pegado?: boolean;
}

/**
 * Signos que Noto Serif no tiene, por uno que sí: sin esto salían huecos.
 * Lo demás que no esté en la fuente sale en blanco (emoji).
 */
const SUSTITUTOS: Record<string, string> = { '→': '›', '←': '‹', '⇒': '›', '≈': '~', '≥': '>=', '≤': '<=', '✓': '•', '✔': '•' };
function sinGlifo(t: string): string {
    return t.replace(/[→←⇒≈≥≤✓✔]/g, c => SUSTITUTOS[c] ?? c);
}

/** Palabras y espacios con su fuente, en orden lógico. */
function piezasDe(runs: ReadonlyArray<InlineRun>): Pieza[] {
    const out: Pieza[] = [];
    for (const r of runs) {
        for (const parte of r.text.split(/(\s+)/)) {
            if (!parte) continue;
            if (/^\s+$/.test(parte)) {
                out.push({ text: ' ', font: 'serif', bold: !!r.bold, italic: !!r.italic, hebreo: false, espacio: true });
                continue;
            }
            // Dentro de una palabra, el hebreo y lo demás van por separado: la
            // fuente hebrea no tiene paréntesis, comillas, comas ni dígitos, y
            // «(חֶסֶד)» salía con huecos (revisión adversarial de R2).
            for (const trozo of parte.split(/([\u0590-\u05FF\uFB1D-\uFB4F]+)/)) {
                if (!trozo) continue;
                const hebreo = HEBREO.test(trozo);
                out.push({ text: hebreo ? trozo : sinGlifo(trozo), font: hebreo ? 'hebreo' : 'serif', bold: !!r.bold, italic: !!r.italic, hebreo, espacio: false, pegado: true });
            }
            out[out.length - 1]!.pegado = false;
        }
    }
    return out;
}

/** Una línea en orden visual: los tramos hebreos seguidos van de derecha a izquierda. */
function ordenVisual(linea: Pieza[]): Pieza[] {
    const out: Pieza[] = [];
    let i = 0;
    while (i < linea.length) {
        if (!linea[i]!.hebreo) { out.push(linea[i]!); i++; continue; }
        let j = i;
        while (j + 1 < linea.length && (linea[j + 1]!.hebreo || (linea[j + 1]!.espacio && linea[j + 2]?.hebreo))) j++;
        const tramo = linea.slice(i, j + 1).reverse().map(p => (p.hebreo ? { ...p, text: visualHebrew(p.text) } : p));
        out.push(...tramo);
        i = j + 1;
    }
    return out;
}

export class PdfExportService implements IExportService {
    constructor(
        private loadFont: PdfFontLoader = fetchPdfFont,
        /** Inyectable para que una prueba observe lo que se dibuja. */
        private crearDoc: () => jsPDF = () => new jsPDF({ unit: 'mm', format: 'a4' }),
    ) { }

    /** Arma el PDF sin descargarlo (lo usan las pruebas). */
    async buildSermonPdf(sermon: SermonEntity): Promise<jsPDF> {
        const doc = this.crearDoc();
        for (const [estilo, file] of Object.entries(FUENTES)) {
            doc.addFileToVFS(file, await this.loadFont(file));
            if (estilo === 'hebreo') doc.addFont(file, 'NotoHebrew', 'normal', 'Identity-H');
            else doc.addFont(file, 'NotoSerif', estilo, 'Identity-H');
        }
        new Dibujo(doc).sermon(sermon);
        return doc;
    }

    async exportSermonToPdf(sermon: SermonEntity): Promise<void> {
        const doc = await this.buildSermonPdf(sermon);
        doc.save(`${sermon.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    }
}

const PT = 0.3528; // mm por punto
/**
 * Dónde va una marca respecto del origen de su letra, en unidades de la
 * fuente: la primera tabla de anclas que tenga a las dos. `null` si la fuente
 * no la ubica sobre esa letra (no se dibuja: una vocal flotando en otro lado
 * es peor que la letra sola).
 */
export function desplazamientoDeMarca(letra: string, marca: string): { dx: number; dy: number } | null {
    const base = ANCLAS.bases[letra];
    for (const [lookup, clase, mx, my] of ANCLAS.marks[marca] ?? []) {
        const a = base?.[String(lookup)]?.[String(clase)];
        if (a) return { dx: a[0] - mx, dy: a[1] - my };
    }
    return null;
}
const TINTA: [number, number, number] = [31, 41, 55];
const GRIS: [number, number, number] = [107, 114, 128];

class Dibujo {
    private y: number;
    private readonly ancho: number;
    private readonly alto: number;
    private readonly m = { izq: 24, der: 24, sup: 24, inf: 24 };

    constructor(private doc: jsPDF) {
        this.ancho = doc.internal.pageSize.getWidth();
        this.alto = doc.internal.pageSize.getHeight();
        this.y = this.m.sup;
    }

    private get util() { return this.ancho - this.m.izq - this.m.der; }

    private fuente(p: Pick<Pieza, 'font' | 'bold' | 'italic'>, size: number) {
        if (p.font === 'hebreo') this.doc.setFont('NotoHebrew', 'normal');
        else this.doc.setFont('NotoSerif', p.bold && p.italic ? 'bolditalic' : p.bold ? 'bold' : p.italic ? 'italic' : 'normal');
        this.doc.setFontSize(size);
    }

    private ancho_(p: Pieza, size: number) {
        this.fuente(p, size);
        return this.doc.getTextWidth(p.font === 'hebreo' ? visualHebrew(p.text) : p.text);
    }

    private salto(necesita: number) {
        if (this.y + necesita > this.alto - this.m.inf) {
            this.doc.addPage();
            this.y = this.m.sup;
        }
    }

    /**
     * Un párrafo con estilos mezclados, palabra por palabra. `forzar` aplica
     * negrita/cursiva a todo (títulos, notas).
     */
    private parrafo(
        runs: ReadonlyArray<InlineRun>,
        o: { size: number; color?: [number, number, number]; izq?: number; despues?: number; interlinea?: number; forzar?: { bold?: boolean; italic?: boolean }; marca?: string; barra?: boolean },
    ) {
        const izq = this.m.izq + (o.izq ?? 0);
        const util = this.util - (o.izq ?? 0);
        const alto = o.size * PT * (o.interlinea ?? 1.5);
        const piezas = piezasDe(runs).map(p => ({ ...p, bold: p.bold || !!o.forzar?.bold, italic: p.italic || !!o.forzar?.italic }));

        // Palabras = piezas pegadas (hebreo + su puntuación); la línea se
        // corta sólo entre palabras. Una palabra más ancha que la línea (una
        // URL) se parte por letras: antes se salía de la página.
        const palabras: Pieza[][] = [];
        let abierta: Pieza[] = [];
        for (const p of piezas) {
            if (p.espacio) { if (abierta.length) palabras.push(abierta); abierta = []; palabras.push([p]); continue; }
            abierta.push(p);
            if (!p.pegado) { palabras.push(abierta); abierta = []; }
        }
        if (abierta.length) palabras.push(abierta);

        const lineas: Pieza[][] = [[]];
        let usado = 0;
        const cortar = () => {
            const actual = lineas[lineas.length - 1]!;
            while (actual.length && actual[actual.length - 1]!.espacio) actual.pop();
            lineas.push([]);
            usado = 0;
        };
        for (const palabra of palabras) {
            const actual = () => lineas[lineas.length - 1]!;
            if (palabra.length === 1 && palabra[0]!.espacio) {
                if (actual().length > 0) { actual().push(palabra[0]!); usado += this.ancho_(palabra[0]!, o.size); }
                continue;
            }
            const w = palabra.reduce((n, p) => n + this.ancho_(p, o.size), 0);
            if (usado + w > util && actual().length > 0) cortar();
            if (w <= util) {
                actual().push(...palabra);
                usado += w;
                continue;
            }
            for (const p of palabra) {
                for (const letra of p.hebreo ? [p.text] : Array.from(p.text)) {
                    const trozo = { ...p, text: letra };
                    const wl = this.ancho_(trozo, o.size);
                    if (usado + wl > util && actual().length > 0) cortar();
                    actual().push(trozo);
                    usado += wl;
                }
            }
        }
        if (lineas.length > 1 && lineas[lineas.length - 1]!.length === 0) lineas.pop();

        this.doc.setTextColor(...(o.color ?? TINTA));
        lineas.forEach((linea, n) => {
            this.salto(alto);
            if (n === 0 && o.marca) {
                this.fuente({ font: 'serif', bold: false, italic: false }, o.size);
                this.doc.text(o.marca, izq - 5, this.y + o.size * PT);
            }
            if (o.barra) {
                // La barra de la cita, línea por línea: un párrafo que cruza de
                // página la conserva en las dos (antes desaparecía entera).
                this.doc.setDrawColor(199, 210, 254);
                this.doc.setLineWidth(0.9);
                this.doc.line(this.m.izq + 2, this.y, this.m.izq + 2, this.y + alto);
            }
            let x = izq;
            const base = this.y + o.size * PT;
            for (const p of ordenVisual(linea)) {
                this.fuente(p, o.size);
                if (p.hebreo) x = this.hebreo(p.text, x, base);
                else {
                    this.doc.text(p.text, x, base);
                    x += this.doc.getTextWidth(p.text);
                }
            }
            this.y += alto;
        });
        this.y += o.despues ?? 0;
    }

    /**
     * Una palabra hebrea ya en orden visual, letra por letra. jsPDF no aplica
     * el posicionamiento de marcas (GPOS) y cada vocal caía sobre la letra
     * vecina: cada marca va en «ancla de la letra − ancla de la marca», con
     * las anclas de la fuente (`hebrewMarkAnchors.json`).
     */
    private hebreo(texto: string, x: number, base: number): number {
        const escala = this.doc.getFontSize() * PT / ANCLAS.upm;
        for (const grupo of texto.match(GRUPO) ?? []) {
            const letra = grupo[0]!;
            this.doc.text(letra, x, base);
            for (const marca of grupo.slice(1)) {
                const d = desplazamientoDeMarca(letra, marca);
                if (d) this.doc.text(marca, x + d.dx * escala, base - d.dy * escala);
            }
            x += this.doc.getTextWidth(letra);
        }
        return x;
    }

    sermon(sermon: SermonEntity) {
        // Encabezado: título, pasaje y fecha, una raya.
        this.parrafo([{ text: sermon.title }], { size: 22, interlinea: 1.25, forzar: { bold: true }, color: [17, 24, 39], despues: 2 });
        const fecha = sermon.createdAt
            ? new Date(sermon.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
            : null;
        const meta = [sermon.bibleReferences?.length ? sermon.bibleReferences.join(', ') : null, fecha].filter(Boolean).join('  ·  ');
        if (meta) this.parrafo([{ text: meta }], { size: 10.5, color: GRIS, forzar: { italic: true }, despues: 1 });
        this.doc.setDrawColor(209, 213, 219);
        this.doc.setLineWidth(0.3);
        this.doc.line(this.m.izq, this.y, this.ancho - this.m.der, this.y);
        this.y += 8;

        for (const b of parseSermonDocument(sermon.content)) {
            switch (b.kind) {
                case 'heading': {
                    const size = b.level === 1 ? 15 : b.level === 2 ? 12.5 : 11.5;
                    // Un título no queda solo al pie de la página.
                    this.salto(size * PT * 1.4 + 16);
                    this.y += b.level === 1 ? 5 : 3;
                    this.parrafo(b.runs, {
                        size, interlinea: 1.3, despues: 2,
                        forzar: { bold: true, italic: b.level === 3 },
                        color: b.level === 2 ? [30, 58, 138] : [17, 24, 39],
                    });
                    break;
                }
                case 'paragraph':
                    this.parrafo(b.runs, { size: 11, despues: 3 });
                    break;
                case 'list':
                    b.items.forEach((item, i) => this.parrafo(item, {
                        size: 11, izq: 7, despues: 1.2, marca: b.ordered ? `${b.start + i}.` : '•',
                    }));
                    this.y += 2;
                    break;
                case 'quote':
                    for (const par of b.paragraphs) {
                        this.parrafo(par, { size: 10.5, izq: 7, color: [55, 65, 81], despues: 3, barra: true });
                    }
                    break;
            }
        }

        const fuentes = sermonBibliographyEntries(sermon.citationManifest, sermon.bibliography);
        if (fuentes.length > 0) {
            this.salto(30);
            this.y += 6;
            this.parrafo([{ text: 'Fuentes consultadas' }], { size: 13, forzar: { bold: true }, despues: 2 });
            fuentes.forEach((f, i) => {
                const autor = f.author?.trim() ? ` — ${f.author}` : '';
                const pagina = f.page?.trim() ? ` (p. ${f.page})` : '';
                this.parrafo([{ text: `[${i + 1}] `, bold: true }, { text: `${f.title}${autor}${pagina}` }], { size: 10, despues: f.usedFor ? 0.5 : 2 });
                if (f.usedFor) this.parrafo([{ text: f.usedFor, italic: true }], { size: 9.5, izq: 6, color: GRIS, despues: 2 });
            });
        }

        const atribuciones = aggregateRequiredAttributions(sermon.citationManifest);
        if (atribuciones.length > 0) {
            this.y += 4;
            this.parrafo([{ text: 'Atribuciones' }], { size: 12, forzar: { bold: true }, despues: 2 });
            for (const a of atribuciones) {
                this.parrafo([{ text: a.title, bold: true }], { size: 9.5, despues: 0.5 });
                for (const l of a.lines) this.parrafo([{ text: l }], { size: 9, color: GRIS, despues: 0.5 });
            }
        }

        const total = this.doc.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            this.doc.setPage(i);
            this.fuente({ font: 'serif', bold: false, italic: false }, 8.5);
            this.doc.setTextColor(156, 163, 175);
            this.doc.text(`${i} / ${total}`, this.ancho / 2, this.alto - 12, { align: 'center' });
        }
    }
}
