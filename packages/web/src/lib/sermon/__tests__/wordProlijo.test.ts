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
