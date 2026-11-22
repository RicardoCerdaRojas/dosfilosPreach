import { buscarPertinentes } from '../../../functions/src/library/consulta/recuperarFragmentos';
import { FRAGMENTOS_DE_TEMAS, MAX_CONSULTA, POR_HORA, agruparPorLibro } from '../../../functions/src/library/consulta/agruparPorLibro';
import { consumeRateLimitToken } from '../../../functions/src/shared/rateLimit';
import { listaDeIds, texto } from './argumentos';
import { citaDe } from '../recursos';
import { comoJson, ErrorDeHerramienta, type Herramienta } from './tipos';

/**
 * «Buscar temas» de la web, desde el MCP: los mismos candidatos (vectores +
 * pasaje), el mismo reordenador y el mismo umbral; la misma búsqueda por hora
 * (el tope se comparte con la web). Devuelve extractos de 400 caracteres con
 * su cita; el texto entero de una hoja se pide con `leer_hoja`.
 */
export const buscarBiblioteca: Herramienta = {
    nombre: 'buscar_biblioteca',
    descripcion: 'Busca un tema o un pasaje en la biblioteca del usuario (sus libros y los compartidos de dominio público), por significado y ordenado por pertinencia. Devuelve por libro las hojas que lo tratan, con un extracto y la cita lista para usar. Sirve en español o inglés. Para leer una hoja entera, leer_hoja.',
    esquema: {
        type: 'object',
        properties: {
            consulta: { type: 'string', description: 'El tema o el pasaje: «doble acusativo», «Santiago 5:14».' },
            libros: { type: 'array', items: { type: 'string' }, description: 'Opcional: ids de libros (resourceId) para buscar solo en ellos.' },
        },
        required: ['consulta'],
        additionalProperties: false,
    },
    modo: 'lee',
    alcance: 'corpus:read',
    async ejecutar(args, ctx) {
        const consulta = texto(args, 'consulta', { max: MAX_CONSULTA, min: 2 });
        const ids = listaDeIds(args, 'libros', 30);
        if (!ctx.geminiKey) throw new ErrorDeHerramienta('La búsqueda no está disponible ahora.');
        const permitido = await consumeRateLimitToken(ctx.db, { bucket: 'library_topics', key: ctx.uid, windowMs: 60 * 60 * 1000, max: POR_HORA });
        if (!permitido) throw new ErrorDeHerramienta('Demasiadas búsquedas seguidas. Espera unos minutos.');
        const { fragmentos, reordenado } = await buscarPertinentes(
            consulta, ctx.uid, ids ? { tipo: 'libros', ids } : { tipo: 'todo' }, ctx.geminiKey,
            { total: FRAGMENTOS_DE_TEMAS, timeoutSeconds: 40 },
        );
        const libros = agruparPorLibro(fragmentos);
        // La cita con la numeración de cada libro, como la ve el autor en la web.
        const fichas = await Promise.all(libros.map(l => ctx.db.collection('library_resources').doc(l.resourceId).get()));
        const resultado = libros.map((l, i) => {
            const data = fichas[i]?.data() ?? {};
            return {
                resourceId: l.resourceId,
                titulo: l.titulo,
                autor: l.autor,
                pasajes: l.hojas.map(h => ({
                    hoja: h.hoja,
                    seccion: h.seccion || null,
                    cita: citaDe({ data }, h.hoja, h.seccion),
                    pertinencia: h.pertinencia,
                    extracto: h.extracto,
                })),
            };
        });
        return {
            texto: comoJson({ consulta, ordenadoPorPertinencia: reordenado, libros: resultado }),
            leido: libros.map(l => ({ resourceId: l.resourceId, hojas: l.hojas.flatMap(h => (h.hoja === null ? [] : [h.hoja])) })),
        };
    },
};
