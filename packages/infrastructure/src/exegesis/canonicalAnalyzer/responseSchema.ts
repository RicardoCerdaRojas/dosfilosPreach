import type { TestamentVoice } from '../testamentVoice';

/**
 * Gemini response schema for `CanonicalVerseAnalysis`.
 *
 * Gemini's `responseSchema` parameter accepts a subset of JSON Schema
 * (no oneOf/anyOf/$ref, no recursive types, limited format hints).
 * The shape below is a flat JSON-Schema-shaped object Gemini honors
 * server-side, guaranteeing the parsed output matches the domain
 * `CanonicalVerseAnalysis` type up to renaming of timestamps (Date
 * fields are stamped by the application layer post-parse, not by the
 * model).
 *
 * Drift discipline: when `CanonicalVerseAnalysis` changes in domain,
 * update this schema in lockstep. The analyzer runtime parser does a
 * shallow shape check on top of Gemini's enforcement so drift surfaces
 * as a parse error early.
 *
 * Why hand-written instead of zod-generated:
 *   - Zero new dependencies in infrastructure (zod is currently a
 *     web-only dep). Domain stays library-pure.
 *   - The schema is stable enough that hand-maintenance is cheap.
 *     We change it only when canonical methodology shifts.
 *   - Hand-writing lets us add rich `description` strings per field
 *     that Gemini reads as guidance — these would be lost if
 *     auto-generated from TS types.
 *
 * POR QUÉ ES UNA FUNCIÓN Y NO UNA CONSTANTE
 *
 * Sus descripciones estaban fijas en griego —«versículo del NT griego», «según
 * NA28/UBS5», «término griego»— mientras el prompt del sistema ya cambiaba de
 * testamento con `voiceFor`. Analizando Jonás, el modelo recibía dos
 * instrucciones opuestas en la misma llamada: el prompt le pedía hebreo con
 * aparato BHS y el esquema le pedía griego con aparato NA28.
 *
 * En producción ganó el prompt —los análisis de Jonás no traen una sola
 * referencia a NA28— pero eso es suerte, no diseño: son dos señales en conflicto
 * y la que gana depende del modelo, de su versión y del largo del prompt. Un
 * esquema que contradice a su propio prompt es una regresión esperando el día
 * en que la balanza se incline para el otro lado.
 */
