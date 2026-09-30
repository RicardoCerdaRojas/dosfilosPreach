import { describe, it, expect } from 'vitest';
import { assessRubricRigor, type PaperRubric, type SourceRequirement } from '../../entities/PaperRubric';
import { exportPaperToMarkdown } from '../../entities/exportPaperToMarkdown';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import { applyPageLabelStyle } from '../citationStyle';

const rubrica = (reqs: Array<Pick<SourceRequirement, 'sourceType' | 'minimum'>>): PaperRubric =>
    ({ sourceRequirements: reqs.map(r => ({ ...r, maximum: null, justification: '' })) } as unknown as PaperRubric);

/**
 * El nivel medía CANTIDAD. La plantilla del TP de análisis sintáctico
 * —gramática ≥1, comentario crítico ≥2— sumaba 9 y salía «Pastoral /
 * homilético — no diseñado para trabajo académico», con «2 de 5 áreas»
 * contando la metodológica (TP Santiago 2:14-26, 2026-09-30).
 */
describe('assessRubricRigor — el rigor lo da el tipo de fuente', () => {
    it('el TP corto con fuentes técnicas es de seminario', () => {
        const a = assessRubricRigor(rubrica([
            { sourceType: 'grammar-syntax', minimum: 1 },
            { sourceType: 'commentary-critical', minimum: 2 },
        ]));
        expect(a.level).toBe('seminary');
        expect(a.groupBreadth).toBe(2);
    });

    it('sin ninguna fuente técnica sigue siendo pastoral', () => {
        expect(assessRubricRigor(rubrica([{ sourceType: 'commentary-expository', minimum: 3 }])).level)
            .toBe('pastoral');
    });

    it('la cantidad sigue decidiendo los niveles de arriba', () => {
        expect(assessRubricRigor(rubrica([
            { sourceType: 'commentary-critical', minimum: 6 },
            { sourceType: 'grammar-syntax', minimum: 3 },
        ])).level).toBe('research');
    });

    it('la plantilla de estilo no es un área académica', () => {
        const a = assessRubricRigor(rubrica([
            { sourceType: 'commentary-critical', minimum: 1 },
            { sourceType: 'style-template-paper', minimum: 1 },
        ]));
        expect(a.groupBreadth).toBe(1);
        expect(a.groupTotal).toBe(4);
    });
});

/**
 * El sílabo del TP semanal pide «(Carballosa, 208)». El compositor escribe
 * «p. 208» porque el reetiquetado de hojas y el anclaje lo necesitan; el
 * rótulo se ajusta al entregar.
 */
describe('applyPageLabelStyle', () => {
    const PARENTETICA_SIN_P = { lineSpacing: 'single', blankLineBetweenParagraphs: true, citationForm: 'parenthetical', pageLabel: 'bare' } as const;

    it('quita «p.» y «pp.» dentro de las citas', () => {
        expect(applyPageLabelStyle('Así (Carballosa, p. 208) y (Mayor, pp. 77-78; Ropes, p. 203).', PARENTETICA_SIN_P))
            .toBe('Así (Carballosa, 208) y (Mayor, 77-78; Ropes, 203).');
    });

    it('«hoja N» no se toca: dice que la página impresa se desconoce', () => {
        expect(applyPageLabelStyle('(Wallace, hoja 87)', PARENTETICA_SIN_P)).toBe('(Wallace, hoja 87)');
    });

    it('fuera de un paréntesis no toca nada', () => {
        expect(applyPageLabelStyle('ver p. 12 del apéndice', PARENTETICA_SIN_P)).toBe('ver p. 12 del apéndice');
    });

    it('sin pedirlo, o con notas al pie, el texto queda igual', () => {
        expect(applyPageLabelStyle('(Mayor, p. 77)', null)).toBe('(Mayor, p. 77)');
        expect(applyPageLabelStyle('(Mayor, p. 77)', { ...PARENTETICA_SIN_P, pageLabel: 'labelled' })).toBe('(Mayor, p. 77)');
        expect(applyPageLabelStyle('(Mayor, p. 77)', { ...PARENTETICA_SIN_P, citationForm: 'footnote' })).toBe('(Mayor, p. 77)');
    });

    it('lo que se descarga ya sale con el rótulo pedido', () => {
        const paper = {
            title: 'TP #5', passage: { bookId: 'JAS', chapterStart: 2, chapterEnd: 2, verseStart: 14, verseEnd: 26 },
            displayLanguage: 'es', steps: [], assembledMarkdown: '## ¿Pregunta?\n\nLa fe (Carballosa, p. 208).',
            rubric: { formatting: PARENTETICA_SIN_P },
        } as unknown as ExegeticalPaper;
        expect(exportPaperToMarkdown(paper, { omitHeader: true })).toContain('(Carballosa, 208)');
    });
});
