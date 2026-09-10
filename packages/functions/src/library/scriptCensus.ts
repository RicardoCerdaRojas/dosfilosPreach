/**
 * Censo de escrituras del texto extraído.
 *
 * Cuenta, no opina. El juicio —«esta extracción está rota»— vive en el dominio,
 * donde se puede cambiar sin reprocesar los libros ya guardados y donde se
 * puede testear. Acá sólo se registra qué salió, porque es el único momento en
 * que el texto completo está en memoria: `textContent` se guarda TRUNCADO a
 * 800 KB por el límite de Firestore, así que contar después daría otro número.
 *
 * Existe por un hallazgo medido sobre la biblioteca real. Cuatro obras hebreas
 * habían extraído CERO caracteres hebreos y nadie se enteró:
 *
 *   Sasson, «Jonah» (Anchor Bible)   790.779 chars   0 hebreo   205 citas
 *   Barrick & Busenitz, gramática    342.995 chars   0 hebreo    32 citas
 *   BHQ, aparato de los Doce         676.994 chars   0 hebreo
 *   «Hebreo Bíblico», manual         827.573 chars   0 hebreo
 *
 * No es un límite del sistema: «Gramática Hebreo» de Farfán, el mismo tipo de
 * libro, extrajo 65.188 caracteres hebreos. A esos cuatro les fue mal, el dato
 * estaba a la vista, y nadie lo miró. Un comentario del texto hebreo sin una
 * sola letra hebrea es una extracción fallida, no un libro sin hebreo.
 */

/** Bloques Unicode, no idiomas: es lo que se puede contar sin equivocarse. */
const HEBREO = /[֐-׿יִ-ﭏ]/g;
const GRIEGO = /[Ͱ-Ͽἀ-῿]/g;
const LATINO = /[A-Za-zÀ-ɏ]/g;

export interface ScriptCensus {
    /** Largo del texto COMPLETO, antes de truncar para Firestore. */
    totalChars: number;
    hebrew: number;
    greek: number;
    latin: number;
}

export function censusOf(text: string): ScriptCensus {
    const t = text ?? '';
    return {
        totalChars: t.length,
        hebrew: (t.match(HEBREO) || []).length,
        greek: (t.match(GRIEGO) || []).length,
        latin: (t.match(LATINO) || []).length,
    };
}
