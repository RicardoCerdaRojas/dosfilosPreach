import { describe, expect, it } from 'vitest';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { approvedSectionTitles } from '../sectionTitles';
import { sectionHeadingKey } from '../composedVerseSections';

const PSA = (v: number) => ({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: v, verseEnd: v });
const paper = (titles: Record<string, string> | null) => ({
    displayLanguage: 'es', sectionTitles: titles,
    steps: [{ id: 'v3', kind: 'verse', verseRef: PSA(3) }, { id: 'c', kind: 'conclusion', verseRef: null }],
}) as unknown as ExegeticalPaper;

describe('approvedSectionTitles — el título aprobado por la clave del título del ensamble (etapa 3.4)', () => {
    it('«Salmo 23:3» → el título aprobado; también un ensamble viejo que dice «Salmos 23:3»', () => {
        const m = approvedSectionTitles(paper({ v3: '  El pastor que restaura y guía (v. 3) ' }));
        expect(m.get(sectionHeadingKey('Salmo 23:3'))).toBe('El pastor que restaura y guía (v. 3)');
        expect(m.get(sectionHeadingKey('Salmos 23:3'))).toBe('El pastor que restaura y guía (v. 3)');
    });
    it('sin títulos, vacíos o de un paso que no es versículo: nada', () => {
        expect(approvedSectionTitles(paper(null)).size).toBe(0);
        expect(approvedSectionTitles(paper({ v3: '   ', c: 'Conclusión temática' })).size).toBe(0);
    });
});
