import { buildVocabularyBlock, type ThesisAdvisorInput } from '@dosfilos/domain';

/**
 * Proponer el título temático de cada versículo (fase «Lecciones del TI #2»,
 * etapa 3.4; B68e). El TI #1 entregado titula cada versículo por lo que
 * hace en el argumento —«El pastor que hace recostar y conduce (v. 2)»—, no
 * con la referencia ni copiando la traducción: medido, tomar la primera
 * cláusula de la traducción daba «Salmo de David (v. 1)» (el título del
 * salmo) o el versículo entero.
 */
export interface HeadingsPromptInput extends Pick<ThesisAdvisorInput, 'passageLabel' | 'language' | 'briefings'> {
    /** La tesis aprobada: los títulos la desarrollan. */
    thesis: string | null;
    /** Los versículos a titular, en orden: la clave que se devuelve y el número. */
    verses: ReadonlyArray<{ key: string; label: string }>;
}

export function buildHeadingsPrompt(input: HeadingsPromptInput): { system: string; user: string } {
    const en = input.language === 'en';
    const system = [
        'Eres un profesor de exégesis que ayuda a un estudiante de MDiv a titular las secciones de su trabajo de investigación: un título por versículo.',
        'Cada título dice qué hace ese versículo en el argumento del trabajo, en pocas palabras (entre 3 y 9), y termina con la referencia entre paréntesis: «(v. N)» o «(vv. N–M)».',
        'NO copies la traducción ni uses el título del salmo («Salmo de David») como título del versículo. Toma el tema de lo que el análisis aceptado estableció y de la tesis aprobada.',
        'Los títulos de los distintos versículos forman una progresión: leídos en orden, cuentan el argumento.',
        buildVocabularyBlock(input.language, 'academic'),
        en ? 'Write the headings in English.' : 'Escribe los títulos en español.',
    ].join('\n\n');
    const user = [
        `Pasaje: ${input.passageLabel}`,
        '',
        '## Tesis aprobada',
        input.thesis?.trim() || '(sin tesis aprobada todavía)',
        '',
        '## Versículos a titular (devuelve un título por cada clave)',
        ...input.verses.map(v => `- ${v.key}: ${v.label}`),
        '',
        '## Análisis aceptados',
        input.briefings,
    ].join('\n');
    return { system, user };
}

export const HEADINGS_SCHEMA = {
    type: 'object',
    properties: {
        headings: {
            type: 'array',
            items: {
                type: 'object',
                properties: { key: { type: 'string' }, title: { type: 'string' } },
                required: ['key', 'title'],
            },
        },
    },
    required: ['headings'],
} as const;

/** Un título por clave pedida; los que no vienen o vienen vacíos, fuera. */
export function parseHeadings(text: string, keys: ReadonlyArray<string>): Record<string, string> {
    const raw = JSON.parse(text) as { headings?: Array<{ key?: string; title?: string }> };
    const out: Record<string, string> = {};
    for (const h of raw.headings ?? []) {
        const titulo = h.title?.trim();
        if (h.key && keys.includes(h.key) && titulo && !out[h.key]) out[h.key] = titulo;
    }
    return out;
}
