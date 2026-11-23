/**
 * Encabezados corridos: el título del libro o del capítulo que se repite
 * arriba de cada página impresa, y que la extracción marca como título.
 *
 * Medido en Robertson (A Grammar of the Greek New Testament, 1.528 páginas):
 * «A GRAMMAR OF THE GREEK NEW TESTAMENT» abre 357 páginas como `##`, «THE
 * CASES (ΠΤΩΣΕΙΣ)» 38, «PREPOSITIONS» 44… Cada vez reiniciaba la ruta de
 * sección, y los fragmentos perdían su sección real: la hoja 575, citada en
 * el TP #7, no conservaba la del genitivo (A8c, 2026-11-22). Además llegan
 * con errores del escaneo («THEGREEK», «OE TIE», «TE.STA1VIENT»: 14 variantes).
 *
 * Regla: un título que ABRE la página (sin texto antes) en tres o más páginas
 * es un encabezado corrido, y también sus variantes casi iguales. Hay dos
 * clases, y solo una se ignora:
 *
 *   - El del LIBRO («A GRAMMAR…»): corre por todo el volumen, intercalado con
 *     los de varios capítulos, de punta a punta (al menos el 60 % del
 *     volumen), abre muchas páginas (al menos el 5 %) y casi
 *     nunca aparece en otro lugar que arriba (90 %). No dice nada de dónde se
 *     está: ninguna de sus apariciones cuenta como título. Las dos últimas
 *     condiciones salvan los subtítulos que se repiten en cada perícopa de un
 *     comentario («Translation», «Notes», «Comment»): abren una página de vez
 *     en cuando, pero casi siempre van en medio. Y hay uno solo: el más
 *     frecuente de los que cumplen.
 *   - El del CAPÍTULO («MODE», «THE CASES»): corre solo dentro de su capítulo
 *     y sigue contando como título, como antes. Reinicia la ruta en cada
 *     página que abre, y eso es a propósito: medido en Robertson, las
 *     subsecciones «5. TEMPORAL CLAUSES», «8. CONDITIONAL SENTENCES» quedaron
 *     como texto plano en la extracción, y sin ese reinicio «2. CAUSAL
 *     SENTENCES» se arrastraba por 175 fragmentos que no son suyos. Una ruta
 *     gruesa y cierta («MODE») vale más que una fina y falsa en una cita.
 */

/** Páginas que tiene que abrir un mismo título para ser un encabezado corrido. */
export const REPETICIONES_DE_UN_CORRIDO = 3;
/** Encabezados de capítulo que atraviesa el del libro entre su primera y su última aparición. */
export const CAPITULOS_QUE_ATRAVIESA_EL_DEL_LIBRO = 3;
/** Parte de las páginas que abre el del libro. Robertson: 357 de 1.528 (23 %). */
export const PAGINAS_QUE_ABRE_EL_DEL_LIBRO = 0.05;
/**
 * Parte del volumen que recorre el del libro, de su primera a su última
 * aparición. Una PARTE del libro («INTRODUCTION» en Mayor, «PARTE I -
 * TEOLOGÍA PROPIA») también corre e intercala capítulos, pero solo por su
 * tramo, y es un título real: ignorarla borraba su comienzo.
 */
export const TRAMO_QUE_RECORRE_EL_DEL_LIBRO = 0.6;
/** Parte de sus apariciones que van arriba de la página. Robertson: 357 de 357. */
export const PARTE_AL_TOPE_DEL_DEL_LIBRO = 0.9;
/** Parecido mínimo para contar una variante del escaneo como el mismo encabezado. */
const PARECIDO_DE_UNA_VARIANTE = 0.85;
/** Por debajo de este largo, una letra cambia el sentido («tense» / «terse»): sin variantes. */
const LARGO_MINIMO_PARA_VARIANTE = 10;

/**
 * El título sin acentos, mayúsculas ni puntuación, en cualquier alfabeto. Las
 * cifras SE CONSERVAN: «GEN 1:1» y «GEN 1:2», «Chapter 1» y «Chapter 2» son
 * títulos distintos (revisión adversarial de A8c: sin cifras, todo JFB quedaba
 * en «GEN 1:1»). Es la clave para comparar un título con sus ancestros.
 */
