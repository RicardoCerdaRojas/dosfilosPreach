import type { PanoramaInput } from '@dosfilos/domain';
import { buildSourcePreamble, formatVerses } from './shared';

/**
 * Pase 1 — Panorama del libro.
 *
 * The first pass of the methodology: identify the book's identity
 * (genre, purpose, pastoral problem, central theme, movements, key
 * terms) BEFORE attempting any structural division. The downstream
 * passes use this as their working understanding of the book; the
 * `genre` field in particular drives the genre-aware prompt
 * branching of Pase 3.
 *
 * Output is JSON conforming to the BookPanorama domain shape (the
 * Gemini call requests structured output via responseSchema).
 */

export function buildPanoramaSystemInstruction(displayLanguage: 'es' | 'en'): string {
    if (displayLanguage === 'es') {
        return [
            'Eres un homileta y exegeta experto en la metodología histórico-gramatical-literal aplicada a la planificación de predicaciones expositivas.',
            '',
            'Tu tarea en este paso es producir el PANORAMA del libro bíblico — una lectura panorámica que captura su identidad antes de cualquier división estructural.',
            '',
            'Identifica:',
            '- El género literario primario del libro (uno de: epistle, narrative, poetry, prophecy, wisdom, gospel, apocalypse, law, mixed). Usa "mixed" solo cuando dos géneros conviven con peso similar (Daniel narrativa+apocalipsis; Lamentaciones lamento+acróstico).',
            '- El propósito autoral del libro (1-2 oraciones).',
            '- El problema pastoral o teológico que el libro aborda (la situación de los destinatarios — falsa enseñanza, sufrimiento, idolatría, falta de sabiduría, etc.).',
            '- El tema central del libro (un solo tema dominante; distinto del propósito).',
            '- Los movimientos argumentativos o narrativos grandes que el autor ejecuta (3-7 etiquetas cortas que sirvan como punto de partida para la división macro).',
            '- Los términos clave o motivos repetidos que dan cohesión al libro (3-10 términos).',
            '- Una nota breve sobre dónde se sitúa el libro en la historia redentora (opcional, solo si añade claridad).',
            '',
            'Reglas innegociables:',
            '- El tema central NO es el propósito. El propósito describe lo que el autor HACE; el tema describe sobre qué.',
            '- Los movimientos NO son perícopas ni capítulos — son los grandes bloques argumentativos o narrativos. Pensar a nivel de "introducción → tesis → desarrollo → exhortación → cierre", no a nivel de versículos.',
            '- Las palabras clave deben ser términos efectivamente repetidos en el libro, no temas teológicos generales.',
            '',
            'Salida: JSON estricto siguiendo el schema (genre, purpose, pastoralProblem, centralTheme, movements[], keyTerms[], redemptiveHistoryNote opcional).',
        ].join('\n');
    }

    return [
        'You are an expert homiletician and exegete in the historical-grammatical-literal methodology for planning expository preaching series.',
        '',
        'Your task in this step is to produce the PANORAMA of the biblical book — a panoramic reading that captures its identity before any structural division.',
        '',
        'Identify:',
        '- The primary literary genre (one of: epistle, narrative, poetry, prophecy, wisdom, gospel, apocalypse, law, mixed). Use "mixed" only when two genres coexist with similar weight (Daniel narrative+apocalyptic; Lamentations lament+acrostic).',
        '- The author\'s purpose for the book (1-2 sentences).',
        '- The pastoral or theological problem the book addresses (false teaching, suffering, idolatry, lack of wisdom, etc.).',
        '- The book\'s central theme (one dominant theme; distinct from the purpose).',
        '- The large argumentative or narrative movements (3-7 short labels that serve as starting points for macro division).',
        '- The key terms or repeated motifs that give cohesion to the book (3-10 terms).',
        '- A brief note on the book\'s place in redemptive history (optional, only when it adds clarity).',
        '',
        'Non-negotiable rules:',
        '- The central theme is NOT the purpose. The purpose describes what the author DOES; the theme describes what about.',
        '- Movements are NOT pericopes or chapters — they are large argumentative or narrative blocks. Think at the level of "introduction → thesis → development → exhortation → closing", not verses.',
        '- Key terms must be terms effectively repeated in the book, not general theological topics.',
        '',
        'Output: strict JSON conforming to the schema (genre, purpose, pastoralProblem, centralTheme, movements[], keyTerms[], optional redemptiveHistoryNote).',
    ].join('\n');
}

export function buildPanoramaUserMessage(input: PanoramaInput): string {
    const isSpanish = input.displayLanguage === 'es';
    const targetBlock = input.targetPreachableCount
        ? (isSpanish
              ? `\n\nNota: el predicador planea alrededor de ${input.targetPreachableCount} sermones para esta serie (suave — informativo, no constriñe el panorama).`
              : `\n\nNote: the preacher targets approximately ${input.targetPreachableCount} sermons for this series (soft — informative, not a constraint on the panorama).`)
        : '';
    const sourcePreamble = buildSourcePreamble(input.sourceLanguage, input.displayLanguage, input.book);

    if (isSpanish) {
        return [
            `Libro: ${input.book}`,
            `Versículos provistos: ${input.verses.length}.${targetBlock}`,
            sourcePreamble,
            'Texto verso a verso (formato `cap:vers <TAB> texto`):',
            '',
            formatVerses(input.verses),
            '',
            '---',
            'Devuelve únicamente JSON estricto siguiendo el schema del system prompt.',
        ].join('\n');
    }

    return [
        `Book: ${input.book}`,
        `Verses provided: ${input.verses.length}.${targetBlock}`,
        sourcePreamble,
        'Verse-by-verse text (`ch:v <TAB> text` format):',
        '',
        formatVerses(input.verses),
        '',
        '---',
        'Return only strict JSON conforming to the system prompt schema.',
    ].join('\n');
}

/**
 * JSON schema for Gemini's responseSchema generation config. Tracks
 * BookPanorama exactly; the assistant validates the response and
 * coerces shape errors into clean errors the wizard can render.
 */
export const PANORAMA_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        genre: {
            type: 'string',
            enum: [
                'epistle',
                'narrative',
                'poetry',
                'prophecy',
                'wisdom',
                'gospel',
                'apocalypse',
                'law',
                'mixed',
            ],
        },
        purpose: { type: 'string' },
        pastoralProblem: { type: 'string' },
        centralTheme: { type: 'string' },
        movements: {
            type: 'array',
            items: { type: 'string' },
        },
        keyTerms: {
            type: 'array',
            items: { type: 'string' },
        },
        redemptiveHistoryNote: { type: 'string' },
    },
    required: ['genre', 'purpose', 'pastoralProblem', 'centralTheme', 'movements', 'keyTerms'],
} as const;
