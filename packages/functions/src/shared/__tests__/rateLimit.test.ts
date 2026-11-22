import { describe, expect, it } from 'vitest';
import { rateLimitDocId, windowIsFull } from '../rateLimit';

describe('windowIsFull', () => {
    const NOW = 1_000_000;
    const HOUR = 3_600_000;

    it('las marcas fuera de la ventana no cuentan', () => {
        const viejas = [NOW - HOUR - 1, NOW - HOUR - 2, NOW - HOUR - 3];
        expect(windowIsFull(viejas, NOW, HOUR, 3)).toBe(false);
    });

    it('topa al alcanzar el máximo, no al superarlo', () => {
        const recientes = [NOW - 10, NOW - 20, NOW - 30];
        expect(windowIsFull(recientes, NOW, HOUR, 3)).toBe(true);
        expect(windowIsFull(recientes, NOW, HOUR, 4)).toBe(false);
    });

    it('la basura en el array no rompe el conteo', () => {
        const sucio = [NOW - 10, null as unknown as number, 'x' as unknown as number];
        expect(windowIsFull(sucio, NOW, HOUR, 2)).toBe(false);
    });
});

describe('rateLimitDocId', () => {
    it('sanea la identidad para usarla como id de documento', () => {
        expect(rateLimitDocId('llm_proxy', 'uid/con/barras')).toBe('llm_proxy__uid_con_barras');
    });

    it('recorta identidades absurdamente largas', () => {
        expect(rateLimitDocId('b', 'x'.repeat(200)).length).toBeLessThanOrEqual(83);
    });
});

describe('la unificación no puede perder los contadores existentes', () => {
    it('produce el MISMO id de documento que la copia local de captureLead', () => {
        // `captureLead` tenía su propia copia del limitador que escribía en
        // `lead_magnet__<ip>`. Al pasar a la util compartida, si el id cambiara
        // los contadores vivos se reiniciarían y cada bot recuperaría su cuota
        // el día del despliegue — la protección se apagaría sola, en silencio.
        const ip = '203.0.113.7';
        const idViejo = `lead_magnet__${ip.replace(/[^a-zA-Z0-9.:_-]/g, '_').slice(0, 80)}`;

        expect(rateLimitDocId('lead_magnet', ip)).toBe(idViejo);
    });

    it('el primer salto de x-forwarded-for es el que identifica al cliente', () => {
        // La cadena llega como "cliente, proxy1, proxy2". Limitar por la cadena
        // entera daría una identidad distinta por cada ruta de proxies, y el
        // mismo bot pasaría el tope tantas veces como caminos encuentre.
        const cadena = '203.0.113.7, 70.41.3.18, 150.172.238.178';
        const primerSalto = cadena.split(',')[0]!.trim();

        expect(rateLimitDocId('lead_magnet', primerSalto)).toBe('lead_magnet__203.0.113.7');
        expect(rateLimitDocId('lead_magnet', primerSalto)).not.toBe(rateLimitDocId('lead_magnet', cadena));
    });
});

describe('consumeRateLimitToken — atómico (revisión de A9)', () => {
    it('lee y escribe en una transacción: dos pedidos seguidos no ven el mismo contador', async () => {
        const { consumeRateLimitToken } = await import('../rateLimit');
        const docs = new Map<string, Record<string, unknown>>();
        let transacciones = 0;
        const db = {
            collection: () => ({ doc: (id: string) => ({ id }) }),
            runTransaction: async (fn: (tx: unknown) => Promise<boolean>) => {
                transacciones++;
                return fn({
                    get: async (ref: { id: string }) => ({ exists: docs.has(ref.id), data: () => docs.get(ref.id) }),
                    set: (ref: { id: string }, d: Record<string, unknown>) => { docs.set(ref.id, { ...(docs.get(ref.id) ?? {}), ...d }); },
                });
            },
        } as unknown as FirebaseFirestore.Firestore;
        const opts = { bucket: 'b', key: 'k', windowMs: 60_000, max: 2 };
        expect(await consumeRateLimitToken(db, opts)).toBe(true);
        expect(await consumeRateLimitToken(db, opts)).toBe(true);
        expect(await consumeRateLimitToken(db, opts)).toBe(false);
        expect(transacciones).toBe(3);
    });
});
