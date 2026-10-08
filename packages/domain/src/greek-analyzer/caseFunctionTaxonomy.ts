import type { GreekCase } from './morphGntToken';

/**
 * LA TAXONOMÍA DE FUNCIONES DEL CASO — gramática intermedia (Wallace,
 * *Greek Grammar Beyond the Basics*; Dana-Mantey).
 *
 * ES UNA LISTA CERRADA A PROPÓSITO, y esa es la decisión de diseño. Mostramos
 * la MORFOLOGÍA desde el dataset (nominativo, genitivo…) pero la FUNCIÓN es
 * interpretativa: hay que pedírsela al modelo. Dejarlo escribir la etiqueta
 * libremente produciría términos con aire académico que ningún profesor
 * reconoce — y un término inventado es peor que no decir nada, porque el
 * pastor lo repetiría en clase. El modelo ELIGE de esta lista o devuelve
 * vacío; el parser descarta cualquier id que no esté acá.
 *
 * El caso de Santiago 1:1 que lo motivó: Ἰάκωβος no es sujeto de ningún verbo
 * finito —no hay ninguno, χαίρειν es infinitivo— sino NOMINATIVO ABSOLUTO, el
 * de los encabezados y saludos epistolares. El profesor del fundador lo
 * nombró; nuestra tarjeta decía "sujeto del saludo implícito": cerca, pero sin
 * la categoría.
 */
export const CASE_FUNCTIONS: Record<GreekCase, readonly string[]> = {
    N: [
        'subject',            // sujeto del verbo finito
        'predicateNominative',// predicado nominal (con εἰμί y equivalentes)
        'absolute',           // encabezados, títulos, saludos epistolares
        'appellation',        // el nombre en sí ("se llamará X")
        'apposition',         // aposición simple
        'pendent',            // nominativo pendiente (anacoluto)
    ],
    G: [
        'possession',         // "de" — pertenencia
        'relationship',       // parentesco (hijo/padre DE)
        'subjective',         // el genitivo actúa (el amor DE Dios: Dios ama)
        'objective',          // el genitivo recibe (el temor DE Dios: se le teme)
        'attributive',        // cualidad ("cuerpo de pecado" = pecaminoso)
        'partitive',          // el todo del que se toma una parte
        'source',             // origen
        'apposition',         // genitivo de aposición ("la señal DE la circuncisión")
        'content',            // de contenido ("la red llena DE peces") — G3
        'time',               // genitivo de tiempo (dentro de qué tiempo: "de noche") — G3
        'separation',         // de separación ("ajenos DE la ciudadanía") — G3
        'comparison',         // de comparación (tras comparativo: "mayor QUE") — G3
        'absoluteSubject',    // sujeto de un genitivo absoluto ("ὀψίας γενομένης") — G3
        'objectOfPreposition',
    ],
    D: [
        'indirectObject',
        'means',              // instrumento ("por/mediante")
        'manner',             // modo
        'reference',          // "con respecto a"
        'advantage',          // dativo de interés (a favor de)
        'time',               // dativo de tiempo (cuándo)
        'sphere',             // esfera/ámbito
        'agency',             // dativo de agencia (raro: con perfecto pasivo) — G3
        'association',        // de asociación ("con") — G3
        'cause',              // de causa ("por") — G3
        'location',           // de lugar ("en") — G3
        'objectOfPreposition',
    ],
    A: [
        'directObject',
        'doubleAccusative',
        'subjectOfInfinitive',// el "sujeto" en acusativo de una infinitiva
        'measure',            // extensión de tiempo o espacio
        'respect',            // acusativo de relación
        'cognate',            // cognado ("temieron con gran temor") — G3
        'adverbial',          // adverbial (de modo: "gratuitamente" = δωρεάν) — G3
        'objectOfPreposition',
    ],
    V: ['address'],           // invocación directa
} as const;

/** ¿Es una función válida para ese caso? El parser lo usa para descartar. */
export function isKnownCaseFunction(gcase: GreekCase, id: string): boolean {
    return CASE_FUNCTIONS[gcase]?.includes(id) ?? false;
}
