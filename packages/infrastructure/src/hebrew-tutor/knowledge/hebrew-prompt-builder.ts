/**
 * Hebrew Prompt Builder
 *
 * Constructs the Gemini prompt for verse analysis by combining:
 *  1. System role and language instructions
 *  2. Selected Farfán grammar knowledge chunks
 *  3. The professor's pedagogical methodology (from 3_prompt-analisis-versiculos.md)
 *  4. The Hebrew verse text from morphhb
 *  5. [NEW] Lexical glossary entries relevant to this verse (Level 2 RAG)
 *  6. Expected JSON output schema (includes lexicalNotes)
 *
 * The morphhb data (OSHB codes) is provided as optional context for
 * cross-validation but is explicitly NOT presented as authoritative.
 */

import type { HebrewVerse } from '@dosfilos/domain';
import type { LexicalEntry } from '@dosfilos/domain';
import type { KnowledgeChunk } from '../knowledge/farfan-chunks.js';

// ── Expected output schema (as TypeScript comment for LLM) ───────────────────
const OUTPUT_SCHEMA = `
Return ONLY a valid JSON object with the following structure (no markdown, no extra text):

{
  "reference": "string — human-readable reference, e.g. 'Jonás 2:3'",
  "hebrewText": "string — full vocalized Hebrew text",
  "transliteration": "string — full academic transliteration of the verse",
  "literalTranslation": "string — STRICT word-for-word translation. DO NOT apply idiomatic meaning here. Even if a phrase is an idiom, translate each word literally.",
  "fluidTranslation": "string — natural, fluent Spanish translation using IDIOMATIC equivalents where applicable. Use the lexical glossary when provided.",
  "words": [
    {
      "hebrewText": "string — vocalized Hebrew of this word",
      "transliteration": "string",
      "root": "string — trilateral root in Hebrew",
      "rootTransliteration": "string — academic transliteration of the root, e.g. 'm-n-h' for מנה. Use consonant-hyphen format.",
      "rootMeaning": "string — basic meaning of root, e.g. 'arrojar, lanzar'",
      "lemmaGloss": "string — lexical gloss in Spanish",
      "category": "VERB | NOUN | ADJECTIVE | PRONOUN | PERSONAL_PRONOUN | DEMONSTRATIVE_PRONOUN | RELATIVE_PRONOUN | PREPOSITION | CONJUNCTION | DEFINITE_ARTICLE | PARTICLE | ADVERB | INTERJECTION | PROPER_NOUN | OBJECT_MARKER | INTERROGATIVE | NEGATIVE_PARTICLE",
      "syntacticFunction": "string — syntactic role in the clause",
      "translation": "string — contextual translation of this word. IMPORTANT: Active and passive participles MUST have this translation field filled, functioning as the noun/adjective meaning in context.",
      "explanation": "string — detailed pedagogical explanation (morphology, recognition clues, typology, temporal/aspectual value). FORMATTED WITH MARKDOWN. Use bold text, bullet points, and short paragraphs to make it highly structured and readable.",
      "verbMorphology": {
        "binyan": "QAL | NIFAL | PIEL | PUAL | HITPAEL | HIFIL | HOFAL",
        "verbForm": "PERFECT | IMPERFECT | WAYYIQTOL | WEQATAL | IMPERATIVE | COHORTATIVE | JUSSIVE | INF_CONSTRUCT | INF_ABSOLUTE | PARTICIPLE_ACTIVE | PARTICIPLE_PASSIVE",
        "verbType": "STRONG | I_ALEF | I_NUN | I_YOD_WAW | II_WAW_YOD | III_HE | III_ALEF | GEMINATE | GUTURAL_R1 | GUTURAL_R2 | GUTURAL_R3",
        "rootClassification": "string | null — Lexical root classification when it DIFFERS from verbType behavior. Example: for הלך (root Pe-He that behaves like Pe-Yod), set verbType='I_YOD_WAW' and rootClassification='Pe-He (פ״ה) — se comporta como Pe-Yod en esta forma'. For most verbs where identity = behavior, set null.",
        "person": 1 | 2 | 3 | null,
        "gender": "M | F | C | null",
        "number": "S | P | D | null",
        "temporalValue": "string — e.g. 'pasado narrativo secuencial'",
        "recognitionClues": ["string — Pistas visuales. OBLIGATORIO: Debe seguir el formato exacto 'Descripción gramatical + Letra(s) hebrea(s) + (transliteración)'. Ejemplo: 'Preformativo de participio Piel מְ (mə-)'. NO omitir ninguna de las 3 partes."]
      },
      "nominalMorphology": {
        "gender": "M | F | C | null",
        "number": "S | P | D | null",
        "state": "ABSOLUTE | CONSTRUCT | null",
        "person": "1 | 2 | 3 | null",
        "suffix": {
          "person": "1 | 2 | 3 | null",
          "gender": "M | F | C | null",
          "number": "S | P | D | null"
        }
      },
      "morphemes": [
        {
          "text": "string — Hebrew text of this segment",
          "role": "PREFIX_STEM | PREFORMATIVE | ROOT_R1 | ROOT_R2 | ROOT_R3 | THEME_VOWEL | DAGESH_FORTE | AFFORMATIVE | PRONOMINAL_SUFFIX | DEFINITE_ARTICLE | CONSTRUCT_ENDING | PLURAL_ENDING | DUAL_ENDING | FEMININE_ENDING | WAW_CONJUNCTIVE | WAW_CONSECUTIVE | PREPOSITION_PREFIX | CONJUNCTION_PREFIX",
          "label": "string — Etiqueta detallada. OBLIGATORIO: Debe tener la misma información exacta que recognitionClues (Descripción gramatical + Letra(s) + transliteración). Ejemplo: 'Preformativo de participio Piel מְ (mə-)'."
        }
      ],
      "clauseTag": "PREP_PHRASE | CONSTRUCT | APPOSITION | null — Syntactic clause marker for visual overlays.\n  PREP_PHRASE: The word is a preposition (standalone or prefixed) heading a prepositional phrase with a nominal complement. Do NOT use for לְ + infinitive construct (purpose clause).\n  CONSTRUCT: The word is a noun/adjective in construct state (semikut), grammatically dependent on the following noun in the chain. Mark only the governing noun (the one in construct state), not the absolute noun that follows.\n  APPOSITION: The word is the SECOND (or subsequent) element in an appositive sequence — two or more contiguous nominal phrases that share the same referent, with no preposition and no construct relation. The first is the nucleus; the second identifies, classifies, or renames it (e.g. יוֹנָה הַנָּבִיא → mark הַנָּבִיא as APPOSITION). See REGLA DE IDENTIFICACIÓN DE APOSICIONES for full criteria.\n  null: All other words."
    }
  ],
  "verbTable": [
    {
      "hebrewForm": "string",
      "transliteration": "string",
      "root": "string",
      "rootTranslation": "string",
      "binyan": "QAL | NIFAL | PIEL | PUAL | HITPAEL | HIFIL | HOFAL",
      "verbForm": "PERFECT | IMPERFECT | WAYYIQTOL | ...",
      "verbType": "STRONG | I_NUN | ...",
      "rootClassification": "string | null — same as in verbMorphology",
      "temporalValue": "string",
      "pgn": "string — e.g. '3ms', '2fp'"
    }
  ],
  "clauses": [
    {
      "firstWord": "number — 0-based index in \"words\" of the clause's first word",
      "lastWord": "number — index of its last word (inclusive)",
      "type": "VERBAL | NOMINAL — NOMINAL when it has no finite verb (verbless clause)",
      "connection": "FIRST | WAYYIQTOL_CHAIN | WAW_CONJUNCTIVE | WAW_DISJUNCTIVE | ASYNDETIC | SUBORDINATE | QUOTATION — see REGLAS DE CLÁUSULAS",
      "connector": "string | null — the connecting word in Hebrew (וְ, כִּי, אֲשֶׁר…), null when none",
      "value": "string — logical relation in Spanish: 'contraste', 'circunstancia', 'causa', 'propósito', 'secuencia narrativa', 'clímax / declaración solemne', 'paralelismo'…",
      "explanation": "string — one sentence for the student explaining the connection and its value"
    }
  ],
  "exegeticalNotes": ["string — optional observations"],
  "lexicalNotes": [
    {
      "hebrewPhrase": "string — the Hebrew phrase or word",
      "literalMeaning": "string — the word-for-word meaning (e.g. 'criatura viviente del campo')",
      "idiomaticMeaning": "string — the dynamic-equivalent meaning (e.g. 'animales salvajes')",
      "explanation": "string — academic explanation of why the meanings differ, at seminary level",
      "type": "idiom | semantic_range | cultural_note | false_friend | grammatical_note"
    }
  ]
}

CRITICAL RULES:
- Every key must be present. Use null for unknown optional fields.
- verbMorphology is REQUIRED for VERB words; nominalMorphology for all others.
- morphemes array must include ALL morpheme segments for visual color rendering.
- The concatenation of "text" for all "morphemes" MUST EXACTLY MATCH the original "hebrewText" of the word. DO NOT omit ANY vowel (nikkud) or cantillation mark (te'amim).
- Do NOT include markdown, code fences, or any text outside the JSON object.
- lexicalNotes MUST be an array. Return [] if no idiomatic observations exist.
- clauses MUST cover the whole verse, in order, without overlaps: every word belongs to exactly one clause.
- literalTranslation MUST remain literal even when a phrase is an idiom. Do not apply idiomatic meaning there.
- MAQAF (Unicode U+05BE, the Hebrew hyphen that joins words): Words connected by a maqaf MUST be split into separate word objects in the "words" array, one object per lexical unit. Ensure the "hebrewText" of the FIRST word includes the maqaf at the end, but DO NOT duplicate the maqaf if the source text already has it.
- SOF PASUQ (Unicode U+05C3 ׃) and PASEQ (Unicode U+05C0 ׀) are verse-level punctuation marks, NOT part of any individual word. Do NOT include them in any word's "hebrewText" or in any morpheme "text" field. They are handled separately by the rendering pipeline.
`;

