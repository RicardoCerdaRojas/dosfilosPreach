import { SOURCE_TYPE_ORDER, findBooksByAlias, getBookById, getSourceRecommendations, type BibleBookId, type SourceType } from '@dosfilos/domain';
import { texto, textoOpcional } from './argumentos';
import { comoJson, ErrorDeHerramienta, type Herramienta } from './tipos';

/** El libro bíblico de un nombre en español o inglés («Santiago», «James») o de su id («JAS»). */
export function libroBiblico(nombre: string): { id: BibleBookId; nombre: string } | null {
    const porId = /^[1-3]?[A-Za-z]{2,3}$/.test(nombre) ? getBookById(nombre.toUpperCase() as BibleBookId) : null;
    const libro = porId ?? findBooksByAlias(nombre)[0] ?? null;
    return libro ? { id: libro.id, nombre: libro.nameEs } : null;
}

/**
 * Las obras que el catálogo curado recomienda para un libro bíblico, por tipo
 * de fuente (el mismo catálogo de «Qué conseguir»). No lee la biblioteca: dice
 * qué existe y qué edición se cita.
 */
export const consultarCatalogo: Herramienta = {
    nombre: 'consultar_catalogo',
    descripcion: 'Obras recomendadas por el catálogo curado de Dos Filos para un libro de la Biblia, por tipo de fuente (comentario crítico, léxico, gramática…), con autor, editorial, año e ISBN de la edición que se cita. No dice si el usuario las tiene: para eso, buscar_biblioteca.',
    esquema: {
        type: 'object',
        properties: {
            libro: { type: 'string', description: 'Libro de la Biblia: «Santiago», «James» o «JAS».' },
            tipo: { type: 'string', enum: [...SOURCE_TYPE_ORDER], description: 'Opcional: solo un tipo de fuente.' },
        },
        required: ['libro'],
        additionalProperties: false,
    },
    modo: 'lee',
    alcance: 'corpus:read',
    async ejecutar(args) {
        const libro = libroBiblico(texto(args, 'libro', { max: 40 }));
        if (!libro) throw new ErrorDeHerramienta('No reconozco ese libro de la Biblia.');
        const tipo = textoOpcional(args, 'tipo', 60);
        if (tipo && !SOURCE_TYPE_ORDER.includes(tipo as SourceType)) throw new ErrorDeHerramienta('Tipo de fuente desconocido.');
        const tipos = tipo ? [tipo as SourceType] : SOURCE_TYPE_ORDER;
        const obras = tipos.flatMap(t => getSourceRecommendations(libro.id, t, 'es').map(r => ({
            tipo: t,
            titulo: r.title,
            autor: r.author,
            serie: r.series,
            editorial: r.publisher,
            anio: r.year || null,
            isbn: r.isbn,
            nivel: r.tier,
            idiomas: r.languages,
            ...(r.rationale ? { porque: r.rationale } : {}),
        })));
        return { texto: comoJson({ libro, obras }) };
    },
};
