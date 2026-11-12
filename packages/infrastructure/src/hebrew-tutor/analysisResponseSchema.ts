/**
 * Esquema de la respuesta del análisis de un versículo hebreo (G0).
 *
 * POR QUÉ: con JSON libre (`json_object`), gpt-6-luna repetía el objeto hasta el
 * tope de 32.768 fichas en 7 de 22 llamadas del banco fuera de muestra
 * (2026-11-11); en 5 la respuesta quedó «incompleta» y producción pagó y cayó a
 * Gemini. Con esquema, el servidor pide `json_schema` estricto
 * (`OpenAiLlmClient` + `esquemaEstricto`): la respuesta termina al cerrar el
 * objeto y cada campo pedido viene, aunque sea en `null` (Gn 18:27 omitía el
 * valor de la waw disyuntiva).
 *
 * MISMA FORMA QUE HOY. Medido en 21 respuestas reales: el modelo ya mandaba
 * todas las claves y `null` en los campos condicionales. Por eso aquí TODO es
 * obligatorio y lo condicional es `nullable`: `quitarNulosOpcionales` no quita
 * nada y la web recibe lo mismo que antes. Lo único que cambia de contenido:
 * `clauseTag` llegaba a veces como el texto "null" (10 de 273) y el enum lo
 * impide.
 *
 * Los enums salen del dominio (una sola fuente). El dominio nombra 7 binyanim:
 * un tallo menor (polel, hishtafel) se nombra con el de los 7 que el prompt ya
 * pedía; OSHB deja esos tallos sin corregir (`oshb-contrast.ts`).
 *
 * `propertyOrdering` es para Gemini (respaldo): sin él ordena alfabéticamente y
 * escribiría la explicación antes que la palabra. `esquemaEstricto` lo descarta
 * para OpenAI, que respeta el orden de `properties`.
 */
import {
    Binyan, VerbForm, VerbType, GrammaticalCategory, MorphemeRole, NominalState,
    RESOLVED_RELATIONS, FRONTING_FUNCTIONS,
} from '@dosfilos/domain';
import { SchemaType } from '../llm/schemaType';

type Nodo = Record<string, unknown>;

const texto = (description?: string): Nodo => ({ type: SchemaType.STRING, ...(description ? { description } : {}) });
const textoONulo = (description?: string): Nodo => ({ ...texto(description), nullable: true });
const lista = (valores: readonly string[], nulo = false): Nodo => ({
    type: SchemaType.STRING, enum: [...valores], ...(nulo ? { nullable: true } : {}),
});
const persona: Nodo = { type: SchemaType.INTEGER, nullable: true, description: '1, 2 o 3' };
const SIN_RAIZ = (que: string) =>
    `${que}. Todo verbo, sustantivo (también אִישׁ, אֱלֹהִים), adjetivo, numeral y nombre propio la lleva; un nombre propio, la raíz de la que viene si es clara y, si no, sus consonantes con el significado «nombre propio; etimología discutida». null SÓLO en palabras sin raíz: preposiciones, conjunciones, partículas (אֶת, לֹא, הִנֵּה) y pronombres.`;
const GENERO = ['M', 'F', 'C'];
const NUMERO = ['S', 'P', 'D'];

/** Objeto con todos sus campos obligatorios y en el orden dado. */
function objeto(properties: Record<string, Nodo>, nulo = false): Nodo {
    const orden = Object.keys(properties);
    return { type: SchemaType.OBJECT, properties, required: orden, propertyOrdering: orden, ...(nulo ? { nullable: true } : {}) };
}

const verbMorphology = objeto({
    binyan: lista(Object.values(Binyan)),
    verbForm: lista(Object.values(VerbForm)),
    verbType: lista(Object.values(VerbType)),
    rootClassification: textoONulo(),
    person: persona,
    gender: lista(GENERO, true),
    number: lista(NUMERO, true),
    temporalValue: texto(),
    recognitionClues: { type: SchemaType.ARRAY, items: texto() },
}, true);

const nominalMorphology = objeto({
    gender: lista(GENERO, true),
    number: lista(NUMERO, true),
    state: lista(Object.values(NominalState), true),
    person: persona,
    suffix: objeto({ person: persona, gender: lista(GENERO, true), number: lista(NUMERO, true) }, true),
}, true);