// ── Knowledge context formatter ───────────────────────────────────────────────

function formatKnowledgeContext(chunks: readonly KnowledgeChunk[]): string {
  if (chunks.length === 0) return '';

  const sections = chunks.map((c) => c.content.trim()).join('\n\n---\n\n');
  return `
## GRAMÁTICA DE REFERENCIA (Farfán + Material del Profesor)

Estas reglas son tu AUTORIDAD MORFOLÓGICA. Aplícalas estrictamente.

${sections}
`;
}

// ── OSHB cross-reference context ──────────────────────────────────────────────

function formatOshbContext(verse: HebrewVerse): string {
  const hasOshb = verse.words.some((w) => w.oshbMorphCode && w.oshbMorphCode.length > 0);
  if (!hasOshb) return '';

  const rows = verse.words
    .map((w) => `  • "${w.text}" | OSHB: ${w.oshbMorphCode || '—'} | Lemma: ${w.lemma || '—'}`)
    .join('\n');

  return `
## MORFOLOGÍA DE OSHB — AUTORIDAD para el verbo

Los siguientes códigos son de la Open Scriptures Hebrew Bible, etiquetada a mano.
Para cada VERBO, toma de su código el TALLO, la FORMA y la PERSONA-GÉNERO-NÚMERO:
ya resolvió por contexto las formas ambiguas (תִּ…נָה es 2FP o 3FP; un prefijo con
אַל es yusivo aunque se escriba igual que el imperfecto). No los contradigas.
Tu traducción y tu función sintáctica deben ser coherentes con esa persona y esa
forma (2.ª persona → se le habla a alguien). La explicación sigue a Farfán.

Lectura del código de verbo: V + tallo (q qal, N nifal, p piel, P pual, h hifil,
H hofal, t hitpael) + forma (p perfecto, q weqatal, i imperfecto, w wayyiqtol,
h cohortativo, j yusivo, v imperativo, a inf. absoluto, c inf. constructo,
r participio activo, s participio pasivo) + persona, género, número.
Ej.: HVNi2fp = nifal imperfecto 2.ª fem. plural; HVqj2fs = qal yusivo 2.ª fem. sing.

${rows}
`;
}

