import { sanitizeExtractedTextOnly } from '../../../functions/src/library/sanitizeExtractedText';
import { gastarCupo, HOJAS_POR_LIBRO_AL_DIA } from '../cupo';
import { citaDe, recursoLegible } from '../recursos';
import { enteroOpcional, texto, textoOpcional } from './argumentos';
import { comoJson, ErrorDeHerramienta, type Herramienta } from './tipos';

/** Fragmentos que se juntan para una hoja o una sección (una hoja tiene 1–6). */
const FRAGMENTOS_POR_LECTURA = 24;

/**
 * El texto entero de una hoja de un libro (o de una sección, en un libro sin
 * hojas como JFB). Regla de derechos (decisión 3): solo libros propios o
 * compartidos de dominio público; de los propios, a lo sumo 60 hojas
 * distintas por libro y día, y todo queda en la auditoría.
 */
export const leerHoja: Herramienta = {
    nombre: 'leer_hoja',
    descripcion: `Lee el texto entero de una hoja de un libro de la biblioteca del usuario, con su cita («(Varner, p. 188)»). En un libro sin páginas (texto convertido, como el comentario de Jamieson-Fausset-Brown) se pide la sección («JAS 1:5») en vez de la hoja. Cupo: ${HOJAS_POR_LIBRO_AL_DIA} hojas distintas por libro y día en los libros propios.`,
    esquema: {
        type: 'object',
        properties: {
            libro: { type: 'string', description: 'El id del libro (resourceId), como lo devuelve buscar_biblioteca o leer_trabajo.' },
            hoja: { type: 'integer', minimum: 1, description: 'La hoja del archivo (no la página impresa).' },
            seccion: { type: 'string', description: 'Solo en libros sin páginas: la sección, por ejemplo «JAS 1:5».' },
        },
        required: ['libro'],
        additionalProperties: false,
    },
    modo: 'lee',
    alcance: 'corpus:read',
    async ejecutar(args, ctx) {
        const resourceId = texto(args, 'libro', { max: 200 });
        const hoja = enteroOpcional(args, 'hoja', 1, 100_000);
        const seccion = textoOpcional(args, 'seccion', 120);
        const recurso = await recursoLegible(ctx, resourceId);
        if (!recurso) throw new ErrorDeHerramienta('No encontré ese libro en tu biblioteca.');

        let consulta = ctx.db.collection('document_chunks')
            .where('userId', '==', recurso.dueno)
            .where('resourceId', '==', recurso.id);
        let cupoRestante: number | null = null;
        if (recurso.sinHojas) {
            if (!seccion) throw new ErrorDeHerramienta('Este libro no tiene páginas: pide una sección (por ejemplo «JAS 1:5»).');
            consulta = consulta.where('metadata.section', '==', seccion);
        } else {
            if (hoja === null) throw new ErrorDeHerramienta('Falta «hoja».');
            if (recurso.propio) {
                cupoRestante = await gastarCupo(ctx.db, ctx.uid, recurso.id, hoja);
                if (cupoRestante === null) throw new ErrorDeHerramienta(`Llegaste al cupo de hoy para este libro (${HOJAS_POR_LIBRO_AL_DIA} hojas). Mañana se renueva.`);
            }
            consulta = consulta.where('metadata.page', '==', hoja);
        }
        const snap = await consulta.limit(FRAGMENTOS_POR_LECTURA).get();
        const fragmentos = snap.docs
            .map(d => d.data())
            .sort((a, b) => Number(a.chunkIndex ?? 0) - Number(b.chunkIndex ?? 0));
        if (fragmentos.length === 0) throw new ErrorDeHerramienta(recurso.sinHojas ? 'Esa sección no está en el libro.' : 'Esa hoja no tiene texto en el índice.');
        const textoDeLaHoja = fragmentos.map(f => sanitizeExtractedTextOnly(String(f.text ?? '')).trim()).filter(Boolean).join('\n\n');
        const seccionDeLaHoja = seccion ?? String(fragmentos[0]?.metadata?.section ?? '');
        return {
            texto: comoJson({
                libro: { resourceId: recurso.id, titulo: recurso.data.title ?? null, autor: recurso.data.author ?? null },
                hoja: recurso.sinHojas ? null : hoja,
                seccion: seccionDeLaHoja || null,
                cita: citaDe(recurso, recurso.sinHojas ? null : hoja, seccionDeLaHoja),
                ...(cupoRestante !== null ? { hojasQueQuedanHoy: cupoRestante } : {}),
                texto: textoDeLaHoja,
            }),
            leido: [{ resourceId: recurso.id, ...(recurso.sinHojas ? { seccion: seccion! } : { hojas: [hoja!] }) }],
        };
    },
};