export function canonicalVerseAnalysisSchema(voice: TestamentVoice) {
    return {
    type: 'object',
    description:
        `Análisis exegético canónico de un único versículo ${voice.testamentEs}, en ${voice.language}, ` +
        'estructurado según los once pasos del método histórico-gramatical-literal ' +
        'más los cinco diferenciadores documentados en docs/exegesis/METODOLOGIA.md.',
    properties: {
        originalText: {
            type: 'string',
            description: `Texto ${voice.languageAdjEs} del versículo según la edición crítica de referencia (${voice.apparatusEs}).`,
        },
        textualCriticism: {
            type: 'object',
            description:
                'Paso 1 (capa 1) y Diferenciador 4. SIEMPRE presente. Cuando no hay ' +
                'variantes significativas en el aparato, "variants" queda vacío y ' +
                '"note" lo confirma explícitamente. Disciplina forzada de revisión.',
            properties: {
                note: {
                    type: 'string',
                    description:
                        'Nota siempre presente. Confirma que la revisión del aparato se hizo. ' +
                        `Cuando no hay variantes: ej. "Sin variantes significativas en el aparato para este verso." ` +
                        'Cuando hay variantes: breve resumen del panorama antes de detallar.',
                },
                variants: {
                    type: 'array',
                    description:
                        'Variantes textuales detalladas. Vacío cuando "note" indica que no hay variantes significativas.',
                    items: {
                        type: 'object',
                        properties: {
                            lemma: {
                                type: 'string',
                                description: `Palabra o frase contestada, en ${voice.language}.`,
                            },
                            readings: {
                                type: 'array',
                                description: 'Lecturas variantes observadas en el aparato.',
                                items: {
                                    type: 'object',
                                    properties: {
                                        text: {
                                            type: 'string',
                                            description: `Texto de la lectura, en ${voice.language}.`,
                                        },
                                        witnesses: {
                                            type: 'array',
                                            description:
                                                'Testigos manuscritos que apoyan esta lectura. ' +
                                                'Usar siglas estándar del aparato: papiros (𝔓⁴⁶), mayúsculos (ℵ, A, B, C, D), ' +
                                                'versiones (lat, syr, cop), citas patrísticas.',
                                            items: { type: 'string' },
                                        },
                                    },
                                    required: ['text', 'witnesses'],
                                },
                            },
                            adoptedReading: {
                                type: 'string',
                                description: 'Lectura adoptada por este análisis.',
                            },
                            rationale: {
                                type: 'string',
                                description:
                                    'Justificación. Debe referenciar los cánones de crítica textual ' +
                                    'que informaron la decisión (lectio brevior, lectio difficilior, ' +
                                    'peso de testigos, etc.). 1-3 oraciones.',
                            },
                            apparatusReference: {
                                type: 'string',
                                description:
                                    `Referencia opcional al aparato del testamento correspondiente (${voice.apparatusEs}). Vacío si no aplica.`,
                            },
                        },
                        required: ['lemma', 'readings', 'adoptedReading', 'rationale'],
                    },
                },
            },
            required: ['note', 'variants'],
        },
        syntacticAnalysis: {
            type: 'object',
            description:
                'Pasos 2-3 (capa 2). Análisis sintáctico con datos morfológicos integrados ' +
                'en cada elemento. NO se separa morfología en una tabla aparte — la morfología ' +
                'es parte de cómo se describe la función sintáctica de cada construcción.',
            properties: {
                mainVerb: {
                    type: 'object',
                    nullable: true,
                    description:
                        'Verbo principal de la oración que contiene este verso. PUEDE ser null cuando el verso ' +
                        'es parte de una oración cuyo verbo principal está en un verso vecino (cadenas participiales, ' +
                        'pares μέν...δέ, oraciones periódicas extendidas). Cuando es null, "mainVerbNote" debe explicar dónde está.',
                    properties: {
                        text: { type: 'string' },
                        morphology: { type: 'string' },
                        syntacticFunction: { type: 'string' },
                        interpretiveSignificance: { type: 'string' },
                    },
                    required: ['text', 'morphology', 'syntacticFunction', 'interpretiveSignificance'],
                },
                mainVerbNote: {
                    type: 'string',
                    description:
                        'Nota que explica dónde vive el verbo principal cuando "mainVerb" es null. Vacío cuando hay verbo principal.',
                },
                keyConstructions: {
                    type: 'array',
                    description:
                        'Construcciones sintácticas clave: participios y su función, cláusulas relativas, ' +
                        'frases preposicionales con matiz por preposición + caso, construcciones de genitivo ' +
                        'según las categorías de Wallace. Cada una con morfología + función + significancia interpretativa.',
                    items: {
                        type: 'object',
                        properties: {
                            text: {
                                type: 'string',
                                description: `Fragmento del texto ${voice.languageAdjEs} como aparece en el verso.`,
                            },
                            morphology: {
                                type: 'string',
                                description:
                                    'Descripción morfológica en lenguaje natural (matching el idioma de salida). ' +
                                    'Ej.: "participio aoristo activo, nominativo masculino singular"; ' +
                                    '"frase preposicional con dativo".',
                            },
                            syntacticFunction: {
                                type: 'string',
                                description:
                                    'Función sintáctica anclada en categorías de Wallace. ' +
                                    'Ej.: "circunstancial temporal" / "esfera locativa" / "genitivo descriptivo".',
                            },
                            interpretiveSignificance: {
                                type: 'string',
                                description:
                                    'Por qué este elemento importa para el significado del verso. 1-2 oraciones. ' +
                                    'Citas inline en formato (Autor, "Título", p. N) cuando aplican.',
                            },
                        },
                        required: ['text', 'morphology', 'syntacticFunction', 'interpretiveSignificance'],
                    },
                },
                discourseParticles: {
                    type: 'array',
                    description:
                        'Paso 5. Partículas discursivas (δέ, γάρ, οὖν, μέν...δέ, καί, ἀλλά, ὅτι) ' +
                        'con su función argumentativa. Vacío cuando ninguna partícula del verso amerita comentario. ' +
                        'Anclar en categorías de Levinsohn / Runge.',
                    items: {
                        type: 'object',
                        properties: {
                            particle: { type: 'string' },
                            function: {
                                type: 'string',
                                description:
                                    'Función argumentativa per Runge. Ej.: "marcador de desarrollo" (δέ), ' +
                                    '"marcador de fundamento" (γάρ), "marcador de inferencia" (οὖν).',
                            },
                            note: {
                                type: 'string',
                                description: 'Cómo opera la partícula en este verso específico. 1-2 oraciones.',
                            },
                        },
                        required: ['particle', 'function', 'note'],
                    },
                },
            },
            required: ['mainVerb', 'keyConstructions', 'discourseParticles'],
        },
        lexicalAnalyses: {
            type: 'array',
            description:
                'Paso 4 (capa 2) y Diferenciador 1. Análisis léxico-semántico por término clave. ' +
                'Separa "rango semántico general" (lo que documentan los léxicos) de "carga específica en el verso" ' +
                '(cómo el contexto inmediato selecciona del rango). Salvaguarda contra la falacia de "totalidad transferida".',
            items: {
                type: 'object',
                properties: {
                    term: {
                        type: 'string',
                        description: `Término ${voice.language} como aparece en el verso (flexionado).`,
                    },
                    lemma: { type: 'string', description: 'Lemma (forma de diccionario).' },
                    gloss: { type: 'string', description: 'Glosa inicial para lectores no-especialistas.' },
                    generalSemanticRange: {
                        type: 'object',
                        description: 'Rango semántico general según léxicos (BDAG, LSJ, Louw-Nida).',
                        properties: {
                            glosses: {
                                type: 'array',
                                description: 'Posibles glosas a través del rango del término.',
                                items: { type: 'string' },
                            },
                            sources: {
                                type: 'array',
                                items: SOURCE_CITATION_SCHEMA(),
                            },
                        },
                        required: ['glosses', 'sources'],
                    },
                    verseSpecificLoading: {
                        type: 'string',
                        description:
                            'Diferenciador 1: cómo el contexto inmediato del verso selecciona del rango general. ' +
                            '1-3 oraciones. Nombrar la presión contextual específica ' +
                            '(ej. "el dativo locativo activa la lectura de esfera, no la instrumental").',
                    },
                    loadingSources: {
                        type: 'array',
                        description: 'Fuentes citadas para el argumento de carga específica (típicamente comentaristas).',
                        items: SOURCE_CITATION_SCHEMA(),
                    },
                },
                required: ['term', 'lemma', 'gloss', 'generalSemanticRange', 'verseSpecificLoading', 'loadingSources'],
            },
        },
        argumentativeRole: {
            type: 'string',
            description:
                'Paso 6 (capa 3) y Diferenciador 2. 1-2 oraciones nombrando qué hace este verso ' +
                'en el flujo argumentativo de la pericopa: ¿establece tesis, desarrolla, contrasta, ejemplifica, transiciona, concluye?',
        },
        historicalContext: {
            type: 'array',
            description:
                'Paso 7 (capa 3). Trasfondo histórico-cultural. Vacío cuando el verso no demanda contexto extra-textual. ' +
                'NO incluir por completitud — solo cuando genuinamente informa el sentido.',
            items: {
                type: 'object',
                properties: {
                    aspect: {
                        type: 'string',
                        description: 'Aspecto explicado (ej. "dinámica patrón-cliente", "convenciones del testamento como género literario").',
                    },
                    relevance: { type: 'string', description: 'Cómo este aspecto importa para el significado del verso. 1-2 oraciones.' },
                    sources: { type: 'array', items: SOURCE_CITATION_SCHEMA() },
                },
                required: ['aspect', 'relevance', 'sources'],
            },
        },
        oldTestamentLinks: {
            type: 'array',
            description: 'Paso 8 (capa 3). Citas/alusiones/ecos del AT. Taxonomía de Hays. Vacío cuando no hay resonancia canónica.',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['quotation', 'allusion', 'echo'] },
                    sourcePassage: { type: 'string', description: 'Pasaje del AT (ej. "Salmos 110:1").' },
                    citationFormula: {
                        type: 'string',
                        description:
                            'Fórmula de cita presente en el verso (γέγραπται, καθὼς εἴρηται). Vacío para alusiones/ecos.',
                    },
                    interpretiveBearing: {
                        type: 'string',
                        description: 'Qué aporta interpretativamente la conexión. 1-2 oraciones.',
                    },
                    sources: { type: 'array', items: SOURCE_CITATION_SCHEMA() },
                },
                required: ['type', 'sourcePassage', 'interpretiveBearing', 'sources'],
            },
        },
        commentatorEngagement: {
            type: 'array',
            description:
                'Paso 9 (capa 4). Engagement con comentaristas según la estrategia dialéctica ancla/contraste/técnica. ' +
                'NO es lista de citas — es lista de POSICIONES. Cada entrada parafrasea lo que el comentarista argumenta sobre ESTE verso.',
            items: {
                type: 'object',
                properties: {
                    sourceKey: {
                        type: 'string',
                        description: 'Clave de cita que coincide con una fuente configurada en el paper.',
                    },
                    page: { type: 'integer', description: 'Página donde se articula la posición.' },
                    role: { type: 'string', enum: ['anchor', 'contrast', 'technical'] },
                    position: {
                        type: 'string',
                        description: 'Qué argumenta este comentarista sobre este verso. 1-3 oraciones, parafraseado.',
                    },
                    verbatimQuote: {
                        type: 'string',
                        description:
                            'OBLIGATORIA. La oración textual de la fuente que respalda "position", copiada EXACTA ' +
                            'del texto provisto de esa fuente. Si no podés localizarla en el texto provisto, ' +
                            'NO incluyas esta entrada.',
                    },
                },
                required: ['sourceKey', 'page', 'role', 'position', 'verbatimQuote'],
            },
        },
        translationCruxes: {
            type: 'array',
            description:
                'Paso 10 (capa 5). Cruces de traducción contestados en el verso. Cada uno con opciones, ' +
                'posiciones de comentaristas, y COMPROMISO escogido con justificación derivada del análisis previo.',
            items: {
                type: 'object',
                properties: {
                    phrase: { type: 'string', description: `Frase ${voice.languageAdjEs} cuya traducción está en disputa.` },
                    description: {
                        type: 'string',
                        description: 'Por qué es un crux. 1-2 oraciones.',
                    },
                    options: {
                        type: 'array',
                        description: 'Opciones de traducción consideradas.',
                        items: {
                            type: 'object',
                            properties: {
                                translation: { type: 'string' },
                                characterization: {
                                    type: 'string',
                                    description: 'Caracterización del matiz interpretativo (ej. "instrumental", "locativo", "modal").',
                                },
                            },
                            required: ['translation', 'characterization'],
                        },
                    },
                    commentatorPositions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                sourceKey: { type: 'string' },
                                page: { type: 'integer' },
                                summary: { type: 'string', description: 'Resumen de 1-2 oraciones de la posición.' },
                                supports: {
                                    type: 'integer',
                                    description: 'Índice (0-based) en "options" indicando qué opción apoya el comentarista.',
                                },
                                verbatimQuote: {
                                    type: 'string',
                                    description:
                                        'OBLIGATORIA. La oración textual de la fuente en la que se apoya "summary", ' +
                                        'copiada EXACTA del texto de esa fuente provisto en el mensaje del usuario. ' +
                                        'Si no podés localizar la oración en el texto provisto, NO incluyas esta posición.',
                                },
                            },
                            required: ['sourceKey', 'page', 'summary', 'supports', 'verbatimQuote'],
                        },
                    },
                    commitment: {
                        type: 'object',
                        properties: {
                            chosen: { type: 'string', description: 'La traducción elegida.' },
                            rationale: {
                                type: 'string',
                                description:
                                    'Justificación derivada del análisis. 1-3 oraciones. ' +
                                    'Debe conectar de vuelta a hallazgos sintácticos/léxicos del análisis previo.',
                            },
                        },
                        required: ['chosen', 'rationale'],
                    },
                },
                required: ['phrase', 'description', 'options', 'commentatorPositions', 'commitment'],
            },
        },
        initialTranslation: {
            type: 'string',
            description:
                'Traducción de trabajo del verso ANTES de resolver los cruces. ' +
                `Es la "primera pasada" que el alumno haría al leer el ${voice.language}. Surfaces en study mode.`,
        },
        finalTranslation: {
            type: 'string',
            description:
                'Traducción final reflejando los compromisos adoptados en translationCruxes. ' +
                'Cuando no hay cruces identificados, igual a initialTranslation.',
        },
        verseThesis: {
            type: 'string',
            description:
                'Paso 11 (capa 6). Tesis del verso. 1-3 oraciones articulando qué establece ESTE verso ' +
                'dado el análisis. PUEDE referenciar el verso INMEDIATAMENTE ADYACENTE solo cuando la gramática lo exige ' +
                '(pares μέν...δέ, cadenas participiales, comparativos). NUNCA recapitular la pericopa, NUNCA mencionar versos distantes.',
        },
        theologicalHooks: {
            type: 'array',
            description:
                'Diferenciador 5. Loci doctrinales tocados por el verso. ' +
                'Usado por composers no-académicos (sermón, devocional). El composer académico los ignora.',
            items: {
                type: 'object',
                properties: {
                    locus: {
                        type: 'string',
                        enum: [
                            'cristologia',
                            'soteriologia',
                            'eclesiologia',
                            'antropologia',
                            'pneumatologia',
                            'escatologia',
                            'bibliologia',
                            'teologia-propia',
                            'angelologia-demonologia',
                            'etica-cristiana',
                            'otro',
                        ],
                    },
                    customLocus: {
                        type: 'string',
                        description: 'Nombre custom cuando locus === "otro". Vacío en otros casos.',
                    },
                    contribution: {
                        type: 'string',
                        description: 'Qué contribuye este verso a este locus. 1-2 oraciones.',
                    },
                },
                required: ['locus', 'contribution'],
            },
        },
        confidenceFlags: {
            type: 'array',
            description:
                'Diferenciador 3. Flags de confianza para afirmaciones específicas. ' +
                'Composers usan estos flags para calibrar lenguaje hedge en la prosa final.',
            items: {
                type: 'object',
                properties: {
                    claim: {
                        type: 'string',
                        description:
                            'Afirmación flageada — específica suficiente para anclar a un movimiento interpretativo particular.',
                    },
                    level: { type: 'string', enum: ['high', 'medium', 'tentative'] },
                    preferredHedges: {
                        type: 'array',
                        description:
                            'Frases hedge preferidas para esta afirmación según el nivel. ' +
                            'High: ["demuestra", "establece"]. Medium: ["sostiene", "argumenta"]. Tentative: ["sugiere", "podría leerse como"].',
                        items: { type: 'string' },
                    },
                },
                required: ['claim', 'level', 'preferredHedges'],
            },
        },
        footnoteExtensions: {
            type: 'array',
            description:
                'Extensiones para notas al pie. Cada entrada ancla a una frase verbatim de uno de los campos prosaicos ' +
                'y carga 1-3 oraciones de extensión del argumento con sus fuentes.',
            items: {
                type: 'object',
                properties: {
                    anchorPhrase: {
                        type: 'string',
                        description:
                            'Frase verbatim de uno de los campos prosaicos del análisis. Composer fuzzy-matchea para colocar el marcador.',
                    },
                    text: { type: 'string', description: 'Cuerpo de la nota al pie. 1-3 oraciones.' },
                    sources: { type: 'array', items: SOURCE_CITATION_SCHEMA() },
                },
                required: ['anchorPhrase', 'text', 'sources'],
            },
        },
    },
    required: [
        'originalText',
        'textualCriticism',
        'syntacticAnalysis',
        'lexicalAnalyses',
        'argumentativeRole',
        'historicalContext',
        'oldTestamentLinks',
        'commentatorEngagement',
        'translationCruxes',
        'initialTranslation',
        'finalTranslation',
        'verseThesis',
        'theologicalHooks',
        'confidenceFlags',
        'footnoteExtensions',
        ],
    } as const;
}

/**
 * `SourceCitation` schema. Inlined as a function-call producing fresh
 * objects because Gemini's responseSchema doesn't support `$ref` —
 * each occurrence needs its own concrete object.
 */
function SOURCE_CITATION_SCHEMA() {
    return {
        type: 'object',
        properties: {
            sourceKey: {
                type: 'string',
                description: 'Clave de cita que coincide con una fuente configurada en el paper.',
            },
            page: {
                type: 'integer',
                description: 'Número de página. Usar 0 solo cuando la fuente no tiene paginación.',
            },
            locator: {
                type: 'string',
                description: 'Disambiguador opcional cuando sourceKey no basta (ej. "vol. 2", "§142", "ad loc."). Vacío si no aplica.',
            },
        },
        required: ['sourceKey', 'page'],
    } as const;
}
