/**
 * Lo que el MODELO aporta al analizador griego — y sólo eso.
 *
 * La morfología NO está aquí: es determinista (MorphGNT) y se resolvió en la
 * fase 1. El modelo recibe esa morfología como CONTEXTO y aporta lo que no es
 * calculable: rango semántico del lema, función sintáctica en la frase, y las
 * dos traducciones del versículo. Separar las capas mantiene honesto al
 * sistema: lo verificable nunca depende de lo generado.
 */

/** El aporte del modelo para UNA palabra. */
export interface GreekWordInsight {
    /** Forma superficial, para validar el alineamiento con los tokens. */
    readonly text: string;
    /** Rango semántico del lema: los sentidos posibles, no uno solo. */
    readonly semanticRange: string;
    /** Cómo funciona ESTA palabra en ESTA frase. */
    readonly syntacticFunction: string;
    /**
     * La FUNCIÓN DEL CASO según la taxonomía estándar (Wallace) — el nombre
     * técnico que un profesor de seminario evalúa: "nominativo absoluto",
     * "genitivo de posesión", "dativo de medio". Id de la lista CERRADA
     * (`CASE_FUNCTIONS`); el parser descarta lo que no esté en ella. Ausente
     * cuando la palabra no tiene caso o el modelo no la determinó.
     */
    readonly caseFunction?: string;
    /**
     * Historia del nombre propio: por qué Ἰάκωβος se traduce "Santiago" y no
     * "Jacobo". Sólo en nombres propios y sólo cuando hay algo que contar.
     */
    readonly nameNote?: string;
    /**
     * El uso del ARTÍCULO según la taxonomía cerrada (`ARTICLE_USES`). El
     * artículo griego no es "el/la" español: hace trabajos que el castellano
     * no marca, y explicarlos es lo que convierte un artículo suelto en un
     * hilo argumental visible.
     */
    readonly articleUse?: string;
    /**
     * Con `articleUse: 'anaphoric'`, A QUÉ señala hacia atrás — la palabra y
     * su versículo ("ὑπομονήν, v. 3"). Es lo que explica por qué un versículo
     * puede EMPEZAR con un artículo.
     */
    readonly antecedent?: string;
    /**
     * Descomposición de una palabra COMPUESTA (ὁλόκληροι = ὅλος + κλῆρος).
     *
     * CON LA SALVAGUARDA CONTRA LA FALACIA DE LA RAÍZ, que es la razón de que
     * `meaningMatchesParts` exista: el error exegético más común es suponer
     * que el sentido de un compuesto ES la suma de sus partes. A veces lo es
     * y a veces el uso se alejó por completo — y un pastor que predica la
     * etimología de una palabra cuyo uso ya no la respalda dice algo falso
     * con aire de erudición. El campo obliga a declararlo.
     */
    /**
     * La función DISCURSIVA de una partícula o conjunción (taxonomía cerrada,
     * Runge): qué hace en el argumento, no sólo qué significa. δέ marca
     * DESARROLLO —un paso nuevo— y sólo a veces contraste: traducirla siempre
     * "pero" le inventa al texto una oposición que no está.
     */
    readonly discourseFunction?: string;
    /** Qué conecta con qué, en una línea ("el v.4 con la ὑπομονή del v.3"). */
    readonly connects?: string;
    readonly composition?: {
        readonly parts: readonly { readonly text: string; readonly gloss: string }[];
        readonly note: string;
        readonly meaningMatchesParts: boolean;
    };
    /** Traducción contextual de la palabra. */
    readonly translation: string;
    /**
     * G2 — la función del verbo según Wallace (participio, infinitivo, modo),
     * de la lista acotada por el dato (`greekVerbCandidates`). Con `verbRule`,
     * la decidió una regla del código y el asistente sólo la explica.
     */
    readonly verbFunction?: import('../language-structure/verbFunctions').VerbFunctionId;
    readonly verbRule?: import('../language-structure/verbFunctions').VerbRule;
    /** El uso del tiempo en el indicativo («presente habitual», «aoristo ingresivo»). */
    readonly tenseUse?: import('../language-structure/verbFunctions').TenseUseId;
    /** Por qué esa función o ese uso, en una frase. */
    readonly verbNote?: string;
    /**
     * G3 — en una preposición con verbo pasivo, el tipo de agencia (Wallace):
     * agente último (ὑπό/παρά + genitivo) o intermedio (διά + genitivo).
     * Lo decide el texto al mostrar (`applyNominalRules`).
     */
    readonly agency?: import('../language-structure/nominalFunctions').AgencyKind;
    /** La regla de G3 que decidió la agencia o la anáfora del artículo. */
    readonly nominalRule?: import('../language-structure/nominalFunctions').NominalRule;
    /** αὐτός intensivo («él mismo») o identificador («el mismo»), por su posición (`applyNominalRules`). */
    readonly autosUse?: import('../language-structure/nominalFunctions').AutosUse;
    /** Lo que ese αὐτός realza o identifica (texto de la palabra). */
    readonly autosHeadText?: string;
    /** «ἐπὶ τὸ αὐτό»: modismo, «juntos». */
    readonly autosTogether?: boolean;
    /** Traducción de lo que αὐτός realza («Señor»), para decirlo en el idioma del lector. */
    readonly autosHeadTranslation?: string;
    /** G4 — la regla (Runge) que decidió o acotó la función discursiva. */
    readonly discourseRule?: import('../language-structure/discourseFunctions').DiscourseRule;
    /** G4 — pronombre explícito: la posición del verbo que ya marca esa persona (#G1). */
    readonly overtPronounVerb?: number;
    /** …y su forma («βλασφημοῦσιν»), para decirlo en la ficha. */
    readonly overtPronounVerbText?: string;
}

