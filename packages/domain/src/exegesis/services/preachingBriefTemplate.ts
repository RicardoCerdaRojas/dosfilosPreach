import { grammarSearchKeys } from './grammarSearchKeys';

/**
 * El encuadre de un estudio para predicar, cuando nadie dio las preguntas.
 *
 * En un trabajo de curso las preguntas vienen del profesor: el encuadre de
 * Santiago 2:1-13 traía cuatro numeradas, con la forma griega adentro. En una
 * serie expositiva no las da nadie — DESCUBRIRLAS leyendo es el acto
 * exegético, y es justamente lo que no se puede automatizar.
 *
 * Pero el sistema necesita esas preguntas igual, y no por prolijidad. Son las
 * que le dan llaves a las gramáticas y a los léxicos, que no se indexan por
 * pasaje: medido en el corpus de Jonás 4, Ortiz, Barrick y Farfan no nombran
 * el pasaje en NINGUNA página. Sin una forma hebrea en el encuadre, esos tres
 * libros no tienen por dónde entrar.
 *
 * De ahí la forma de la plantilla: cuatro bloques que son iguales en cada
 * sermón de una serie, y UNO que hay que llenar leyendo. Los cuatro se
 * escriben una vez; el quinto es el trabajo.
 *
 * Medido antes de escribirla: los seis sermones de la serie de Jonás tienen el
 * encuadre VACÍO, y con él vacío no funciona nada de lo que se construyó para
 * que funcionara —ni el reparto de extensión, ni la pregunta por sección, ni
 * la forma de cita, ni la búsqueda por categoría gramatical—.
 */

export const PREACHING_BRIEF_TEMPLATE = `PASAJE Y UNIDAD
[Referencia]. Qué escena o movimiento es dentro del libro, y con qué unidad
anterior se encadena.

DESTINO
Estudio para predicación expositiva. NO es un trabajo académico: el andamiaje
se hace entero y no se muestra. El resultado tiene que servir para predicar,
no para entregar.

PREGUNTAS DEL TEXTO
[Este bloque lo llenás leyendo el pasaje. Una pregunta por cada cruz real, y
en cada una nombrá la forma hebrea o griega concreta — es lo que le da entrada
a las gramáticas y los léxicos, que no se indexan por pasaje.]
1.
2.

LO QUE TIENE QUE QUEDAR RESUELTO
- La intención del autor en esta unidad, en una oración.
- Qué decisión de traducción cambia el sentido, si hay alguna.
- Qué hace este pasaje en el argumento del libro.

FUENTES Y FORMATO`;

/**
 * La plantilla con el bloque de fuentes YA ESCRITO por el sistema.
 *
 * El bloque de fuentes pedía anotar a mano cuál libro translitera, cuál no se
 * puede repetir y cuál ancla. El fundador lo probó y dijo que era lo más
 * difícil de llenar — con razón: son cosas que el sistema ya midió, y pedirle
 * que las transcriba es hacerle a él el trabajo de la máquina.
 *
 * Lo que sigue en blanco es el bloque de PREGUNTAS, que es el acto exegético.
 */
export function buildPreachingBrief(sourcesAndFormat: string): string {
    const bloque = sourcesAndFormat.trim();
    return bloque
        ? `${PREACHING_BRIEF_TEMPLATE}\n${bloque}`
        : PREACHING_BRIEF_TEMPLATE;
}

/**
 * Qué le falta a un encuadre para que el sistema pueda trabajar con él.
 *
 * No es una revisión de estilo ni una opinión sobre la redacción. Cada
 * carencia que se reporta corresponde a una pieza que, sin ella, hace su
 * trabajo a medias y en silencio.
 */
export type BriefGap =
    /** Vacío: no hay encuadre. */
    | 'empty'
    /** Quedó la plantilla sin llenar, con sus corchetes de instrucción. */
    | 'template-unfilled'
    /**
     * Ninguna forma del original ni categoría gramatical.
     *
     * Es la carencia con consecuencia medible: sin ellas, las gramáticas y los
     * léxicos del corpus no tienen por dónde entrar al pasaje.
     */
    | 'no-search-keys';

/**
 * Las marcas que deja la plantilla sin llenar.
 *
 * Se busca el corchete y no una frase concreta: quien borra el texto de ayuda
 * pero deja los corchetes no llenó nada, y quien reescribe el bloque entero
 * con sus palabras sí lo hizo.
 */
const CORCHETE_DE_PLANTILLA = /\[[^\]]{12,}\]/;

export function briefGaps(brief: string | null | undefined): BriefGap[] {
    const texto = (brief ?? '').trim();
    if (!texto) return ['empty'];

    const gaps: BriefGap[] = [];
    if (CORCHETE_DE_PLANTILLA.test(texto)) gaps.push('template-unfilled');

    const claves = grammarSearchKeys(texto);
    if (claves.originalForms.length === 0 && claves.categories.length === 0) {
        gaps.push('no-search-keys');
    }
    return gaps;
}
