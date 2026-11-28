import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { setExegesisPlanQuotaAdmin, setPlanQuotaAdmin } from '../library/processingBalance';

/**
 * Renovación mensual de la cuota de las cuentas de CORTESÍA.
 *
 * Una cuenta de pago renueva su cuota con cada factura de Stripe
 * (`applyMonthlyQuotaIfPending`, marcador `monthly_grants/{invoiceId}`). Una
 * cuenta a la que el super admin le asignó el plan desde el panel
 * (`changePlanForUser`) no tiene suscripción en Stripe, nunca recibe factura y
 * se quedaba para siempre con la cuota sembrada el día de la asignación. Caso
 * real: un Pro asignado el 2026-08-16 seguía con los US$10 de agosto en
 * noviembre. El fundador decidió el 2026-11-28 que se renueve cada mes.
 *
 * Corre el día 1 a las 04:00 de Santiago. Por cada cuenta de cortesía activa:
 *   1. deja el marcador `monthly_grants/cortesia-AAAA-MM` en una transacción
 *      (si ya existe, ese mes ya se renovó y no se repite);
 *   2. pone la cuota del plan con los mismos helpers del webhook (SET, sin
 *      acumular; el balde pack no se toca);
 *   3. si el paso 2 falla, borra el marcador para que la próxima corrida lo
 *      reintente.
 * Al final escribe `renovaciones_cortesia/AAAA-MM` con lo que hizo.
 */

export const ZONA_DE_RENOVACION = 'America/Santiago';
const PREFIJO_DEL_MARCADOR = 'cortesia-';

interface SuscripcionGuardada {
    status?: unknown;
    planId?: unknown;
    id?: unknown;
    stripeSubscriptionId?: unknown;
}

const esIdDeStripe = (v: unknown) => typeof v === 'string' && v.startsWith('sub_');

/**
 * Activa, de un plan pagado y sin suscripción en Stripe.
 *
 * El id de Stripe vive en DOS campos según por dónde entró la cuenta: el
 * webhook de un usuario existente que se suscribe escribe `subscription.id`
 * (el campo de la entidad `Subscription`), y el registro con pago primero
 * escribe `subscription.stripeSubscriptionId`. Hay que mirar los dos: mirar
 * uno solo tomaba por cortesía a quien paga. Copia de
 * `esSuscripcionDeCortesia` en domain (functions no importa domain, ADR-025).
 */
export function esCuentaDeCortesia(sub: SuscripcionGuardada | undefined | null): boolean {
    if (!sub || sub.status !== 'active') return false;
    if (typeof sub.planId !== 'string' || sub.planId === '' || sub.planId === 'free') return false;
    return !esIdDeStripe(sub.id) && !esIdDeStripe(sub.stripeSubscriptionId);
}

/** El mes de la renovación, `AAAA-MM`, en la zona de la renovación. */
export function periodoDeRenovacion(fecha: Date, zona: string = ZONA_DE_RENOVACION): string {
    const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(fecha);
    const anio = partes.find(p => p.type === 'year')?.value;
    const mes = partes.find(p => p.type === 'month')?.value;
    return `${anio}-${mes}`;
}

export function marcadorDeCortesia(periodo: string): string {
    return `${PREFIJO_DEL_MARCADOR}${periodo}`;
}

export interface CuotaDelPlan {
    standardPages: number;
    premiumPages: number;
    exegesisUsd: number;
}

export function cuotaDelPlan(limits: Record<string, unknown> | undefined): CuotaDelPlan {
    const n = (v: unknown) => Math.max(0, Number(v) || 0);
    return {
        standardPages: n(limits?.standardPagesPerMonth),
        premiumPages: n(limits?.premiumPagesPerMonth),
        exegesisUsd: n(limits?.exegesisUsdPerMonth),
    };
}

