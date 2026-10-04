import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SermonEntity, type SermonPrintOptions } from '@dosfilos/domain';
import { PdfExportService, desplazamientoDeMarca, fetchPdfFont, visualHebrew } from '../PdfExportService';

/**
 * El PDF del sermón (hallazgo 34 del ejercicio de Jonás): imprimía markdown
 * crudo y el hebreo como «™,¾ê°ä…». Ahora fuentes incrustadas, hebreo en orden
 * visual y cada vocal en el ancla de su letra.
 */
const FUENTES = join(__dirname, '../../../../web/public/fonts/pdf');
const cargar = async (file: string) => readFileSync(join(FUENTES, file)).toString('base64');

describe('hebreo en el PDF', () => {
    it('orden visual: las letras al revés, cada vocal con su letra', () => {
        expect(visualHebrew('וַיְמַן')).toBe('ןמַיְוַ');
    });

    it('la vocal va en el ancla de su letra, según la fuente', () => {
        // patach sobre mem: ancla de mem (329, 0) − ancla de patach (139, 0).
        expect(desplazamientoDeMarca('מ', 'ַ')).toEqual({ dx: 190, dy: 0 });
        // jolem: el glifo ya trae su altura; el ancla sólo lo corre en horizontal (dy 0).
        expect(desplazamientoDeMarca('\u05D5', '\u05B9')).toEqual({ dx: 134, dy: 0 });
        expect(desplazamientoDeMarca('a', 'ַ')).toBeNull();
    });
});

describe('PdfExportService.buildSermonPdf', () => {
    it('arma el sermón con las cinco fuentes y numera las páginas', async () => {
        const pedidas: string[] = [];
        const svc = new PdfExportService(async f => { pedidas.push(f); return cargar(f); });
        const sermon = SermonEntity.create({
            id: 's', userId: 'u', title: 'La sombra de Jonás', status: 'published',
            content: '## I. Dios prepara\n\n**וַיְמַן** — Dios *prepara* la planta.\n\n* uno\n* dos\n\n> **Jonás 4:6** — Y preparó Jehová Dios una calabacera.',
            bibleReferences: ['Jonás 4:5-11'], tags: [], createdAt: new Date(), updatedAt: new Date(),
        } as never);
        const doc = await svc.buildSermonPdf(sermon);
        expect(pedidas.sort()).toEqual(['EBGaramond-Italic.ttf', 'EBGaramond-Regular.ttf', 'EBGaramond-SemiBold.ttf', 'EBGaramond-SemiBoldItalic.ttf', 'NotoSerifHebrew-Regular.ttf']);
        expect(doc.getNumberOfPages()).toBe(1);
        const fuentes = Object.values(doc.getFontList()).flat();
        expect(Object.keys(doc.getFontList())).toEqual(expect.arrayContaining(['EBGaramond', 'NotoHebrew']));
        expect(fuentes.length).toBeGreaterThan(0);
    }, 60000);
});

describe('PdfExportService — lo que se dibuja (revisión adversarial de R2)', () => {
    async function dibujado(content: string, opciones: SermonPrintOptions = {}, extra: Record<string, unknown> = {}) {
        const { jsPDF } = await import('jspdf');
        const llamadas: Array<{ text: string; x: number; y: number; font: string; page: number }> = [];
        const svc = new PdfExportService(cargar, () => {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const original = doc.text.bind(doc);
            doc.text = ((t: string, x: number, y: number, ...resto: unknown[]) => {
                llamadas.push({ text: String(t), x, y, font: doc.getFont().fontName, page: doc.getCurrentPageInfo().pageNumber });
                return (original as (...a: unknown[]) => unknown)(t, x, y, ...resto);
            }) as typeof doc.text;
            return doc;
        });
        await svc.buildSermonPdf(SermonEntity.create({
            id: 's', userId: 'u', title: 'Prueba del PDF', status: 'published', content,
            bibleReferences: [], tags: [], createdAt: new Date(), updatedAt: new Date(), ...extra,
        } as never), opciones);
        return llamadas;
    }

    it('REGRESIÓN: el salto que puso el pastor corta la línea (LINE_BREAK_RULE)', async () => {
        const l = await dibujado('**A nivel institucional**\nHace muchos años.');
        const etiqueta = l.find((x) => x.text === 'institucional')!;
        const hace = l.find((x) => x.text === 'Hace')!;
        // «Hace» va en el renglón siguiente y arranca en el margen, como la etiqueta.
        expect(hace.y).toBeGreaterThan(etiqueta.y);
        expect(hace.x).toBeCloseTo(l.find((x) => x.text === 'A')!.x, 1);
    }, 60000);

        it('la puntuación pegada al hebreo va con la fuente latina, y el hebreo con la suya', async () => {
        const l = await dibujado('La palabra (חֶסֶד) significa.');
        expect(l.find(x => x.text === '(')?.font).toBe('EBGaramond');
        expect(l.find(x => x.text === ')')?.font).toBe('EBGaramond');
        expect(l.filter(x => x.font === 'NotoHebrew').map(x => x.text).join('')).toContain('ד');
    });

    it('el maqaf y el sof pasuq se dibujan (no son vocales)', async () => {
        const l = await dibujado('כָּל־הָעָם׃');
        const hebreo = l.filter(x => x.font === 'NotoHebrew').map(x => x.text);
        expect(hebreo).toContain('־');
        expect(hebreo).toContain('׃');
    });

    it('una palabra más ancha que la línea se parte y no se sale de la página', async () => {
        const l = await dibujado('https://' + 'x'.repeat(400) + '.com');
        const deLaUrl = l.filter(x => x.text === 'x');
        // Ninguna letra pasa el margen derecho, y la palabra ocupa varias líneas.
        expect(Math.max(...deLaUrl.map(x => x.x))).toBeLessThan(210 - 20);
        expect(new Set(deLaUrl.map(x => x.y)).size).toBeGreaterThan(1);
    });

    it('una numerada cortada sigue en su número; una flecha no queda en blanco', async () => {
        const l = await dibujado('1. Primero\n\nPárrafo.\n\n2. Segundo → tercero');
        expect(l.map(x => x.text)).toEqual(expect.arrayContaining(['1.', '2.', '›']));
    });

});

