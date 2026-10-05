import { jsPDF } from 'jspdf';
import anclas from './hebrewMarkAnchors.json';
import {
    IExportService,
    SermonEntity,
    aggregateRequiredAttributions,
    parseSermonDocument,
    sermonBibliographyEntries,
    sermonFileName,
    type InlineRun,
    type SermonPrintOptions,
} from '@dosfilos/domain';

/**
 * El sermón en PDF, con fuentes incrustadas, compuesto como un libro.
 *
 * El exportador anterior imprimía el markdown crudo (`**Puntos:**`, `* I.`,
 * `<br />`), adivinaba los títulos por el largo de la línea y usaba las fuentes
 * estándar de jsPDF, que no tienen hebreo: las etiquetas salían como
 * «™,¾ê°ä…» (sermón 6 de Jonás, 2026-10-03). Ahora dibuja el mismo modelo que
 * el Word (`parseSermonDocument`).
 *
 * El diseño es para imprimir (pedido del fundador, 2026-10-03: «más premium»,
 * sin los títulos azules de documento de oficina): EB Garamond (latín y
 * griego), tinta cálida y un solo acento color vino; portada con serie, pasaje,
 * florón y autor; versalitas espaciadas para las secciones; cornisa con título
 * y autor desde la segunda página. El hebreo va en Noto Serif Hebrew.
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

/** «bold» es la seminegrita: la negrita plena de Garamond pesa demasiado en la página. */
const FUENTES = {
    normal: 'EBGaramond-Regular.ttf',
    bold: 'EBGaramond-SemiBold.ttf',
    italic: 'EBGaramond-Italic.ttf',
    bolditalic: 'EBGaramond-SemiBoldItalic.ttf',
    hebreo: 'NotoSerifHebrew-Regular.ttf',
} as const;
const SERIF = 'EBGaramond';

