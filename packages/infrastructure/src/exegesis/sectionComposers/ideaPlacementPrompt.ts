import {
    buildAcademicRegisterBlock,
    type IdeaPlacement,
    type PlaceIdeaInput,
} from '@dosfilos/domain';

/**
 * Prompt, esquema y lectura de «Agregar una idea». Aparte del compositor,
 * como `verseProsePrompt.ts`: se prueban y se comparan entre modelos sin
 * cargar el cliente de Firebase.
 */
export const IDEA_PLACEMENT_SCHEMA = {
    type: 'object',
    properties: {
        paragraphIndex: { type: 'integer', description: 'Número del párrafo donde entra la idea (el que va entre corchetes).' },
        afterSentence: {
            type: 'string',
            description: 'La oración de ESE párrafo, copiada exacta, después de la cual entra la idea. Vacía para ponerla al final del párrafo.',
        },
        sentence: { type: 'string', description: 'La idea redactada: una o dos oraciones, con la cita del estudiante tal cual.' },
        alreadyStated: {
            type: 'string',
            description: 'Si la sección YA dice esta idea, la oración que la dice, copiada exacta. Vacía si no la dice.',
        },
    },
    required: ['paragraphIndex', 'afterSentence', 'sentence', 'alreadyStated'],
} as const;

export function buildIdeaPlacementPrompt(input: PlaceIdeaInput): { systemInstruction: string; userMessage: string } {
    const en = input.language === 'en';
    const reglas = en
        ? [
            'You add ONE idea to an academic section that the student already wrote. You do NOT rewrite the section.',
            '- Write the idea as one or two sentences that fit where they go: same register, a connector that ties them to the previous sentence.',
            '- Keep every citation the student wrote EXACTLY as written, in the same sentence as what it supports. Add no other citation and no source the student did not name.',
            '- Do not add content the student did not give: no new claims, no intensifiers.',
            '- Choose the paragraph where the idea belongs and the sentence after which it reads naturally. Copy that sentence exactly as it appears.',
            '- If the section ALREADY says this idea (even with other words or another page), copy that sentence into "alreadyStated". Still write "sentence", but do not repeat what the sentence before already says.',
        ]
        : [
            'Agregas UNA idea a una sección académica que el estudiante ya escribió. NO reescribes la sección.',
            '- Redacta la idea en una o dos oraciones que encajen donde van: el mismo registro, un conector que las ate a la oración anterior.',
            '- Conserva cada cita que escribió el estudiante TAL CUAL, en la misma oración que lo que respalda. No agregues otra cita ni una fuente que el estudiante no nombró.',
            '- No agregues contenido que el estudiante no dio: ni afirmaciones nuevas ni intensificadores.',
            '- Elige el párrafo donde la idea pertenece y la oración después de la cual se lee natural. Copia esa oración exacta, como aparece.',
            '- Si la sección YA dice esta idea (aunque con otras palabras u otra página), copia esa oración en "alreadyStated". Igual redacta "sentence", sin repetir lo que dice la oración anterior.',
        ];
    const systemInstruction = [...reglas, '', buildAcademicRegisterBlock(input.language)].join('\n');
    const parrafos = input.paragraphs.map((p, i) => {
        const h = input.headings?.[i];
        return h ? `[${i}] (${en ? 'under' : 'bajo'} «${h}») ${p}` : `[${i}] ${p}`;
    }).join('\n\n');
    const userMessage = en
        ? `SECTION (numbered paragraphs):\n\n${parrafos}\n\nIDEA TO ADD:\n${input.idea.trim()}`
        : `SECCIÓN (párrafos numerados):\n\n${parrafos}\n\nIDEA QUE HAY QUE AGREGAR:\n${input.idea.trim()}`;
    return { systemInstruction, userMessage };
}

export function parseIdeaPlacement(raw: string): IdeaPlacement {
    const limpio = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const data = JSON.parse(limpio) as Partial<IdeaPlacement>;
    const sentence = typeof data.sentence === 'string' ? data.sentence.trim() : '';
    if (!sentence) throw new Error('GeminiIdeaPlacer: la respuesta no trae la oración');
    return {
        paragraphIndex: typeof data.paragraphIndex === 'number' ? data.paragraphIndex : 0,
        afterSentence: typeof data.afterSentence === 'string' ? data.afterSentence : '',
        sentence,
        alreadyStated: typeof data.alreadyStated === 'string' ? data.alreadyStated.trim() : '',
    };
}
