import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El recorrido completo de la renovación de cortesía sobre un Firestore falso
 * en memoria. Cubre lo que encontró la revisión adversarial (2026-11-28):
 * marcadores de backfill tomados por facturas, plan inexistente que ponía
 * ceros, marcador huérfano de una corrida caída, y la cuenta que pasa a pagar
 * entre la consulta y la escritura.
 */

const escrituras: Array<{ uid: string; balde: string; valor: number }> = [];
vi.mock('../../library/processingBalance', () => ({
    setPlanQuotaAdmin: vi.fn(async (uid: string, modo: string, valor: number) => { escrituras.push({ uid, balde: modo, valor }); }),
    setExegesisPlanQuotaAdmin: vi.fn(async (uid: string, valor: number) => { escrituras.push({ uid, balde: 'exegesis', valor }); }),
}));
vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'TS' },
    getFirestore: () => { throw new Error('no se usa en la prueba'); },
}));
vi.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: () => () => undefined }));

import { renovarCuotasDeCortesia } from '../renovarCuotaDeCortesia';

type Datos = Record<string, any>;
const docs = new Map<string, Datos>();

function obtener(obj: Datos, ruta: string): unknown {
    return ruta.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);
}

function refDoc(ruta: string): any {
    return {
        path: ruta,
        id: ruta.split('/').pop(),
        get: async () => snap(ruta),
        set: async (d: Datos) => { docs.set(ruta, { ...d }); },
        update: async (d: Datos) => { docs.set(ruta, { ...(docs.get(ruta) ?? {}), ...d }); },
        delete: async () => { docs.delete(ruta); },
        collection: (c: string) => refColeccion(`${ruta}/${c}`),
    };
}

function snap(ruta: string) {
    const d = docs.get(ruta);
    return { exists: d !== undefined, id: ruta.split('/').pop(), ref: refDoc(ruta), data: () => (d ? { ...d } : undefined) };
}

function refColeccion(ruta: string, filtros: Array<(d: Datos) => boolean> = [], tope = Infinity): any {
    const hijos = () => [...docs.keys()].filter(k => k.startsWith(`${ruta}/`) && !k.slice(ruta.length + 1).includes('/'));
    return {
        doc: (id: string) => refDoc(`${ruta}/${id}`),
        where: (campo: string, op: string, valor: unknown) => refColeccion(ruta, [...filtros, (d) => {
            const v = obtener(d, campo) as any;
            if (v === undefined) return false;
            return op === '==' ? v === valor : op === '>=' ? v >= (valor as any) : op === '<' ? v < (valor as any) : false;
        }], tope),
        limit: (n: number) => refColeccion(ruta, filtros, n),
        get: async () => {
            const encontrados = hijos().filter(k => filtros.every(f => f(docs.get(k)!))).slice(0, tope).map(snap);
            return { empty: encontrados.length === 0, docs: encontrados };
        },
    };
}

const db: any = {
    collection: (c: string) => refColeccion(c),
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => fn({
        get: async (ref: any) => snap(ref.path),
        set: (ref: any, d: Datos) => { docs.set(ref.path, { ...d }); },
    }),
};

const PRO = { limits: { standardPagesPerMonth: 2500, premiumPagesPerMonth: 150, exegesisUsdPerMonth: 10 } };
const DIC = new Date('2026-12-01T07:00:00Z');

beforeEach(() => {
    docs.clear();
    escrituras.length = 0;
    docs.set('plans/pro', PRO);
});

