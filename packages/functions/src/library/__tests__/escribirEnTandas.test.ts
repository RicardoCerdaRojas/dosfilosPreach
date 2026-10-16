import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v2/https', () => ({ onCall: (_o: unknown, h: unknown) => h, HttpsError: class extends Error {} }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({}) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: { vector: (v: number[]) => v } }));
const { escribirEnTandas } = await import('../indexStructuredDocument');

/** Una base que rechaza las tandas de más de `tope` escrituras, como Firestore con «Transaction too big». */
function baseConTope(tope: number, mensaje = '3 INVALID_ARGUMENT: Transaction too big. Decrease transaction size.') {
    const escritos: string[] = [];
    const tandas: number[] = [];
    const db = {
        batch: () => {
            const pendientes: string[] = [];
            return {
                set: (ref: { id: string }) => { pendientes.push(ref.id); },
                commit: async () => {
                    tandas.push(pendientes.length);
                    if (pendientes.length > tope) throw new Error(mensaje);
                    escritos.push(...pendientes);
                },
            };
        },
    };
    return { db: db as unknown as FirebaseFirestore.Firestore, escritos, tandas };
}
const escrituras = (n: number) => Array.from({ length: n }, (_, i) => [{ id: `c${i}` }, {}] as unknown as [FirebaseFirestore.DocumentReference, FirebaseFirestore.DocumentData]);

describe('escribirEnTandas', () => {
    it('una tanda que entra se escribe de una vez', async () => {
        const { db, escritos, tandas } = baseConTope(500);
        await escribirEnTandas(db, escrituras(500));
        expect(tandas).toEqual([500]);
        expect(escritos).toHaveLength(500);
    });

    it('una tanda demasiado grande se parte hasta que entra, sin perder ni repetir', async () => {
        const { db, escritos } = baseConTope(100);
        await escribirEnTandas(db, escrituras(500));
        expect(escritos).toEqual(Array.from({ length: 500 }, (_, i) => `c${i}`));
    });

    it('otro error no se reintenta', async () => {
        const { db, tandas } = baseConTope(0, 'PERMISSION_DENIED');
        await expect(escribirEnTandas(db, escrituras(10))).rejects.toThrow('PERMISSION_DENIED');
        expect(tandas).toEqual([10]);
    });
});
