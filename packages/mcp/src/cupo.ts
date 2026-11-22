import type { Firestore } from 'firebase-admin/firestore';

/**
 * Cupo de texto de libros hacia el cliente MCP (decisión 3 del fundador):
 * a lo sumo 60 hojas DISTINTAS de un mismo libro por día y usuario. Volver a
 * leer una hoja ya leída hoy no gasta. El día es el de Chile (America/Santiago).
 */
export const HOJAS_POR_LIBRO_AL_DIA = 60;

export function diaDeHoy(ahora = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Anota la hoja si cabe en el cupo. Devuelve cuántas quedan, o null si ya no cabe. */
export async function gastarCupo(db: Firestore, uid: string, resourceId: string, hoja: number, ahora = new Date()): Promise<number | null> {
    const ref = db.collection('corpus_quota').doc(`${uid}_${resourceId}_${diaDeHoy(ahora)}`);
    return db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const hojas = new Set<number>((snap.exists ? (snap.get('hojas') as number[] | undefined) : undefined) ?? []);
        if (!hojas.has(hoja)) {
            if (hojas.size >= HOJAS_POR_LIBRO_AL_DIA) return null;
            hojas.add(hoja);
            tx.set(ref, { uid, resourceId, dia: diaDeHoy(ahora), hojas: [...hojas] }, { merge: true });
        }
        return HOJAS_POR_LIBRO_AL_DIA - hojas.size;
    });
}
