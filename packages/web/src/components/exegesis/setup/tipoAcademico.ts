/**
 * De cómo la biblioteca clasifica un libro, a qué tipo académico proponer.
 *
 * Vive aparte del diálogo porque es DATO, no interfaz: un mapa entre dos
 * taxonomías. Dentro del componente no se podía probar sin levantar Firebase,
 * y una regla que no se puede probar es la que se desactualiza.
 */
import type { LibraryResource, ResourceType } from '@dosfilos/domain';
import type { SourceType } from '@dosfilos/domain';

/**
 * Qué tipo académico proponer para un recurso, según cómo está clasificado en
 * la biblioteca.
 *
 * EL DEFECTO QUE CORRIGE. Esto era un `switch` con cuatro casos y un `default:
 * 'other'`, sobre una biblioteca que tiene ONCE tipos. Los seis más precisos
 * —justamente los que alguien clasificó con cuidado— caían todos en «Otro»:
 * el comentario de Sasson sobre Jonás, que es de la Anchor Bible, se proponía
 * como «Otro» mientras la taxonomía académica de este mismo producto pone
 * «Anchor» entre los ejemplos de comentario crítico-técnico.
 *
 * El resultado era pedirle al pastor que clasificara a mano lo que el sistema
 * ya sabía, en una taxonomía académica que no tiene por qué dominar.
 *
 * POR QUÉ UN REGISTRO Y NO UN `switch`. `Record<ResourceType, SourceType>`
 * obliga al compilador a exigir una decisión por cada tipo de biblioteca. Con
 * un `default` catch-all, agregar un tipo nuevo lo manda en silencio a «Otro»
 * y nadie se entera — que es exactamente cómo llegamos acá.
 */
export const TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA: Record<ResourceType, SourceType> = {
    // El aparato y las ediciones del texto: BHS, BHQ, NA28.
    'critical-text': 'biblical-text-edition',

    // La biblioteca distingue el comentario técnico del corriente, y la
    // taxonomía académica también. Antes los dos iban a `commentary-critical`,
    // que sobrevalúa a un comentario expositivo y le pide un rigor que no
    // ofrece.
    'exegetical-commentary': 'commentary-critical',
    'commentary': 'commentary-expository',

    'grammar': 'grammar-syntax',
    'theological-dictionary': 'theological-dictionary',

    // Un diccionario bíblico y una introducción responden la misma pregunta
    // que el trasfondo: quién, cuándo, en qué mundo. El ABD figura entre los
    // ejemplos de `historical-background`.
    'bible-dictionary': 'historical-background',
    'biblical-survey': 'historical-background',
    'historical-context': 'historical-background',

    'theology': 'theological-monograph',
    'article': 'journal-article',
    'other': 'other',
};

export function defaultSourceTypeFor(resource: LibraryResource): SourceType {
    return TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA[resource.type] ?? 'other';
}

/**
 * Qué filtro de biblioteca corresponde a un tipo académico.
 *
 * Es el camino inverso del mapa de arriba, y sirve para que un requisito de la
 * rúbrica —«Diccionario teológico · 0/1»— abra la biblioteca ya filtrada en vez
 * de ser otra puerta de subida.
 *
 * Cuando VARIOS tipos de biblioteca desembocan en el mismo tipo académico
 * —trasfondo histórico recibe diccionarios bíblicos, panorámicas e historia—
 * se devuelve `'all'` a propósito: elegir uno escondería los otros dos, y un
 * filtro que oculta el libro que el pastor está buscando es peor que no
 * filtrar. Filtrar sólo cuando la respuesta es única y no hay nada que perder.
 */
export function filtroDeBibliotecaPara(sourceType: SourceType): ResourceType | 'all' {
    const [unico, ...resto] = (Object.keys(TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA) as ResourceType[])
        .filter(t => TIPO_ACADEMICO_POR_TIPO_DE_BIBLIOTECA[t] === sourceType);
    return unico && resto.length === 0 ? unico : 'all';
}