/**
 * El "¿y qué?" de una palabra teológicamente cargada: POR QUÉ su morfología o
 * su semántica importan para la predicación. Es el salto del dato a la
 * consecuencia — "aoristo imperativo" → "pide una decisión puntual, no una
 * actitud continua".
 */
export interface GreekKeyInsight {
    /** Posición de la palabra (desde v13): marca la «Clave» en esa palabra y no en otra igual. */
    readonly index?: number;
    /** La palabra, verbatim como aparece en el versículo. */
    readonly text: string;
    readonly significance: string;
}

/**
 * Versión del contrato del análisis. Se ESTAMPA al parsear (no la emite el
 * modelo) y viaja al caché: un caché de versión anterior ofrece "Ampliar
 * análisis". Adivinar por campos no funciona — `wordOrderNote` puede faltar
 * legítimamente ("si el orden no enseña nada, omite"), así que su ausencia no
 * distingue un caché viejo de una decisión del modelo.
 *
 * v1: traducciones + words. v2: + keyInsights. v3: + wordOrderNote.
 * v4: genitivos en cadena — la aposición muestra "(de) X" y lo explica.
 * v5: + caseFunction (taxonomía cerrada) y nameNote (nombres propios).
 * v6: + relations (aposición/concordancia) y rhetoric (quiasmo/inclusión).
 * v7: español latinoamericano (ustedes, no vosotros).
 * v8: + articleUse/antecedent, con el versículo anterior como contexto.
 * v9: + composition (palabras compuestas) y artículo con uso obligatorio.
 * v10: + discourseFunction/connects para partículas y conjunciones.
 * v11: + clauseReadings — la lectura de cada fila de «Estructura» (G1 + G5).
 * v12: + verbFunction/tenseUse/verbNote — la función de cada verbo (G2, Wallace).
 * v13: + hechos de G3 (agencia, artículo anafórico) en el prompt; claves por posición; más funciones de caso.
 * v14: + función en el argumento acotada por regla (G4, Runge) y pronombre explícito.
 */
export const GREEK_INSIGHT_PROMPT_VERSION = 14;

export interface GreekVerseInsight {
    /** "JAS 1:2" — la clave del caché. */
    readonly reference: string;
    /** Traducción literal: calca el orden y la sintaxis del griego. */
    readonly literalTranslation: string;
    /** Traducción fluida: español natural. */
    readonly fluidTranslation: string;
    /** En el MISMO orden que los tokens del versículo. */
    readonly words: readonly GreekWordInsight[];
    /**
     * Las 2-3 palabras que cargan el peso teológico del versículo, con su
     * significancia homilética. SÓLO ésas: en todas las palabras sería ruido.
     * Ausente en cachés anteriores a este campo.
     */
    readonly keyInsights?: readonly GreekKeyInsight[];
    /**
     * El reordenamiento más ilustrativo del versículo, explicado con SUS
     * palabras ("δοῦλος cierra la frase griega; el español lo antepone…").
     * La regla general —el griego marca la función con casos y usa el orden
     * para el énfasis— es fija y vive en la UI; esta nota es el ejemplo
     * concreto. Ausente cuando el orden no enseña nada en este versículo.
     */
    readonly wordOrderNote?: string;
    /**
     * Relaciones entre palabras (aposición, concordancia…) — validadas
     * contra la morfología real. Permiten iluminar el par en pantalla en vez
     * de dejar el dato como prosa dentro de una sola palabra.
     */
    readonly relations?: readonly import('./rhetoricalStructure').WordRelation[];
    /**
     * Estructura retórica del versículo (quiasmo, inclusión, paralelismo),
     * SI la hay y si se sostiene. Es INTERPRETACIÓN y la UI la muestra como
     * propuesta — ver las salvaguardas en `rhetoricalStructure.ts`.
     */
    readonly rhetoric?: import('./rhetoricalStructure').RhetoricalStructure;
    /**
     * La lectura de cada cláusula de la vista «Estructura» (valor, explicación,
     * la relación que el dato deja abierta y foco/marco de lo antepuesto),
     * validada contra las filas. Ausente antes de v11 o sin datos de estructura.
     */
    readonly clauseReadings?: readonly import('../language-structure/clauseReading').ClauseReading[];
    /** Ausente en cachés anteriores al versionado. */
    readonly promptVersion?: number;
}
