import { requirementsOfPaper } from '@dosfilos/domain';
import { texto } from './argumentos';
import { trabajoDelUsuario } from './trabajo';
import { comoJson, type Herramienta } from './tipos';

/**
 * Los requisitos de un trabajo con la MISMA regla que la pestaña «Entradas»
 * (`requirementsOfPaper`): de dónde sale cada uno (rúbrica, sílabo,
 * enunciado, tipo), si se cumple, si se mide o lo marca el autor, y en qué
 * unidad. El texto de un requisito llega como clave y valores (la web lo
 * traduce); los literales, tal cual.
 */
export const leerRequisitos: Herramienta = {
    nombre: 'leer_requisitos',
    descripcion: 'Los requisitos de un trabajo, como los ve el autor en la pestaña «Entradas»: extensión, fuentes por tipo, criterios de la rúbrica, lecturas del sílabo, cada pregunta en su sección y la forma del tipo de trabajo; si se cumple cada uno, si lo mide el sistema o lo marcó el autor, y los avisos.',
    esquema: {
        type: 'object',
        properties: { trabajo: { type: 'string', description: 'El id del trabajo (de leer_trabajo).' } },
        required: ['trabajo'],
        additionalProperties: false,
    },
    modo: 'lee',
    alcance: 'corpus:read',
    async ejecutar(args, ctx) {
        const paper = await trabajoDelUsuario(ctx, texto(args, 'trabajo', { max: 200 }));
        const { profileKind, units, requirements, warnings } = requirementsOfPaper(paper);
        return {
            texto: comoJson({
                trabajo: paper.id,
                tipo: profileKind,
                unidades: units.map(u => ({ id: u.id, tipo: u.kind, numero: u.number })),
                requisitos: requirements,
                avisos: warnings,
            }),
        };
    },
};
