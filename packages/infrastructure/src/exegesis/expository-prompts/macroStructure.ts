import type { BookPanorama, MacroInput } from '@dosfilos/domain';
import { buildSourcePreamble, formatVerses } from './shared';

/**
 * Pase 2 — Macroestructura.
 *
 * Receives the panorama from Pase 1 + the full verse text. Divides
 * the book into a length-aware number of macro-sections (typically
 * 3-12), each carrying a function from the curated MacroFunction
 * set (introduction / thesis / argument-development / narrative-arc
 * / climax / application / closing / transition / digression).
 *
 * The original cap of 3-7 was genre/length-naive — it forced
 * Romans/Acts/Genesis into unnatural merging. The current target is
 * computed from verse count (`recommendMacroCount`) and offered as
 * a soft hint in the user message; the system prompt explicitly
 * says the genre's structural markers OVERRIDE the count when they
 * conflict (toledots in Genesis, oracle blocks in Isaiah, geographic
 * frame in Acts, 5-book division in Psalms, etc.).
 *
 * The panorama's `movements` field is a HINT (the LLM may rename or
 * regroup), not a constraint.
 */

/**
 * Length-aware target macro count. Derived from verse count via a
 * coarse linear curve (~80 verses per macro), clamped to the range
 * any sensible book occupies (3-12). Intended as a SOFT hint to
 * the LLM, not a hard cap.
 *
 * Calibrated against the academic consensus for representative
 * books:
 *   - Filemón (25v) → 3
 *   - 2 Pedro (60v) → 3
 *   - Filipenses (~104v) → 3-4
 *   - Romanos (~430v) → 5-6 (Moo divides into 6-7; we hint 5-6 and
 *     let the model bump up if the structure demands)
 *   - Hechos (~1000v) → 12 (matches the standard geographic/
 *     thematic division: 1:1-6:7 / 6:8-9:31 / 9:32-12:24 /
 *     12:25-16:5 / 16:6-19:20 / 19:21-28:31 plus inner subdivisions)
 *   - Génesis (~1500v) → 12 (matches the 11 toledots + prologue)
 *   - Isaías (~1290v) → 12
 */
export function recommendMacroCount(verseCount: number): number {
    if (verseCount <= 0) return 3;
    return Math.min(12, Math.max(3, Math.round(verseCount / 80)));
}

