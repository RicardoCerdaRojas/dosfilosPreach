import type { DocumentData } from 'firebase-admin/firestore';
import { DUENO_COMPARTIDO, esLibroSinHojas } from '../../functions/src/library/bibliotecaCompartida';
import { etiquetaDeFuente } from '@/components/library/consulta/etiquetaDeFuente';
import type { Contexto } from './herramientas/tipos';

/** Un libro que el usuario puede leer por el MCP: suyo, o compartido de dominio público. */
export interface RecursoLegible {
    id: string;
    data: DocumentData;
    /** El `userId` de sus fragmentos. */
    dueno: string;
    propio: boolean;
    /** Texto sin hojas (JFB): se lee y se cita por sección. */
    sinHojas: boolean;
}

/**
 * Regla de derechos (decisión 3, diseño §8.1): el texto solo de los libros
 * propios o de los compartidos citables públicamente. Un libro de otro
 * usuario o un compartido protegido es «no encontrado», sin decir por qué.
 */
export async function recursoLegible(ctx: Contexto, resourceId: string): Promise<RecursoLegible | null> {
    const snap = await ctx.db.collection('library_resources').doc(resourceId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    const propio = data.userId === ctx.uid;
    const compartido = data.userId === DUENO_COMPARTIDO && data.publiclyCitable === true;
    if (!propio && !compartido) return null;
    return { id: snap.id, data, dueno: String(data.userId), propio, sinHojas: compartido && esLibroSinHojas(data) };
}

/**
 * La cita de un pasaje, con la MISMA regla que la web (`etiquetaDeFuente`):
 * «(Varner, p. 188)» solo con numeración confirmada, «hoja N» sin ella, la
 * sección si no hay hoja.
 */
export function citaDe(recurso: { data: DocumentData }, hoja: number | null, seccion: string): string {
    return etiquetaDeFuente(
        { n: 0, resourceId: '', titulo: String(recurso.data.title ?? ''), autor: String(recurso.data.author ?? ''), hoja, seccion, extracto: '' },
        { author: recurso.data.author ?? null, title: recurso.data.title ?? null, pageNumbering: recurso.data.pageNumbering ?? null },
    );
}
