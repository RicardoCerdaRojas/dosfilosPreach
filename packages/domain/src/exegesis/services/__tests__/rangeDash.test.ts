import { describe, it, expect } from 'vitest';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { exportPaperToMarkdown } from '../../entities/exportPaperToMarkdown';
import { assembleMarkdown } from '../assemblyContents';
import { rangosConRaya } from '../rangeDash';

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
