import { describe, it, expect } from 'vitest';
import { deserializeStep, deserializeThesis } from '../FirestoreExegeticalPaperRepository';

/** Etapa 3.2: la tesis vuelve de Firestore con fechas (llegan como Timestamp) y sin basura. */
const ts = (d: Date) => ({ toDate: () => d });
describe('deserializeThesis', () => {
    it('devuelve el texto, el origen y las fechas como Date', () => {
        const aprobada = new Date('2026-10-31T10:00:00Z');
        const t = deserializeThesis({ text: 'La tesis.', origin: 'proposed', approvedAt: ts(aprobada), updatedAt: ts(aprobada) })!;
        expect(t).toEqual({ text: 'La tesis.', origin: 'proposed', approvedAt: aprobada, updatedAt: aprobada });
    });
    it('un borrador conserva approvedAt nulo; un origen desconocido es del estudiante', () => {
        expect(deserializeThesis({ text: 'Borrador.', origin: 'otro', approvedAt: null })).toMatchObject({ approvedAt: null, origin: 'student' });
    });
    it('sin texto no hay tesis (trabajos anteriores)', () => {
        expect(deserializeThesis(undefined)).toBeNull();
        expect(deserializeThesis({ text: '   ' })).toBeNull();
    });
});

describe('la prosa guardada para deshacer', () => {
    it('vuelve de Firestore con las fechas de sus revisiones como Date', () => {
        const fecha = new Date('2026-11-02T10:00:00Z');
        const v = { id: 'v1', markdown: 'Nueva.', previousProse: { markdown: 'Antes.', undone: true, citationReviews: [{ path: 'prosa@5', note: 'n', reviewedAt: ts(fecha) }] } };
        const paso = deserializeStep({ id: 's', versions: [v], currentId: 'v1', acceptedId: 'v1' });
        expect(paso.accepted!.previousProse).toEqual({ markdown: 'Antes.', undone: true, citationReviews: [{ path: 'prosa@5', note: 'n', reviewedAt: fecha }] });
    });
});
