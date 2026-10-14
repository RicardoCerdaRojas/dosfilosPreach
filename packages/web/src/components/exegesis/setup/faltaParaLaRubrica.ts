import {
    computeRubricCompliance,
    isPickedByPages,
    sourceTypesForRubric,
    type ExegeticalPaper,
    type LibraryResource,
    type SourceType,
} from '@dosfilos/domain';
import { resourceIdsOf } from './extractionDefaults';
import { defaultSourceTypeFor } from './tipoAcademico';

/** Un requisito de la rúbrica sin cubrir y los libros de la biblioteca que lo cubrirían. */
export interface FaltaParaLaRubrica {
    sourceType: SourceType;
    /** Cuántas fuentes de este tipo faltan. */
    missing: number;
    /** Gramática, léxico: no se hallan buscando el pasaje; se eligen sus páginas. */
    porPaginas: boolean;
    resources: LibraryResource[];
}

/** El tipo con que la fila del diálogo arranca un libro (`initialSelectionFor`). */
export function tipoDelRecurso(resource: LibraryResource): SourceType {
    return resource.exegeticalType ?? defaultSourceTypeFor(resource);
}

/**
 * Qué libros de la biblioteca cubren un requisito de la rúbrica que el corpus
 * todavía no cumple.
 *
 * «Recomendado para este pasaje» ordena por fragmentos que hablan del pasaje,
 * y una gramática toca un versículo en una línea. En el TP #7 (Santiago
 * 3:13-18) Robertson, la única gramática permitida, no salió recomendado y el
 * fundador lo encontró buscando «robert», con la rúbrica pidiendo
 * «Gramática ≥1». Esto recomienda por TIPO.
 *
 * Fuera: los libros que ya están en el corpus, los excluidos del trabajo y los
 * que ya recomienda el pasaje (`yaRecomendados`), para no listarlos dos veces.
 */
export function faltaParaLaRubrica({
    paper,
    resources,
    candidatos,
    yaRecomendados,
    esExcluido,
}: {
    paper: Pick<ExegeticalPaper, 'rubric' | 'sources' | 'passage'>;
    /** Toda la biblioteca: de aquí se sabe qué libros comenta cada fuente. */
    resources: ReadonlyArray<LibraryResource>;
    /** Los libros que hoy muestra el diálogo (búsqueda y filtro aplicados). */
    candidatos: ReadonlyArray<LibraryResource>;
    yaRecomendados: ReadonlySet<string>;
    esExcluido: (resource: LibraryResource) => boolean;
}): FaltaParaLaRubrica[] {
    if (!paper.rubric) return [];
    const tipos = sourceTypesForRubric(paper.sources, id => resources.find(r => r.id === id), paper.passage.bookId);
    const faltan = computeRubricCompliance(tipos, paper.rubric).requirements
        .filter(r => r.required > 0 && !r.satisfied);
    if (faltan.length === 0) return [];
    // Un libro ya en el corpus que no cuenta (vacío, de otro libro) se arregla
    // en su tarjeta, no agregándolo otra vez.
    const enElCorpus = resourceIdsOf(paper.sources, () => true);
    return faltan
        .map(req => ({
            sourceType: req.sourceType,
            missing: req.missing,
            porPaginas: isPickedByPages({ sourceType: req.sourceType }),
            resources: candidatos.filter(r =>
                tipoDelRecurso(r) === req.sourceType
                && !enElCorpus.has(r.id)
                && !yaRecomendados.has(r.id)
                && !esExcluido(r)),
        }))
        .filter(f => f.resources.length > 0);
}
