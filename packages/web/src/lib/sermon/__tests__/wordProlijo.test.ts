import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { Sermon } from '@dosfilos/domain';
import { exportSermonToDocx } from '../exportSermonToDocx';

/**
 * El Word del sermón (hallazgo 34 del ejercicio de Jonás): quedaban `<br />`,
 * `>` y `*` literales y los títulos pegados al texto. Se abre el documento y
 * se mira lo que el pastor vería.
 */
const CONTENIDO = [
    '### Ilustración de Apertura',
    '',
    'El pueblo de *París* asaltó la **Bastilla**.',
    '',
    '**Puntos:**',
    '',
    '* I. La inclinación egocéntrica (vv. 5-8)',
    '* II. El apego desmedido (vv. 9-10)',
    '',
    '<br />',
    '',
    '## I. La inclinación egocéntrica',
    '',
    '> **Jonás 4:5-8** — 5 Y salió Jonás de la ciudad.',
    '',
    '* וַיְמַן — Dios prepara.',
].join('\n');

async function xml(): Promise<string> {
    const blob = await exportSermonToDocx({
        id: 's', userId: 'u', title: 'La sombra de Jonás', content: CONTENIDO,
        bibleReferences: ['Jonás 4:5-11'], tags: ['וַיְמַן'], status: 'published',
        createdAt: new Date('2026-10-03'), updatedAt: new Date('2026-10-03'), isShared: false, authorName: 'P', preachingHistory: [],
    } as Sermon);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip.file('word/document.xml')!.async('string');
}

describe('exportSermonToDocx — prolijo', () => {
    it('REGRESIÓN: el salto que puso el pastor es un salto en el Word, dentro del mismo párrafo (LINE_BREAK_RULE)', async () => {
        const blob = await exportSermonToDocx({
            id: 's', userId: 'u', title: 'Saltos', content: '**A nivel institucional**\nHace muchos años observé algo.',
            bibleReferences: [], tags: [], status: 'published',
            createdAt: new Date('2026-10-04'), updatedAt: new Date('2026-10-04'), isShared: false, authorName: 'P', preachingHistory: [],
        } as Sermon);
        const doc = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
        const parrafo = [...doc.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0]).find((p) => p.includes('institucional'))!;
        expect(parrafo).toContain('Hace muchos');
        expect(parrafo.indexOf('<w:br/>')).toBeGreaterThan(parrafo.indexOf('institucional'));
        expect(parrafo.indexOf('<w:br/>')).toBeLessThan(parrafo.indexOf('Hace muchos'));
    });

    it('sin markdown ni HTML literal', async () => {
        const doc = await xml();
        const texto = [...doc.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
        expect(texto).not.toMatch(/&lt;br|\*\*|(^|\|)&gt;|(^|\|)\* /);
        expect(texto).toContain('Bastilla');
    });

    it('títulos con estilo de título, listas con viñetas reales y la cita con sangría', async () => {
        const doc = await xml();
        expect(doc).toMatch(/w:pStyle w:val="Heading1"/);
        expect(doc).toMatch(/w:pStyle w:val="Heading2"/);
        expect((doc.match(/<w:numPr>/g) ?? []).length).toBe(3);
        expect(doc).toMatch(/<w:ind w:left="567"/);
    });

    it('negrita y cursiva como formato, no como asteriscos', async () => {
        const doc = await xml();
        expect(doc).toMatch(/<w:b\/>[\s\S]{0,200}Bastilla/);
        expect(doc).toMatch(/<w:i\/>[\s\S]{0,200}París/);
    });

    it('REGRESIÓN: el subrayado del editor se subraya; no se imprime «<u>» (INLINE_FORMAT_RULE)', async () => {
        const blob = await exportSermonToDocx({
            id: 's', userId: 'u', title: 'T', content: 'Vean.\n<u>Dios es misericordia:</u>\nÉxodo 34:6.',
            bibleReferences: [], tags: [], status: 'published',
            createdAt: new Date('2026-10-03'), updatedAt: new Date('2026-10-03'), isShared: false, authorName: 'P', preachingHistory: [],
        } as Sermon);
        const x = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
        expect(x).not.toMatch(/&lt;\/?u&gt;/);
        expect(x).toMatch(/<w:r><w:rPr>(?:(?!<\/w:rPr>).)*<w:u w:val="single"\/>(?:(?!<\/w:rPr>).)*<\/w:rPr><w:t[^>]*>Dios es misericordia:<\/w:t>/);
        expect(x).not.toMatch(/<w:u w:val="single"\/>(?:(?!<\/w:r>).)*Vean\./);
    });

    it('el hebreo llega tal cual; las etiquetas no se imprimen', async () => {
        const doc = await xml();
        expect((doc.match(/וַיְמַן/g) ?? []).length).toBe(1);
    });
});

