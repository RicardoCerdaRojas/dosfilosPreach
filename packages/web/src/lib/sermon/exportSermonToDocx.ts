import {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    HeadingLevel,
    LevelFormat,
    Packer,
    PageNumber,
    Paragraph,
    TabStopType,
    TextRun,
} from 'docx';
import {
    aggregateRequiredAttributions,
    parseSermonDocument,
    sermonBibliographyEntries,
    type InlineRun,
    type Sermon,
    type SermonPrintOptions,
} from '@dosfilos/domain';

/**
 * El sermón en Word, para entregarlo o imprimirlo.
 *
 * Se dibuja desde `parseSermonDocument`, el mismo modelo que usa el PDF. Antes
 * se partía el markdown por líneas y quedaban `<br />`, `>` y `*` literales, y
 * los títulos pegados al texto (sermón 6 de Jonás, 2026-10-03).
 *
 * El diseño acompaña al del PDF (pedido del fundador, 2026-10-03: «más
 * premium», sin los títulos azules): Garamond, tinta cálida y un acento color
 * vino; portada con serie, pasaje, florón y autor; secciones en versalitas;
 * cornisa con título y autor desde la segunda página. Garamond viene con
 * Office en Windows y en Mac; incrustar EB Garamond no sirve porque `docx`
 * sólo incrusta la regular y Word sintetizaría la negrita y la cursiva.
 *
 * Las marcas `[N]` de la prosa quedan en línea y se numeran igual que
 * «Fuentes consultadas», al final.
 */
const FUENTE = 'Garamond';
const TINTA = '211D1A';
const GRIS = '766E67';
const ACENTO = '7C2626';
const FILETE = 'CDC4BA';
const CITA = '48403A';
/** 28 mm, como el PDF. */
const MARGEN = 1587;
const ANCHO_UTIL = 11906 - 2 * MARGEN;

const runsDe = (runs: ReadonlyArray<InlineRun>, extra: { italics?: boolean; color?: string; size?: number } = {}) =>
    runs.map(r => r.lineBreak
        // El salto que puso el pastor dentro del párrafo (LINE_BREAK_RULE).
        ? new TextRun({ text: '', break: 1 })
        : new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic || extra.italics,
        // El subrayado del editor (INLINE_FORMAT_RULE).
        ...(r.underline ? { underline: {} } : {}),
        ...(extra.color ? { color: extra.color } : {}),
        ...(extra.size ? { size: extra.size } : {}),
    }));

function fechaDe(sermon: Sermon): string | null {
    const dia = sermon.scheduledDate ?? sermon.createdAt;
    if (!dia) return null;
    return new Date(dia).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

const floron = (antes: number, despues: number) => new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: antes, after: despues },
    children: [new TextRun({ text: '❦', color: ACENTO, size: 26 })],
});

/** Rótulo de sección: versalitas espaciadas, color vino. */
const rotulo = (texto: string, centrado = false) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    ...(centrado ? { alignment: AlignmentType.CENTER } : {}),
    children: [new TextRun({ text: texto })],
    keepNext: true,
});

function portada(sermon: Sermon, opciones: SermonPrintOptions): Paragraph[] {
    const p: Paragraph[] = [];
    const serie = opciones.series?.trim();
    p.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1000, after: 240 },
        children: [new TextRun({ text: serie ? `Serie · ${serie}` : 'Sermón', allCaps: true, characterSpacing: 40, color: ACENTO, size: 17 })],
    }));
    p.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: sermon.title })],
        spacing: { after: 160 },
    }));
    const pasaje = sermon.bibleReferences?.filter(Boolean).join('; ');
    if (pasaje) {
        p.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: pasaje, italics: true, color: GRIS, size: 27 })],
        }));
    }
    p.push(floron(120, 200));
    if (opciones.author) {
        p.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: opciones.author, allCaps: true, characterSpacing: 30, size: 19 })],
        }));
    }
    const fecha = fechaDe(sermon);
    if (fecha) {
        p.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: fecha, italics: true, color: GRIS, size: 21 })],
        }));
    }
    p.push(new Paragraph({ spacing: { after: 360 }, children: [] }));
    return p;
}

