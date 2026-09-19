import type { LibraryResourceLike } from '../recommendations/libraryMatch';
import { matchRecommendationToResource } from '../recommendations/libraryMatch';
import type { SourceRecommendation } from '../recommendations/types';

/**
 * Las obras que el curso manda leer, y cuáles de ellas hay en la
 * biblioteca.
 *
 * Es el primero de los tres huecos que el fundador nombró al terminar su
 * trabajo de seminario: «no saber qué fuentes usar». El sílabo lista las
 * obras por nombre —«Waltke–O'Connor, IBHS»; «Ross, Commentary on the
 * Psalms»— y hasta ahora ese listado moría en el PDF del curso: la rúbrica
 * extraía CUÁNTAS fuentes de cada tipo hacían falta, nunca CUÁLES.
 *
 * La diferencia importa. «Tres comentarios críticos» se cumple con
 * cualquier tres; «Ross, Craigie y Waltke–O'Connor» es lo que el profesor
 * va a buscar en las notas al pie.
 */

export interface CourseBibliographyEntry {
    /** Cómo la nombra el sílabo. Es lo único obligatorio. */
    title: string;
    author?: string;
    /** Colección o sigla, cuando el sílabo la da: «IBHS», «WBC 19». */
    series?: string;
    /** Si el curso la exige o sólo la sugiere. */
    requirement: 'required' | 'recommended';
    /** Lo que el sílabo dice de ella, cuando dice algo. */
    note?: string;
    /**
     * Recurso de la biblioteca que el usuario enlazó A MANO.
     *
     * Manda sobre el emparejador automático, y existe porque éste falla
     * por diseño: es conservador, y un sílabo que dice «Craigie, Psalms
     * 1–50 (WBC 19)» contra un archivo titulado «Word Biblical Commentary
     * Vol_ 19, Psalms 1-50» no supera su umbral —«Psalms» es la única
     * palabra larga del título del sílabo—. Aflojarlo haría que el sistema
     * afirme tener libros que no tiene, que es peor.
     */
    resourceId?: string;
}

export interface CourseBibliographyMatch<R extends LibraryResourceLike> {
    entry: CourseBibliographyEntry;
    /** El recurso de la biblioteca que la cubre, o `null` si falta. */
    resource: R | null;
    /** Si ya está en el corpus de ESTE trabajo. */
    inCorpus: boolean;
}

/**
 * Cruza el listado del curso con la biblioteca y con el corpus del trabajo.
 *
 * Reusa el emparejador de recomendaciones, que es deliberadamente
 * conservador: prefiere no encontrar a inventar que el usuario ya tiene un
 * libro. Un falso negativo deja visible la opción de subirlo; un falso
 * positivo le hace creer que cumplió con una obra que no tiene.
 */
export function matchCourseBibliography<R extends LibraryResourceLike>(
    entries: ReadonlyArray<CourseBibliographyEntry>,
    resources: ReadonlyArray<R>,
    corpusResourceIds: ReadonlySet<string>,
): Array<CourseBibliographyMatch<R>> {
    return entries.map(entry => {
        // Lo que el usuario enlazó manda; el emparejador sólo propone.
        const enlazado = entry.resourceId
            ? resources.find(r => r.id === entry.resourceId) ?? null
            : null;
        const resource = enlazado
            ?? (entry.resourceId ? null : resources.find(r => matchRecommendationToResource(asRecommendation(entry), r)) ?? null);
        return {
            entry,
            resource,
            inCorpus: resource !== null && corpusResourceIds.has(resource.id),
        };
    });
}

/** Cuánto del listado del curso está cubierto, para decirlo en una línea. */
export function courseBibliographyCoverage<R extends LibraryResourceLike>(
    matches: ReadonlyArray<CourseBibliographyMatch<R>>,
): { required: number; requiredInCorpus: number; missing: number } {
    const requeridas = matches.filter(m => m.entry.requirement === 'required');
    return {
        required: requeridas.length,
        requiredInCorpus: requeridas.filter(m => m.inCorpus).length,
        // Lo que falta es lo que ni siquiera está en la biblioteca: sin el
        // libro no hay nada que agregar al corpus, y ése es el aviso que
        // llega a tiempo —antes de escribir, no al citar—.
        missing: requeridas.filter(m => m.resource === null).length,
    };
}

/**
 * El listado del curso en la forma que entiende el emparejador.
 *
 * Los campos que el sílabo no da van vacíos a propósito: el emparejador
 * los trata como «sin señal» y cae al cotejo por autor y título, que es
 * todo lo que un sílabo suele dar.
 */
function asRecommendation(entry: CourseBibliographyEntry): SourceRecommendation {
    return {
        author: entry.author ?? '',
        title: entry.title,
        series: entry.series ?? null,
        publisher: '',
        year: 0,
        isbn: null,
    } as SourceRecommendation;
}
