import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * La cuota de consultas del mes, la misma que usa el chat de Facultad
 * (`plan.limits.queriesPerMonth` contra `users/{uid}/usage_counters/{AAAA-MM}`).
 *
 * Una pregunta a la biblioteca cuenta como una consulta de Facultad: es la
 * misma cosa (preguntar a los libros) y no se cobra distinto. A diferencia de
 * Facultad, que lo revisa en el navegador, acá lo revisa el servidor.
 */

export function periodoActual(fecha: Date = new Date()): string {
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** `null` si puede consultar; si no, el motivo para el usuario. */
export function motivoSinCuota(limite: number | undefined, usadas: number): string | null {
    if (limite === undefined || limite < 0) return null;   // ilimitado
    if (usadas < limite) return null;
    return `Alcanzaste tu límite de ${limite} consultas este mes.`;
}

export async function revisarCuota(userId: string): Promise<string | null> {
    const db = getFirestore();
    const usuario = (await db.collection('users').doc(userId).get()).data();
    const planId: string = usuario?.subscription?.planId ?? 'free';
    const [plan, contador] = await Promise.all([
        db.collection('plans').doc(planId).get(),
        db.doc(`users/${userId}/usage_counters/${periodoActual()}`).get(),
    ]);
    // Como Facultad: sin plan no se consulta.
    if (!plan.exists) return 'No encontramos tu plan. Escríbenos si el problema sigue.';
    const limite = plan.data()?.limits?.queriesPerMonth as number | undefined;
    return motivoSinCuota(limite, Number(contador.data()?.queriesUsed ?? 0));
}

/** Suma una consulta, igual que `incrementUsage`. Sólo después de una respuesta. */
export async function sumarConsulta(userId: string): Promise<void> {
    const periodKey = periodoActual();
    const ahora = new Date();
    await getFirestore().doc(`users/${userId}/usage_counters/${periodKey}`).set({
        userId,
        periodKey,
        queriesUsed: FieldValue.increment(1),
        lastEventAt: ahora,
    }, { merge: true });
}
