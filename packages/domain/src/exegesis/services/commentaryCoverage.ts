import type { BibleBookId } from '../../bible/canon/BibleCanon';
import type { LibraryResource } from '../../entities/LibraryResource';
import type { ProjectSource } from '../entities/ProjectSource';
import type { SourceType } from '../entities/SourceType';

/**
 * Si un comentario comenta el libro del pasaje.
 *
 * La rúbrica cuenta por TIPO: «Comentario expositivo · 1/1». En el TP #6
 * (Santiago 3) ese requisito lo cumplía Subukjian, *Volvamos a la
 * predicación bíblica* —homilética—, porque la biblioteca lo tenía como
 * comentario. Un comentario que no comenta Santiago no cumple el requisito
 * de comentario de un trabajo sobre Santiago.
 *
 *   - `covers`: lo comenta, comenta la Biblia entera o un testamento sin
 *     detallar libros, o no hay ficha de biblioteca de dónde saberlo (un
 *     archivo subido directo).
 *   - `other-books`: la biblioteca dice qué libros comenta y éste no está.
 *   - `no-book`: la biblioteca no dice qué libro comenta. SIGUE contando,
 *     con aviso: un archivo subido desde el corpus queda en la biblioteca
 *     así, sin libros, y es justamente el comentario que el estudiante
 *     trajo. Sin un dato que distinga ese caso del libro mal clasificado,
 *     dejar de contarlo castigaría al que sí está bien.
 */
export type CommentaryBookCoverage = 'covers' | 'other-books' | 'no-book';

const COMENTARIOS: ReadonlySet<SourceType> = new Set<SourceType>(['commentary-expository', 'commentary-critical']);

export function isCommentaryType(type: SourceType): boolean {
    return COMENTARIOS.has(type);
}

export function commentaryBookCoverage(
    resource: Pick<LibraryResource, 'coversBibleBooks' | 'scope'> | null | undefined,
    bookId: BibleBookId,
): CommentaryBookCoverage {
    if (!resource) return 'covers';
    const libros = resource.coversBibleBooks ?? [];
    if (libros.includes(bookId)) return 'covers';
    if (libros.length > 0) return 'other-books';
    if (resource.scope === 'whole-bible' || resource.scope === 'whole-testament') return 'covers';
    return 'no-book';
}

/**
 * Los tipos con que la rúbrica cuenta el corpus: un comentario que comenta
 * OTROS libros no suma al requisito de comentario.
 */
export function sourceTypesForRubric(
    sources: ReadonlyArray<Pick<ProjectSource, 'sourceType' | 'sourceLibraryResourceId' | 'corpusId'>>,
    resourceOf: (id: string) => Pick<LibraryResource, 'coversBibleBooks' | 'scope'> | null | undefined,
    bookId: BibleBookId,
): SourceType[] {
    return sources
        .filter(s => !isCommentaryType(s.sourceType)
            || commentaryBookCoverage(
                (s.sourceLibraryResourceId ? resourceOf(s.sourceLibraryResourceId) : null) ?? resourceOf(s.corpusId),
                bookId,
            ) !== 'other-books')
        .map(s => s.sourceType);
}
