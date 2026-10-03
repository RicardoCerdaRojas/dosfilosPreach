import {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
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
} from '@dosfilos/domain';

/**
 * El sermón en Word, para entregarlo o imprimirlo.
 *
 * Se dibuja desde `parseSermonDocument`, el mismo modelo que usa el PDF. Antes
 * se partía el markdown por líneas y quedaban `<br />`, `>` y `*` literales, y
 * los títulos pegados al texto (sermón 6 de Jonás, 2026-10-03).
 *
 * Las marcas `[N]` de la prosa quedan en línea y se numeran igual que
 * «Fuentes consultadas», al final.
 */
const FUENTE = 'Georgia';
const GRIS = '666666';
const TINTA = '1F2937';

const runsDe = (runs: ReadonlyArray<InlineRun>, extra: { italics?: boolean; color?: string; size?: number } = {}) =>
    runs.map(r => new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic || extra.italics,
        ...(extra.color ? { color: extra.color } : {}),
        ...(extra.size ? { size: extra.size } : {}),
    }));

function fechaDe(sermon: Sermon): string | null {
    if (!sermon.createdAt) return null;
    return new Date(sermon.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function exportSermonToDocx(sermon: Sermon): Promise<Blob> {
    const p: Paragraph[] = [];

    p.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: sermon.title })],
        spacing: { after: 120 },
    }));
    const meta = [
        sermon.bibleReferences?.length ? sermon.bibleReferences.join(', ') : null,
        fechaDe(sermon),
    ].filter(Boolean).join('  ·  ');
    if (meta) {
        p.push(new Paragraph({
            children: [new TextRun({ text: meta, italics: true, color: GRIS })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D1D5DB', space: 8 } },
            spacing: { after: 360 },
        }));
    }

    let listas = 0;
    for (const b of parseSermonDocument(sermon.content)) {
        switch (b.kind) {
            case 'heading':
                p.push(new Paragraph({
                    heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
                    children: runsDe(b.runs),
                    keepNext: true,
                }));
                break;
            case 'paragraph':
                // Espaciado explícito: algunos lectores ignoran el del estilo por defecto.
                p.push(new Paragraph({ children: runsDe(b.runs), spacing: { after: 200, line: 300 } }));
                break;
            case 'list': {
                // Viñetas con la numeración de Word; las numeradas escriben su
                // número: una lista cortada por un párrafo sigue en el suyo
                // (`start`), y la numeración de Word volvía a 1.
                const instance = listas++;
                b.items.forEach((item, i) => {
                    p.push(b.ordered
                        ? new Paragraph({
                            children: [new TextRun({ text: `${b.start + i}.\t` }), ...runsDe(item)],
                            indent: { left: 567, hanging: 340 },
                            tabStops: [{ type: TabStopType.LEFT, position: 567 }],
                            spacing: { after: 80, line: 300 },
                        })
                        : new Paragraph({
                            children: runsDe(item),
                            numbering: { reference: 'vinetas', level: 0, instance },
                            spacing: { after: 80, line: 300 },
                        }));
                });
                break;
            }
            case 'quote':
                for (const par of b.paragraphs) {
                    p.push(new Paragraph({
                        children: runsDe(par, { color: '374151' }),
                        indent: { left: 567, right: 283 },
                        border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'C7D2FE', space: 12 } },
                        spacing: { before: 120, after: 200, line: 300 },
                    }));
                }
                break;
        }
    }

    const fuentes = sermonBibliographyEntries(sermon.citationManifest, sermon.bibliography);
    if (fuentes.length > 0) {
        p.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Fuentes consultadas' })], pageBreakBefore: false }));
        fuentes.forEach((f, i) => {
            const autor = f.author?.trim() ? ` — ${f.author}` : '';
            const pagina = f.page?.trim() ? ` (p. ${f.page})` : '';
            p.push(new Paragraph({
                children: [new TextRun({ text: `[${i + 1}] `, bold: true }), new TextRun({ text: `${f.title}${autor}${pagina}` })],
                spacing: { after: f.usedFor ? 40 : 100 },
            }));
            if (f.usedFor) {
                p.push(new Paragraph({
                    children: [new TextRun({ text: f.usedFor, italics: true, color: GRIS, size: 20 })],
                    indent: { left: 360 },
                    spacing: { after: 100 },
                }));
            }
        });
    }

    const atribuciones = aggregateRequiredAttributions(sermon.citationManifest);
    if (atribuciones.length > 0) {
        p.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Atribuciones' })] }));
        for (const a of atribuciones) {
            p.push(new Paragraph({ children: [new TextRun({ text: a.title, bold: true, size: 20 })], spacing: { after: 40 } }));
            for (const linea of a.lines) {
                p.push(new Paragraph({ children: [new TextRun({ text: linea, size: 20, color: GRIS })], spacing: { after: 40 } }));
            }
        }
    }

    const doc = new Document({
        creator: 'Preach',
        title: sermon.title,
        styles: {
            default: {
                document: { run: { font: FUENTE, size: 24, color: TINTA }, paragraph: { spacing: { after: 160, line: 300 } } },
                title: { run: { font: FUENTE, size: 48, bold: true, color: '111827' } },
                heading1: { run: { font: FUENTE, size: 30, bold: true, color: '111827' }, paragraph: { spacing: { before: 400, after: 160 } } },
                heading2: { run: { font: FUENTE, size: 26, bold: true, color: '1E3A8A' }, paragraph: { spacing: { before: 280, after: 120 } } },
                heading3: { run: { font: FUENTE, size: 24, bold: true, italics: true, color: '374151' }, paragraph: { spacing: { before: 200, after: 80 } } },
            },
        },
        numbering: {
            config: [
                {
                    reference: 'vinetas',
                    levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }],
                },
            ],
        },
        sections: [{
            properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ children: [PageNumber.CURRENT], color: '9CA3AF', size: 18 })],
                    })],
                }),
            },
            children: p,
        }],
    });

    return Packer.toBlob(doc);
}
