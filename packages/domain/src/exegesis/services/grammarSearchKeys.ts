/**
 * Con qué se le pregunta a una gramática.
 *
 * Una gramática temática no está organizada por pasajes: su índice son
 * categorías —«2.4. The Genitive Case», «10. Participles», «2.1.3. Third class
 * conditional»— y por eso la consulta por pasaje le devuelve cero. Medido
 * sobre el corpus de Santiago 2:1-13: Porter quedó en 0 fragmentos teniendo
 * 465 secciones indexadas, y la sugerencia semántica propuso 46 hojas de las
 * que ocho tramos no servían a ninguna pregunta y el que contestaba la
 * pregunta 2 no entraba.
 *
 * Las llaves salen del ENCUADRE del trabajo, no del análisis canónico. Es una
 * decisión de secuencia: el análisis corre después de armar el corpus, y el
 * encuadre está desde el primer minuto. Y alcanza, porque el encuadre de un
 * trabajo de sintaxis nombra las dos cosas que el índice de una gramática
 * usa: la forma griega y el nombre de la categoría.
 *
 *     «¿Cómo funciona ἐὰν (Stg. 2:2)?»                 → ἐάν
 *     «¿Cómo está funcionando el participio ἐλεγχόμενοι?» → participio
 */

/**
 * Los términos gramaticales, en los dos idiomas.
 *
 * La lista deja AFUERA a propósito los que colisionan con el español
 * corriente. «caso» aparece en cualquier encuadre y arrastraría las treinta
 * secciones de preposiciones de Porter, que todas dicen «Case» en el título;
 * «final» entra por «finalmente». Un término que trae ruido en cada trabajo
 * vale menos que no estar.
 *
 * Es una lista CERRADA y tiene que serlo: los títulos de sección de una
 * gramática están en su idioma —Porter titula en inglés— y el encuadre está
 * en el del alumno. Traducir con un modelo acá sería pagar una llamada para
 * resolver un vocabulario de cincuenta palabras que no cambia nunca, y
 * arriesgar que «caso» vuelva como «case» en el sentido de «causa judicial».
 *
 * Cada entrada es el término en español y su forma en inglés. Se comparan sin
 * tildes y en minúsculas, y por prefijo: «genitiv» alcanza a «genitivo»,
 * «genitivos», «genitive» y «genitives».
 */
export const GRAMMAR_TERMS: ReadonlyArray<{ es: string; en: string }> = [
    // Casos
    { es: 'nominativ', en: 'nominativ' },
    { es: 'genitiv', en: 'genitiv' },
    { es: 'dativ', en: 'dativ' },
    { es: 'acusativ', en: 'accusativ' },
    { es: 'vocativ', en: 'vocativ' },
    // Formas verbales
    { es: 'participi', en: 'participl' },
    { es: 'infinitiv', en: 'infinitiv' },
    { es: 'imperativ', en: 'imperativ' },
    { es: 'subjuntiv', en: 'subjunctiv' },
    { es: 'optativ', en: 'optativ' },
    { es: 'indicativ', en: 'indicativ' },
    // Tiempo y aspecto
    { es: 'aoristo', en: 'aorist' },
    { es: 'presente', en: 'present' },
    { es: 'imperfecto', en: 'imperfect' },
    { es: 'perfecto', en: 'perfect' },
    { es: 'pluscuamperfecto', en: 'pluperfect' },
    { es: 'futuro', en: 'future' },
    // Voz
    { es: 'activa', en: 'active' },
    { es: 'pasiva', en: 'passive' },
    // Sintaxis de la oración
    { es: 'condicional', en: 'conditional' },
    { es: 'protasis', en: 'protasis' },
    { es: 'apodosis', en: 'apodosis' },
    { es: 'relativa', en: 'relative' },
    { es: 'causal', en: 'causal' },
    { es: 'concesiv', en: 'concessiv' },
    { es: 'temporal', en: 'temporal' },
    { es: 'aposicion', en: 'apposition' },
    { es: 'atributiv', en: 'attributiv' },
    { es: 'predicativ', en: 'predicat' },
    { es: 'absoluto', en: 'absolute' },
    // Partes de la oración
    { es: 'conjuncion', en: 'conjunction' },
    { es: 'particula', en: 'particle' },
    { es: 'preposicion', en: 'preposition' },
    { es: 'articulo', en: 'article' },
    { es: 'pronombre', en: 'pronoun' },
    { es: 'adjetivo', en: 'adjective' },
    { es: 'adverbio', en: 'adverb' },
    { es: 'sustantivo', en: 'noun' },
    { es: 'negacion', en: 'negation' },
];

