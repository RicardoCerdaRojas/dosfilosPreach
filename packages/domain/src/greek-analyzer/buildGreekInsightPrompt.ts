import { buildVerbFunctionTask, type VerbCandidate } from '../language-structure/verbFunctions';
import { buildClauseReadingTask } from '../language-structure/clauseReading';
import type { StructureNode } from '../language-structure/verseStructure';
import type { GreekWordToken } from './morphGntToken';
import { CASE_FUNCTIONS } from './caseFunctionTaxonomy';
import { SPANISH_REGISTER } from '../shared/spanishRegister';
import { ARTICLE_USES } from './articleUseTaxonomy';
import { DISCOURSE_FUNCTIONS } from './particleTaxonomy';

/** Expande el tag a texto plano para el prompt, sin códigos crípticos. */
const TENSE: Record<string, string> = { P: 'presente', I: 'imperfecto', F: 'futuro', A: 'aoristo', X: 'perfecto', Y: 'pluscuamperfecto' };
const VOICE: Record<string, string> = { A: 'activa', M: 'media', P: 'pasiva' };
const MOOD: Record<string, string> = { I: 'indicativo', D: 'imperativo', S: 'subjuntivo', O: 'optativo', N: 'infinitivo', P: 'participio' };
const CASE: Record<string, string> = { N: 'nominativo', G: 'genitivo', D: 'dativo', A: 'acusativo', V: 'vocativo' };
const POS: Record<string, string> = {
    N: 'sustantivo', V: 'verbo', A: 'adjetivo', D: 'adverbio', P: 'preposición', C: 'conjunción',
    X: 'partícula', I: 'interjección', RA: 'artículo', RP: 'pronombre personal', RR: 'pronombre relativo',
    RD: 'pronombre demostrativo', RI: 'pronombre interrogativo/indefinido',
};

function describirTag(t: GreekWordToken): string {
    const g = t.tag;
    const partes = [
        POS[t.pos],
        g.tense && TENSE[g.tense],
        g.voice && VOICE[g.voice],
        g.mood && MOOD[g.mood],
        g.person && `${g.person}ª persona`,
        g.case && CASE[g.case],
        g.number && (g.number === 'S' ? 'singular' : 'plural'),
        g.gender && (g.gender === 'M' ? 'masculino' : g.gender === 'F' ? 'femenino' : 'neutro'),
    ].filter(Boolean);
    return partes.join(', ');
}

/**
 * Pide al modelo SÓLO lo que la morfología no da.
 *
 * LA MORFOLOGÍA VA COMO DATO RESUELTO, no como tarea: viene de MorphGNT, la
 * fuente de verdad, y el prompt lo dice para que el modelo la USE en la
 * función sintáctica en vez de recalcularla — recalcularla es la puerta por
 * la que entraría a contradecir el dataset.
 */
