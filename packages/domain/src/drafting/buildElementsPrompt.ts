import { ELEMENTS_PER_SECTION } from './SermonElement';

export interface ElementsPromptInput {
    /** Pasaje del sermón, como lo escribió el pastor. */
    passage: string;
    /** Sección para la que se proponen elementos. */
    sectionLabel: string;
    /** Qué tiene que lograr esa sección — su trabajo dentro del sermón. */
    sectionJob: string;
    /** La proposición homilética, verbatim. */
    proposition?: string;
    /** Los títulos de los puntos, verbatim. */
    points?: readonly string[];
    /**
     * La proposición que el pastor decidió para ESTE punto, si existe.
     *
     * Cuando está, es el insumo principal: los elementos de la exposición son
     * las partes que la desglosan. Proponer sin ella produce ideas sueltas
     * sobre el pasaje en vez de las piezas de SU argumento.
     */
    pointProposition?: string;
    /** Texto bíblico real de la sección, para no proponer de memoria. */
    scriptureText?: string;
    /** Lo que el pastor YA trabajó y es suyo: observaciones, principio, notas… */
    pastorWork?: readonly string[];
    /** Elementos que el pastor ya decidió para esta sección: no se repiten. */
    alreadyDecided?: readonly string[];
    /**
     * Su estudio exegético de ocho pasos, como FUENTE PRIMARIA de propuestas.
     *
     * Sin esto, el acompañante proponía contexto histórico desde el
     * conocimiento general del modelo mientras el pastor tenía un estudio
     * completo del pasaje a dos pasos de distancia — el estudio llegaba a la
     * redacción recortado a palabras clave y anécdota, y sus hallazgos no
     * alimentaban las decisiones. Las propuestas deben salir de SU trabajo;
     * el conocimiento del modelo es el respaldo, no la fuente.
     */
    study?: {
        exegeticalProposition?: string;
        historical?: string;
        literary?: string;
        audience?: string;
        pastoralInsights?: readonly string[];
    };
}

/**
 * Pide ELEMENTOS —ideas decidibles—, no prosa.
 *
 * LA DIFERENCIA NO ES COSMÉTICA. Pedir prosa produce párrafos que el pastor
 * acepta o rechaza en bloque; pedir elementos produce decisiones que puede
 * tomar una por una, y son esas decisiones las que llevan procedencia. Un texto
 * generado de una vez no tiene costuras: no hay forma de atribuir nada.
 *
 * TRES INSTRUCCIONES QUE DECIDEN SI LA PROPUESTA SIRVE:
 *
 * 1. **Específico del pasaje, no del tema.** "Hablar del contexto histórico" no
 *    es un elemento: es el nombre de la sección. "La crueldad asiria y por qué
 *    Nínive aterraba a Israel" sí lo es, porque podría ser otra cosa.
 * 2. **No repetir lo que el pastor ya decidió.** Re-proponer su trabajo es la
 *    forma más rápida de que abandone el flujo.
 * 3. **Puede proponer MENOS.** Si el pasaje no da para cinco elementos, cinco
 *    elementos son relleno. Exigir un número fijo es el mecanismo por el que se
 *    fabrica contenido — la misma lección que la cita de autoridad obligatoria.
 */
/**
 * El estudio del pastor, como bloque del prompt.
 *
 * FUENTE PRIMARIA, NO EXCLUSIVA. Cuando el estudio habla del tema de la
 * sección, las propuestas salen de él — su lenguaje y sus hallazgos mandan.
 * Prohibirle al modelo todo conocimiento propio dejaría sin propuestas a las
 * secciones que el estudio no cubre (una ilustración, una conexión actual);
 * el punto es la PRIORIDAD, no el monopolio.
 */
function bloqueEstudio(study: ElementsPromptInput['study']): string {
    if (!study) return '';
    const partes = [
        study.exegeticalProposition && `- Proposición exegética: ${study.exegeticalProposition}`,
        study.historical && `- Contexto histórico: ${study.historical}`,
        study.literary && `- Contexto literario: ${study.literary}`,
        study.audience && `- Audiencia original: ${study.audience}`,
        ...(study.pastoralInsights ?? []).map((i) => `- Idea pastoral suya: ${i}`),
    ].filter(Boolean);
    if (partes.length === 0) return '';
    return `\nSU ESTUDIO EXEGÉTICO DEL PASAJE — LA FUENTE PRIMARIA:
Cuando el estudio hable del tema de esta sección, tus propuestas SALEN DE AQUÍ:
su lenguaje y sus hallazgos mandan sobre tu conocimiento general. Lo que el
estudio no cubra puedes proponerlo desde el texto bíblico, no desde datos
externos que él no pueda verificar.
${partes.join('\n')}\n`;
}

