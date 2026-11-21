/**
 * De las categorías que nombra el análisis a la subsección exacta de una gramática.
 *
 * Segundo paso de la meta de gramáticas en dos pasos (decisión del fundador,
 * 2026-11-21). El primero, `grammarCategoryRegions`, lleva la pregunta a la
 * región del libro. Este toma lo que el análisis ya decidió o propuso —las
 * opciones de cada pregunta («Participio de medio», «Circunstancia
 * concomitante»), la caracterización de cada punto discutible y la función
 * sintáctica de cada construcción («Participio atributivo en segunda posición»)—
 * y devuelve las subsecciones que tratan esa categoría.
 *
 * Medido en el banco del corpus: en TP #10, P1, las opciones «medio | manera |
 * circunstancia concomitante» son las subsecciones «Means», «Manner» y
 * «Attendant Circumstance» de Wallace, donde caen las citas 627 y 642.
 *
 * El glosario es CERRADO, como `GRAMMAR_TERMS`: los títulos de la gramática
 * están en su idioma y el análisis en el del alumno, y traducir con un modelo
 * aquí pagaría una llamada para un vocabulario que no cambia.
 */
import { foldKey } from './grammarSearchKeys';
import { sectionNodesFromOutline, type OutlineEntry, type SectionNode } from './grammarCategoryRegions';

/**
 * Término del análisis (español, plegado, por prefijo) → cómo lo titula una
 * gramática en inglés (plegado, por prefijo). `general: true` marca las
 * categorías amplias, que ubican la región pero no bastan para elegir una
 * subsección.
 */
export const CATEGORY_GLOSSARY: ReadonlyArray<{ es: string; en: string[]; general?: boolean; wholeWord?: boolean }> = [
    // Clases de palabra y casos: ubican, no deciden.
    { es: 'participi', en: ['particip'], general: true },
    { es: 'infinitiv', en: ['infinitiv'], general: true },
    { es: 'genitiv', en: ['genitiv'], general: true },
    { es: 'dativ', en: ['dativ'], general: true },
    { es: 'acusativ', en: ['accusativ'], general: true },
    { es: 'nominativ', en: ['nominativ'], general: true },
    { es: 'vocativ', en: ['vocativ'], general: true },
    { es: 'articul', en: ['article'], general: true },
    { es: 'pronombre', en: ['pronoun'], general: true },
    { es: 'adverbial', en: ['adverbial'], general: true },
    { es: 'perfecto', en: ['perfect'], general: true },
    { es: 'aoristo', en: ['aorist'], general: true },
    { es: 'presente', en: ['present'], general: true },
    { es: 'futuro', en: ['future'], general: true },
    { es: 'imperativ', en: ['imperativ'], general: true },
    { es: 'subjuntiv', en: ['subjunctiv'], general: true },
    { es: 'optativ', en: ['optativ'], general: true },
    // Participios.
    { es: 'de medio', en: ['means'] },
    { es: 'instrumental', en: ['means', 'instrument'] },
    { es: 'de manera', en: ['manner'] },
    { es: 'circunstancia concomitante', en: ['attendant circumstance'] },
    { es: 'concomitante', en: ['attendant circumstance'] },
    { es: 'temporal', en: ['temporal'], wholeWord: true },
    { es: 'causal', en: ['cause', 'causal'], wholeWord: true },
    { es: 'condicional', en: ['condition'] },
    { es: 'concesiv', en: ['concessive'] },
    { es: 'de proposito', en: ['purpose'] },
    // Palabra entera: «finalmente» no es una cláusula final.
    { es: 'final', en: ['purpose'], wholeWord: true },
    { es: 'de resultado', en: ['result'] },
    { es: 'sustantivad', en: ['substantiv'] },
    { es: 'atributiv', en: ['attributiv'] },
    { es: 'predicativ', en: ['predicate'] },
    { es: 'perifrastic', en: ['periphrastic'] },
    { es: 'complementari', en: ['complementary'] },
    { es: 'absoluto', en: ['absolute'] },
    // Genitivo, dativo, acusativo.
    { es: 'subjetivo', en: ['subjective'] },
    { es: 'objetivo', en: ['objective'] },
    { es: 'plenario', en: ['plenary'] },
    { es: 'produccion', en: ['production'] },
    { es: 'posesiv', en: ['possessive', 'possession'] },
    { es: 'partitiv', en: ['partitive'] },
    { es: 'aposicion', en: ['apposition'] },
    { es: 'descriptiv', en: ['descriptive'] },
    { es: 'de contenido', en: ['content'] },
    { es: 'de material', en: ['material'] },
    { es: 'de relacion', en: ['relationship'] },
    { es: 'de referencia', en: ['reference'] },
    { es: 'ventaja', en: ['advantage'] },
    { es: 'interes', en: ['interest'] },
    { es: 'sujeto del infinitivo', en: ['subject of the infinitive'] },
    { es: 'doble acusativo', en: ['double'] },
    { es: 'neutro plural', en: ['neuter plural'] },
    { es: 'epexegetic', en: ['epexegetical'] },
    // Artículo.
    { es: 'monadic', en: ['monadic'] },
    { es: 'por excelencia', en: ['par excellence'] },
    { es: 'anaforic', en: ['anaphoric'] },
    { es: 'generico', en: ['generic'] },
    // Tiempos y modos.
    { es: 'intensiv', en: ['intensive'] },
    { es: 'extensiv', en: ['extensive', 'consummative'] },
    { es: 'resultante', en: ['intensive', 'resultative'] },
    { es: 'prolepti', en: ['proleptic'] },
    { es: 'anticipacion', en: ['proleptic', 'futuristic'] },
    { es: 'gnomic', en: ['gnomic'] },
    { es: 'ingresiv', en: ['ingressive'] },
    { es: 'constativ', en: ['constative'] },
    { es: 'culminativ', en: ['consummative'] },
    { es: 'progresiv', en: ['progressive'] },
    { es: 'iterativ', en: ['iterative'] },
    { es: 'prohibicion', en: ['prohibition'] },
    { es: 'deliberativ', en: ['deliberative'] },
    { es: 'hortativ', en: ['hortatory'] },
    { es: 'discurso indirecto', en: ['indirect discourse'] },
    { es: 'pregunta indirecta', en: ['indirect question'] },
    { es: 'interrogacion indirecta', en: ['indirect question'] },
    { es: 'voz media', en: ['middle'] },
];