export interface ResumenDeRenovacion {
    periodo: string;
    renovadas: Array<{ uid: string; planId: string } & CuotaDelPlan>;
    yaRenovadas: number;
    conFacturaDeStripe: number;
    fallidas: Array<{ uid: string; error: string }>;
}

export async function renovarCuotasDeCortesia(db: Firestore, ahora: Date): Promise<ResumenDeRenovacion> {
    const periodo = periodoDeRenovacion(ahora);
    const marcador = marcadorDeCortesia(periodo);
    const resumen: ResumenDeRenovacion = { periodo, renovadas: [], yaRenovadas: 0, conFacturaDeStripe: 0, fallidas: [] };
    const cuotas = new Map<string, CuotaDelPlan>();

    const activos = await db.collection('users').where('subscription.status', '==', 'active').get();
    for (const usuario of activos.docs) {
        const sub = usuario.data().subscription as SuscripcionGuardada | undefined;
        if (!esCuentaDeCortesia(sub)) continue;
        const uid = usuario.id;
        const planId = sub!.planId as string;
        const grants = usuario.ref.collection('monthly_grants');

        // A la defensiva: si alguna vez llegó una factura de Stripe, la cuenta
        // es de pago aunque le falte `stripeSubscriptionId`; la renueva el webhook.
        const conFactura = await grants.orderBy('invoiceId').limit(1).get();
        if (!conFactura.empty) {
            resumen.conFacturaDeStripe++;
            console.warn(`[renovarCuotaDeCortesia] ${uid.substring(0, 8)}… tiene facturas de Stripe sin stripeSubscriptionId; no se renueva aquí`);
            continue;
        }

        const refMarcador = grants.doc(marcador);
        const nueva = await db.runTransaction(async (tx) => {
            if ((await tx.get(refMarcador)).exists) return false;
            tx.create(refMarcador, { tipo: 'cortesia', periodo, planId, creado: FieldValue.serverTimestamp() });
            return true;
        });
        if (!nueva) {
            resumen.yaRenovadas++;
            continue;
        }

        try {
            if (!cuotas.has(planId)) {
                const plan = await db.collection('plans').doc(planId).get();
                cuotas.set(planId, cuotaDelPlan(plan.data()?.limits as Record<string, unknown> | undefined));
            }
            const cuota = cuotas.get(planId)!;
            await setPlanQuotaAdmin(uid, 'standard', cuota.standardPages);
            await setPlanQuotaAdmin(uid, 'premium', cuota.premiumPages);
            await setExegesisPlanQuotaAdmin(uid, cuota.exegesisUsd);
            await refMarcador.update({ ...cuota, aplicado: FieldValue.serverTimestamp() });
            resumen.renovadas.push({ uid, planId, ...cuota });
        } catch (err) {
            const mensaje = err instanceof Error ? err.message : String(err);
            console.error(`[renovarCuotaDeCortesia] falló ${uid.substring(0, 8)}…; se borra el marcador para reintentar:`, err);
            resumen.fallidas.push({ uid, error: mensaje });
            await refMarcador.delete().catch(e => console.error('[renovarCuotaDeCortesia] no se pudo borrar el marcador:', e));
        }
    }

    await db.collection('renovaciones_cortesia').doc(periodo).set({
        ...resumen,
        corrida: FieldValue.serverTimestamp(),
    }, { merge: true });
    return resumen;
}

export const renovarCuotaDeCortesia = onSchedule(
    { schedule: '0 4 1 * *', timeZone: ZONA_DE_RENOVACION, region: 'us-central1', memory: '256MiB', timeoutSeconds: 300 },
    async () => {
        const r = await renovarCuotasDeCortesia(getFirestore(), new Date());
        console.log(`[renovarCuotaDeCortesia] ${r.periodo}: ${r.renovadas.length} renovadas, ${r.yaRenovadas} ya renovadas, ${r.conFacturaDeStripe} con factura de Stripe, ${r.fallidas.length} fallidas`);
    },
);