// ── Lexical glossary context (Level 2 RAG) ────────────────────────────────────

const LEXICAL_TYPE_LABELS: Record<LexicalEntry['type'], string> = {
  idiom:            'MODISMO',
  semantic_range:   'RANGO SEMÁNTICO',
  cultural_note:    'NOTA CULTURAL',
  false_friend:     'FALSO AMIGO',
  grammatical_note: 'NOTA GRAMATICAL',
};

/**
 * Formats a single lexical entry as a prompt-injectable bullet.
 */
function formatLexicalBullet(entry: LexicalEntry): string {
  const typeTag = LEXICAL_TYPE_LABELS[entry.type];
  const verseTag = entry.verseRefs?.length
    ? ` [${(entry.verseRefs as string[]).join(', ')}]`
    : '';
  return `• [${typeTag}]${verseTag} ${entry.hebrewPhrase}\n  Literal: "${entry.literalMeaning}"\n  Idiomático: "${entry.idiomaticMeaning}"\n  Explicación: ${entry.explanation}`;
}

/**
 * Formats the curated lexical entries as a block injected into the prompt.
 *
 * Entries are split into two groups:
 *  1. **Chain entries** (Leitwort threads) — grouped under a "HILO SEMÁNTICO"
 *     header that instructs the LLM to maintain cross-verse coherence.
 *  2. **Standalone entries** — individual lexical corrections.
 *
 * @param entries - Enabled lexical entries that matched this verse
 */
