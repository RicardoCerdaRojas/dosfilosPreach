/**
 * Las regiones de una gramática que tratan una categoría, leídas de la RUTA de
 * secciones y no del último título.
 *
 * `sectionsForKeys` compara el título de la sección que abre cada fragmento, y
 * en una gramática profunda ese título es genérico: Wallace guarda
 * «II. Specific Uses › C. Verbal Genitive › 1. Subjective Genitive ›
 * a. Definition», y el fragmento solo dice «a. Definition». La categoría está
 * en un ancestro. Medido en el banco del corpus (2026-11-21): las pérdidas de
 * Wallace en TP #11 y TP #12 caen en «Genitive of Production», «Subjective
 * Genitive», «Means» y «Manner», ninguna nombrada en el último título.
 *
 * Esto es el PRIMER paso de la meta de gramáticas en dos pasos (decisión del
 * fundador, 2026-11-21): antes del análisis, la pregunta lleva a la región; la
 * hoja exacta la da después la opción de la decisión (`grammarSheetsForOptions`).
 * Una región es para navegar, no una propuesta de hojas.
 */
import {
    titleNamesCategory, titleNamesCategoryOnlyAfterPreposition, titleNamesOriginalForm, type GrammarSearchKeys,
} from './grammarSearchKeys';

/** Un fragmento del libro con su ruta de secciones, en el orden del libro. */
export interface OutlineEntry {
    sheet: number;
    /** Ruta completa de títulos, del más general al más específico. */
    sectionPath: ReadonlyArray<string>;
}

/** Una sección del libro: un tramo continuo con la misma ruta hasta su nivel. */
export interface SectionNode {
    title: string;
    path: string[];
    depth: number;
    startSheet: number;
    endSheet: number;
}

export interface CategoryRegion {
    startSheet: number;
    endSheet: number;
    /** Las secciones que nombran la categoría y forman la región. */
    sections: SectionNode[];
    /** Qué clave del encuadre la trajo. */
    matched: string[];
    /**
     * Las subcategorías de la región (el nivel de abajo de cada sección), con su
     * tramo: lo que el estudiante recorre para elegir.
     */
    subcategories: SectionNode[];
}

/** Hojas de separación que todavía unen dos secciones de distinto padre en una sola región. */
const HUECO_MAXIMO = 1;

/**
 * Las secciones del libro como tramos continuos. Una misma ruta que reaparece
 * más adelante («Specific Uses» en cada capítulo de los casos) es otra sección.
 */
export function sectionNodesFromOutline(entries: ReadonlyArray<OutlineEntry>): SectionNode[] {
    const nodos: SectionNode[] = [];
    let abiertos: SectionNode[] = [];
    for (const e of entries) {
        const ruta = e.sectionPath.map(t => t.trim()).filter(Boolean);
        let comun = 0;
        while (comun < abiertos.length && comun < ruta.length && abiertos[comun]!.title === ruta[comun]) comun++;
        abiertos = abiertos.slice(0, comun);
        for (const n of abiertos) n.endSheet = Math.max(n.endSheet, e.sheet);
        for (let d = comun; d < ruta.length; d++) {
            const nodo: SectionNode = { title: ruta[d]!, path: ruta.slice(0, d + 1), depth: d, startSheet: e.sheet, endSheet: e.sheet };
            nodos.push(nodo);
            abiertos.push(nodo);
        }
    }
    return nodos;
}

function clavesQueNombra(title: string, keys: GrammarSearchKeys): string[] {
    const griegas = keys.originalForms.filter(g => titleNamesOriginalForm(title, g));
    const categorias = keys.categories.filter(c => titleNamesCategory(title, c) && !titleNamesCategoryOnlyAfterPreposition(title, c));
    return [...griegas, ...categorias];
}

const dentroDe = (hijo: SectionNode, padre: SectionNode) =>
    hijo.depth > padre.depth && hijo.startSheet >= padre.startSheet && hijo.endSheet <= padre.endSheet
    && padre.path.every((t, i) => hijo.path[i] === t);

/**
 * Las regiones que tratan lo que el encuadre pregunta. Se queda con las
 * secciones más generales que nombran la categoría (una subsección de una
 * sección ya elegida no agrega nada) y une las que quedan pegadas.
 */
export function grammarCategoryRegions(
    entries: ReadonlyArray<OutlineEntry>,
    keys: GrammarSearchKeys,
): CategoryRegion[] {
    if (keys.originalForms.length === 0 && keys.categories.length === 0) return [];
    const nodos = sectionNodesFromOutline(entries);
    const elegidas = nodos
        .map(n => ({ n, matched: clavesQueNombra(n.title, keys) }))
        .filter(x => x.matched.length > 0);
    const maximas = elegidas.filter(x => !elegidas.some(o => o !== x && dentroDe(x.n, o.n)));
    maximas.sort((a, b) => a.n.startSheet - b.n.startSheet || a.n.depth - b.n.depth);

    const padreDe = (n: SectionNode) => nodos.find(p => p.depth === n.depth - 1 && dentroDe(n, p));
    const regiones: CategoryRegion[] = [];
    let padreUltima: SectionNode | undefined;
    for (const { n, matched } of maximas) {
        const hijos = nodos.filter(h => h.depth === n.depth + 1 && dentroDe(h, n));
        const padre = padreDe(n);
        const ult = regiones[regiones.length - 1];
        // Hermanas que nombran la categoría bajo el mismo padre son una región
        // aunque haya otra hermana en medio (A. Adjectival y C. Verbal Genitive).
        const hermanas = !!padre && padre === padreUltima;
        padreUltima = padre;
        if (ult && (hermanas || n.startSheet <= ult.endSheet + HUECO_MAXIMO + 1)) {
            ult.endSheet = Math.max(ult.endSheet, n.endSheet);
            ult.sections.push(n);
            ult.matched = [...new Set([...ult.matched, ...matched])];
            ult.subcategories.push(...hijos);
        } else {
            regiones.push({ startSheet: n.startSheet, endSheet: n.endSheet, sections: [n], matched, subcategories: hijos });
        }
    }
    return regiones;
}