export function buildMacroSystemInstruction(displayLanguage: 'es' | 'en'): string {
    if (displayLanguage === 'es') {
        return [
            'Eres un homileta y exegeta experto. Continúas un análisis ya iniciado: en el paso anterior identificaste el panorama del libro (género, propósito, problema pastoral, tema, movimientos, palabras clave).',
            '',
            'En este paso debes producir la MACROESTRUCTURA: dividir el libro en macro-secciones grandes, cada una con su función dentro del flujo del libro.',
            '',
            'Una macro-sección NO es una perícopa ni un capítulo. Es un BLOQUE GRANDE que cumple una función dentro del argumento o narración del libro completo. Los sermones vivirán DENTRO de las macro-secciones, no entre ellas.',
            '',
            'Para cada macro-sección, identifica:',
            '- title: etiqueta corta del bloque (3-7 palabras).',
            '- chapterStart, verseStart, chapterEnd, verseEnd: límites inclusivos del bloque.',
            '- theme: sobre qué trata el bloque (1-2 oraciones).',
            '- functionInBook: rol del bloque dentro del libro. Elige UNO de:',
            '  • introduction — saludo, prólogo, presentación de autor o destinatarios.',
            '  • thesis — afirmación teológica que el resto del libro desarrolla.',
            '  • argument-development — bloques de exposición que sostienen la tesis.',
            '  • narrative-arc — tramo narrativo con tensión propia (apertura/desarrollo/clímax).',
            '  • climax — punto culminante de la argumentación o narración.',
            '  • application — exhortaciones, mandatos, consecuencias éticas.',
            '  • closing — saludos finales, doxología, despedida.',
            '  • transition — bisagra entre dos secciones grandes.',
            '  • digression — paréntesis explicativo o ilustrativo.',
            '- order: posición secuencial (1 = primera macro-sección del libro).',
            '',
            '## Cantidad de macro-secciones',
            '',
            'El predicador te pasará en el mensaje un número aproximado sugerido en función del tamaño del libro. Trátalo como GUÍA SUAVE, no como restricción. La estructura del texto manda — si el libro tiene marcadores estructurales canónicos que producen más o menos macro-secciones que la sugerencia, HÓNRALOS y diverge del número.',
            '',
            '## Marcadores estructurales canónicos a respetar',
            '',
            'Cuando el género del panorama coincida, busca y honra los siguientes marcadores aunque te lleven fuera del rango sugerido:',
            '',
            '- Narrativa hebrea: las **fórmulas toledot** (אֵלֶּה תּוֹלְדוֹת) en Génesis marcan 11 super-bloques + prólogo. Las series de wayyiqtol prolongadas marcan tramos narrativos.',
            '- Hechos: la **estructura geográfica de Lucas** (Jerusalén → Judea/Samaria → fin de la tierra) más los resúmenes de progreso recurrentes (6:7, 9:31, 12:24, 16:5, 19:20, 28:31).',
            '- Mateo: los **5 grandes discursos** (5-7, 10, 13, 18, 24-25) cada uno cierran con "y aconteció que cuando Jesús terminó..." — son macros incuestionables.',
            '- Salmos: la **división canónica en 5 libros** (1-41, 42-72, 73-89, 90-106, 107-150). Dentro de cada libro pueden existir colecciones (Salmos de ascenso 120-134, davídicos, etc.).',
            '- Profecía mayor: oráculos contra naciones forman bloques propios (Isa 13-23, Jer 46-51, Ez 25-32). Visión + interpretación forman una unidad.',
            '- Epístolas paulinas: típicamente saludo + acción de gracias + cuerpo doctrinal + sección parenética + saludos finales. NO mezcles doctrina con parénesis solo porque están adyacentes.',
            '- Sabiduría: prólogo + colecciones temáticas + epílogo. Los acrósticos son bloques cerrados.',
            '- Apocalipsis: prólogo + 7 cartas + ciclos septenarios (sellos/trompetas/copas) + interludios + epílogo.',
            '',
            '## Reglas innegociables',
            '',
            '- Las macro-secciones cubren TODO el libro sin huecos y sin solaparse.',
            '- La cantidad debe reflejar la estructura del texto, no un objetivo arbitrario. Mínimo 3 (todo libro tiene al menos apertura/desarrollo/cierre); máximo flexible según el libro lo demande.',
            '- La función debe reflejar lo que el bloque HACE en el flujo del libro, no solo el tema.',
            '- Los movimientos del panorama son una sugerencia inicial — puedes renombrar, regrupar o subdividir si la estructura del texto lo pide.',
            '',
            'Salida: JSON estricto con `macroSections: [{ id, title, chapterStart, verseStart, chapterEnd, verseEnd, theme, functionInBook, order }]`.',
            '- id: cadena única dentro del run (ej. "ms-1", "ms-2").',
        ].join('\n');
    }

    return [
        'You are an expert homiletician and exegete. You are continuing a multi-step analysis: in the previous step you identified the book\'s panorama (genre, purpose, pastoral problem, theme, movements, key terms).',
        '',
        'In this step, produce the MACROSTRUCTURE: divide the book into large macro-sections, each with its function within the book\'s flow.',
        '',
        'A macro-section is NOT a pericope or a chapter. It is a LARGE BLOCK that performs a function within the book\'s overall argument or narrative. Sermons will live INSIDE macro-sections, not across them.',
        '',
        'For each macro-section, identify:',
        '- title: short block label (3-7 words).',
        '- chapterStart, verseStart, chapterEnd, verseEnd: inclusive boundaries.',
        '- theme: what the block is about (1-2 sentences).',
        '- functionInBook: role within the book. Choose ONE of:',
        '  • introduction — greeting, prologue, presentation of author or recipients.',
        '  • thesis — theological affirmation the rest of the book develops.',
        '  • argument-development — exposition blocks supporting the thesis.',
        '  • narrative-arc — narrative stretch with its own tension (opening/development/climax).',
        '  • climax — culminating point of the argument or narrative.',
        '  • application — exhortations, commands, ethical consequences.',
        '  • closing — final greetings, doxology, farewell.',
        '  • transition — hinge between two large sections.',
        '  • digression — explanatory or illustrative parenthesis.',
        '- order: sequential position (1 = first macro-section of the book).',
        '',
        '## Macro-section count',
        '',
        'The preacher will pass an approximate suggested count in the user message, scaled to the book length. Treat it as a SOFT GUIDE, not a constraint. The text\'s structure rules — if the book has canonical structural markers that produce more or fewer macro-sections than the suggestion, HONOR THEM and diverge from the count.',
        '',
        '## Canonical structural markers to respect',
        '',
        'When the panorama\'s genre matches, look for and honor the following markers even if they take you outside the suggested range:',
        '',
        '- Hebrew narrative: the **toledot formulas** (אֵלֶּה תּוֹלְדוֹת) in Genesis mark 11 super-blocks + prologue. Extended wayyiqtol chains mark narrative stretches.',
        '- Acts: Luke\'s **geographic structure** (Jerusalem → Judea/Samaria → ends of the earth) plus the recurring progress summaries (6:7, 9:31, 12:24, 16:5, 19:20, 28:31).',
        '- Matthew: the **5 great discourses** (5-7, 10, 13, 18, 24-25) each closing with "And it happened that when Jesus finished..." — incontrovertible macros.',
        '- Psalms: the **canonical 5-book division** (1-41, 42-72, 73-89, 90-106, 107-150). Within each book, collections may exist (Songs of Ascent 120-134, Davidic, etc.).',
        '- Major prophecy: oracles against the nations form their own blocks (Isa 13-23, Jer 46-51, Ez 25-32). Vision + interpretation form one unit.',
        '- Pauline epistles: typically greeting + thanksgiving + doctrinal body + paraenetic section + final greetings. DO NOT mix doctrine with paraenesis just because they are adjacent.',
        '- Wisdom: prologue + thematic collections + epilogue. Acrostics are closed blocks.',
        '- Apocalypse: prologue + 7 letters + septenary cycles (seals/trumpets/bowls) + interludes + epilogue.',
        '',
        '## Non-negotiable rules',
        '',
        '- Macro-sections cover the ENTIRE book without gaps or overlaps.',
        '- The count must reflect the text\'s structure, not an arbitrary target. Minimum 3 (every book has at least opening/body/closing); maximum flexible per the book\'s demands.',
        '- The function must reflect what the block DOES in the book\'s flow, not just the topic.',
        '- The panorama\'s movements are an initial suggestion — you may rename, regroup, or subdivide if the text\'s structure calls for it.',
        '',
        'Output: strict JSON with `macroSections: [{ id, title, chapterStart, verseStart, chapterEnd, verseEnd, theme, functionInBook, order }]`.',
        '- id: unique string within the run (e.g. "ms-1", "ms-2").',
    ].join('\n');
}

