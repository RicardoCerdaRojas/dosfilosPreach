import { DEFAULT_PAPER_FORMATTING, type CitationForm } from '../entities/PaperRubric';

/**
 * Cómo se escribe una cita dentro del párrafo, según lo que pida la entrega.
 *
 * La forma estaba cableada en la instrucción del compositor —«Citas inline en
 * formato (Autor, "Título", p. N)»— mientras la rúbrica guardaba
 * `citationForm` y el exportador Word lo obedecía. Dos sitios decidiendo lo
 * mismo, y el trabajo salía con las dos formas mezcladas: medido en Santiago
 * 2:1-13, tres versículos citaron «(Mayor, 77)» y el cuarto «(Adamson, "The
 * Epistle of James - New International Commentary on the New Testament",
 * p. 108)», con el título entero ocupando dos renglones del cuerpo.
 *
 * La forma con título NO es decoración: es la única que el exportador
 * reconoce para bajar la cita a nota al pie, y por eso se exige literal
 * cuando la entrega pide notas. En cambio el trabajo parentético manda el
 * título a la bibliografía y dentro del paréntesis sólo van apellido y
 * página.
 *
 * El rótulo de la página no se toca en ninguna de las dos: «hoja 55» sigue
 * siendo «hoja 55», que es la regla que evita mandar al lector a una página
 * que no existe.
 */
export function buildCitationFormBlock(
    form: CitationForm | null,
    language: 'es' | 'en',
): string {
    const f = form ?? DEFAULT_PAPER_FORMATTING.citationForm;
    if (language === 'en') {
        return f === 'parenthetical'
            ? [
                '## Citation form (hard rule)',
                'Cite as (Author, p. N) — surname and page only. NEVER put the title inside the parentheses: this paper carries a bibliography at the end and that is where titles live.',
                'Use the page label exactly as the briefing gives it: (Wallace, sheet 87), not (Wallace, p. 87).',
                'One single form across the whole section. Two citation forms in one paper is an error the grader sees.',
            ].join('\n')
            : [
                '## Citation form (hard rule)',
                'Cite as (Author, "Title", p. N) — the title in double quotes, verbatim. The exporter turns exactly this shape into a footnote; any other shape stays stranded in the body as a parenthesis.',
                'Use the page label exactly as the briefing gives it: (Wallace, "Greek Grammar", sheet 87), not "p. 87".',
                'One single form across the whole section. Two citation forms in one paper is an error the grader sees.',
            ].join('\n');
    }
    return f === 'parenthetical'
        ? [
            '## Forma de cita (regla dura)',
            'Citá como (Apellido, p. N) — sólo apellido y página. NUNCA metas el título dentro del paréntesis: este trabajo lleva bibliografía al final y ahí es donde va el título.',
            'El rótulo de página va tal cual lo da el briefing: (Wallace, hoja 87), no (Wallace, p. 87).',
            'Una sola forma en toda la sección. Dos formas de cita en un mismo trabajo es un error que el corrector ve.',
        ].join('\n')
        : [
            '## Forma de cita (regla dura)',
            'Citá como (Apellido, "Título", p. N) — el título entre comillas dobles, literal. El exportador convierte exactamente esa forma en nota al pie; cualquier otra queda varada en el cuerpo como paréntesis.',
            'El rótulo de página va tal cual lo da el briefing: (Wallace, "Gramática Griega", hoja 87), no «p. 87».',
            'Una sola forma en toda la sección. Dos formas de cita en un mismo trabajo es un error que el corrector ve.',
        ].join('\n');
}
