import type { ExegeticalPaper } from '@dosfilos/domain';
import { deserialize } from '../../../infrastructure/src/firebase/deserializarTrabajo';
import { ErrorDeHerramienta, type Contexto } from './tipos';

/**
 * Un trabajo del usuario, leído como lo lee la web (`deserializarTrabajo`).
 * Uno ajeno es «no encontrado», sin decir por qué.
 */
export async function trabajoDelUsuario(ctx: Contexto, trabajoId: string): Promise<ExegeticalPaper> {
    const snap = await ctx.db.collection('exegeticalPapers').doc(trabajoId).get();
    const data = snap.data();
    if (!snap.exists || !data || data.ownerId !== ctx.uid) throw new ErrorDeHerramienta('No encontré ese trabajo.');
    return deserialize(snap.id, data);
}