export interface CategoryLabelMatch {
    label: string;
    node: SectionNode;
    /** Términos del glosario que el título de la subsección nombra. */
    terms: string[];
}

const contiene = (texto: string, termino: string, palabraEntera = false) => {
    let at = texto.indexOf(termino);
    while (at !== -1) {
        const empieza = at === 0 || !/\p{L}/u.test(texto[at - 1]!);
        const termina = !palabraEntera || !/\p{L}/u.test(texto[at + termino.length] ?? '');
        if (empieza && termina) return true;
        at = texto.indexOf(termino, at + 1);
    }
    return false;
};

/** Qué términos del glosario nombra una etiqueta del análisis, ya en inglés. */
export function glossaryTermsIn(label: string): { specific: string[]; general: string[] } {
    const t = foldKey(label);
    const specific = new Set<string>(); const general = new Set<string>();
    for (const g of CATEGORY_GLOSSARY) {
        if (!contiene(t, g.es, g.wholeWord)) continue;
        for (const en of g.en) (g.general ? general : specific).add(en);
    }
    return { specific: [...specific], general: [...general] };
}

/**
 * Las subsecciones de la gramática que tratan cada etiqueta.
 *
 * Una subsección se elige si su TÍTULO nombra un término específico de la
 * etiqueta («Means», «Attendant Circumstance»): las categorías generales
 * («particip», «genitive») solo desempatan, mirando la ruta entera, entre
 * subsecciones con el mismo título en capítulos distintos («Means» del
 * participio y «Means» del dativo). Si nada específico coincide, la etiqueta no
 * propone nada: la región ya la cubre `grammarCategoryRegions`.
 */
export function grammarSheetsForCategoryLabels(
    entries: ReadonlyArray<OutlineEntry>,
    labels: ReadonlyArray<string>,
): CategoryLabelMatch[] {
    const nodos = sectionNodesFromOutline(entries);
    const plegados = nodos.map(n => ({ n, titulo: foldKey(n.title), ruta: foldKey(n.path.join(' › ')) }));
    const out: CategoryLabelMatch[] = [];
    for (const label of labels) {
        const { specific, general } = glossaryTermsIn(label);
        let mejores: Array<{ n: SectionNode; terms: string[]; puntaje: number }> = [];
        for (const { n, titulo, ruta } of plegados) {
            const terms = specific.filter(s => contiene(titulo, s));
            if (terms.length === 0) continue;
            const puntaje = terms.length * 10 + general.filter(g => contiene(ruta, g)).length;
            if (mejores.length === 0 || puntaje > mejores[0]!.puntaje) mejores = [{ n, terms, puntaje }];
            else if (puntaje === mejores[0]!.puntaje) mejores.push({ n, terms, puntaje });
        }
        for (const m of mejores) out.push({ label, node: m.n, terms: m.terms });
    }
    return out;
}
