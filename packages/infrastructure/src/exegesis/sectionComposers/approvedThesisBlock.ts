/**
 * La tesis aprobada por el estudiante, como bloque del mensaje para la
 * conclusión o la introducción (fase «Lecciones del TI #2», etapa 3.2).
 *
 * Sin ella los compositores adivinaban la tesis: en el TI #2 la introducción
 * tomó la última oración de la conclusión, y la tesis estaba en la primera.
 * Con ella no hay que adivinar: es ESA, con sus palabras.
 */
export function approvedThesisBlock(
    thesis: string | null | undefined,
    section: 'conclusion' | 'introduction',
    lang: 'es' | 'en',
): string {
    const texto = thesis?.trim();
    if (!texto) return '';
    if (lang === 'en') {
        return [
            '### Approved thesis (written by the author after the analyses)',
            '',
            `> ${texto}`,
            '',
            section === 'conclusion'
                ? 'This IS the thesis. Return to it explicitly and sustain it verse by verse with what the analyses established. Do not replace it with another one; if the body does not support some part of it, say so with restraint.'
                : 'This IS the thesis. End the introduction with it, in its own words or nearly so. Do not derive another thesis from the conclusion.',
        ].join('\n');
    }
    return [
        '### Tesis aprobada (la escribió el autor después de los análisis)',
        '',
        `> ${texto}`,
        '',
        section === 'conclusion'
            ? 'ESTA es la tesis. Vuelve a ella explícitamente y sostenla versículo por versículo con lo que establecieron los análisis. No la reemplaces por otra; si el cuerpo no sostiene alguna parte, dilo con prudencia.'
            : 'ESTA es la tesis. Termina la introducción con ella, con sus mismas palabras o casi. No derives otra tesis de la conclusión.',
    ].join('\n');
}
