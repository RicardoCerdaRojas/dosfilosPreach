import {
    DEFAULT_PAPER_FORMATTING,
    type CitationForm,
    type LineSpacing,
    type PageLabelStyle,
    type PaperFormatting,
} from '@dosfilos/domain';

/**
 * Lo que el formulario de «Formato» edita, antes de guardarse.
 *
 * `lineSpacing: 'default'` significa «como la guía de la casa». Antes esa
 * opción BLOQUEABA la forma de cita y la línea entre párrafos, y al guardar
 * `'default'` descartaba todo (`formatting: null`): quien elegía «cita entre
 * paréntesis» sin tocar el interlineado entregaba con nota al pie. Así salió
 * el TP de Santiago 2:14-26 con «(Robertson, Grammar…, 1175)» en el cuerpo.
 * Ahora cada campo es independiente.
 */
export interface FormattingDraft {
    lineSpacing: LineSpacing | 'default';
    citationForm: CitationForm;
    blankLine: boolean;
    pageLabel: PageLabelStyle;
}

export function draftFromFormatting(f: PaperFormatting | null | undefined): FormattingDraft {
    return {
        lineSpacing: !f || f.lineSpacingFromHouse ? 'default' : f.lineSpacing,
        citationForm: f?.citationForm ?? DEFAULT_PAPER_FORMATTING.citationForm,
        blankLine: f?.blankLineBetweenParagraphs ?? DEFAULT_PAPER_FORMATTING.blankLineBetweenParagraphs,
        pageLabel: f?.pageLabel ?? 'labelled',
    };
}

/**
 * `null` sólo si NADA difiere de la casa: así la entrega sigue a la guía si
 * algún día cambia. Si algo difiere, se guarda todo, con el interlineado de
 * la casa cuando quedó en «como la guía».
 */
export function formattingFromDraft(d: FormattingDraft): PaperFormatting | null {
    const comoLaCasa = d.lineSpacing === 'default'
        && d.citationForm === DEFAULT_PAPER_FORMATTING.citationForm
        && d.blankLine === DEFAULT_PAPER_FORMATTING.blankLineBetweenParagraphs
        && d.pageLabel === 'labelled';
    if (comoLaCasa) return null;
    return {
        lineSpacing: d.lineSpacing === 'default' ? DEFAULT_PAPER_FORMATTING.lineSpacing : d.lineSpacing,
        ...(d.lineSpacing === 'default' ? { lineSpacingFromHouse: true } : {}),
        citationForm: d.citationForm,
        blankLineBetweenParagraphs: d.blankLine,
        // El rótulo sólo se aplica a la cita entre paréntesis
        // (`applyPageLabelStyle`); guardarlo con nota al pie no haría nada.
        ...(d.citationForm === 'parenthetical' && d.pageLabel === 'bare' ? { pageLabel: 'bare' as const } : {}),
    };
}