/** Las pide al sitio la primera vez que se exporta; quedan en memoria. */
const cache = new Map<string, Promise<string>>();
export const fetchPdfFont: PdfFontLoader = file => {
    const hit = cache.get(file);
    if (hit) return hit;
    const p = fetch(`/fonts/pdf/${file}`)
        .then(r => {
            // Una fuente que no existe no da 404: Hosting reescribe a
            // index.html con 200, y jsPDF fallaba después con un error oscuro.
            if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) {
                throw new Error(`No se pudo cargar la fuente ${file}`);
            }
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
    /** Un salto de línea que puso el pastor: corta la línea acá. */
    salto?: boolean;
}

/**
 * Signos que la fuente latina no tiene, por uno que sí: sin esto salían huecos.
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
        // El salto que puso el pastor dentro del párrafo (LINE_BREAK_RULE):
        // una pieza propia que corta la línea.
        if (r.lineBreak) {
            out.push({ text: '', font: 'serif', bold: false, italic: false, hebreo: false, espacio: false, salto: true });
            continue;
        }
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
    async buildSermonPdf(sermon: SermonEntity, opciones: SermonPrintOptions = {}): Promise<jsPDF> {
        const doc = this.crearDoc();
        for (const [estilo, file] of Object.entries(FUENTES)) {
            doc.addFileToVFS(file, await this.loadFont(file));
            if (estilo === 'hebreo') doc.addFont(file, 'NotoHebrew', 'normal', 'Identity-H');
            else doc.addFont(file, SERIF, estilo, 'Identity-H');
        }
        doc.setProperties({ title: sermon.title, author: opciones.author ?? '', creator: 'Preach' });
        new Dibujo(doc).sermon(sermon, opciones);
        return doc;
    }

    async exportSermonToPdf(sermon: SermonEntity, opciones: SermonPrintOptions = {}): Promise<void> {
        const doc = await this.buildSermonPdf(sermon, opciones);
        doc.save(sermonFileName(sermon.title, 'pdf'));
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
type RGB = [number, number, number];
/** Tinta cálida, gris piedra y un solo acento color vino: nada de azul de oficina. */
const TINTA: RGB = [33, 29, 26];
const GRIS: RGB = [118, 110, 103];
const ACENTO: RGB = [124, 38, 38];
const FILETE: RGB = [205, 196, 186];
const CITA: RGB = [72, 64, 58];
/** Noto Hebrew se ve más grande que Garamond al mismo cuerpo. */
const HEBREO_CUERPO = 0.88;
/** Cuerpo 12 y márgenes de 28 mm: ~85 caracteres por línea, legible desde el atril. */
const CUERPO = 12;

interface OpcionesParrafo {
    size: number;
    color?: RGB;
    izq?: number;
    der?: number;
    despues?: number;
    interlinea?: number;
    forzar?: { bold?: boolean; italic?: boolean };
    /** Viñeta, número o `[n]`, alineado a la derecha en la sangría. */
    marca?: string;
    colorMarca?: RGB;
    barra?: boolean;
    centrar?: boolean;
    /** Espacio entre letras, en mm: las versalitas lo piden. */
    espaciado?: number;
}

const enVersalitas = (runs: ReadonlyArray<InlineRun>): InlineRun[] =>
    runs.map(r => ({ ...r, text: r.text.toLocaleUpperCase('es') }));

class Dibujo {
    private y: number;
    private readonly ancho: number;
    private readonly alto: number;
    private readonly m = { izq: 28, der: 28, sup: 27, inf: 25 };

    constructor(private doc: jsPDF) {
        this.ancho = doc.internal.pageSize.getWidth();
        this.alto = doc.internal.pageSize.getHeight();
        this.y = this.m.sup;
    }

    private get util() { return this.ancho - this.m.izq - this.m.der; }

    private fuente(p: Pick<Pieza, 'font' | 'bold' | 'italic'>, size: number) {
        if (p.font === 'hebreo') {
            this.doc.setFont('NotoHebrew', 'normal');
            this.doc.setFontSize(size * HEBREO_CUERPO);
            return;
        }
        this.doc.setFont(SERIF, p.bold && p.italic ? 'bolditalic' : p.bold ? 'bold' : p.italic ? 'italic' : 'normal');
        this.doc.setFontSize(size);
    }

    private ancho_(p: Pieza, size: number, espaciado = 0) {
        this.fuente(p, size);
        if (p.font === 'hebreo') return this.doc.getTextWidth(visualHebrew(p.text));
        return this.doc.getTextWidth(p.text) + espaciado * Array.from(p.text).length;
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
    private parrafo(runs: ReadonlyArray<InlineRun>, o: OpcionesParrafo) {
        const izq = this.m.izq + (o.izq ?? 0);
        const util = this.util - (o.izq ?? 0) - (o.der ?? 0);
        const alto = o.size * PT * (o.interlinea ?? 1.5);
        const esp = o.espaciado ?? 0;
        const piezas = piezasDe(runs).map(p => ({ ...p, bold: p.bold || !!o.forzar?.bold, italic: p.italic || !!o.forzar?.italic }));

        // Palabras = piezas pegadas (hebreo + su puntuación); la línea se
        // corta sólo entre palabras. Una palabra más ancha que la línea (una
        // URL) se parte por letras: antes se salía de la página.
        const palabras: Pieza[][] = [];
        let abierta: Pieza[] = [];
        for (const p of piezas) {
            if (p.espacio || p.salto) { if (abierta.length) palabras.push(abierta); abierta = []; palabras.push([p]); continue; }
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
            if (palabra[0]!.salto) {
                cortar();
                continue;
            }
            if (palabra.length === 1 && palabra[0]!.espacio) {
                if (actual().length > 0) { actual().push(palabra[0]!); usado += this.ancho_(palabra[0]!, o.size, esp); }
                continue;
            }
            const w = palabra.reduce((n, p) => n + this.ancho_(p, o.size, esp), 0);
            if (usado + w > util && actual().length > 0) cortar();
            if (w <= util) {
                actual().push(...palabra);
                usado += w;
                continue;
            }
            for (const p of palabra) {
                for (const letra of p.hebreo ? [p.text] : Array.from(p.text)) {
                    const trozo = { ...p, text: letra };
                    const wl = this.ancho_(trozo, o.size, esp);
                    if (usado + wl > util && actual().length > 0) cortar();
                    actual().push(trozo);
                    usado += wl;
                }
            }
        }
        if (lineas.length > 1 && lineas[lineas.length - 1]!.length === 0) lineas.pop();

        lineas.forEach((linea, n) => {
            this.salto(alto);
            const base = this.y + o.size * PT;
            if (n === 0 && o.marca) {
                this.fuente({ font: 'serif', bold: false, italic: false }, o.size);
                this.doc.setTextColor(...(o.colorMarca ?? o.color ?? TINTA));
                this.doc.text(o.marca, izq - 1.8, base, { align: 'right' });
            }
            if (o.barra) {
                // La barra de la cita, línea por línea: un párrafo que cruza de
                // página la conserva en las dos.
                this.doc.setDrawColor(...ACENTO);
                this.doc.setLineWidth(0.3);
                this.doc.line(this.m.izq + 3, this.y + 0.6, this.m.izq + 3, this.y + alto + 0.6);
            }
            const visual = ordenVisual(linea);
            let x = izq;
            if (o.centrar) {
                const w = visual.reduce((t, p) => t + this.ancho_(p, o.size, esp), 0);
                x = izq + Math.max(0, (util - w) / 2);
            }
            this.doc.setTextColor(...(o.color ?? TINTA));
            for (const p of visual) {
                this.fuente(p, o.size);
                if (p.hebreo) x = this.hebreo(p.text, x, base);
                else {
                    this.doc.text(p.text, x, base, esp ? { charSpace: esp } : undefined);
                    x += this.doc.getTextWidth(p.text) + esp * Array.from(p.text).length;
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

    /** Dos filetes y un florón al centro: separa la portada y cierra el sermón. */
    private ornamento(despues = 7) {
        const cx = this.ancho / 2;
        const y = this.y + 2.2;
        this.doc.setDrawColor(...FILETE);
        this.doc.setLineWidth(0.25);
        this.doc.line(cx - 30, y, cx - 5.5, y);
        this.doc.line(cx + 5.5, y, cx + 30, y);
        this.fuente({ font: 'serif', bold: false, italic: false }, 13);
        this.doc.setTextColor(...ACENTO);
        this.doc.text('❦', cx, y + 1.6, { align: 'center' });
        this.y += 4.4 + despues;
    }

    /** Título de sección en versalitas espaciadas, color vino. */
    private rotulo(runs: ReadonlyArray<InlineRun>, o: { centrar?: boolean; antes?: number; despues?: number } = {}) {
        this.salto(9.5 * PT * 1.3 + 16);
        this.y += o.antes ?? 4.5;
        this.parrafo(enVersalitas(runs), {
            size: 9.5, interlinea: 1.35, espaciado: 0.55, forzar: { bold: true }, color: ACENTO,
            centrar: o.centrar, despues: o.despues ?? 2,
        });
    }

    private portada(sermon: SermonEntity, opciones: SermonPrintOptions) {
        this.y = 40;
        const serie = opciones.series?.trim();
        this.parrafo([{ text: (serie ? `Serie · ${serie}` : 'Sermón').toLocaleUpperCase('es') }], {
            size: 8.5, color: ACENTO, centrar: true, espaciado: 0.9, interlinea: 1.4, despues: 5, izq: 10, der: 10,
        });
        this.parrafo([{ text: sermon.title }], { size: 27, interlinea: 1.12, centrar: true, despues: 3.5, izq: 6, der: 6 });
        const pasaje = sermon.bibleReferences?.filter(Boolean).join('; ');
        if (pasaje) this.parrafo([{ text: pasaje }], { size: 13.5, forzar: { italic: true }, centrar: true, color: GRIS, despues: 4 });
        this.ornamento(5);
        if (opciones.author) {
            this.parrafo([{ text: opciones.author.toLocaleUpperCase('es') }], { size: 9.5, espaciado: 0.7, centrar: true, despues: 0.8 });
        }
        const dia = sermon.scheduledDate ?? sermon.createdAt;
        if (dia) {
            const fecha = new Date(dia).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            this.parrafo([{ text: fecha }], { size: 10.5, forzar: { italic: true }, centrar: true, color: GRIS });
        }
        this.y += 13;
    }

    sermon(sermon: SermonEntity, opciones: SermonPrintOptions = {}) {
        this.portada(sermon, opciones);

        for (const b of parseSermonDocument(sermon.content)) {
            switch (b.kind) {
                case 'heading':
                    if (b.level === 1) {
                        // Un punto no queda solo al pie de la página.
                        this.salto(17 * PT * 1.25 + 24);
                        this.y += 7;
                        this.parrafo(b.runs, { size: 17, interlinea: 1.2, despues: 1.8 });
                        this.doc.setDrawColor(...ACENTO);
                        this.doc.setLineWidth(0.4);
                        this.doc.line(this.m.izq, this.y, this.m.izq + 14, this.y);
                        this.y += 5;
                    } else if (b.level === 2) {
                        this.rotulo(b.runs);
                    } else {
                        this.salto(12.5 * PT * 1.3 + 14);
                        this.y += 2;
                        this.parrafo(b.runs, { size: 12.5, interlinea: 1.3, forzar: { italic: true }, despues: 1.2 });
                    }
                    break;
                case 'paragraph':
                    this.parrafo(b.runs, { size: CUERPO, interlinea: 1.42, despues: 2.8 });
                    break;
                case 'list':
                    b.items.forEach((item, i) => this.parrafo(item, {
                        size: CUERPO, interlinea: 1.42, izq: 6.5, despues: 1.4,
                        marca: b.ordered ? `${b.start + i}.` : '•', colorMarca: ACENTO,
                    }));
                    this.y += 1.6;
                    break;
                case 'quote':
                    for (const par of b.paragraphs) {
                        this.parrafo(par, { size: 11, interlinea: 1.4, izq: 8, der: 4, color: CITA, despues: 2.6, barra: true });
                    }
                    this.y += 0.8;
                    break;
            }
        }

        // Florón de cierre: el sermón termina aquí; lo que sigue es aparato.
        this.salto(14);
        this.y += 5;
        this.ornamento(4);

        const fuentes = sermonBibliographyEntries(sermon.citationManifest, sermon.bibliography);
        if (fuentes.length > 0) {
            this.rotulo([{ text: 'Fuentes consultadas' }], { centrar: true, antes: 4, despues: 4 });
            fuentes.forEach((f, i) => {
                const autor = f.author?.trim() ? `, ${f.author}` : '';
                const pagina = f.page?.trim() ? `, p. ${f.page}` : '';
                this.parrafo([{ text: f.title, italic: true }, { text: `${autor}${pagina}.` }], {
                    size: 10.5, interlinea: 1.35, izq: 8, marca: `[${i + 1}]`, colorMarca: GRIS, despues: f.usedFor ? 0.4 : 1.8,
                });
                if (f.usedFor) this.parrafo([{ text: f.usedFor }], { size: 9.5, interlinea: 1.35, izq: 8, color: GRIS, despues: 1.8 });
            });
        }

        const atribuciones = aggregateRequiredAttributions(sermon.citationManifest);
        if (atribuciones.length > 0) {
            this.rotulo([{ text: 'Atribuciones' }], { centrar: true, antes: 6, despues: 3 });
            for (const a of atribuciones) {
                this.parrafo([{ text: a.title, bold: true }], { size: 9.5, interlinea: 1.35, despues: 0.5 });
                for (const l of a.lines) this.parrafo([{ text: l }], { size: 9, interlinea: 1.35, color: GRIS, despues: 0.5 });
            }
        }

        this.cornisasYFolios(sermon.title, opciones.author ?? null);
    }

    /**
     * Folio al pie de cada página; desde la segunda, cornisa con el título a la
     * izquierda y el autor a la derecha, sobre un filete.
     */
    private cornisasYFolios(titulo: string, autor: string | null) {
        const total = this.doc.getNumberOfPages();
        const yCornisa = 15;
        for (let i = 1; i <= total; i++) {
            this.doc.setPage(i);
            this.fuente({ font: 'serif', bold: false, italic: false }, 10);
            this.doc.setTextColor(...GRIS);
            this.doc.text(String(i), this.ancho / 2, this.alto - 13, { align: 'center' });
            if (i === 1) continue;

            const derecha = autor ?? '';
            this.fuente({ font: 'serif', bold: false, italic: true }, 9);
            const wDerecha = derecha ? this.doc.getTextWidth(derecha) + 6 : 0;
            if (derecha) this.doc.text(derecha, this.ancho - this.m.der, yCornisa, { align: 'right' });

            this.fuente({ font: 'serif', bold: false, italic: false }, 7.5);
            const esp = 0.45;
            const cabe = this.util - wDerecha;
            const anchoDe = (t: string) => this.doc.getTextWidth(t) + esp * Array.from(t).length;
            let izquierda = titulo.toLocaleUpperCase('es');
            if (anchoDe(izquierda) > cabe) {
                const palabras = izquierda.split(/\s+/);
                while (palabras.length > 1 && anchoDe(`${palabras.join(' ')} …`) > cabe) palabras.pop();
                izquierda = `${palabras.join(' ')} …`;
            }
            this.doc.text(izquierda, this.m.izq, yCornisa, { charSpace: esp });

            this.doc.setDrawColor(...FILETE);
            this.doc.setLineWidth(0.2);
            this.doc.line(this.m.izq, yCornisa + 2.4, this.ancho - this.m.der, yCornisa + 2.4);
        }
    }
}
