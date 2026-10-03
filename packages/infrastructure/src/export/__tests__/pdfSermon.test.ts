import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SermonEntity } from '@dosfilos/domain';
import { PdfExportService, desplazamientoDeMarca, visualHebrew } from '../PdfExportService';

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
        expect(pedidas.sort()).toEqual(['NotoSerif-Bold.ttf', 'NotoSerif-BoldItalic.ttf', 'NotoSerif-Italic.ttf', 'NotoSerif-Regular.ttf', 'NotoSerifHebrew-Regular.ttf']);
        expect(doc.getNumberOfPages()).toBe(1);
        const fuentes = Object.values(doc.getFontList()).flat();
        expect(Object.keys(doc.getFontList())).toEqual(expect.arrayContaining(['NotoSerif', 'NotoHebrew']));
        expect(fuentes.length).toBeGreaterThan(0);
    }, 60000);
});

describe('PdfExportService — lo que se dibuja (revisión adversarial de R2)', () => {
    async function dibujado(content: string) {
        const { jsPDF } = await import('jspdf');
        const llamadas: Array<{ text: string; x: number; y: number; font: string }> = [];
        const svc = new PdfExportService(cargar, () => {
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const original = doc.text.bind(doc);
            doc.text = ((t: string, x: number, y: number, ...resto: unknown[]) => {
                llamadas.push({ text: String(t), x, y, font: doc.getFont().fontName });
                return (original as (...a: unknown[]) => unknown)(t, x, y, ...resto);
            }) as typeof doc.text;
            return doc;
        });
        await svc.buildSermonPdf(SermonEntity.create({
            id: 's', userId: 'u', title: 'Prueba del PDF', status: 'published', content,
            bibleReferences: [], tags: [], createdAt: new Date(), updatedAt: new Date(),
        } as never));
        return llamadas;
    }

    it('la puntuación pegada al hebreo va con la fuente latina, y el hebreo con la suya', async () => {
        const l = await dibujado('La palabra (חֶסֶד) significa.');
        expect(l.find(x => x.text === '(')?.font).toBe('NotoSerif');
        expect(l.find(x => x.text === ')')?.font).toBe('NotoSerif');
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
