import { derivePaperUnits, formatPassageReference, readPaperProfileKind } from '@dosfilos/domain';
import { textoOpcional } from './argumentos';
import { trabajoDelUsuario } from './trabajo';
import { comoJson, type Herramienta } from './tipos';

/** Trabajos que se listan sin id: los más recientes. */
const TRABAJOS_EN_LA_LISTA = 40;

/**
 * Sin id, los trabajos del usuario; con id, su estado: pasaje, tipo, unidades,
 * fuentes del corpus (con las hojas elegidas) y qué pasos tienen texto. No
 * devuelve el texto del trabajo: es del autor, y lo lee en la web.
 */
export const leerTrabajo: Herramienta = {
    nombre: 'leer_trabajo',
    descripcion: 'Sin «trabajo», lista los trabajos exegéticos del usuario (id, título, pasaje). Con «trabajo», su estado: pasaje, tipo de trabajo, unidades (preguntas o versículos), fuentes del corpus con sus libros (resourceId) y hojas elegidas, y qué pasos ya tienen texto.',
    esquema: {
        type: 'object',
        properties: { trabajo: { type: 'string', description: 'Opcional: el id del trabajo.' } },
        additionalProperties: false,
    },
    modo: 'lee',
    alcance: 'corpus:read',
    async ejecutar(args, ctx) {
        const trabajoId = textoOpcional(args, 'trabajo', 200);
        if (!trabajoId) {
            const snap = await ctx.db.collection('exegeticalPapers').where('ownerId', '==', ctx.uid)
                .select('title', 'passage', 'updatedAt', 'archivedAt').get();
            const lista = snap.docs
                .map(d => ({ d, at: d.get('updatedAt')?.toDate?.()?.getTime?.() ?? 0 }))
                .filter(x => !x.d.get('archivedAt'))
                .sort((a, b) => b.at - a.at)
                .slice(0, TRABAJOS_EN_LA_LISTA)
                .map(({ d, at }) => ({
                    trabajo: d.id,
                    titulo: d.get('title') ?? null,
                    pasaje: d.get('passage') ? formatPassageReference(d.get('passage')) : null,
                    actualizado: at ? new Date(at).toISOString().slice(0, 10) : null,
                }));
            return { texto: comoJson({ trabajos: lista }) };
        }
        const paper = await trabajoDelUsuario(ctx, trabajoId);
        const tipo = readPaperProfileKind(paper).kind;
        const unidades = derivePaperUnits({ kind: tipo, assignmentBrief: paper.assignmentBrief, passage: paper.passage, steps: paper.steps, sectionTitles: paper.sectionTitles });
        const resumen = {
            trabajo: paper.id,
            titulo: paper.title,
            pasaje: formatPassageReference(paper.passage),
            tipo,
            unidades: unidades.map(u => ({ id: u.id, tipo: u.kind, numero: u.number, texto: u.text })),
            fuentes: paper.sources.map(s => ({
                clave: s.citationKey ?? s.displayLabel,
                tipoDeFuente: s.sourceType,
                libro: s.sourceLibraryResourceId ?? s.corpusId,
                hojasElegidas: s.excerptRecipe?.sheetRanges ?? [],
            })),
            pasos: paper.steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map(p => ({
                    id: p.id,
                    tipo: p.kind,
                    versiculos: p.verseRef ? formatPassageReference(p.verseRef) : null,
                    conTexto: !!(p.accepted?.markdown?.trim() || p.current?.markdown?.trim()),
                })),
            documentoArmado: !!paper.assembledMarkdown?.trim(),
        };
        return { texto: comoJson(resumen) };
    },
};
