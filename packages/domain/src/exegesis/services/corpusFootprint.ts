import type { ProjectSource } from '../entities/ProjectSource';
import type { StepSourcePlan } from '../entities/StepSourcePlan';
import { countChars, type PageIndexEntry } from '../outline/documentPageIndex';
import { retrievalScopeOf, stepPinnedSheets, wholeDocumentTravelsEntire } from './curatedScope';

/**
 * Cuánto corpus llega al prompt de UN paso (un versículo).
 *
 * Lo que viaja lo decide `retrievalScopeOf`, la misma función que usa el
 * analizador: las páginas elegidas, las hojas de los fragmentos y el documento
 * completo se CONSULTAN por versículo (`retrieveCurated` → `selectForPrompt`),
 * y entre todas aportan como mucho `CURATED_CORPUS_BUDGET_CHARS`; lo fijado,
 * los fragmentos editados y los que no dicen de qué hoja son viajan completos.
 *
 * El medidor de #730 sumaba todas las hojas admitidas como si viajaran
 * enteras. En Jonás 4:5-11 (2026-10-02) marcaba 129% cuando lo que llega a cada
 * versículo es ~130.000 caracteres: pasar dos comentarios de fragmentos a
 * páginas lo hizo SUBIR, siendo que el envío real no cambiaba.
 */

/**
 * Tope de lo que el corpus consultado (páginas elegidas, hojas de fragmentos,
 * documentos completos) aporta a un paso, sumando todas sus fuentes. Lo usan el análisis por versículo y la composición del paso; el
 * medidor lo lee de aquí para no inventarse otro número.
 *
 * La mitad del tope del prompt: el resto es para las instrucciones, la guía de
 * estilo, el texto base y los análisis previos, y `fitPromptToCap` recorta
 * después si algo se desmadra.
 */
export const CURATED_CORPUS_BUDGET_CHARS = 100_000;

/**
 * Lo que aporta a un paso el grupo de fuentes con páginas elegidas: lo fijado
 * entra entero; lo demás, hasta llenar el tope (ver `selectForPrompt`).
 */
export function curatedCharsPerStep(admittedChars: number, pinnedChars: number): number {
    return Math.max(pinnedChars, Math.min(admittedChars, CURATED_CORPUS_BUDGET_CHARS));
}

export interface CorpusFootprint {
    /** Lo que viaja completo: fragmentos sin hoja y fragmentos editados. */
    excerptChars: number;
    /**
     * Lo que se CONSULTA por versículo: las hojas elegidas y las hojas de los
     * fragmentos. Un documento completo suma el libro entero, que no se
     * conoce sin su índice: ver `wholeDocuments`.
     */
    admittedChars: number;
    /** Hojas fijadas («siempre incluir»): viajan completas. */
    pinnedChars: number;
    /**
     * Lo fijado solo para un paso, en el paso que más trae (`pinnedSheets`).
     * Cuenta el máximo y no la suma: cada paso paga solo lo suyo.
     */
    stepPinnedChars?: number;
    /** Fuentes sin páginas ni fragmentos: se consulta el libro entero. */
    wholeDocuments: number;
    /** Lo que llega, como mucho, al prompt de un versículo. */
    perStepChars: number;
    /** Alguna fuente con páginas todavía no tiene su índice: los totales son un mínimo. */
    pending: boolean;
}

/**
 * El corpus entero, separado en lo que viaja completo y lo que se consulta.
 *
 * Cada fuente cuenta según `retrievalScopeOf`, la misma pregunta que se hace
 * el analizador para decidir qué buscar:
 *
 *   - Páginas elegidas: sus hojas, del índice del documento. Sin índice
 *     todavía, `pending` —decir cero es el error que #730 corrigió—.
 *   - Fragmentos con hoja: se consultan TODAS las hojas de donde salieron
 *     (el recuperador no distingue los fragmentos guardados de sus vecinos de
 *     hoja), así que con índice se cuentan las hojas; sin índice, el texto de
 *     los fragmentos, como mínimo. Los editados o sin hoja viajan completos.
 *   - Documento completo: chico, viaja entero (`wholeDocumentTravelsEntire`,
 *     lo mismo que decide el recuperador); un libro pasa siempre el tope del
 *     grupo, así que alcanza con contarlo.
 *   - Sin nada que consultar: sus fragmentos viajan completos.
 */