export function buildGreekInsightPrompt(input: {
    reference: string;
    tokens: readonly GreekWordToken[];
    /**
     * El texto del versículo ANTERIOR, como contexto y no como tarea.
     *
     * Sin él la anáfora es indetectable: el artículo de Santiago 1:4 (ἡ δὲ
     * ὑπομονή) señala a la ὑπομονήν del v.3, y un análisis que sólo ve un
     * versículo no puede saberlo. Es la diferencia entre "acá hay un
     * artículo" y "acá el autor retoma lo que acaba de decir".
     */
    previousVerse?: { reference: string; text: string };
    /** Las filas de «Estructura» (MACULA): el modelo las LEE, no las arma. */
    structure?: readonly StructureNode[];
    /** Los verbos con sus funciones posibles (G2). */
    verbs?: readonly VerbCandidate[];
}): string {
    const lectura = buildClauseReadingTask(input.structure ?? []);
    const verbos = buildVerbFunctionTask(input.verbs ?? [], input.tokens.map(t => t.text));
    const lista = input.tokens
        .map((t, i) => `${i + 1}. ${t.text} — lema ${t.lemma} — ${describirTag(t)}`)
        .join('\n');

    // La lista CERRADA de funciones, sólo para los casos presentes en este
    // versículo: darle la taxonomía entera sería ruido, y darle libertad para
    // inventar etiquetas sería peor que no preguntar.
    const casosPresentes = [...new Set(input.tokens.map((t) => t.tag.case).filter(Boolean))] as (keyof typeof CASE_FUNCTIONS)[];
    const NOMBRE_CASO: Record<string, string> = { N: 'nominativo', G: 'genitivo', D: 'dativo', A: 'acusativo', V: 'vocativo' };
    const taxonomia = casosPresentes
        .map((c) => `  ${NOMBRE_CASO[c]}: ${CASE_FUNCTIONS[c].join(', ')}`)
        .join('\n');

    const contexto = input.previousVerse
        ? `\nVERSÍCULO ANTERIOR (${input.previousVerse.reference}) — SÓLO CONTEXTO, no lo analices:\n${input.previousVerse.text}\n`
        : '';

    return `Eres un gramático de griego koiné asistiendo a un pastor hispanohablante que estudia el texto original.
${contexto}
VERSÍCULO: ${input.reference}
${input.tokens.map((t) => t.text).join(' ')}

PALABRAS CON SU MORFOLOGÍA YA RESUELTA (MorphGNT — es la fuente de verdad, NO la recalcules ni la contradigas; úsala para explicar la función):

${lista}

TAREA — para el versículo:
1. "literalTranslation": traducción LITERAL al español, calcando el orden y la
   sintaxis del griego tanto como el español lo tolere.
2. "fluidTranslation": traducción FLUIDA, español natural.

Y para CADA palabra, en el MISMO ORDEN de la lista:
- "text": la palabra tal como aparece arriba (verbatim, con puntuación).
- "semanticRange": el rango semántico del LEMA — los sentidos que puede tener,
  separados por " / ". Rango real del léxico, no uno solo ni inventados.
- "syntacticFunction": cómo funciona ESTA palabra en ESTA frase, en una línea
  ("sujeto de ἡγήσασθε", "objeto directo", "genitivo de relación…"). Apóyate
  en la morfología dada.
- "translation": su traducción contextual en este versículo. CASO ESPECIAL —
  genitivos en cadena: cuando la palabra es aposición de un genitivo cuyo "de"
  ya se puso en español ("del Señor Jesucristo" lleva UN solo "de"), escribe
  la traducción como "(de) X" — el paréntesis muestra que la preposición viene
  repartida del núcleo del sintagma, no omitida. Y dilo en su
  "syntacticFunction": "comparte el 'de' de κυρίου".

Y ADEMÁS, "keyInsights": elige las 2 o 3 palabras que cargan el PESO
TEOLÓGICO del versículo y explica su SIGNIFICANCIA para la predicación — el
paso del dato a la consecuencia: por qué importa que ese verbo sea aoristo y
no presente, qué pierde el oyente si el matiz del lema se traduce plano.
2 a 4 frases por palabra, concretas y predicables. NO repitas la morfología
(ya está arriba): explica qué SE SIGUE de ella.

Y "wordOrderNote": si el ORDEN griego de este versículo difiere del español
de forma que enseñe algo (un genitivo antepuesto, el sujeto al final, un
énfasis por posición), explícalo en 2-3 frases CITANDO las palabras griegas
concretas y cómo se reordenan al traducir. Si el orden no enseña nada aquí,
devuelve "" — no inventes una lección donde no la hay.

Y para cada palabra CON CASO, "caseFunction": la función del caso según la
taxonomía estándar (Wallace). ELIGE EXACTAMENTE UNO de estos identificadores
—no inventes etiquetas ni las traduzcas, devuelve el id tal cual— y si
ninguno encaja o no estás seguro, devuelve "":

${taxonomia}

Guía: el sujeto de un verbo FINITO es "subject"; en un encabezado o saludo
epistolar SIN verbo finito el nominativo es "absolute". Distingue el genitivo
"subjective" (el genitivo actúa) del "objective" (el genitivo recibe).

Y para cada ARTÍCULO (categoría "artículo"), "articleUse": su uso según esta
lista CERRADA —devuelve el id tal cual, y "" si ninguno encaja—:
  ${ARTICLE_USES.join(', ')}

TODO artículo tiene un uso: NO dejes "articleUse" vacío en un artículo —
elige el MÁS ESPECÍFICO que aplique, y recurre a "generic" o "abstract" sólo
cuando de verdad corresponda. El artículo griego NO es "el/la" del español:
hace trabajos que el castellano no marca, y decir sólo "artículo definido"
no le enseña nada al pastor.

REVISA PRIMERO SI ES ANAFÓRICO, contra el versículo anterior que te di: si
el sustantivo que acompaña ya apareció ahí, el artículo lo está RETOMANDO —
y eso explica por qué un versículo puede EMPEZAR con un artículo. Entonces
agrega "antecedent" con la palabra y su lugar ("ὑπομονήν, v. 3"). Si no hay
antecedente identificable, NO digas que es anafórico.

Y para cada PARTÍCULA o CONJUNCIÓN, "discourseFunction": qué hace en el
ARGUMENTO —no sólo qué significa— de esta lista CERRADA:
  ${DISCOURSE_FUNCTIONS.join(', ')}

Más "connects": qué enlaza con qué, en una línea ("este versículo con la
ὑπομονή del anterior"). Usa el versículo previo que te di como contexto.

⚠️ δέ NO ES "PERO". Marca DESARROLLO —un paso nuevo del argumento— y sólo a
veces contraste; traducirla siempre "pero" le inventa al texto una oposición
que no está. Lo mismo con καί (continuidad, no siempre "y"), γάρ (fundamenta
lo dicho) y οὖν (infiere). Elige la función por lo que hace AQUÍ.

Y para las palabras COMPUESTAS (dos raíces unidas: ὁλόκληρος = ὅλος +
κλῆρος; ἐκκλησία = ἐκ + καλέω), "composition":
  · "parts": cada componente con su glosa ({"text": "ὅλος", "gloss": "entero,
    completo"}).
  · "meaningMatchesParts": true si el uso REAL de la palabra en el griego del
    NT todavía corresponde a la suma de sus partes; false si el uso se alejó.
  · "note": qué aporta la composición al sentido — y SI meaningMatchesParts
    es false, DILO explícitamente y explica qué significa de verdad.

⚠️ LA FALACIA DE LA RAÍZ es el error exegético más común: suponer que el
sentido de un compuesto ES la suma de sus partes. A veces lo es y a veces el
uso se alejó por completo. Un pastor que predica la etimología de una
palabra cuyo uso ya no la respalda dice algo falso con aire de erudición.
Si la palabra no es compuesta, omite "composition".

Y para los NOMBRES PROPIOS, "nameNote": si el nombre castellano se aleja del
griego por historia de la traducción (Ἰάκωβος → "Santiago", del latín
Iacobus → Iacomus → "Sant Iago"; Κηφᾶς → "Cefas/Pedro"; Σαῦλος → "Saulo"),
cuéntalo en 1-2 frases y di si el castellano tiene un doblete más literal
(Jacobo). Si el nombre no tiene historia que contar, devuelve "".

Y "relations": las relaciones ENTRE PALABRAS que un profesor señalaría, con
las POSICIONES de la lista de arriba (empezando en 0) — tipos permitidos:
"apposition" (dos sustantivos del mismo caso que nombran al mismo referente),
"agreement" (adjetivo o artículo que concuerda con su sustantivo), "governs"
(la preposición que rige a su término), "modifies". Cada una con "note" de
una línea. Devuelve [] si no hay ninguna clara.

Y "rhetoric": SÓLO si el versículo tiene una estructura retórica CLARA —
"chiasm" (A B B' A': los miembros se cierran en ESPEJO, invertidos),
"inclusio" (abre y cierra con lo mismo) o "parallelism". Cada miembro con su
"label" (A, B, B', A'), sus "wordIndices" REALES y una "note".

⚠️ EL QUIASMO ES EL HALLAZGO MÁS SOBRE-DIAGNOSTICADO DE LOS ESTUDIOS
BÍBLICOS. La mayoría de los versículos NO tiene uno. Devolver null es la
respuesta correcta y frecuente: proponer una estructura dudosa le da al
pastor algo que predicará con confianza y que su profesor desmontará. Si los
miembros no se cierran invertidos de verdad, NO es quiasmo — llámalo
paralelismo o devuelve null.

${lectura}
${verbos}

REGLAS:
- Todo en español, salvo las palabras griegas.
- ${SPANISH_REGISTER}
- NO inventes sentidos que el lema no tiene: el pastor va a predicar con esto.
- La lista de salida tiene EXACTAMENTE ${input.tokens.length} palabras, en el mismo orden.

FORMATO DE SALIDA (JSON, sin texto alrededor):
{
  "literalTranslation": "…",
  "fluidTranslation": "…",
  "words": [
    { "text": "…", "semanticRange": "sentido A / sentido B", "syntacticFunction": "…", "translation": "…", "caseFunction": "possession", "nameNote": "", "articleUse": "", "antecedent": "", "discourseFunction": "", "connects": ""${verbos ? ', "verbFunction": "", "tenseUse": "", "verbNote": ""' : ''} }
  ],
  "keyInsights": [
    { "text": "…", "significance": "Por qué esta palabra importa al predicar este versículo." }
  ],
  "wordOrderNote": "…",
  "relations": [ { "from": 6, "to": 0, "type": "apposition", "note": "δοῦλος nombra al mismo referente que Ἰάκωβος." } ],
  "rhetoric": null${lectura ? ',\n  "clauseReadings": [ { "n": 1, "value": "…", "explanation": "…" } ]' : ''}
}`;
}