export async function exportSermonToDocx(sermon: Sermon, opciones: SermonPrintOptions = {}): Promise<Blob> {
    const p: Paragraph[] = portada(sermon, opciones);

    let listas = 0;
    for (const b of parseSermonDocument(sermon.content)) {
        switch (b.kind) {
            case 'heading':
                if (b.level === 2) {
                    p.push(rotulo(b.runs.map(r => r.text).join('')));
                } else {
                    p.push(new Paragraph({
                        heading: b.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_3,
                        children: runsDe(b.runs),
                        keepNext: true,
                    }));
                }
                break;
            case 'paragraph':
                // Espaciado explícito: algunos lectores ignoran el del estilo por defecto.
                p.push(new Paragraph({ children: runsDe(b.runs), spacing: { after: 160, line: 336 } }));
                break;
            case 'list': {
                // Viñetas con la numeración de Word; las numeradas escriben su
                // número: una lista cortada por un párrafo sigue en el suyo
                // (`start`), y la numeración de Word volvía a 1.
                const instance = listas++;
                b.items.forEach((item, i) => {
                    p.push(b.ordered
                        ? new Paragraph({
                            children: [new TextRun({ text: `${b.start + i}.\t`, color: ACENTO }), ...runsDe(item)],
                            indent: { left: 567, hanging: 340 },
                            tabStops: [{ type: TabStopType.LEFT, position: 567 }],
                            spacing: { after: 80, line: 336 },
                        })
                        : new Paragraph({
                            children: runsDe(item),
                            numbering: { reference: 'vinetas', level: 0, instance },
                            spacing: { after: 80, line: 336 },
                        }));
                });
                break;
            }
            case 'quote':
                for (const par of b.paragraphs) {
                    p.push(new Paragraph({
                        children: runsDe(par, { color: CITA, size: 22 }),
                        indent: { left: 567, right: 227 },
                        border: { left: { style: BorderStyle.SINGLE, size: 6, color: ACENTO, space: 10 } },
                        spacing: { before: 80, after: 160, line: 320 },
                    }));
                }
                break;
        }
    }

    // Florón de cierre: el sermón termina aquí; lo que sigue es aparato.
    p.push(floron(240, 120));

    const fuentes = sermonBibliographyEntries(sermon.citationManifest, sermon.bibliography);
    if (fuentes.length > 0) {
        p.push(rotulo('Fuentes consultadas', true));
        fuentes.forEach((f, i) => {
            const autor = f.author?.trim() ? `, ${f.author}` : '';
            const pagina = f.page?.trim() ? `, p. ${f.page}` : '';
            p.push(new Paragraph({
                children: [
                    new TextRun({ text: `[${i + 1}]\t`, color: GRIS }),
                    new TextRun({ text: f.title, italics: true }),
                    new TextRun({ text: `${autor}${pagina}.` }),
                ],
                indent: { left: 454, hanging: 454 },
                tabStops: [{ type: TabStopType.LEFT, position: 454 }],
                spacing: { after: f.usedFor ? 20 : 100 },
            }));
            if (f.usedFor) {
                p.push(new Paragraph({
                    children: [new TextRun({ text: f.usedFor, color: GRIS, size: 19 })],
                    indent: { left: 454 },
                    spacing: { after: 100 },
                }));
            }
        });
    }

    const atribuciones = aggregateRequiredAttributions(sermon.citationManifest);
    if (atribuciones.length > 0) {
        p.push(rotulo('Atribuciones', true));
        for (const a of atribuciones) {
            p.push(new Paragraph({ children: [new TextRun({ text: a.title, bold: true, size: 19 })], spacing: { after: 40 } }));
            for (const linea of a.lines) {
                p.push(new Paragraph({ children: [new TextRun({ text: linea, size: 18, color: GRIS })], spacing: { after: 40 } }));
            }
        }
    }

    const folio = new Footer({
        children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], color: GRIS, size: 20 })],
        })],
    });

    const doc = new Document({
        creator: opciones.author || 'Preach',
        title: sermon.title,
        styles: {
            default: {
                document: { run: { font: FUENTE, size: 24, color: TINTA }, paragraph: { spacing: { after: 160, line: 336 } } },
                title: { run: { font: FUENTE, size: 54, color: TINTA }, paragraph: { spacing: { after: 160, line: 260 } } },
                heading1: { run: { font: FUENTE, size: 34, color: TINTA }, paragraph: { spacing: { before: 480, after: 160 } } },
                heading2: { run: { font: FUENTE, size: 19, bold: true, allCaps: true, characterSpacing: 30, color: ACENTO }, paragraph: { spacing: { before: 300, after: 80 } } },
                heading3: { run: { font: FUENTE, size: 25, italics: true, color: TINTA }, paragraph: { spacing: { before: 200, after: 80 } } },
            },
        },
        numbering: {
            config: [
                {
                    reference: 'vinetas',
                    levels: [{
                        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 567, hanging: 283 } }, run: { color: ACENTO } },
                    }],
                },
            ],
        },
        sections: [{
            properties: {
                titlePage: true,
                page: { margin: { top: 1531, bottom: 1417, left: MARGEN, right: MARGEN, header: 794 } },
            },
            headers: {
                // La primera página es la portada: sin cornisa.
                first: new Header({ children: [] }),
                default: new Header({
                    children: [new Paragraph({
                        tabStops: [{ type: TabStopType.RIGHT, position: ANCHO_UTIL }],
                        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: FILETE, space: 4 } },
                        children: [
                            new TextRun({ text: sermon.title, allCaps: true, characterSpacing: 20, color: GRIS, size: 15 }),
                            ...(opciones.author ? [new TextRun({ text: `\t${opciones.author}`, italics: true, color: GRIS, size: 18 })] : []),
                        ],
                    })],
                }),
            },
            footers: { first: folio, default: folio },
            children: p,
        }],
    });

    return Packer.toBlob(doc);
}
