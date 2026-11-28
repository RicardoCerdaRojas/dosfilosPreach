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
 *      que relee la cuenta (si ya está aplicado, ese mes ya se renovó);
 *   2. pone la cuota del plan con los mismos helpers del webhook (SET, sin
 *      acumular; el balde pack no se toca);
 *   3. si el paso 2 falla, borra el marcador para que la próxima corrida lo
 *      reintente.
 * Al final escribe `renovaciones_cortesia/AAAA-MM_<ms>` con los CONTEOS, sin uids:
 * el detalle por cuenta vive en su marcador, que se borra con la cuenta.
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
    /** Cuántas se renovaron, por plan. */
    renovadasPorPlan: Record<string, number>;
    yaRenovadas: number;
    conFacturaDeStripe: number;
    fallidas: number;
}

export async function renovarCuotasDeCortesia(db: Firestore, ahora: Date): Promise<ResumenDeRenovacion> {
    const periodo = periodoDeRenovacion(ahora);
    const marcador = marcadorDeCortesia(periodo);
    const resumen: ResumenDeRenovacion = { periodo, renovadasPorPlan: {}, yaRenovadas: 0, conFacturaDeStripe: 0, fallidas: 0 };
    /** `null` = el documento del plan no existe. */
    const cuotas = new Map<string, CuotaDelPlan | null>();

    const activos = await db.collection('users').where('subscription.status', '==', 'active').get();
    for (const usuario of activos.docs) {
        const sub = usuario.data().subscription as SuscripcionGuardada | undefined;
        if (!esCuentaDeCortesia(sub)) continue;
        const uid = usuario.id;
        const planId = sub!.planId as string;
        const grants = usuario.ref.collection('monthly_grants');

        // A la defensiva: si alguna vez llegó una factura de Stripe, la cuenta
        // es de pago aunque le falte el id; la renueva el webhook. Sólo cuentan
        // las facturas `in_…`: los backfills también escriben `invoiceId`
        // («backfill-…», «exegesis-backfill-…») y no son facturas.
        const conFactura = await grants.where('invoiceId', '>=', 'in_').where('invoiceId', '<', 'in`').limit(1).get();
        if (!conFactura.empty) {
            resumen.conFacturaDeStripe++;
            console.warn(`[renovarCuotaDeCortesia] ${uid.substring(0, 8)}… tiene facturas de Stripe sin stripeSubscriptionId; no se renueva aquí`);
            continue;
        }

        // El plan se lee ANTES de tomar el marcador: sin el documento del plan
        // no se escribe nada (poner ceros le borraría la cuota a la cuenta).
        if (!cuotas.has(planId)) {
            const plan = await db.collection('plans').doc(planId).get();
            cuotas.set(planId, plan.exists ? cuotaDelPlan(plan.data()?.limits as Record<string, unknown> | undefined) : null);
        }
        const cuota = cuotas.get(planId);
        if (!cuota) {
            console.error(`[renovarCuotaDeCortesia] el plan ${planId} no existe; ${uid.substring(0, 8)}… no se renueva`);
            resumen.fallidas++;
            continue;
        }

        const refMarcador = grants.doc(marcador);
        const nueva = await db.runTransaction(async (tx) => {
            // Se relee la cuenta: si entre la consulta y ahora pasó a pagar,
            // la cuota es de su factura y no se pisa.
            const [actual, previo] = await Promise.all([tx.get(usuario.ref), tx.get(refMarcador)]);
            const subActual = actual.data()?.subscription as SuscripcionGuardada | undefined;
            if (!esCuentaDeCortesia(subActual) || subActual?.planId !== planId) return false;
            // Un marcador sin `aplicado` es de una corrida que murió a mitad de
            // camino: el mes sigue pendiente.
            if (previo.exists && previo.data()?.aplicado) return false;
            tx.set(refMarcador, { tipo: 'cortesia', periodo, planId, creado: FieldValue.serverTimestamp() });
            return true;
        });
        if (!nueva) {
            resumen.yaRenovadas++;
            continue;
        }

        try {
            await setPlanQuotaAdmin(uid, 'standard', cuota.standardPages);
            await setPlanQuotaAdmin(uid, 'premium', cuota.premiumPages);
            await setExegesisPlanQuotaAdmin(uid, cuota.exegesisUsd);
            await refMarcador.update({ ...cuota, aplicado: FieldValue.serverTimestamp() });
            resumen.renovadasPorPlan[planId] = (resumen.renovadasPorPlan[planId] ?? 0) + 1;
        } catch (err) {
            console.error(`[renovarCuotaDeCortesia] falló ${uid.substring(0, 8)}…; se borra el marcador para reintentar:`, err);
            resumen.fallidas++;
            await refMarcador.delete().catch(e => console.error('[renovarCuotaDeCortesia] no se pudo borrar el marcador:', e));
        }
    }

    // Un documento por corrida: una segunda corrida en el mismo mes no borra
    // lo que registró la primera.
    await db.collection('renovaciones_cortesia').doc(`${periodo}_${ahora.getTime()}`).set({
        ...resumen,
        corrida: FieldValue.serverTimestamp(),
    });
    return resumen;
}

export const renovarCuotaDeCortesia = onSchedule(
    { schedule: '0 4 1 * *', timeZone: ZONA_DE_RENOVACION, region: 'us-central1', memory: '256MiB', timeoutSeconds: 300 },
    async () => {
        const r = await renovarCuotasDeCortesia(getFirestore(), new Date());
        const renovadas = Object.values(r.renovadasPorPlan).reduce((a, b) => a + b, 0);
        console.log(`[renovarCuotaDeCortesia] ${r.periodo}: ${renovadas} renovadas, ${r.yaRenovadas} ya renovadas, ${r.conFacturaDeStripe} con factura de Stripe, ${r.fallidas} fallidas`);
    },
);