/** Sin tildes ni mayúsculas, para comparar español, inglés y griego por igual. */
export function foldKey(text: string): string {
    return text
        .normalize('NFD')
        // Diacríticos latinos y griegos —tildes, espíritus, iota suscrita—:
        // «ἐὰν» y «ἐάν» son la misma palabra y el índice escribe una sola.
        .replace(/[̀-ͯ᾽-῾]/g, '')
        .normalize('NFC')
        .toLowerCase();
}

/**
 * Largo mínimo de una forma griega.
 *
 * Dos, y no tres. `εἰ` —la condicional de primera clase— tiene dos letras y
 * Porter le dedica una sección entera: «2.11. εἰ (Conjunction, Conditional)».
 * Con el tope en tres se perdía, y con ella media respuesta a la pregunta de
 * las condicionales.
 *
 * Dos letras sólo son seguras porque la comparación exige PALABRA ENTERA: sin
 * eso, «δε» caería dentro de «δείκνυμι» y de media gramática.
 */
const MIN_LARGO_GRIEGO = 2;

export interface GrammarSearchKeys {
    /** Formas griegas que nombra el encuadre, sin diacríticos. */
    greek: string[];
    /**
     * Categorías gramaticales que nombra el encuadre, en las dos lenguas.
     *
     * Van las dos porque el índice está en el idioma DEL LIBRO y no en el del
     * alumno: Porter titula «The Genitive Case» y el encuadre dice
     * «genitivos».
     */
    categories: string[];
}

/**
 * Qué buscar en el índice de una gramática, leído del encuadre del trabajo.
 *
 * No inventa categorías: sólo reconoce las que el encuadre nombra. Un encuadre
 * que no habla de gramática devuelve listas vacías, y entonces no hay nada que
 * proponer — que es más honesto que proponer el índice entero.
 */
export function grammarSearchKeys(brief: string | null | undefined): GrammarSearchKeys {
    const texto = foldKey(brief ?? '');
    if (!texto.trim()) return { greek: [], categories: [] };

    const greek = [...new Set(
        (texto.match(/[Ͱ-Ͽἀ-῿]+/g) ?? []).filter(w => w.length >= MIN_LARGO_GRIEGO),
    )];

    const categories: string[] = [];
    for (const { es, en } of GRAMMAR_TERMS) {
        if (!nombraElTermino(texto, es)) continue;
        categories.push(es);
        if (en !== es) categories.push(en);
    }

    return { greek, categories: [...new Set(categories)] };
}


/**
 * Si el encuadre nombra un término gramatical.
 *
 * El término tiene que EMPEZAR una palabra, y el final queda libre para que
 * «genitiv» alcance a «genitivo» y a «genitivos». Sin el comienzo de palabra,
 * «media» entraba por «inmediatamente» y «final» por «finalmente»: medido
 * sobre el encuadre real de Santiago 2:1-13, eso proponía 34 secciones donde
 * corresponden 13, y las de más eran la voz media y las finales, que el
 * trabajo no pregunta.
 */
function nombraElTermino(texto: string, termino: string): boolean {
    let at = texto.indexOf(termino);
    while (at !== -1) {
        const antes = at === 0 ? '' : texto[at - 1]!;
        if (!/\p{L}/u.test(antes)) return true;
        at = texto.indexOf(termino, at + 1);
    }
    return false;
}

/** Una letra griega, para reconocer dónde empieza y termina una palabra. */
const LETRA_GRIEGA = /[\u0370-\u03FF\u1F00-\u1FFF]/;

