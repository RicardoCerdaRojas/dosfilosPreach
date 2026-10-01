import type { LiteraryGenre, MicroInput } from '@dosfilos/domain';
import { buildSourcePreamble, formatVerses } from './shared';

/**
 * Pase 3 — Microestructura.
 *
 * Receives panorama + macro-sections + verses. For each macro-section,
 * identifies the exegetical units inside it (syntactically-justified
 * blocks the AUTHOR appears to have shaped). Each unit carries:
 * the syntactic boundary, the literary signals that justify it, the
 * function it performs in the local argument, and a concise central
 * idea.
 *
 * Genre-aware: the system instruction branches based on the
 * panorama's `genre` so the criteria match the text type
 * (participial chains for Greek epistle, waw-consecutive for Hebrew
 * narrative, parallelism for poetry, oracle formulas for prophecy,
 * etc.). One LLM call per book — Pro 2.5's 1M context comfortably
 * holds all macros + all verses; later we can split per macro if
 * quality drops on long books.
 */

export function buildMicroSystemInstruction(
    genre: LiteraryGenre,
    displayLanguage: 'es' | 'en',
): string {
    const isSpanish = displayLanguage === 'es';
    const opening = isSpanish
        ? [
              'Eres un homileta y exegeta experto. Continúas un análisis ya iniciado: identificaste el panorama (Pase 1) y la macroestructura (Pase 2) del libro.',
              '',
              'En este paso debes producir la MICROESTRUCTURA: dentro de cada macro-sección, identifica las unidades exegéticas — bloques cuyo límite el AUTOR parece haber establecido por sintaxis, recurso literario o marcador de género.',
              '',
              'Para cada unidad exegética, produce:',
              '- id: cadena única dentro del run (ej. "eu-1").',
              '- macroSectionId: id de la macro-sección a la que pertenece (de la lista que recibirás abajo).',
              '- chapterStart, verseStart, chapterEnd, verseEnd: límites inclusivos de la unidad.',
              '- suggestedTitle: título corto y predicable (3-7 palabras) — útil para que el predicador identifique la unidad de un vistazo.',
              '- functionInArgument: qué HACE esta unidad en el argumento local (no qué tema toca). Ejemplo: "fundamenta la exhortación posterior con la base teológica de la elección" en lugar de "habla de elección".',
              '- centralIdea: oración única que resume lo que la unidad afirma o cumple.',
              '- literarySignals: array de marcadores concretos que justifican la frontera (ej. "cadena participial en 1:5-8", "inclusio formada por πίστις en 1:1 y 1:21", "fórmula wayyiqtol introduciendo nueva escena en 6:1"). Cada entrada debe citar un marcador específico, NO descripciones genéricas como "estructura sintáctica".',
              '- order: posición secuencial (1 = primera unidad del libro).',
              '',
              'Reglas innegociables:',
              '- Las unidades exegéticas NO se solapan y cubren TODA cada macro-sección sin huecos.',
              '- Una unidad exegética NO es necesariamente un sermón. La conversión a unidades predicables (combinar/dividir) ocurre en el siguiente paso, NO aquí.',
              '- Tamaño objetivo: cada macro-sección debe contener entre 1 y 8 unidades exegéticas. Más sugiere que estás dividiendo por versículo en lugar de por estructura.',
              '- El género del libro guía los criterios — abajo tienes los marcadores específicos del género detectado.',
          ].join('\n')
        : [
              'You are an expert homiletician and exegete. You are continuing a multi-step analysis: you identified the panorama (Pass 1) and the macrostructure (Pass 2) of the book.',
              '',
              'In this step, produce the MICROSTRUCTURE: within each macro-section, identify the exegetical units — blocks whose boundary the AUTHOR appears to have set by syntax, literary device, or genre marker.',
              '',
              'For each exegetical unit, produce:',
              '- id: unique string within the run (e.g. "eu-1").',
              '- macroSectionId: id of the macro-section it belongs to (from the list below).',
              '- chapterStart, verseStart, chapterEnd, verseEnd: inclusive boundaries.',
              '- suggestedTitle: short preachable title (3-7 words) — helps the preacher identify the unit at a glance.',
              '- functionInArgument: what this unit DOES in the local argument (not what topic it covers). Example: "grounds the later exhortation with the theological base of election" rather than "speaks about election".',
              '- centralIdea: single sentence summarizing what the unit affirms or accomplishes.',
              '- literarySignals: array of concrete markers justifying the boundary (e.g. "participial chain in 1:5-8", "inclusio formed by πίστις in 1:1 and 1:21", "wayyiqtol formula introducing new scene in 6:1"). Each entry must cite a specific marker, NOT generic descriptions like "syntactic structure".',
              '- order: sequential position (1 = first unit of the book).',
              '',
              'Non-negotiable rules:',
              '- Exegetical units do NOT overlap and cover EACH macro-section without gaps.',
              '- An exegetical unit is NOT necessarily a sermon. The conversion to preachable units (combine/split) happens in the next step, NOT here.',
              '- Target size: each macro-section should contain between 1 and 8 exegetical units. More suggests you are dividing by verse rather than by structure.',
              '- The book\'s genre guides the criteria — below you have the markers specific to the detected genre.',
          ].join('\n');

    return `${opening}\n\n${genreCriteria(genre, isSpanish)}\n\n${closingFormat(isSpanish)}`;
}

