import { describe, it, expect } from 'vitest';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { exportPaperToMarkdown } from '../../entities/exportPaperToMarkdown';
import { assembleMarkdown } from '../assemblyContents';
import { paginasAbreviadas, rangosConRaya } from '../rangeDash';

/** TP #9 (B44): «# Santiago 4:11-17» y la portada «SANTIAGO 4:11-17» salieron con guion. */
describe('rangosConRaya — una sola regla para el ensamble y el Word', () => {
    it('guion, guiones Unicode y signo menos, con o sin espacios', () => {
        expect(rangosConRaya('Santiago 4:11-17')).toBe('Santiago 4:11–17');
        expect(rangosConRaya('SANTIAGO 4:11 - 17')).toBe('SANTIAGO 4:11–17');
        expect(rangosConRaya('Stg 3:1−12 y 4:1‐10, pp. 584‑585')).toBe('Stg 3:1–12 y 4:1–10, pp. 584–585');
        expect(rangosConRaya('Santiago 4:13-5:6')).toBe('Santiago 4:13–5:6');
    });

    it('no toca una fecha ni un guion de palabra', () => {
        expect(rangosConRaya('Entrega 2026-10-28 · Santiago 4:11-17')).toBe('Entrega 2026-10-28 · Santiago 4:11–17');
        expect(rangosConRaya('Octubre 2026-10')).toBe('Octubre 2026-10');
        expect(rangosConRaya('greco-romano')).toBe('greco-romano');
    });

    it('el título del ensamble y la cabecera del Word coinciden, y la fecha de exportación sigue con guiones', () => {
        const paper = {
            title: undefined, displayLanguage: 'es', assignmentBrief: '', steps: [],
            passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 },
        } as unknown as ExegeticalPaper;
        const ensamble = assembleMarkdown(paper, 'es').split('\n')[0];
        const word = exportPaperToMarkdown(paper, { exportedAt: new Date('2026-10-28T12:00:00Z') });
        expect(ensamble).toBe('# Santiago 4:11–17');
        expect(word.split('\n')[0]).toBe(ensamble);
        expect(word).toContain(':** Santiago 4:11–17');
        expect(word).toContain('2026-10-28');
    });
});

/** Guía de TMS 2024–2025, «Números»: cada ejemplo de la guía, tal cual. */
describe('paginasAbreviadas — rangos de páginas como la guía', () => {
    it('primer número menor que 100: el segundo entero', () => {
        for (const r of ['2–4', '19–45', '61–99', '92–137']) expect(paginasAbreviadas(r)).toBe(r);
    });

    it('100 o más: al menos dos cifras, como los ejemplos de la guía', () => {
        expect(paginasAbreviadas('23–46')).toBe('23–46');
        expect(paginasAbreviadas('162–175')).toBe('162–75');
        expect(paginasAbreviadas('315–317')).toBe('315–17');
        expect(paginasAbreviadas('648–695')).toBe('648–95');
        expect(paginasAbreviadas('2156–2189')).toBe('2156–89');
    });

    it('sin el cero inicial del segundo número: 103–6, 308–9, 702–7', () => {
        expect(paginasAbreviadas('103–106')).toBe('103–6');
        expect(paginasAbreviadas('308–309')).toBe('308–9');
        expect(paginasAbreviadas('702–707')).toBe('702–7');
    });

    it('REGRESIÓN TI #2: «567-568» con guion sale «567–68», como el TI #1 entregado («563–64»)', () => {
        expect(paginasAbreviadas('567-568')).toBe('567–68');
        expect(paginasAbreviadas('563 - 564')).toBe('563–64');
    });

    it('con tomo, como HALOT; varias páginas; y lo que no es un rango, intacto', () => {
        expect(paginasAbreviadas('2:457-458')).toBe('2:457–58');
        expect(paginasAbreviadas('436, 512-514')).toBe('436, 512–14');
        expect(paginasAbreviadas('§18')).toBe('§18');
        expect(paginasAbreviadas('xiv')).toBe('xiv');
    });

    it('múltiplo de 100, otra cantidad de cifras o un segundo menor: entero', () => {
        expect(paginasAbreviadas('100-104')).toBe('100–104');
        expect(paginasAbreviadas('987-1002')).toBe('987–1002');
        expect(paginasAbreviadas('512-498')).toBe('512–498');
    });
});