export function buildElementsPrompt(input: ElementsPromptInput): string {
    const bloque = (titulo: string, items: readonly string[] | undefined) =>
        items?.length ? `\n${titulo}\n${items.map((i) => `- ${i}`).join('\n')}\n` : '';

    /**
     * CON PROPOSICIÓN, LA TAREA ES OTRA — y esto no es un matiz.
     *
     * Antes la proposición entraba como un párrafo más junto a las reglas,
     * mientras la tarea seguía diciendo "propón elementos para esta sección".
     * El modelo la usaba como FILTRO DE JUSTIFICACIÓN: hacía lluvia de ideas
     * desde los rasgos del texto —la cadena de verbos, el destino, una
     * repetición— y después explicaba cada una contra la frase.
     *
     * El síntoma que lo delató: un concepto central de la proposición del pastor
     * ("Jonás se rebela al carácter misericordioso de Dios") no recibió NINGUNA
     * propuesta, y el hueco no se reportó. La frase se citaba en los "por qué" y
     * aun así no gobernaba nada.
     *
     * Ahora el primer paso es ENUMERAR los conceptos de la frase, y recién
     * después buscar en el texto lo que sostiene cada uno. Y el concepto sin
     * apoyo textual SE DECLARA en vez de desaparecer: un hueco silencioso deja
     * al pastor creyendo que su proposición quedó cubierta.
     */
    const tarea = input.pointProposition
        ? `TAREA, EN DOS PASOS Y EN ESTE ORDEN:

1. Identifica los CONCEPTOS que nombra la proposición de este punto. Son las
   partes en que se abre su afirmación, no los temas del pasaje.
2. Por CADA concepto, propón UN elemento: lo que en el texto bíblico sostiene
   ese concepto. El orden de tu salida sigue el orden de la frase.

NO propongas ideas que no correspondan a un concepto de la proposición, por
buenas que sean: aquí él ya decidió de qué se trata este punto.

SI UN CONCEPTO NO TIENE APOYO EN EL TEXTO, DILO — propón igual un elemento para
ese concepto y marca ese elemento con "unsupported": true. Callarlo lo dejaría
creyendo que su proposición quedó cubierta cuando le falta una parte.

NO escribas esa advertencia dentro de "text". El texto del elemento es lo que
puede terminar en el sermón: un prefijo ahí se le filtra al púlpito. La marca va
en su campo.`
        : `TAREA: propón entre ${ELEMENTS_PER_SECTION.min} y ${ELEMENTS_PER_SECTION.max} ELEMENTOS para esta sección.`;

    return `Eres el acompañante de un pastor que está redactando un sermón. NO escribes el sermón: le ayudas a DECIDIR qué va en cada sección.

PASAJE: ${input.passage}
${input.proposition ? `\nPROPOSICIÓN HOMILÉTICA (la escribió él, es la tesis del sermón):\n"${input.proposition}"\n` : ''}${bloqueEstudio(input.study)}${bloque('PUNTOS DEL SERMÓN:', input.points)}${bloque('LO QUE ÉL YA TRABAJÓ EN SU ESTUDIO (es suyo, respétalo):', input.pastorWork)}${bloque('YA DECIDIÓ ESTOS ELEMENTOS PARA ESTA SECCIÓN — NO los repitas ni los reformules:', input.alreadyDecided)}
${input.scriptureText ? `TEXTO BÍBLICO:\n"${input.scriptureText}"\n` : ''}${input.pointProposition ? `\nPROPOSICIÓN DE ESTE PUNTO (la escribió él):\n"${input.pointProposition}"\n` : ''}
SECCIÓN: ${input.sectionLabel}
TRABAJO DE ESTA SECCIÓN: ${input.sectionJob}

${tarea}

QUÉ ES UN ELEMENTO: una idea DECIDIBLE — una afirmación o imagen concreta que
PODRÍA SER OTRA y que cambia el sermón si cambia. La prueba: ¿podría un pastor
competente elegir distinto y seguir siendo fiel al texto? Si la respuesta es no,
no es un elemento.

REGLAS:
1. **ESPECÍFICO DE ESTE PASAJE, no del tema.** "Hablar del trasfondo histórico"
   NO es un elemento: es el nombre de la sección. "La crueldad asiria y por qué
   Nínive aterraba a un israelita" SÍ lo es.
2. **Una o dos frases cada uno.** No redactes el párrafo: nombra la idea. El
   pastor decide primero y la prosa se escribe después.
3. **PROPÓN MENOS SI EL PASAJE NO DA PARA MÁS.** Es preferible ${ELEMENTS_PER_SECTION.min}
   elementos sólidos que ${ELEMENTS_PER_SECTION.max} donde tres son relleno. No
   rellenes para llegar a un número.
4. **NADA QUE NO PUEDAS SOSTENER.** Si un dato histórico es disputado, dilo
   dentro del elemento o no lo propongas. Este material va al púlpito.
5. No repitas lo que él ya decidió ni lo que ya trabajó en su estudio.

FORMATO DE SALIDA (JSON, sin texto alrededor):
{
  "elements": [
    { "text": "La idea, en una o dos frases.", "why": ${
        input.pointProposition
            ? '"QUÉ CONCEPTO de su proposición desarrolla, citando sus palabras."'
            : '"Por qué sirve a ESTE sermón, en una línea."'
    }${input.pointProposition ? ', "unsupported": false' : ''} }
  ]
}`;
}
