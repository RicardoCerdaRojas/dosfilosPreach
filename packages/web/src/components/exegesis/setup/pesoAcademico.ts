import { SOURCE_TYPE_CATALOG, type LibraryResource, type SourceType } from '@dosfilos/domain';
import { defaultSourceTypeFor } from './tipoAcademico';

/**
 * Cuánto PESA un libro, al lado de cuánto HABLA del pasaje.
 *
 * EL PROBLEMA. El buscador ordena los libros por fragmentos que coinciden con
 * el pasaje y muestra ese número. Un pastor que no es especialista lee ese
 * número como un ranking de calidad: «12 relevantes» arriba de «3 relevantes»
 * parece decir que el primero es mejor libro. No lo dice. Un devocional que
 * menciona Jonás en cada página puntúa altísimo, y un comentario crítico que
 * le dedica tres páginas densas puntúa bajo.
 *
 * Son dos ejes distintos y hay que mostrar los dos: cuánto habla del pasaje, y
 * cuánto vale como autoridad. El segundo ya existe en el catálogo como
 * `rigorTier`, pero nunca llegó a la pantalla donde se elige.
 *
 * El número crudo no se muestra: un «3» no le dice nada a quien no conoce la
 * escala. Se muestra la palabra.
 */
export type PesoAcademico = 'tecnica' | 'academica' | 'apoyo' | 'textoBase' | 'noCitable';

const POR_NIVEL: Record<0 | 1 | 2 | 3, PesoAcademico> = {
    3: 'tecnica',
    2: 'academica',
    1: 'apoyo',
    0: 'noCitable',
};

/**
 * El peso de un tipo académico ya conocido.
 *
 * El nivel 0 del catálogo junta dos cosas que en pantalla no son lo mismo. La
 * rúbrica no cuenta una edición del texto —BHQ, NA28— como fuente académica
 * porque es el texto que se está estudiando, no un estudio sobre él; pero el
 * pastor SÍ la cita, y rotularla «no se cita» sería falso. El modelo de estilo,
 * en cambio, no se cita nunca. Se los separa acá, sin tocar la escala que usa
 * la rúbrica.
 */
export function pesoDeTipo(type: SourceType): PesoAcademico {
    if (type === 'biblical-text-edition') return 'textoBase';
    // Un tipo que el catálogo no conozca cae en «de apoyo», no en «no se
    // cita». Desconocer un libro no es lo mismo que saber que no se cita, y
    // el rótulo duro sobre un comentario crítico mal clasificado haría que el
    // pastor lo descarte.
    const nivel = SOURCE_TYPE_CATALOG[type]?.rigorTier;
    return POR_NIVEL[nivel ?? 1];
}

/**
 * El peso de un recurso de la biblioteca.
 *
 * Si ya fue clasificado, se usa esa clasificación. Si no, se deduce del tipo
 * con que está guardado —la misma deducción que llena el diálogo— en vez de
 * callar: dejar la mitad de las filas sin peso haría parecer que a esos libros
 * no se les conoce ninguno, cuando la biblioteca sí sabe qué son.
 */
export function pesoDeRecurso(resource: LibraryResource): PesoAcademico {
    return pesoDeTipo(resource.exegeticalType ?? defaultSourceTypeFor(resource));
}