/**
 * Si un título nombra esta forma griega como PALABRA ENTERA.
 *
 * La exigencia de palabra entera es lo que permite buscar formas de dos
 * letras. `\b` de JavaScript no sirve —es ASCII y considera frontera a
 * cualquier letra griega—, así que se mira el carácter de cada lado.
 */
export function titleNamesGreek(title: string, key: string): boolean {
    const t = foldKey(title);
    let at = t.indexOf(key);
    while (at !== -1) {
        const antes = at === 0 ? '' : t[at - 1]!;
        const despues = t[at + key.length] ?? '';
        if (!LETRA_GRIEGA.test(antes) && !LETRA_GRIEGA.test(despues)) return true;
        at = t.indexOf(key, at + 1);
    }
    return false;
}

/** Si un título nombra esta categoría. Por prefijo: «genitiv» alcanza a «genitive». */
export function titleNamesCategory(title: string, category: string): boolean {
    return foldKey(title).includes(category);
}

export interface SectionProposal {
    sheet: number;
    section: string;
    /** Qué clave del encuadre la trajo, para decir POR QUÉ se propone. */
    matched: string[];
    /**
     * Si además nombra una forma griega del encuadre.
     *
     * Es la única señal fuerte que hay, y se midió antes de elegirla. De las
     * once secciones de Porter que nombran «conditional», las cuatro que
     * además traen una forma griega del encuadre son exactamente las cuatro
     * que contestan la pregunta: ἐάν (h209), εἰ (h209), Conditional Clauses
     * (h255) y Third class conditional (h261).
     */
    corroborated: boolean;
}

/**
 * Las secciones del libro que responden a lo que el encuadre pregunta.
 *
 * Se descartó ordenar por la FORMA del título —qué fracción de él ocupa el
 * término— y la medición es la razón. Con ese criterio «2.1.3. Third class
 * conditional» quedaba ÚLTIMA de once, con peso 0,14, por ser el título más
 * largo; y es justamente la sección que contesta la pregunta. En un índice
 * jerárquico el encabezado más específico es casi siempre el más útil y
 * necesariamente el más largo: ordenar por forma entierra lo mejor.
 *
 * Así que no se ordena por forma. Van primero las corroboradas —las que
 * además nombran una forma griega del encuadre, que es evidencia y no
 * apariencia— y después el orden del libro. Y no se descarta ninguna: la
 * lista completa de una categoría son once o treinta filas, revisables, y
 * mucho menos que las 465 secciones del libro o que una adivinanza semántica
 * de 46 hojas.
 */
export function sectionsForKeys(
    /**
     * El índice de secciones del libro, no el de hojas.
     *
     * La diferencia es la mitad del asunto: `pages` guarda UNA sección por
     * hoja y una hoja puede traer varias. La 209 de Porter abre con «2.9.
     * διό» y adentro están «2.10. ἐάν» y «2.11. εἰ» — de sus 465 secciones,
     * el índice por hoja deja ver 130, y entre las 335 perdidas está la que
     * contesta la pregunta sobre las condicionales.
     */
    sections: ReadonlyArray<{ sheet: number; section: string | null }>,
    keys: GrammarSearchKeys,
): SectionProposal[] {
    if (keys.greek.length === 0 && keys.categories.length === 0) return [];

    const vistas = new Map<string, SectionProposal>();
    for (const entry of sections) {
        const title = entry.section?.trim();
        if (!title || vistas.has(title)) continue;

        const griegas = keys.greek.filter(g => titleNamesGreek(title, g));
        const categorias = keys.categories.filter(c => titleNamesCategory(title, c));
        if (griegas.length === 0 && categorias.length === 0) continue;

        vistas.set(title, {
            sheet: entry.sheet,
            section: title,
            matched: [...griegas, ...categorias],
            corroborated: griegas.length > 0,
        });
    }

    return [...vistas.values()].sort((a, b) =>
        Number(b.corroborated) - Number(a.corroborated) || a.sheet - b.sheet);
}
