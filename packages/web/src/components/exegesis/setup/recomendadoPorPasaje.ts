import { commentaryBookCoverage, isCommentaryType, type BibleBookId, type LibraryResource, type RankedResource } from '@dosfilos/domain';
import { pesoDeRecurso } from './pesoAcademico';
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
 *     gramática, aparato, texto base): ésas tocan un versículo en una línea y
 *     ahí una línea vale.
 * No se esconden: pasan al resto de la lista.
 */
export function recomendablePorPasaje(resource: LibraryResource, rank: RankedResource, bookId: BibleBookId): boolean {
    const tipo = tipoDelRecurso(resource);
    if (isCommentaryType(tipo) && commentaryBookCoverage(resource, bookId) === 'other-books') return false;
    if (rank.matchedChunkCount >= MIN_FRAGMENTOS_RECOMENDADO) return true;
    const peso = pesoDeRecurso(resource);
    return peso === 'tecnica' || peso === 'textoBase';
}