describe('renovarCuotasDeCortesia', () => {
    it('renueva la cortesía y no toca a quien paga', async () => {
        docs.set('users/cortesia', { subscription: { status: 'active', planId: 'pro' } });
        docs.set('users/paga', { subscription: { status: 'active', planId: 'pro', id: 'sub_1' } });
        const r = await renovarCuotasDeCortesia(db, DIC);
        expect(r.renovadasPorPlan).toEqual({ pro: 1 });
        expect(escrituras.map(e => e.uid)).toEqual(['cortesia', 'cortesia', 'cortesia']);
        expect(escrituras.find(e => e.balde === 'exegesis')?.valor).toBe(10);
        expect(docs.get('users/cortesia/monthly_grants/cortesia-2026-12')?.aplicado).toBe('TS');
    });

    it('no repite el mismo mes', async () => {
        docs.set('users/cortesia', { subscription: { status: 'active', planId: 'pro' } });
        await renovarCuotasDeCortesia(db, DIC);
        escrituras.length = 0;
        const r = await renovarCuotasDeCortesia(db, DIC);
        expect(escrituras).toEqual([]);
        expect(r.yaRenovadas).toBe(1);
    });

    it('un marcador de backfill no es una factura de Stripe', async () => {
        docs.set('users/cortesia', { subscription: { status: 'active', planId: 'pro' } });
        docs.set('users/cortesia/monthly_grants/backfill-1', { invoiceId: 'backfill-1717' });
        docs.set('users/cortesia/monthly_grants/exegesis-backfill-1', { invoiceId: 'exegesis-backfill-1717' });
        const r = await renovarCuotasDeCortesia(db, DIC);
        expect(r.conFacturaDeStripe).toBe(0);
        expect(r.renovadasPorPlan).toEqual({ pro: 1 });
    });

    it('con una factura de Stripe real no se renueva aquí', async () => {
        docs.set('users/raro', { subscription: { status: 'active', planId: 'pro' } });
        docs.set('users/raro/monthly_grants/in_123', { invoiceId: 'in_123' });
        const r = await renovarCuotasDeCortesia(db, DIC);
        expect(r.conFacturaDeStripe).toBe(1);
        expect(escrituras).toEqual([]);
    });

    it('si el plan no existe no escribe ceros', async () => {
        docs.set('users/cortesia', { subscription: { status: 'active', planId: 'fantasma' } });
        const r = await renovarCuotasDeCortesia(db, DIC);
        expect(escrituras).toEqual([]);
        expect(r.fallidas).toBe(1);
        expect(docs.has('users/cortesia/monthly_grants/cortesia-2026-12')).toBe(false);
    });

    it('un marcador sin aplicar (corrida caída) se completa', async () => {
        docs.set('users/cortesia', { subscription: { status: 'active', planId: 'pro' } });
        docs.set('users/cortesia/monthly_grants/cortesia-2026-12', { tipo: 'cortesia', periodo: '2026-12', planId: 'pro' });
        const r = await renovarCuotasDeCortesia(db, DIC);
        expect(r.renovadasPorPlan).toEqual({ pro: 1 });
        expect(escrituras).toHaveLength(3);
    });

    it('si pasó a pagar entre la consulta y la escritura, no se pisa su cuota', async () => {
        docs.set('users/cortesia', { subscription: { status: 'active', planId: 'pro' } });
        const original = db.runTransaction;
        db.runTransaction = async (fn: any) => {
            docs.set('users/cortesia', { subscription: { status: 'active', planId: 'team', id: 'sub_9' } });
            return original(fn);
        };
        try {
            await renovarCuotasDeCortesia(db, DIC);
        } finally {
            db.runTransaction = original;
        }
        expect(escrituras).toEqual([]);
    });

    it('el resumen no guarda uids y una segunda corrida no borra la primera', async () => {
        docs.set('users/cortesia', { subscription: { status: 'active', planId: 'pro' } });
        await renovarCuotasDeCortesia(db, DIC);
        await renovarCuotasDeCortesia(db, new Date(DIC.getTime() + 1000));
        const resumenes = [...docs.keys()].filter(k => k.startsWith('renovaciones_cortesia/'));
        expect(resumenes).toHaveLength(2);
        expect(JSON.stringify(resumenes.map(k => docs.get(k)))).not.toContain('cortesia"');
    });
});
