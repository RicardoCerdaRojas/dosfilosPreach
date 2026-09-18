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

/**
 * El segundo hallazgo, medido el 2026-09-17 sobre la misma biblioteca: un
 * libro puede traer TODO su hebreo y traerlo AL REVÉS. El léxico de Ortiz
 * extrajo 79.687 caracteres hebreos —sano según el censo de arriba— con las
 * palabras invertidas letra a letra: «אֲגָם» salió «םָגֲא». Las definiciones
 * en español se leen bien, así que nada lo delataba, y el lema hebreo que
 * encabeza cada entrada es justamente lo que un trabajo de exégesis cita.
 *
 * Lo que lo delata: las letras finales (ך ם ן ף ץ) sólo existen al FINAL de
 * una palabra hebrea. Al invertir, quedan al principio. Medido sobre las 67
 * obras de la biblioteca real, cuatro salieron invertidas —Ortiz 11,8 %,
 * «Gramática Hebreo» 13,3 %, «Léxico Griego-Español» 9,7 %, «Diccionario
 * Teológico del NT» 10,3 %— y el resto queda entre 0,0 % y 0,1 %. No hay
 * nada en el medio.
 *
 * Y CORRIGE EL PÁRRAFO DE ARRIBA: «Gramática Hebreo» de Farfán se citaba ahí
 * como prueba de que el sistema podía con ese tipo de libro, porque extrajo
 * 65.188 caracteres hebreos. Los extrajo al revés. Tener el alfabeto y tenerlo
 * utilizable son dos cosas distintas, y el censo de alfabetos sólo ve la
 * primera.
 */

/** Bloques Unicode, no idiomas: es lo que se puede contar sin equivocarse. */
const HEBREO = /[֐-׿יִ-ﭏ]/g;
const GRIEGO = /[Ͱ-Ͽἀ-῿]/g;
const LATINO = /[A-Za-zÀ-ɏ]/g;

/** Consonantes hebreas, sin vocales ni cantilación. */
const CONSONANTE = /[א-ת]/g;
/** Letras finales: en hebreo correcto sólo cierran palabra. */
const FINAL = /[ךםןףץ]/;
/** Una palabra hebrea: letras hebreas seguidas, con sus puntos. */
const PALABRA_HEBREA = /[֐-׿]+/g;

export interface ScriptCensus {
    /** Largo del texto COMPLETO, antes de truncar para Firestore. */
    totalChars: number;
    hebrew: number;
    greek: number;
    latin: number;
    /** Palabras hebreas de dos o más consonantes. */
    hebrewWords?: number;
    /** De ésas, cuántas empiezan por una letra final: la marca del texto invertido. */
    hebrewFinalAtStart?: number;
}

export function censusOf(text: string): ScriptCensus {
    const t = text ?? '';
    const direccion = contarDireccionHebrea(t);
    return {
        totalChars: t.length,
        hebrew: (t.match(HEBREO) || []).length,
        greek: (t.match(GRIEGO) || []).length,
        latin: (t.match(LATINO) || []).length,
        ...direccion,
    };
}

/**
 * Cuántas palabras hebreas hay y cuántas empiezan por una letra final.
 *
 * Cuenta, no opina: el umbral y el veredicto viven en el dominio
 * (`assessExtraction`), donde se pueden cambiar sin reprocesar los libros
 * ya guardados.
 *
 * Se ignoran las palabras de una sola consonante —preposiciones sueltas,
 * letras de numeración— porque en ellas «primera» y «última» son la misma
 * posición y toda final contaría como error.
 */
export function contarDireccionHebrea(text: string): { hebrewWords: number; hebrewFinalAtStart: number } {
    let hebrewWords = 0;
    let hebrewFinalAtStart = 0;
    for (const palabra of text.match(PALABRA_HEBREA) || []) {
        const consonantes = palabra.match(CONSONANTE);
        if (!consonantes || consonantes.length < 2) continue;
        hebrewWords++;
        if (FINAL.test(consonantes[0]!)) hebrewFinalAtStart++;
    }
    return { hebrewWords, hebrewFinalAtStart };
}