export function buildMacroUserMessage(input: MacroInput): string {
    const isSpanish = input.displayLanguage === 'es';
    const panoramaBlock = formatPanoramaForPrompt(input.panorama, isSpanish);
    const recommended = recommendMacroCount(input.verses.length);
    const countHint = isSpanish
        ? `Cantidad sugerida (guía suave, escalada al tamaño del libro de ${input.verses.length} versos): aproximadamente ${recommended} macro-secciones. Diverge si los marcadores estructurales canónicos del género lo demandan.`
        : `Suggested count (soft guide, scaled to the ${input.verses.length}-verse book): approximately ${recommended} macro-sections. Diverge if the genre's canonical structural markers demand it.`;
    const sourcePreamble = buildSourcePreamble(input.sourceLanguage, input.displayLanguage, input.book);
    const superBlock = formatSuperMacroBlock(input.superMacroSections, isSpanish);

    if (isSpanish) {
        return [
            `Libro: ${input.book}`,
            '',
            panoramaBlock,
            superBlock,
            '',
            countHint,
            sourcePreamble,
            'Texto verso a verso (formato `cap:vers <TAB> texto`):',
            '',
            formatVerses(input.verses),
            '',
            '---',
            'Devuelve únicamente JSON estricto siguiendo el schema del system prompt.',
        ].filter(Boolean).join('\n');
    }

    return [
        `Book: ${input.book}`,
        '',
        panoramaBlock,
        superBlock,
        '',
        countHint,
        sourcePreamble,
        'Verse-by-verse text (`ch:v <TAB> text` format):',
        '',
        formatVerses(input.verses),
        '',
        '---',
        'Return only strict JSON conforming to the system prompt schema.',
    ].filter(Boolean).join('\n');
}

