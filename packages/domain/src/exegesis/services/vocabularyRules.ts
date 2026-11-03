/**
 * La regla general de vocabulario (fase «Lecciones del TI #2», etapa 4.2;
 * B67): una sola fuente para todo prompt que escribe prosa.
 *
 * En el TI #2 el fundador corrigió a mano (bitácora, §3):
 * - 15 términos técnicos sin explicar;
 * - «qatal», «weqatal» y «yiqtol» junto a perfecto e imperfecto;
 * - 13 «hablante» que cambió por «salmista»;
 * - refutaciones de lecturas que el texto no presentó («no es intensivo», tres veces).
 *
 * Los cierres con «sin + infinitivo» NO van: se afirmó que el fundador los corregía,
 * y lo medido dice que no (generados 22, entregados 20).
 *
 * La regla 22 de su guía lo dice para el curso. Pero la guía solo llega a
 * los compositores académicos: el sermón, el devocional y la guía de estudio
 * no la leen. Por eso la regla vive aquí, en código, y llega a todos.
 *
 * La variante pastoral es más estricta con la jerga: en el púlpito no va un
 * término técnico ni siquiera explicado.
 */
export type VocabularyRegister = 'academic' | 'pastoral';

export function vocabularyRules(language: 'es' | 'en', register: VocabularyRegister): string[] {
    const comunes = language === 'en'
        ? [
            '- If a plain word says the same thing, use the plain word, for example: "as an affirmation" rather than "assertive sense", "to make clear" rather than "explicitation", "naturally" rather than "communicates idiomatically", "who acts and who receives" rather than "syntactic distribution", "force" rather than "efficacy".',
            '- The voice of the text is its author: "the psalmist", "the prophet", "James". Not "the speaker".',
            '- Name God as the translation of the paper does: if it says "the LORD" for יהוה, do not write "Yahweh".',
        ]
        : [
            '- Si una palabra llana dice lo mismo, usa la llana, por ejemplo: «como afirmación» y no «sentido aseverativo»; «para dejar claro» y no «explicitación»; «de forma natural» y no «comunica idiomáticamente»; «quién actúa y quién recibe» y no «distribución sintáctica»; «fuerza» y no «eficacia».',
            '- La voz del texto es su autor: «el salmista», «el profeta», «Santiago». No «el hablante».',
            '- Nombra a Dios como lo hace la traducción del trabajo: si dice «el SEÑOR» para יהוה, no escribas «Yahweh».',
        ];
    if (register === 'pastoral') {
        return language === 'en'
            ? [
                '- No grammatical terms, not even explained: say what the form does ("an action that follows", "something certain"), not its name.',
                '- A Hebrew or Greek word only when it is really needed, and always translated.',
                ...comunes,
            ]
            : [
                '- Sin términos de gramática, ni siquiera explicados: di lo que la forma hace («una acción que sigue», «algo seguro»), no su nombre.',
                '- Una palabra hebrea o griega solo si hace falta de verdad, y siempre traducida.',
                ...comunes,
            ];
    }
    return language === 'en'
        ? [
            '- In Hebrew, one nomenclature for verb forms: perfect, imperfect, perfect consecutive, imperfect consecutive. Do not mix in qatal, yiqtol, weqatal or wayyiqtol; when a cited source uses its label, gloss it: "yiqtol (imperfect)".',
            '- A technical term that is not a category of the course grammar (hendiadys, dittography, gnomic, pregnant) is explained in parentheses the first time: "epexegetical (or explanatory)".',
            ...comunes,
            '- "The believer" is not the voice of the text either: it leads to application and claims what the analysis did not show.',
            '- Do not refute a reading that neither the paper nor a source presented ("it is not intensive", "there is no reference to punishment"): say what the text does affirm.',
        ]
        : [
            '- En hebreo, una sola nomenclatura para las formas verbales: perfecto, imperfecto, perfecto consecutivo, imperfecto consecutivo. No mezcles qatal, yiqtol, weqatal ni wayyiqtol; si una fuente citada usa su sigla, va glosada: «yiqtol (imperfecto)».',
            '- Un término técnico que no es categoría de la gramática del curso (hendíadis, ditografía, gnómico, pregnante) se explica entre paréntesis la primera vez: «epexegético (o aclaratorio)».',
            ...comunes,
            '- Tampoco «el creyente» es la voz del texto: lleva a la aplicación y afirma lo que el análisis no mostró.',
            '- No refutes una lectura que ni el trabajo ni una fuente presentó («no es intensivo», «no hay referencia al castigo»): di lo que el texto sí afirma.',
        ];
}

/** El bloque con su encabezado, listo para un prompt. */
export function buildVocabularyBlock(language: 'es' | 'en', register: VocabularyRegister): string {
    const cabecera = language === 'en' ? 'VOCABULARY (hard rules):' : 'VOCABULARIO (reglas duras):';
    return [cabecera, ...vocabularyRules(language, register)].join('\n');
}
