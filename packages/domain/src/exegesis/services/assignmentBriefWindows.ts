/**
 * Cuánto del encuadre ve cada pieza, y por qué.
 *
 * El encuadre del trabajo se usa para dos cosas distintas y la confusión entre
 * ellas costó las dos mitades del defecto.
 *
 * Como CONSULTA de embeddings —para rankear recursos y para extraer
 * fragmentos— conviene recortarlo, y el motivo está medido desde antes: un
 * encuadre largo empeora la consulta porque el modelo colapsa al término
 * dominante. Ahí el tope es correcto.
 *
 * Como INSTRUCCIÓN a un modelo no conviene recortarlo nunca, porque lo que se
 * corta es una orden. Medido: de los 13 trabajos con encuadre, 3 superan los
 * 1.000 caracteres que el planificador de corpus admitía, y lo que quedaba
 * afuera era justo lo que más le incumbe. En Santiago 2:1-13 el planificador
 * nunca vio esta línea:
 *
 *     «Prohibido citar McCartney, Ropes, Varner: el plan de estudios no
 *      permite repetir una fuente en semanas consecutivas.»
 *
 * Es una restricción sobre QUÉ FUENTES ELEGIR, y el planificador de corpus es
 * exactamente quien las elige.
 */

/**
 * Lo que entra en una consulta de embeddings.
 *
 * Un solo número para las tres piezas que arman esa consulta. Antes eran tres
 * literales sueltos y NO coincidían: el ranqueador de recursos usaba 800
 * mientras el extractor usaba 500, con un comentario que afirmaba que el
 * primero «refleja el formato del extractor». Medido: en 4 de los 13 trabajos
 * con encuadre los dos veían un texto distinto, así que rankeaban y extraían
 * contra dos definiciones de «relevante para este trabajo».
 *
 * La huella de la receta de extracción (`ProjectSource`) usa este mismo número
 * a propósito: si la ventana cambia, la huella tiene que cambiar con ella o un
 * corpus viejo se daría por vigente.
 */
export const BRIEF_QUERY_CHARS = 500;

/**
 * Lo que entra en una instrucción a un modelo.
 *
 * Alto a propósito: no está para acortar el encuadre sino para que un pegado
 * accidental de veinte páginas no reviente el prompt. El encuadre más largo en
 * producción tiene 1.809 caracteres y la instrucción de sistema del
 * planificador ocupa 8.414: recortar el encuadre a 1.000 ahorraba un 10 % del
 * prompt y escondía la orden.
 */
export const BRIEF_INSTRUCTION_CHARS = 8000;

/** El encuadre tal como lo ve una consulta de embeddings. */
export function briefForQuery(brief: string | null | undefined): string {
    return (brief ?? '').trim().slice(0, BRIEF_QUERY_CHARS);
}

/**
 * La consulta con que un paso busca en el corpus: el versículo, sus palabras
 * originales y LAS PREGUNTAS DE ESE PASO (PR 2, unidad 5). Buscaba con el
 * encuadre entero, todas las preguntas del trabajo, y la hoja de una pregunta
 * competía con las de las demás: sin fijar nada, de 47 hojas que necesitaban
 * cuatro preguntas de los TP #8 y #9 llegaban 35; con las del paso, 39, y
 * Kittel μέλος (4:1) pasa de 0 a 3 (medido). Un paso sin preguntas propias
 * busca con el encuadre, como antes. Análisis y generación la arman igual.
 */
export function stepCorpusQuery(input: {
    label: string;
    originalText?: string | null;
    stepQuestions: ReadonlyArray<{ text: string }>;
    brief: string | null | undefined;
}): string {
    const preguntas = input.stepQuestions.map(q => q.text.trim()).filter(Boolean).join(' ');
    const contexto = preguntas ? preguntas.slice(0, BRIEF_QUERY_CHARS) : briefForQuery(input.brief);
    return [input.label, input.originalText?.trim() ?? '', contexto].filter(Boolean).join(' — ');
}

/** El encuadre tal como lo ve una instrucción. Entero, salvo desmesura. */
export function briefForInstruction(brief: string | null | undefined): string {
    return (brief ?? '').trim().slice(0, BRIEF_INSTRUCTION_CHARS);
}