/**
 * Two-tier mode (v1.6): when the wizard ran Pase 2a and produced
 * super-macros, surface them in the user message so the model nests
 * each macro under one. Each output macro must populate
 * `parentSuperMacroId` matching one of the listed super-macro ids;
 * macros may not cross super-macro boundaries.
 */
function formatSuperMacroBlock(
    superMacros: ReadonlyArray<{ id: string; title: string; chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number; theme: string }> | undefined,
    isSpanish: boolean,
): string {
    if (!superMacros || superMacros.length === 0) return '';
    const lines: string[] = [''];
    if (isSpanish) {
        lines.push('## Super-macros del libro (Pase 2a — modo dos-niveles)');
        lines.push('Las macros que produzcas DEBEN anidar bajo uno de los siguientes super-macros. Cada macro de salida debe llevar `parentSuperMacroId` igual al id del super-macro contenedor. Las macros no pueden cruzar los límites de un super-macro.');
        lines.push('');
    } else {
        lines.push('## Book super-macros (Pass 2a — two-tier mode)');
        lines.push('Macros you produce MUST nest under one of the following super-macros. Each output macro must carry `parentSuperMacroId` matching the enclosing super-macro id. Macros may not cross super-macro boundaries.');
        lines.push('');
    }
    for (const sm of superMacros) {
        const range = sm.chapterStart === sm.chapterEnd
            ? `${sm.chapterStart}:${sm.verseStart}-${sm.verseEnd}`
            : `${sm.chapterStart}:${sm.verseStart}-${sm.chapterEnd}:${sm.verseEnd}`;
        lines.push(`- \`${sm.id}\` — ${sm.title} (${range}): ${sm.theme}`);
    }
    return lines.join('\n');
}

function formatPanoramaForPrompt(panorama: BookPanorama, isSpanish: boolean): string {
    const lines: string[] = [];
    if (isSpanish) {
        lines.push('## Panorama del libro (Pase 1)');
        lines.push(`- Género: ${panorama.genre}`);
        lines.push(`- Propósito: ${panorama.purpose}`);
        lines.push(`- Problema pastoral: ${panorama.pastoralProblem}`);
        lines.push(`- Tema central: ${panorama.centralTheme}`);
        lines.push(`- Movimientos sugeridos: ${panorama.movements.join(' / ')}`);
        if (panorama.keyTerms.length > 0) {
            lines.push(`- Términos clave: ${panorama.keyTerms.join(', ')}`);
        }
        if (panorama.redemptiveHistoryNote) {
            lines.push(`- Historia redentora: ${panorama.redemptiveHistoryNote}`);
        }
    } else {
        lines.push('## Book panorama (Pass 1)');
        lines.push(`- Genre: ${panorama.genre}`);
        lines.push(`- Purpose: ${panorama.purpose}`);
        lines.push(`- Pastoral problem: ${panorama.pastoralProblem}`);
        lines.push(`- Central theme: ${panorama.centralTheme}`);
        lines.push(`- Suggested movements: ${panorama.movements.join(' / ')}`);
        if (panorama.keyTerms.length > 0) {
            lines.push(`- Key terms: ${panorama.keyTerms.join(', ')}`);
        }
        if (panorama.redemptiveHistoryNote) {
            lines.push(`- Redemptive history: ${panorama.redemptiveHistoryNote}`);
        }
    }
    return lines.join('\n');
}

export const MACRO_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        macroSections: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    chapterStart: { type: 'integer' },
                    verseStart: { type: 'integer' },
                    chapterEnd: { type: 'integer' },
                    verseEnd: { type: 'integer' },
                    theme: { type: 'string' },
                    functionInBook: {
                        type: 'string',
                        enum: [
                            'introduction',
                            'thesis',
                            'argument-development',
                            'narrative-arc',
                            'climax',
                            'application',
                            'closing',
                            'transition',
                            'digression',
                        ],
                    },
                    order: { type: 'integer' },
                    /** v1.6 two-tier mode — set when super-macros were passed. */
                    parentSuperMacroId: { type: 'string' },
                },
                required: [
                    'id',
                    'title',
                    'chapterStart',
                    'verseStart',
                    'chapterEnd',
                    'verseEnd',
                    'theme',
                    'functionInBook',
                    'order',
                ],
            },
        },
    },
    required: ['macroSections'],
} as const;