export function corpusFootprint(
    sources: ReadonlyArray<Pick<ProjectSource, 'id' | 'sourceType' | 'mode' | 'excerpts' | 'excerptRecipe'>>,
    indexBySource: ReadonlyMap<string, ReadonlyArray<PageIndexEntry> | null>,
    /** El plan por paso, para lo fijado solo en un paso. Sin él, como antes. */
    plan?: Pick<StepSourcePlan, 'perStep'> | null,
): CorpusFootprint {
    const stepPinnedChars = maxStepPinnedChars(sources, indexBySource, plan);
    let excerptChars = 0;
    let admittedChars = 0;
    let pinnedChars = 0;
    let wholeDocuments = 0;
    let pending = false;
    const chars = (xs: ReadonlyArray<{ text: string }>) => xs.reduce((n, e) => n + e.text.length, 0);
    for (const s of sources) {
        const scope = retrievalScopeOf(s);
        if (!scope) {
            excerptChars += chars(s.excerpts);
            continue;
        }
        const index = indexBySource.get(s.id) ?? null;
        if (scope.kind === 'whole-document') {
            if (index && wholeDocumentTravelsEntire(index)) {
                pinnedChars += index.reduce((n, p) => n + p.charCount, 0);
            } else {
                wholeDocuments++;
            }
            continue;
        }
        if (scope.kind === 'excerpt-sheets') {
            excerptChars += chars(scope.alwaysExcerpts);
            if (index) {
                admittedChars += countChars(index, scope.sheetRanges);
            } else {
                admittedChars += chars(s.excerpts) - chars(scope.alwaysExcerpts);
                pending = true;
            }
            continue;
        }
        if (!index) {
            pending = true;
            continue;
        }
        admittedChars += countChars(index, scope.sheetRanges);
        pinnedChars += countChars(index, scope.pinnedRanges);
    }
    return finish({ excerptChars, admittedChars, pinnedChars, wholeDocuments, pending, ...(stepPinnedChars > 0 ? { stepPinnedChars } : {}) });
}

/** Lo fijado solo para un paso que no está ya fijado en la receta, en el paso que más trae. */
function maxStepPinnedChars(
    sources: ReadonlyArray<Pick<ProjectSource, 'id' | 'sourceType' | 'mode' | 'excerpts' | 'excerptRecipe'>>,
    indexBySource: ReadonlyMap<string, ReadonlyArray<PageIndexEntry> | null>,
    plan: Pick<StepSourcePlan, 'perStep'> | null | undefined,
): number {
    let max = 0;
    for (const entry of Object.values(plan?.perStep ?? {})) {
        let paso = 0;
        for (const s of sources) {
            const index = indexBySource.get(s.id);
            const delPaso = stepPinnedSheets(entry, s.id);
            if (!index || delPaso.length === 0) continue;
            // Un documento chico ya viaja entero y está contado: no se cuenta dos veces.
            if (retrievalScopeOf(s)?.kind === 'whole-document' && wholeDocumentTravelsEntire(index)) continue;
            const global = s.excerptRecipe?.pinnedRanges ?? [];
            const enGlobal = (sheet: number) => global.some(r => sheet >= r.start && sheet <= r.end);
            paso += countChars(index.filter(p => !enGlobal(p.sheet)), delPaso);
        }
        max = Math.max(max, paso);
    }
    return max;
}

function finish(f: Omit<CorpusFootprint, 'perStepChars'>): CorpusFootprint {
    // Con un documento completo en el grupo, lo consultado llena el tope.
    const consultado = f.wholeDocuments > 0 ? Math.max(f.admittedChars, CURATED_CORPUS_BUDGET_CHARS) : f.admittedChars;
    return { ...f, perStepChars: f.excerptChars + curatedCharsPerStep(consultado, f.pinnedChars + (f.stepPinnedChars ?? 0)) };
}

/**
 * El corpus de las OTRAS fuentes más la selección que se está editando en el
 * selector de páginas, que todavía no está guardada.
 */
export function withPageSelection(
    others: CorpusFootprint,
    selectedChars: number,
    pinnedChars: number,
): CorpusFootprint {
    return finish({
        ...others,
        admittedChars: others.admittedChars + selectedChars,
        pinnedChars: others.pinnedChars + pinnedChars,
    });
}