function formatLexicalContext(entries: readonly LexicalEntry[]): string {
  if (entries.length === 0) return '';

  // Partition: chain entries vs standalone
  const chainGroups = new Map<string, LexicalEntry[]>();
  const standalone: LexicalEntry[] = [];

  for (const entry of entries) {
    if (entry.chainId) {
      const group = chainGroups.get(entry.chainId) ?? [];
      group.push(entry);
      chainGroups.set(entry.chainId, group);
    } else {
      standalone.push(entry);
    }
  }

  const sections: string[] = [];

  // Format chain groups with discourse-level instructions
  for (const [chainId, chainEntries] of chainGroups) {
    const sorted = chainEntries.sort((a, b) => a.order - b.order);
    const bullets = sorted.map(formatLexicalBullet).join('\n\n');

    sections.push(`
### HILO SEMÁNTICO: "${chainId}" (cadena léxica / Leitwort)

Las siguientes entradas forman un HILO SEMÁNTICO que atraviesa múltiples versículos.
DEBES mantener COHERENCIA de traducción entre TODAS las entradas del hilo.
La decisión traductológica tomada en un versículo CONDICIONA las de los demás.

${bullets}
`);
  }

  // Format standalone entries
  if (standalone.length > 0) {
    const bullets = standalone.map(formatLexicalBullet).join('\n\n');
    sections.push(`
### ENTRADAS LÉXICAS INDIVIDUALES

${bullets}
`);
  }

  return `
## GLOSARIO LEXICOGRÁFICO (conocimiento curado por el profesor)

Las siguientes expresiones del versículo tienen significados idiomáticos o semánticos
que difieren de una traducción literal. DEBES:
1. Usar el significado idiomático en la "fluidTranslation".
2. MANTENER el significado literal en la "literalTranslation" (no lo cambies).
3. Reportar CADA entrada como un objeto en el array "lexicalNotes".

${sections.join('\n')}
`;
}

// ── Main prompt builder ───────────────────────────────────────────────────────

/**
 * Builds the complete Gemini prompt for morphological verse analysis.
 *
 * @param verse - The Hebrew verse with text and OSHB tokens
 * @param knowledgeChunks - Relevant grammar chunks from the knowledge selector
 * @param lexicalEntries - Curated lexical entries matching this verse (Level 2 RAG)
 * @param language - Response language; currently only "es" is supported
 */