export function claveDeEncabezado(titulo: string): string {
    return titulo
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

/**
 * La clave de un encabezado corrido: la del título sin el folio que a veces
 * lleva pegado («354 A GRAMMAR…», «THE CASES 355»). Solo si el título tiene al
 * menos dos palabras de letras: en «GEN 1:1» o «Romans 1:1-7» las cifras son
 * el título.
 */
export function claveDeCorrido(titulo: string): string {
    const palabras = claveDeEncabezado(titulo).split(' ').filter(Boolean);
    const numero = (w: string | undefined) => !!w && /^\p{N}+$/u.test(w);
    if (palabras.filter(w => !numero(w)).length >= 2) {
        if (numero(palabras[0])) palabras.shift();
        if (numero(palabras[palabras.length - 1])) palabras.pop();
    }
    return palabras.join(' ');
}

function distancia(a: string, b: string): number {
    let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const fila = [i];
        for (let j = 1; j <= b.length; j++) {
            fila[j] = Math.min(previa[j]! + 1, fila[j - 1]! + 1, previa[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previa = fila;
    }
    return previa[b.length]!;
}

function parecido(a: string, b: string): number {
    const largo = Math.max(a.length, b.length);
    return largo === 0 ? 1 : 1 - distancia(a, b) / largo;
}

/**
 * Para el título que abre cada página (null si la página no abre con uno),
 * si hay que ignorarlo por ser un encabezado corrido repetido.
 */
export function encabezadosCorridosAIgnorar(
    titulosAlTope: ReadonlyArray<string | null>,
    /** Todos los títulos del documento, estén donde estén (para saber cuántos van en medio). */
    todosLosTitulos: ReadonlyArray<string> = [],
): boolean[] {
    const claves = titulosAlTope.map(t => (t ? claveDeCorrido(t) : ''));
    const cuenta = new Map<string, number>();
    for (const k of claves) if (k) cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    const corridos = [...cuenta].filter(([, n]) => n >= REPETICIONES_DE_UN_CORRIDO).map(([k]) => k);
    if (corridos.length === 0) return claves.map(() => false);

    // Cada clave va al encabezado corrido que representa (ella misma, o el
    // frecuente al que más se parece), o a nada.
    const grupo = new Map<string, string | null>();
    for (const k of cuenta.keys()) {
        if (corridos.includes(k)) { grupo.set(k, k); continue; }
        let mejor: string | null = null;
        let mejorParecido = 0;
        if (k.length >= LARGO_MINIMO_PARA_VARIANTE) {
            for (const c of corridos) {
                if (c.length < LARGO_MINIMO_PARA_VARIANTE) continue;
                const p = parecido(k, c);
                if (p >= PARECIDO_DE_UNA_VARIANTE && p > mejorParecido) { mejor = c; mejorParecido = p; }
            }
        }
        grupo.set(k, mejor);
    }

    // Una clave fuera de las del tope busca su grupo por parecido, como las demás.
    const grupoDe = (k: string): string | null => {
        if (!k) return null;
        if (grupo.has(k)) return grupo.get(k) ?? null;
        if (k.length < LARGO_MINIMO_PARA_VARIANTE) return null;
        return corridos.find(c => c.length >= LARGO_MINIMO_PARA_VARIANTE && parecido(k, c) >= PARECIDO_DE_UNA_VARIANTE) ?? null;
    };
    // Del libro: entre su primera y su última aparición abre páginas con los
    // encabezados de varios capítulos. Uno de capítulo, a lo sumo con el del libro.
    const posiciones = new Map<string, number[]>();
    claves.forEach((k, i) => {
        const g = k ? grupo.get(k) ?? null : null;
        if (g) posiciones.set(g, [...(posiciones.get(g) ?? []), i]);
    });
    const delLibro = new Set<string>();
    for (const [g, pos] of posiciones) {
        const [desde, hasta] = [pos[0]!, pos[pos.length - 1]!];
        const otros = new Set<string>();
        for (const [h, ps] of posiciones) if (h !== g && ps.some(p => p > desde && p < hasta)) otros.add(h);
        if (otros.size < CAPITULOS_QUE_ATRAVIESA_EL_DEL_LIBRO) continue;
        if (pos.length < PAGINAS_QUE_ABRE_EL_DEL_LIBRO * titulosAlTope.length) continue;
        if (hasta - desde < TRAMO_QUE_RECORRE_EL_DEL_LIBRO * titulosAlTope.length) continue;
        const enTotal = todosLosTitulos.filter(t => grupoDe(claveDeCorrido(t)) === g).length;
        if (enTotal > 0 && pos.length / enTotal < PARTE_AL_TOPE_DEL_DEL_LIBRO) continue;
        delLibro.add(g);
    }
    // Un libro tiene un solo título: el más frecuente de los que cumplen. En
    // «Obadiah, Jonah and Micah» también cumplía «INTRODUCTION», que es real
    // (cada libro tiene la suya) y no se puede ignorar.
    const [elDelLibro] = [...delLibro].sort((a, b) => posiciones.get(b)!.length - posiciones.get(a)!.length);

    return claves.map(k => {
        const g = k ? grupo.get(k) ?? null : null;
        return !!g && g === elDelLibro;
    });
}