function closingFormat(isSpanish: boolean): string {
    return isSpanish
        ? 'Salida: JSON estricto con `exegeticalUnits: [{ id, macroSectionId, chapterStart, verseStart, chapterEnd, verseEnd, suggestedTitle, functionInArgument, centralIdea, literarySignals[], order }]`.'
        : 'Output: strict JSON with `exegeticalUnits: [{ id, macroSectionId, chapterStart, verseStart, chapterEnd, verseEnd, suggestedTitle, functionInArgument, centralIdea, literarySignals[], order }]`.';
}

function genreCriteria(genre: LiteraryGenre, isSpanish: boolean): string {
    if (isSpanish) {
        switch (genre) {
            case 'epistle':
                return [
                    '## Criterios para epístolas (griego del NT)',
                    '- Verbos finitos principales y sus participios subordinados.',
                    '- Conectores discursivos: γάρ (causa), οὖν (consecuencia), διό / διότι, ἵνα (propósito), ὥστε (resultado), εἰ / ἐάν (condición), ἀλλά (contraste).',
                    '- Pares μέν / δέ (estructura comparativa).',
                    '- Asíndeton (cambio sin conector — marcador de nueva unidad).',
                    '- Inclusio retórico (palabra clave que abre y cierra).',
                    '- Cambios entre indicativo (doctrina) e imperativo (exhortación).',
                    '- Citas o alusiones al AT — la cita y la afirmación que explica suelen formar una unidad.',
                ].join('\n');
            case 'narrative':
                return [
                    '## Criterios para narrativa hebrea',
                    '- Cadenas de wayyiqtol y cambios entre wayyiqtol / qatal / yiqtol / participio.',
                    '- Fórmulas narrativas: וַיְהִי, וַיֹּאמֶר, וַיֵּלֶךְ, וַיָּקָם, וַיַּרְא, וַיִּשְׁמַע.',
                    '- Cambios de personaje, lugar, tiempo o escena.',
                    '- Apertura o cierre de discursos directos.',
                    '- Comentarios explícitos del narrador.',
                    '- Repetición de palabras clave (Leitwort) que une o separa secciones.',
                    '- Tensión narrativa, clímax y resolución como una sola unidad — NO la cortes a la mitad.',
                ].join('\n');
            case 'poetry':
                return [
                    '## Criterios para poesía hebrea',
                    '- Paralelismo (sinónimo, antitético, sintético, escalonado) — NO rompas paralelismos que funcionan juntos.',
                    '- Bicola y tricola — agrupa según la estructura métrica visible.',
                    '- Inclusiones (palabra clave que abre y cierra).',
                    '- Quiasmos.',
                    '- Cambios de voz (lamento → confianza → alabanza, etc.).',
                    '- Cambios entre confesión, petición, alabanza, acción de gracias.',
                    '- Imágenes dominantes y campos semánticos.',
                    '- Acentos masoréticos relevantes para la estructura.',
                ].join('\n');
            case 'prophecy':
                return [
                    '## Criterios para literatura profética',
                    '- Fórmulas de mensajero (כֹּה אָמַר יְהוָה) y de cierre (נְאֻם־יְהוָה).',
                    '- Tipos de oráculo: juicio, salvación, lamento, ay (הוֹי), disputa legal, llamado al arrepentimiento.',
                    '- Estructura interna del oráculo: acusación → evidencia → sentencia → (a veces promesa).',
                    '- Cambios de destinatario (Israel / naciones / remanente).',
                    '- Alternancia entre cumplimiento histórico cercano y esperanza escatológica.',
                    '- Acciones simbólicas o imágenes recurrentes.',
                    '- NO mezcles oráculos distintos solo porque están cerca en el texto.',
                ].join('\n');
            case 'wisdom':
                return [
                    '## Criterios para literatura sapiencial',
                    '- Proverbios independientes vs agrupaciones temáticas.',
                    '- Contrastes recurrentes: justo / impío, sabio / necio, vida / muerte, diligente / perezoso, temor de YHWH / soberbia.',
                    '- Discursos de instrucción (llamados a "escuchar, hijo mío") vs colecciones de máximas.',
                    '- Personificaciones (Sabiduría, Necedad).',
                    '- Poemas acrósticos como unidades cerradas.',
                    '- Fórmulas de bienaventuranza (אַשְׁרֵי).',
                    '- NO unas proverbios independientes salvo que haya señales claras de agrupación temática, léxica o literaria.',
                ].join('\n');
            case 'gospel':
                return [
                    '## Criterios para evangelios',
                    '- Perícopas evangélicas tradicionales: milagros, controversias, parábolas, discursos, narrativas de pasión.',
                    '- Marcadores narrativos similares a la narrativa hebrea (cambios de escena, personaje, lugar).',
                    '- Inclusiones temáticas que el evangelista construye (geográficas, cristológicas, eclesiológicas).',
                    '- Citas del AT como bisagras estructurales.',
                    '- Una parábola + su explicación forman una unidad — NO las separes.',
                    '- Bloques de discurso (Sermón del Monte, discursos del Reino, discurso del Aposento Alto) — respeta la unidad mayor incluso si contiene varias subunidades.',
                ].join('\n');
            case 'apocalypse':
                return [
                    '## Criterios para apocalíptica',
                    '- Visiones como unidades cerradas (introducción → contenido visionario → respuesta del vidente / interpretación).',
                    '- Cadenas de imágenes simbólicas y números recurrentes.',
                    '- Fórmulas litúrgicas (cánticos, doxologías celestiales).',
                    '- Patrones de séptuples (sellos, trompetas, copas).',
                    '- Interludios narrativos entre series (no los separes de la serie a la que pertenecen).',
                    '- Ciclos de juicio + esperanza alternantes.',
                ].join('\n');
            case 'law':
                return [
                    '## Criterios para textos legales',
                    '- Marco narrativo (introducción del lugar / contexto del pacto) vs cuerpo legal.',
                    '- Tipos de ley: apodíctica ("no harás"), casuística ("si alguno..."), motivacional ("porque...").',
                    '- Agrupaciones temáticas (santuario, sacerdocio, pureza, fiestas, propiedad).',
                    '- Fórmulas de apertura y cierre de bloques legislativos.',
                    '- Conexión con el pacto y con santidad — la motivación teológica es parte de la unidad legal.',
                ].join('\n');
            case 'mixed':
            default:
                return [
                    '## Criterios para libros con géneros mixtos',
                    'El libro combina dos o más géneros con peso similar. Aplica los criterios del género dominante para cada bloque, identificando los cambios de género como fronteras importantes. Anota explícitamente en literarySignals cuándo cambia el género dentro del libro.',
                ].join('\n');
        }
    }

    // English variants
    switch (genre) {
        case 'epistle':
            return [
                '## Criteria for epistles (NT Greek)',
                '- Main finite verbs and their subordinated participles.',
                '- Discourse connectors: γάρ (cause), οὖν (consequence), διό / διότι, ἵνα (purpose), ὥστε (result), εἰ / ἐάν (condition), ἀλλά (contrast).',
                '- μέν / δέ pairs (comparative structure).',
                '- Asyndeton (change without connector — new-unit marker).',
                '- Rhetorical inclusio (key word opening and closing).',
                '- Shifts between indicative (doctrine) and imperative (exhortation).',
                '- OT citations or allusions — the citation and the affirmation it explains usually form one unit.',
            ].join('\n');
        case 'narrative':
            return [
                '## Criteria for Hebrew narrative',
                '- Wayyiqtol chains and shifts between wayyiqtol / qatal / yiqtol / participle.',
                '- Narrative formulas: וַיְהִי, וַיֹּאמֶר, וַיֵּלֶךְ, וַיָּקָם, וַיַּרְא, וַיִּשְׁמַע.',
                '- Changes of character, place, time, or scene.',
                '- Opening or closing of direct speech.',
                '- Explicit narrator comments.',
                '- Repetition of key words (Leitwort) joining or separating sections.',
                '- Narrative tension, climax and resolution as a single unit — DO NOT cut them in half.',
            ].join('\n');
        case 'poetry':
            return [
                '## Criteria for Hebrew poetry',
                '- Parallelism (synonymous, antithetic, synthetic, stair-step) — DO NOT break parallelisms that work together.',
                '- Bicola and tricola — group by visible metric structure.',
                '- Inclusions (key word opening and closing).',
                '- Chiasm.',
                '- Voice changes (lament → trust → praise, etc.).',
                '- Shifts between confession, petition, praise, thanksgiving.',
                '- Dominant images and semantic fields.',
                '- Masoretic accents relevant to structure.',
            ].join('\n');
        case 'prophecy':
            return [
                '## Criteria for prophetic literature',
                '- Messenger formulas (כֹּה אָמַר יְהוָה) and closing formulas (נְאֻם־יְהוָה).',
                '- Oracle types: judgment, salvation, lament, woe (הוֹי), legal dispute, call to repentance.',
                '- Internal oracle structure: accusation → evidence → sentence → (sometimes promise).',
                '- Changes of audience (Israel / nations / remnant).',
                '- Alternation between near historical fulfillment and eschatological hope.',
                '- Symbolic actions or recurring imagery.',
                '- DO NOT merge distinct oracles just because they are textually adjacent.',
            ].join('\n');
        case 'wisdom':
            return [
                '## Criteria for wisdom literature',
                '- Independent proverbs vs thematic groupings.',
                '- Recurring contrasts: righteous/wicked, wise/foolish, life/death, diligent/lazy, fear of YHWH/pride.',
                '- Instructional discourses ("listen, my son") vs collections of maxims.',
                '- Personifications (Wisdom, Folly).',
                '- Acrostic poems as closed units.',
                '- Beatitude formulas (אַשְׁרֵי).',
                '- DO NOT merge independent proverbs unless there are clear thematic, lexical, or literary signals of grouping.',
            ].join('\n');
        case 'gospel':
            return [
                '## Criteria for gospels',
                '- Traditional gospel pericopes: miracles, controversies, parables, discourses, passion narratives.',
                '- Narrative markers similar to Hebrew narrative (scene/character/place changes).',
                '- Thematic inclusions the evangelist builds (geographic, christological, ecclesiological).',
                '- OT citations as structural hinges.',
                '- A parable + its explanation form one unit — DO NOT separate them.',
                '- Discourse blocks (Sermon on the Mount, Kingdom discourses, Upper Room discourse) — respect the larger unit even if it contains subunits.',
            ].join('\n');
        case 'apocalypse':
            return [
                '## Criteria for apocalyptic',
                '- Visions as closed units (introduction → visionary content → seer\'s response / interpretation).',
                '- Chains of symbolic imagery and recurring numbers.',
                '- Liturgical formulas (heavenly hymns, doxologies).',
                '- Sevenfold patterns (seals, trumpets, bowls).',
                '- Narrative interludes between series (do not separate them from the series they belong to).',
                '- Alternating cycles of judgment + hope.',
            ].join('\n');
        case 'law':
            return [
                '## Criteria for legal texts',
                '- Narrative frame (place/covenant context introduction) vs legal body.',
                '- Law types: apodictic ("you shall not"), casuistic ("if anyone..."), motivational ("because...").',
                '- Thematic groupings (sanctuary, priesthood, purity, feasts, property).',
                '- Opening and closing formulas of legislative blocks.',
                '- Connection to covenant and holiness — theological motivation is part of the legal unit.',
            ].join('\n');
        case 'mixed':
        default:
            return [
                '## Criteria for mixed-genre books',
                'The book combines two or more genres with similar weight. Apply the criteria of the dominant genre for each block, identifying genre shifts as important boundaries. Explicitly note in literarySignals when the genre changes within the book.',
            ].join('\n');
    }
}

