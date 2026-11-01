import { describe, it, expect } from 'vitest';
import { deserializeThesis } from '../FirestoreExegeticalPaperRepository';

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