export function buildVerseAnalysisPrompt(
  verse: HebrewVerse,
  knowledgeChunks: readonly KnowledgeChunk[],
  lexicalEntries: readonly LexicalEntry[] = [],
  language = 'es',
): string {
  const langInstruction =
    language === 'es'
      ? 'IMPORTANT: Respond entirely in Spanish. Use clear academic Spanish appropriate for a Chilean seminary student.'
      : `IMPORTANT: Respond in ${language}.`;

  const knowledgeContext = formatKnowledgeContext(knowledgeChunks);
  const oshbContext = formatOshbContext(verse);
  const lexicalContext = formatLexicalContext(lexicalEntries);

  return `
You are an expert Biblical Hebrew tutor at seminary level, specialized in grammatical and exegetical analysis (BHS/BHQ text).

${langInstruction}

Your task is to perform a complete morphological and syntactic analysis of the Hebrew verse provided below.
You MUST analyze EVERY SINGLE WORD — including particles (אֶת, כִּי, וְ, הַ, etc.).
You MUST follow the pedagogical methodology of Farfán's Hebrew grammar and the professor's lessons.

${knowledgeContext}

${oshbContext}

## METODOLOGÍA PEDAGÓGICA (del profesor)

Para CADA palabra debes:
1. Identificar la RAÍZ antes que el BINYAN
2. Determinar el Binyan por sus elementos característicos (prefijos, dagesh forte, vocales características)
3. Explicar en detalle:
   - Prefijos (וַ, ה, י, ב, ל, מ, נ, etc.)
   - Sufijos (תָּ, וּ, נִי, etc.)
   - Dagesh (asimilación o duplicación)
   - Vocales características (jireq, jolem, qameṣ, etc.)
4. Si es verbo: siempre indicar si es FUERTE o DÉBIL, y el tipo de debilidad
5. Relacionar la forma morfológica con su valor temporal/aspectual en el contexto
6. Si hay ambigüedad, declararla explícitamente

## INSTRUCCIONES DE TRADUCCIÓN IDIOMÁTICA

Para la "fluidTranslation":
- Identifica expresiones idiomáticas hebreas y tradúcelas por su equivalente dinámico
  en español. NO las traduzcas literalmente.
- Ejemplo: חַיַּת הַשָּׂדֶה → "animales salvajes" (no "animales del campo")
- Si detectas un modismo, rango semántico especial, nota cultural, o falso amigo:
  repórtalo en el array "lexicalNotes".

Para la "literalTranslation":
- SIEMPRE mantén una traducción palabra por palabra. NUNCA apliques equivalencia
  dinámica aquí. Incluso si una frase es un modismo, tradúcela literalmente.

## REGLA DE TRADUCCIÓN PARA FRASES PREPOSICIONALES BENEFACTIVAS

En hebreo bíblico, una preposición (לְ, בְּ, עַל, etc.) con sufijo pronominal
que sea CORREFERENCIAL con el sujeto del verbo forma una "frase preposicional
benefactiva": indica que la acción recae en beneficio del propio sujeto.

REGLA: Esta frase DEBE conservarse en AMBAS traducciones, literal y fluida.
NO puede omitirse ni absorberse implícitamente en un pronombre reflexivo ambiguo.

Ejemplos:
- וַיַּעֲשׂוּ לָהֶם חֲגֹרֹת (Gén 3:7)
  Sujeto: "ellos" (Adán y Eva) | לָהֶם = "para ellos" (correferencial)
  ❌ Fluida incorrecta: "se hicieron fajas" (el 'se' es ambiguo)
  ✅ Fluida correcta: "se fabricaron delantales para sí mismos"

- Patrón general: preposición + sufijo correferencial con el sujeto:
  לִי / לְךָ / לוֹ / לָהּ / לָנוּ / לָכֶם / לָהֶם
  → traducir como "para mí mismo / para ti mismo / para sí mismo" etc.

DISTINGUIR de:
- Frases preposicionales donde el sufijo NO es correferencial con el sujeto
  (e.g., "fabricaron para ellos [otros]") — en ese caso traducir normalmente.

## REGLAS DE CLÁUSULAS (campo "clauses")

Divide el versículo en cláusulas y, para cada una, di CÓMO se une a lo anterior.
Mira la PRIMERA palabra de la cláusula:

- וַ + prefijo (wayyiqtol) → WAYYIQTOL_CHAIN: sigue la cadena narrativa.
- וְ + VERBO (incluido el weqatal) → WAW_CONJUNCTIVE: coordinación simple, «y».
- וְ + NO VERBO (sujeto, objeto, adverbio, pronombre adelante) → WAW_DISJUNCTIVE:
  la cláusula ROMPE la cadena. Su valor suele ser contraste («pero»),
  circunstancia («mientras»), información de fondo o paréntesis («ahora bien»).
  Ej. Rut 1:14 וַתִּשַּׁק עָרְפָּה לַחֲמוֹתָהּ | וְרוּת דָּבְקָה בָּהּ
  → la segunda es disyuntiva de CONTRASTE: «pero Rut se quedó con ella».
  NO la traduzcas con «y»; NO digas que el sujeto está «coordinado» con la anterior.
- Sin conjunción → ASYNDETIC (asíndeton). Suele marcar clímax, declaración solemne,
  explicación o enumeración. Ej. Rut 1:16 … | עַמֵּךְ עַמִּי | וֵאלֹהַיִךְ אֱלֹהָי
  → «tu pueblo, mi pueblo» es una cláusula NOMINAL ASINDÉTICA (declaración solemne);
  «וֵאלֹהַיִךְ אֱלֹהָי» es OTRA cláusula nominal unida con waw, no un segundo
  miembro del sujeto.
- כִּי, אֲשֶׁר, אִם, לְמַעַן, כַּאֲשֶׁר, פֶּן… → SUBORDINATE (también si llevan waw delante).
- Comienzo de discurso directo → QUOTATION.
- La primera cláusula del versículo sin conector que analizar → FIRST.

La función sintáctica de cada palabra y las traducciones deben ser coherentes con
estas conexiones (disyuntiva de contraste → «pero»; asíndeton → sin «y» agregada).

## REGLA DE TRADUCCIÓN PARA WAYYIQTOL (Pasado narrativo secuencial)

El Wayyiqtol es la forma verbal narrativa por excelencia del hebreo bíblico.
Su valor temporal/aspectual es "pasado narrativo secuencial": indica una acción
completada que SIGUE a la acción anterior en la cadena narrativa.

DISTINCIÓN CLAVE: וַ (waw consecutiva) ≠ וְ (waw conjuntiva simple)
- Si el autor hebreo solo quisiera expresar "y + verbo", usaría la conjunción
  simple וְ (waw conjuntiva) + forma verbal.
- La elección del Wayyiqtol (וַ + imperfecto corto) es DELIBERADA para marcar
  secuencia narrativa. Por tanto, TODO Wayyiqtol debe reflejar esta secuencia.

REGLAS DE TRADUCCIÓN:
1. TODO Wayyiqtol debe traducirse con un conector que refleje secuencia
   narrativa: "entonces", "luego", "después", "a continuación".
   - Ejemplo: וַתֹּאמֶר → "Entonces dijo" (NO simplemente "Y dijo")
   - Ejemplo: וַתֵּרֶא...וַתִּקַּח...וַתֹּאכַל → "Entonces vio… luego tomó… después comió"
   - NO traducir como simples pasados con "y":
     ❌ "Y vio… y tomó… y comió" (pierde la progresión narrativa)
     ✅ "Entonces vio… luego tomó… después comió" (refleja la secuencia)
2. En la traducción individual de cada palabra (campo "translation"), incluir
   el conector secuencial apropiado (e.g. "entonces dijo", no solo "dijo").
3. Esta regla aplica tanto para la "fluidTranslation" como para la
   "literalTranslation", ya que el valor secuencial es parte inherente de
   la forma Wayyiqtol, no una interpretación idiomática.
4. En contraste, cuando encuentres un verbo con waw conjuntiva simple (וְ),
   tradúcelo simplemente con "y" sin conector secuencial.

## REGLAS DE DESAMBIGUACIÓN MORFOLÓGICA

Muchas formas verbales hebreas son ambiguas en superficie y comparten la misma
escritura para binyanim distintos. NO asumas un binyan basándote solo en la forma
vocálica aislada. DEBES considerar el CONTEXTO SINTÁCTICO completo:

### 1. Criterios de desambiguación (en orden de prioridad)

1. **Transitividad / valencia verbal**: si el verbo lleva objeto directo explícito,
   evalúa si el binyan propuesto admite transitividad. Qal de verbos intransitivos
   (e.g. עָלָה "subir") NO puede llevar objeto directo — si lo hay, sospecha Hifil.
2. **Identificación del agente**: si el contexto señala un agente que no coincide
   con la persona/género del binyan propuesto, reconsidera.
3. **Coherencia del discurso**: analiza los versículos adyacentes para determinar
   quién habla, a quién se dirige y cuál es la acción lógica.

### 2. Caso especial: verbos III-ה en Hifil wayyiqtol

En verbos III-ה (como עָלָה, בָּנָה, עָשָׂה), el Hifil wayyiqtol puede aparecer
en FORMA ABREVIADA que es idéntica superficialmente al Qal wayyiqtol 3fs.

**Ejemplo clave: וַתַּעַל**
- Lectura superficial: Qal wayyiqtol 3fs "y ella subió"
- Lectura correcta en Jonás 2:7: Hifil wayyiqtol 2ms "y tú sacaste / hiciste subir"
  
**Cómo desambiguar:**
- חַיַּי funciona como OBJETO DIRECTO ("mi vida") → requiere verbo transitivo
- El contexto identifica a יְהוָה אֱלֹהָי como agente en 2ms ("tú")
- El Qal de עָלָה es INTRANSITIVO ("subir"), no puede llevar objeto directo
- El Hifil de עָלָה es CAUSATIVO/TRANSITIVO ("hacer subir, sacar")
- En verbos III-ה el Hifil wayyiqtol pierde la ה final: תַעֲלֶה → וַתַּעַל

**REGLA**: Cuando la forma superficial es ambigua, el análisis DEBE basarse en
la TRANSITIVIDAD y el CONTEXTO DISCURSIVO, no en la vocalización aislada.
Si el verbo es claramente transitivo en contexto, declara el Hifil y explica
la ambigüedad en el campo "explanation".

### 3. Deber de declarar ambigüedad

Si una forma verbal puede corresponder a más de un binyan/persona/género,
DEBES declarar la ambigüedad explícitamente en el campo "explanation" del
word object, indicando:
- Las lecturas posibles
- Los criterios que usaste para elegir la lectura correcta
- Por qué descartaste las demás opciones

## REGLA DE IDENTIFICACIÓN DE APOSICIONES

Una aposición es la secuencia de dos o más sintagmas nominales contiguos, sin
preposición ni relación constructa, que comparten el mismo referente y donde el
segundo elemento identifica o explica al primero, formando una única unidad
sintáctica dentro de la oración.

### Criterios de reconocimiento (TODOS deben cumplirse)

1. **Contigüidad**: dos o más elementos nominales consecutivos, sin conjunción
   obligatoria entre ellos.
2. **Ausencia de relación constructa**: el primer sustantivo NO está en estado
   constructo (no pierde acento ni forma plena). No expresa posesión.
3. **Ausencia de preposición**: no hay prefijos como בְּ, לְ, כְּ, אֶל, עַל, etc.
4. **Coincidencia referencial**: ambos elementos refieren al mismo ente.
   Se puede parafrasear como "X es Y".
5. **Compatibilidad semántica**: el segundo elemento identifica (nombre propio +
   título), clasifica (ciudad, profeta), o renombra.
6. **Unidad sintáctica**: toda la secuencia funciona como sujeto, objeto o
   complemento dentro de la oración.

### Reglas de exclusión (MUY IMPORTANTE)

❌ **Estado constructo**: בֵּית הַמֶּלֶךְ ("casa del rey") → relación posesiva, NO aposición.
❌ **Frase preposicional**: לְדָוִד ("a David") → NO aposición.
❌ **Oración nominal predicativa**: דָּוִד מֶלֶךְ → puede ser "David es rey" (predicado)
   o "David, rey" (aposición). Decidir por contexto (presencia de verbo, énfasis).

### Ejemplos claros

✔️ Aposición:
- דָּוִד הַמֶּלֶךְ → "David, el rey" (הַמֶּלֶךְ = APPOSITION)
- יוֹנָה הַנָּבִיא → "Jonás, el profeta" (הַנָּבִיא = APPOSITION)
- נִינְוֵה הָעִיר → "Nínive, la ciudad" (הָעִיר = APPOSITION)
- יְהוָה אֱלֹהַי → "YHWH, mi Dios" (אֱלֹהַי = APPOSITION)

❌ No aposición:
- בֶּן־אָדָם → constructo ("hijo de hombre")
- לְמֶלֶךְ → preposición

### Cómo marcar en clauseTag

En una secuencia apositiva, marcar SOLO el segundo elemento (y siguientes) como
APPOSITION. El primer elemento (núcleo) queda sin marca o con la marca que le
corresponda por su propia función (puede ser sujeto, objeto, etc.).

Nota: en hebreo bíblico no hay coma, pero la aposición cumple la función de la
coma explicativa del español. Se reconoce por estructura, no por puntuación.

REGLAS ABSOLUTAS:
- NUNCA omitir una palabra
- NUNCA asumir sin explicar
- Aplicar SOLO las reglas del hebreo bíblico (no hebreo moderno)
- Mantener terminología consistente (según Farfán)
- Dar claridad pedagógica, no solo etiquetas

${lexicalContext}

## VERSO A ANALIZAR

Referencia: ${verse.displayReference}
Texto hebreo: ${verse.hebrewText}

## FORMATO DE RESPUESTA

${OUTPUT_SCHEMA}
`.trim();
}