describe('exportSermonToDocx — numeradas (revisión adversarial de R2)', () => {
    it('una numerada cortada por un párrafo sigue en su número', async () => {
        const blob = await exportSermonToDocx({
            id: 's', userId: 'u', title: 'T', content: '1. **Primero**\n\nUn párrafo.\n\n2. **Segundo**',
            bibleReferences: [], tags: [], status: 'published', createdAt: new Date(), updatedAt: new Date(),
            isShared: false, authorName: 'P', preachingHistory: [],
        } as Sermon);
        const doc = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
        const texto = [...doc.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('');
        expect(texto).toContain('1.');
        expect(texto).toContain('2.');
        expect(texto.indexOf('2.')).toBeGreaterThan(texto.indexOf('Un párrafo'));
    });
});

describe('exportSermonToDocx — diseño para imprimir', () => {
    async function partes(opciones: Parameters<typeof exportSermonToDocx>[1] = {}) {
        const blob = await exportSermonToDocx({
            id: 's', userId: 'u', title: 'La sombra de Jonás', content: CONTENIDO,
            bibleReferences: ['Jonás 4:5-11'], tags: [], status: 'published',
            createdAt: new Date('2026-10-03'), updatedAt: new Date('2026-10-03'), isShared: false, authorName: 'Pastor', preachingHistory: [],
        } as Sermon, opciones);
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const leer = (re: RegExp) => Promise.all(Object.keys(zip.files).filter(n => re.test(n)).map(n => zip.file(n)!.async('string')));
        return {
            doc: await zip.file('word/document.xml')!.async('string'),
            cabeceras: (await leer(/^word\/header\d*\.xml$/)).join('\n'),
            estilos: await zip.file('word/styles.xml')!.async('string'),
            core: await zip.file('docProps/core.xml')!.async('string'),
        };
    }

    it('la portada y la cornisa nombran al autor y la serie', async () => {
        const { doc, cabeceras, core } = await partes({ author: 'Ricardo Cerda', series: 'Jonás' });
        expect(doc).toContain('Ricardo Cerda');
        expect(doc).toContain('Serie · Jonás');
        expect(cabeceras).toContain('Ricardo Cerda');
        expect(cabeceras).toContain('La sombra de Jonás');
        expect(core).toContain('Ricardo Cerda');
        // La portada no lleva cornisa.
        expect(doc).toMatch(/<w:titlePg\/>/);
    });

    it('sin autor la hoja no nombra a nadie (ni «Pastor»)', async () => {
        const { doc, cabeceras } = await partes();
        expect(doc + cabeceras).not.toMatch(/Pastor/);
    });

    it('Garamond y el acento vino; sin el azul de antes', async () => {
        const { doc, estilos } = await partes();
        expect(estilos).toContain('w:ascii="Garamond"');
        expect(estilos + doc).toContain('7C2626');
        expect(estilos + doc).not.toMatch(/1E3A8A/i);
    });
});
