import type { ProjectSource } from '../entities/ProjectSource';
import { countChars, type PageIndexEntry } from '../outline/documentPageIndex';
import { hasCuratedScope } from './curatedScope';

/**
 * Cuánto corpus llega al prompt de UN paso (un versículo).
 *
 * Hay dos clases de fuente y viajan distinto:
 *
 *   - Con FRAGMENTOS guardados (sin páginas elegidas): van completas a cada
 *     paso (`AnalyzeVerseCanonicallyUseCase`, rama `usesExtractedExcerpts`).
 *   - Con PÁGINAS ELEGIDAS (receta): sus hojas NO se mandan enteras. El paso le
 *     pregunta al corpus qué de esas hojas habla de su versículo
 *     (`retrieveCurated` → `selectForPrompt`): lo fijado entra completo y el
 *     resto compite por lo que sobre de `CURATED_CORPUS_BUDGET_CHARS`, para
 *     todas esas fuentes juntas.
 *
 * El medidor de #730 sumaba todas las hojas admitidas como si viajaran
 * enteras. En Jonás 4:5-11 (2026-10-02) marcaba 129% cuando lo que llega a cada
 * versículo es ~130.000 caracteres: pasar dos comentarios de fragmentos a
 * páginas lo hizo SUBIR, siendo que el envío real no cambiaba.
 */

/**
 * Tope de lo que el corpus de páginas elegidas aporta a un paso, sumando todas
 * sus fuentes. Lo usan el análisis por versículo y la composición del paso; el
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
    /** Fragmentos de las fuentes sin páginas elegidas: viajan completos. */
    excerptChars: number;
    /** Todas las hojas elegidas. Se CONSULTAN por versículo; no viajan enteras. */
    admittedChars: number;
    /** Hojas fijadas («siempre incluir»): viajan completas. */
    pinnedChars: number;
    /** Lo que llega, como mucho, al prompt de un versículo. */
    perStepChars: number;
    /** Alguna fuente con páginas todavía no tiene su índice: los totales son un mínimo. */
    pending: boolean;
}

/**
 * El corpus entero, separado en lo que viaja completo y lo que se consulta.
 *
 * Una fuente con páginas cuyo índice todavía no llegó deja `pending`: decir
 * cero es el error que #730 corrigió. Las fuentes sin páginas ni fragmentos no
 * suman: no tienen nada que medir, y su problema —leer el comienzo del libro—
 * lo avisa `SourceSinPaginas`.
 */
export function corpusFootprint(
    sources: ReadonlyArray<Pick<ProjectSource, 'id' | 'excerpts' | 'excerptRecipe'>>,
    indexBySource: ReadonlyMap<string, ReadonlyArray<PageIndexEntry> | null>,
): CorpusFootprint {
    let excerptChars = 0;
    let admittedChars = 0;
    let pinnedChars = 0;
    let pending = false;
    for (const s of sources) {
        if (!hasCuratedScope(s)) {
            excerptChars += s.excerpts.reduce((n, e) => n + e.text.length, 0);
            continue;
        }
        const index = indexBySource.get(s.id) ?? null;
        if (!index) {
            pending = true;
            continue;
        }
        admittedChars += countChars(index, s.excerptRecipe!.sheetRanges);
        pinnedChars += countChars(index, s.excerptRecipe!.pinnedRanges ?? []);
    }
    return {
        excerptChars,
        admittedChars,
        pinnedChars,
        perStepChars: excerptChars + curatedCharsPerStep(admittedChars, pinnedChars),
        pending,
    };
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
    const admittedChars = others.admittedChars + selectedChars;
    const pinned = others.pinnedChars + pinnedChars;
    return {
        ...others,
        admittedChars,
        pinnedChars: pinned,
        perStepChars: others.excerptChars + curatedCharsPerStep(admittedChars, pinned),
    };
}