describe('PdfExportService — portada y cornisa (diseño para imprimir)', () => {
    async function dibujado(content: string, opciones: SermonPrintOptions = {}) {
        const { jsPDF } = await import('jspdf');
        const llamadas: Array<{ text: string; x: number; y: number; page: number }> = [];
        let doc!: InstanceType<typeof jsPDF>;
        const svc = new PdfExportService(cargar, () => {
            doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const original = doc.text.bind(doc);
            doc.text = ((t: string, x: number, y: number, ...resto: unknown[]) => {
                llamadas.push({ text: String(t), x, y, page: doc.getCurrentPageInfo().pageNumber });
                return (original as (...a: unknown[]) => unknown)(t, x, y, ...resto);
            }) as typeof doc.text;
            return doc;
        });
        await svc.buildSermonPdf(SermonEntity.create({
            id: 's', userId: 'u', title: 'Compasión temporal', status: 'published', content,
            bibleReferences: ['Jonás 4:5-11'], tags: [], createdAt: new Date(2026, 9, 3), updatedAt: new Date(),
        } as never), opciones);
        return { llamadas, doc };
    }
    const largo = Array.from({ length: 40 }, (_, i) => `Párrafo ${i} con texto suficiente para llenar la línea entera de la página impresa.`).join('\n\n');

    it('la portada nombra al autor, la serie y el pasaje', async () => {
        const { llamadas, doc } = await dibujado('Texto.', { author: 'Ricardo Cerda', series: 'Jonás' });
        const textos = llamadas.filter(l => l.page === 1).map(l => l.text);
        expect(textos).toEqual(expect.arrayContaining(['RICARDO', 'CERDA', 'SERIE', 'JONÁS', 'Jonás', '4:5-11']));
        expect(doc.output()).toContain('/Author (Ricardo Cerda)');
    });

    it('sin autor la hoja no nombra a nadie (ni «Pastor»)', async () => {
        const { llamadas } = await dibujado(largo);
        expect(llamadas.some(l => /pastor/i.test(l.text))).toBe(false);
        expect(llamadas.filter(l => l.page === 1).map(l => l.text)).toContain('SERMÓN');
    });

    it('desde la segunda página, cornisa con título y autor arriba; la primera no la lleva', async () => {
        const { llamadas, doc } = await dibujado(largo, { author: 'Ricardo Cerda' });
        expect(doc.getNumberOfPages()).toBeGreaterThan(1);
        const arriba = (page: number) => llamadas.filter(l => l.page === page && l.y < 20).map(l => l.text);
        expect(arriba(1)).toEqual([]);
        expect(arriba(2)).toEqual(expect.arrayContaining(['COMPASIÓN TEMPORAL', 'Ricardo Cerda']));
        // Folio al pie de cada página.
        expect(llamadas.filter(l => l.page === 2 && l.y > 280).map(l => l.text)).toContain('2');
    });
});

describe('fetchPdfFont', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('una fuente que no existe (Hosting devuelve index.html con 200) falla con un error claro', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })));
        await expect(fetchPdfFont('NoExiste.ttf')).rejects.toThrow('No se pudo cargar la fuente NoExiste.ttf');
    });

    it('una fuente servida como font/ttf se entrega en base64', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'font/ttf' } })));
        expect(await fetchPdfFont('Existe.ttf')).toBe('AQID');
    });
});
