/**
 * PARTÍCULAS Y CONJUNCIONES: posición y función discursiva.
 *
 * δέ aparece 2.766 veces en el NT y le dábamos una línea genérica
 * ("conjunción que introduce una transición"). Son las palabras que ARTICULAN
 * el argumento: quien las lee bien sigue el razonamiento del autor, y quien
 * las ignora predica versículos sueltos.
 */

/**
 * POSPOSITIVAS: nunca abren su cláusula — van en segunda posición (o más
 * atrás) aunque gobiernen toda la frase.
 *
 * ES DETERMINISTA, propiedad del lema: no se le pregunta a nadie. Y es
 * justo lo que confunde al principiante — ve δέ en medio de la frase y cree
 * que conecta sólo lo que tiene al lado, cuando enlaza la oración entera con
 * lo anterior. En español la traducimos al principio ("pero…"), lo que borra
 * la pista.
 */
const POSPOSITIVAS = new Set(['δέ', 'γάρ', 'οὖν', 'μέν', 'τε', 'γε', 'δή', 'μήν', 'ποτε', 'τοίνυν']);

export function isPostpositive(lemma: string): boolean {
    return POSPOSITIVAS.has(lemma.normalize('NFC'));
}

/**
 * FUNCIÓN DISCURSIVA — taxonomía cerrada (Runge, *Discourse Grammar of the
 * Greek New Testament*).
 *
 * La distinción que más rinde: δέ NO es "pero". Marca DESARROLLO —un paso
 * nuevo del argumento— y sólo a veces contraste. Traducirla siempre como
 * "pero" le inventa al texto una oposición que no está.
 */
export const DISCOURSE_FUNCTIONS = [
    'development',      // δέ: un paso nuevo, no necesariamente contrario
    'continuity',       // καί: suma sin cambiar de plano
    'contrast',         // contraste real
    'correction',       // ἀλλά: corrige lo anterior
    'inference',        // οὖν, ἄρα: "por lo tanto"
    'explanation',      // γάρ: fundamenta lo dicho
    'emphasis',         // realza
    'pointCounterpoint',// μέν…δέ: par anticipado
    'resumption',       // retoma un hilo dejado atrás
    'purpose',          // ἵνα, ὅπως: finalidad
    'temporal',         // ὅταν, ὅτε: marco temporal
    'condition',        // εἰ, ἐάν
    'additive',         // καί adverbial: «también», «aun» (G4)
    'attentionGetter',  // ἰδού, ἴδε: llama la atención (G4)
    'restrictive',      // μόνον: «sólo» (G4)
] as const;

export type DiscourseFunction = (typeof DISCOURSE_FUNCTIONS)[number];

export function isKnownDiscourseFunction(id: string): id is DiscourseFunction {
    return (DISCOURSE_FUNCTIONS as readonly string[]).includes(id);
}
