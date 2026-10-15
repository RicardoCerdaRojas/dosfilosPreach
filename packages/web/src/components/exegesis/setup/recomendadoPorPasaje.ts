import { commentaryBookCoverage, isCommentaryType, type BibleBookId, type LibraryResource, type RankedResource, type SourceType } from '@dosfilos/domain';
import { tipoDelRecurso } from './faltaParaLaRubrica';

/** Con menos fragmentos que esto, sólo una obra de consulta se recomienda por el pasaje. */
export const MIN_FRAGMENTOS_RECOMENDADO = 3;

/**
 * Si un libro va en «Recomendado para este pasaje».
 *
 * TP #7 (#6): con uno o dos fragmentos «relevantes» salían comentarios de
 * OTRO libro bíblico (Kistemaker, *1 y 2 Pedro y Judas*; *The Message of 2
 * Peter & Jude*) y un libro de consejería (Tripp). Fuera:
 *   - un comentario que, según la biblioteca, comenta otros libros;
 *   - con menos de tres fragmentos, lo que no es obra de consulta (léxico,
 *     gramática, aparato, texto base) ni un comentario de ESTE libro.
 * No se esconden: pasan al resto de la lista.
 */
export function recomendablePorPasaje(resource: LibraryResource, rank: RankedResource, bookId: BibleBookId): boolean {
    const tipo = tipoDelRecurso(resource);
    if (isCommentaryType(tipo)) {
        const cobertura = commentaryBookCoverage(resource, bookId);
        if (cobertura === 'other-books') return false;
        // Un comentario que la biblioteca dice que comenta ESTE libro va
        // siempre, aunque el índice le haya hallado un solo fragmento.
        if (cobertura === 'covers' && (resource.coversBibleBooks ?? []).includes(bookId)) return true;
    }
    if (rank.matchedChunkCount >= MIN_FRAGMENTOS_RECOMENDADO) return true;
    return OBRAS_DE_CONSULTA.has(tipo);
}

/**
 * Las que tocan un versículo en una línea y ahí una línea vale. Lista
 * explícita y no «peso técnico»: ése incluye comentarios críticos, artículos y
 * fuentes antiguas, que con un fragmento no se recomiendan (revisión
 * adversarial).
 */
const OBRAS_DE_CONSULTA: ReadonlySet<SourceType> = new Set<SourceType>([
    'lexicon-technical', 'theological-dictionary', 'grammar-syntax',
    'critical-apparatus', 'textual-commentary', 'biblical-text-edition',
]);