export function buildMicroUserMessage(input: MicroInput): string {
    const isSpanish = input.displayLanguage === 'es';
    const macroBlock = formatMacrosForPrompt(input.macroSections, isSpanish);
    const sourcePreamble = buildSourcePreamble(input.sourceLanguage, input.displayLanguage);

    if (isSpanish) {
        return [
            `Libro: ${input.book}`,
            `Género detectado: ${input.panorama.genre}`,
            '',
            macroBlock,
            sourcePreamble,
            'Texto verso a verso (formato `cap:vers <TAB> texto`):',
            '',
            formatVerses(input.verses),
            '',
            '---',
            'Devuelve únicamente JSON estricto siguiendo el schema del system prompt. Asegúrate de que cada exegeticalUnit cite un macroSectionId existente.',
        ].join('\n');
    }

    return [
        `Book: ${input.book}`,
        `Detected genre: ${input.panorama.genre}`,
        '',
        macroBlock,
        sourcePreamble,
        'Verse-by-verse text (`ch:v <TAB> text` format):',
        '',
        formatVerses(input.verses),
        '',
        '---',
        'Return only strict JSON conforming to the system prompt schema. Make sure each exegeticalUnit cites an existing macroSectionId.',
    ].join('\n');
}

function formatMacrosForPrompt(
    macros: ReadonlyArray<{ id: string; title: string; chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number; functionInBook: string }>,
    isSpanish: boolean,
): string {
    const heading = isSpanish ? '## Macroestructura (Pase 2)' : '## Macrostructure (Pass 2)';
    const lines = [heading];
    macros.forEach((m) => {
        const range = m.chapterStart === m.chapterEnd
            ? `${m.chapterStart}:${m.verseStart}-${m.verseEnd}`
            : `${m.chapterStart}:${m.verseStart}-${m.chapterEnd}:${m.verseEnd}`;
        lines.push(`- ${m.id} | ${range} | "${m.title}" | ${m.functionInBook}`);
    });
    return lines.join('\n');
}

export const MICRO_RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        exegeticalUnits: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    macroSectionId: { type: 'string' },
                    chapterStart: { type: 'integer' },
                    verseStart: { type: 'integer' },
                    chapterEnd: { type: 'integer' },
                    verseEnd: { type: 'integer' },
                    suggestedTitle: { type: 'string' },
                    functionInArgument: { type: 'string' },
                    centralIdea: { type: 'string' },
                    literarySignals: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                    order: { type: 'integer' },
                },
                required: [
                    'id',
                    'macroSectionId',
                    'chapterStart',
                    'verseStart',
                    'chapterEnd',
                    'verseEnd',
                    'suggestedTitle',
                    'functionInArgument',
                    'centralIdea',
                    'literarySignals',
                    'order',
                ],
            },
        },
    },
    required: ['exegeticalUnits'],
} as const;
