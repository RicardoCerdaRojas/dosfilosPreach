import { describe, expect, it } from 'vitest';
import { applyPageLabelStyle } from '../citationStyle';
import { restoreStoredPageLabels } from '../editedProsePageLabels';
import { exportPaperToMarkdown } from '../../entities/exportPaperToMarkdown';
import type { ExegeticalPaper } from '../../entities/ExegeticalPaper';
import type { PaperFormatting } from '../../entities/PaperRubric';

/**
 * TP #9 (Santiago 4:12, 2026-10-28, B45): «Editar contenido aceptado» guardó la
 * prosa como se entrega y «(Tuggy, p. 257)» quedó «(Tuggy, 257)» en todo el paso.
 */
const SIN_P = { citationForm: 'parenthetical', pageLabel: 'bare' } as PaperFormatting;
const CON_P = { citationForm: 'parenthetical', pageLabel: 'labelled' } as PaperFormatting;

const GUARDADA = 'El participio es sustantivo (Tuggy, p. 257). Rige dos infinitivos (Tuggy, p. 90; Robertson, p. 574).';

describe('restoreStoredPageLabels', () => {
    it('lo que el estudiante no tocó vuelve a su forma guardada', () => {
        // El editor abre con la forma entregada y el estudiante solo agrega una oración.
        const editada = `${applyPageLabelStyle(GUARDADA, SIN_P)} Es el único juez.`;
        expect(restoreStoredPageLabels(editada, GUARDADA, SIN_P)).toBe(`${GUARDADA} Es el único juez.`);
    });

    it('una cita nueva queda tal cual la escribió, con «p.» o sin él', () => {
        const editada = `${applyPageLabelStyle(GUARDADA, SIN_P)} Ver también (Tuggy, 540) y (Moo, p. 198).`;
        expect(restoreStoredPageLabels(editada, GUARDADA, SIN_P)).toBe(`${GUARDADA} Ver también (Tuggy, 540) y (Moo, p. 198).`);
    });

    it('en una cita compuesta, corregir una no le quita el rótulo a la otra', () => {
        const editada = applyPageLabelStyle(GUARDADA, SIN_P).replace('Robertson, 574', 'Robertson, 575');
        expect(restoreStoredPageLabels(editada, GUARDADA, SIN_P)).toContain('(Tuggy, p. 90; Robertson, 575)');
    });

    it('un paréntesis que no era cita no se toca', () => {
        const guardada = 'En los vv. (11, 12) y (Tuggy, p. 257).';
        const editada = 'En los vv. (11, 12) y (Tuggy, 257).';
        expect(restoreStoredPageLabels(editada, guardada, SIN_P)).toBe(guardada);
    });

    it('si la entrega lleva «p.», el editor ya mostraba lo guardado: no hay nada que devolver', () => {
        const editada = 'Texto nuevo (Tuggy, 257).';
        expect(restoreStoredPageLabels(editada, GUARDADA, CON_P)).toBe(editada);
        expect(restoreStoredPageLabels(editada, GUARDADA, null)).toBe(editada);
    });

    it('«hoja N» no es «p. N»: queda como está', () => {
        const guardada = 'Lo dice Wallace (Wallace, hoja 87) y Tuggy (Tuggy, p. 1).';
        const editada = applyPageLabelStyle(guardada, SIN_P);
        expect(editada).toContain('(Wallace, hoja 87)');
        expect(restoreStoredPageLabels(editada, guardada, SIN_P)).toBe(guardada);
    });
});

describe('el Word sale con una sola forma', () => {
    // El exportador Word arma su texto con `exportPaperToMarkdown`.
    const paper = (formatting: PaperFormatting, assembledMarkdown: string) => ({
        title: 'TP #9', displayLanguage: 'es', assignmentBrief: null,
        passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 11, verseEnd: 17 },
        steps: [], assembledMarkdown, rubric: { formatting },
    }) as unknown as ExegeticalPaper;

    it('con «sin p.» la cita guardada y la escrita sin rótulo imprimen igual', () => {
        const md = exportPaperToMarkdown(paper(SIN_P, 'Uno (Tuggy, p. 257). Dos (Tuggy, 540). Tres (Tuggy, pp. 90-91; Robertson, p. 574).'), { omitHeader: true });
        expect(md).toContain('(Tuggy, 257)');
        expect(md).toContain('(Tuggy, 540)');
        expect(md).toContain('(Tuggy, 90-91; Robertson, 574)');
        expect(md).not.toMatch(/\bpp?\.\s*\d/);
    });
});
