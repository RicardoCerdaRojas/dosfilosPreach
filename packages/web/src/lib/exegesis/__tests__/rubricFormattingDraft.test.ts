import { describe, it, expect } from 'vitest';
import { draftFromFormatting, formattingFromDraft } from '../rubricFormattingDraft';

/**
 * «Formato» era una trampa: con el interlineado «Por defecto», la forma de
 * cita y la línea entre párrafos quedaban deshabilitadas, y al guardar
 * `'default'` se descartaba todo. El TP de Santiago 2:14-26 salió con nota
 * al pie aunque el sílabo pedía cita entre paréntesis.
 */
describe('formattingFromDraft', () => {
    const casa = draftFromFormatting(null);

    it('lo elegido se guarda aunque el interlineado siga «como la guía»', () => {
        expect(formattingFromDraft({ ...casa, citationForm: 'parenthetical' }))
            .toEqual({ lineSpacing: 'double', lineSpacingFromHouse: true, citationForm: 'parenthetical', blankLineBetweenParagraphs: false });
        expect(formattingFromDraft({ ...casa, blankLine: true })!.blankLineBetweenParagraphs).toBe(true);
    });

    it('sin nada distinto de la casa, sigue a la guía (null)', () => {
        expect(formattingFromDraft(casa)).toBeNull();
    });

    it('la configuración del TP semanal de TMS se guarda entera', () => {
        expect(formattingFromDraft({ lineSpacing: 'single', citationForm: 'parenthetical', blankLine: true, pageLabel: 'bare' }))
            .toEqual({ lineSpacing: 'single', citationForm: 'parenthetical', blankLineBetweenParagraphs: true, pageLabel: 'bare' });
    });

    it('el rótulo sin «p.» no se guarda con nota al pie', () => {
        expect(formattingFromDraft({ ...casa, lineSpacing: 'single', pageLabel: 'bare' })).not.toHaveProperty('pageLabel');
    });

    it('ida y vuelta: lo guardado vuelve al formulario igual', () => {
        const tp = { lineSpacing: 'single', citationForm: 'parenthetical', blankLineBetweenParagraphs: true, pageLabel: 'bare' } as const;
        expect(formattingFromDraft(draftFromFormatting(tp))).toEqual(tp);
    });
});

describe('ida y vuelta desde «como la guía»', () => {
    it('el interlineado heredado vuelve como heredado, no como «doble»', () => {
        const guardado = formattingFromDraft({ ...draftFromFormatting(null), citationForm: 'parenthetical' })!;
        expect(draftFromFormatting(guardado).lineSpacing).toBe('default');
        // Y se guarda igual: el exportador necesita un interlineado.
        expect(guardado.lineSpacing).toBe('double');
    });
});
