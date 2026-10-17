import { beforeEach, describe, expect, it, vi } from 'vitest';

let reclamada: string | null = null;
let fallaFirestore = false;
const anotaciones: Array<Record<string, unknown>> = [];

vi.mock('firebase-functions/v2/https', async (orig) => ({ ...(await orig<object>()), onCall: (_o: unknown, h: unknown) => h }));
vi.mock('firebase-functions/v2/scheduler', () => ({ onSchedule: (_o: unknown, h: unknown) => h }));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => ({ collection: () => ({ doc: () => ({ set: async (d: Record<string, unknown>) => { anotaciones.push(d); } }) }) }),
    FieldValue: { increment: (n: number) => ({ inc: n }), serverTimestamp: () => 'ahora' },
}));
vi.mock('../reservasDeExegesis', async (orig) => ({
    ...(await orig<object>()),
    reclamarReserva: async () => { if (fallaFirestore) throw new Error('caído'); return reclamada; },
}));
const { cobrarLlamadaDeExegesis, MOTIVO_RESERVA_REQUERIDA } = await import('../cobroDeExegesis');

beforeEach(() => { reclamada = null; fallaFirestore = false; anotaciones.length = 0; });

describe('cobrarLlamadaDeExegesis', () => {
    it('una etiqueta que no cobra pasa sin mirar ni anotar', async () => {
        await expect(cobrarLlamadaDeExegesis('u', 'sermon.consult', 'obligatorio')).resolves.toBeUndefined();
        expect(anotaciones).toHaveLength(0);
    });

    it('con reserva pasa, y lo anota', async () => {
        reclamada = 'r1';
        await expect(cobrarLlamadaDeExegesis('u', 'exegesis.analyzeVerse', 'obligatorio')).resolves.toBeUndefined();
        expect(anotaciones[0]).toMatchObject({ conReserva: { exegesis_analyzeVerse: { inc: 1 } } });
    });

    it('sin reserva: en sombra pasa (y lo anota como sin reserva); en obligatorio se rechaza', async () => {
        await expect(cobrarLlamadaDeExegesis('u', 'exegesis.analyzeVerse', 'sombra')).resolves.toBeUndefined();
        expect(anotaciones[0]).toMatchObject({ sinReserva: { exegesis_analyzeVerse: { inc: 1 } } });
        await expect(cobrarLlamadaDeExegesis('u', 'exegesis.analyzeVerse', 'obligatorio')).rejects.toMatchObject({
            code: 'failed-precondition', details: { reason: MOTIVO_RESERVA_REQUERIDA },
        });
    });

    it('si Firestore falla: en sombra pasa; en obligatorio no hay modelo sin reserva comprobada', async () => {
        fallaFirestore = true;
        await expect(cobrarLlamadaDeExegesis('u', 'exegesis.analyzeVerse', 'sombra')).resolves.toBeUndefined();
        await expect(cobrarLlamadaDeExegesis('u', 'exegesis.analyzeVerse', 'obligatorio')).rejects.toMatchObject({ code: 'unavailable' });
    });
});