const word = objeto({
    hebrewText: texto(),
    transliteration: texto(),
    // Una partícula sin raíz la manda en null (24 de 273 palabras medidas):
    // obligarla a texto haría inventar una raíz. Pero con sólo «anulable», el
    // banco con esquema dejó sin raíz a 19 de 37 nombres propios y a אִישׁ,
    // אֱלֹהִים, שָׁלֹשׁ (antes 3 de 39): la descripción acota cuándo vale null.
    root: textoONulo(SIN_RAIZ('la raíz en hebreo')),
    rootTransliteration: textoONulo(SIN_RAIZ('la transliteración de la raíz con guiones, p. ej. «m-n-h»')),
    rootMeaning: textoONulo(SIN_RAIZ('el significado básico de la raíz')),
    lemmaGloss: texto(),
    category: lista(Object.values(GrammaticalCategory)),
    syntacticFunction: texto(),
    translation: texto(),
    explanation: texto(),
    infinitiveFunction: textoONulo(),
    participleFunction: textoONulo(),
    kiFunction: textoONulo(),
    verbMorphology,
    nominalMorphology,
    morphemes: { type: SchemaType.ARRAY, items: objeto({ text: texto(), role: lista(Object.values(MorphemeRole)), label: texto() }) },
    clauseTag: lista(['PREP_PHRASE', 'CONSTRUCT', 'APPOSITION'], true),
});

const verbTableEntry = objeto({
    hebrewForm: texto(),
    transliteration: texto(),
    root: texto(),
    rootTranslation: texto(),
    binyan: lista(Object.values(Binyan)),
    verbForm: lista(Object.values(VerbForm)),
    verbType: lista(Object.values(VerbType)),
    rootClassification: textoONulo(),
    temporalValue: texto(),
    pgn: texto(),
});

/** Sin filas de «Estructura» (prompt v2): el asistente parte el versículo. */
const clause = objeto({
    firstWord: { type: SchemaType.INTEGER },
    lastWord: { type: SchemaType.INTEGER },
    type: lista(['VERBAL', 'NOMINAL']),
    connection: lista(['FIRST', 'WAYYIQTOL_CHAIN', 'WAW_CONJUNCTIVE', 'WAW_DISJUNCTIVE', 'ASYNDETIC', 'SUBORDINATE', 'QUOTATION']),
    connector: textoONulo(),
    value: texto(),
    explanation: texto(),
});

/**
 * Con filas: lee cada una. "resolved" y "fronting" van en `null` donde la fila
 * no pide elegir; `parseClauseReadings` descarta lo que la fila no ofrece.
 */
const clauseReading = objeto({
    n: { type: SchemaType.INTEGER },
    value: texto(),
    explanation: texto(),
    resolved: lista(RESOLVED_RELATIONS, true),
    fronting: lista(FRONTING_FUNCTIONS, true),
});

const lexicalNote = objeto({
    hebrewPhrase: texto(),
    literalMeaning: texto(),
    idiomaticMeaning: texto(),
    explanation: texto(),
    type: lista(['idiom', 'semantic_range', 'cultural_note', 'false_friend', 'grammatical_note']),
});

/** El esquema según el prompt: con filas de «Estructura», "clauseReadings"; sin ellas, "clauses". */
export function hebrewAnalysisResponseSchema(conLectura: boolean): Nodo {
    return objeto({
        reference: texto(),
        hebrewText: texto(),
        transliteration: texto(),
        literalTranslation: texto(),
        fluidTranslation: texto(),
        words: { type: SchemaType.ARRAY, items: word },
        verbTable: { type: SchemaType.ARRAY, items: verbTableEntry },
        ...(conLectura
            ? { clauseReadings: { type: SchemaType.ARRAY, items: clauseReading } }
            : { clauses: { type: SchemaType.ARRAY, items: clause } }),
        exegeticalNotes: { type: SchemaType.ARRAY, items: texto() },
        lexicalNotes: { type: SchemaType.ARRAY, items: lexicalNote },
    });
}
