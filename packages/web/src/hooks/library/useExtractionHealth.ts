import {
    assessExtraction,
    getBookById,
    requiredScriptsFor,
    type ExtractionHealth,
    type LibraryResourceEntity,
} from '@dosfilos/domain';

/**
 * Si la extracción de un recurso sirve para citarlo.
 *
 * Resuelve el testamento a partir de los libros que el recurso declara cubrir
 * —dato, no inferencia— y deja que el dominio juzgue. El título sólo entra en
 * juego cuando no hay libros, y sólo si nombra su idioma sin ambigüedad.
 */
export function extractionHealthOf(resource: LibraryResourceEntity): ExtractionHealth {
    const libros = (resource as { coversBibleBooks?: ReadonlyArray<string> }).coversBibleBooks ?? [];
    const testamentos = new Set(
        libros.map(id => getBookById(id as never)?.testament).filter(Boolean),
    );
    const coversTestament = testamentos.size === 0
        ? null
        : testamentos.size > 1
            ? 'both' as const
            : ([...testamentos][0] as 'OT' | 'NT');

    return assessExtraction(
        (resource as { scriptCensus?: Parameters<typeof assessExtraction>[0] }).scriptCensus,
        requiredScriptsFor({ type: resource.type, title: resource.title, coversTestament }),
    );
}
