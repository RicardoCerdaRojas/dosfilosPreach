import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toFirestoreLog } from '../preachingLogMapping';

describe('registro de predicación ↔ Firestore', () => {
    it('sin notas no manda el campo: arrayRemove compara el mapa entero', () => {
        const log = { date: new Date('2026-10-04T15:00:00Z'), location: '', durationMinutes: 0 };
        expect(toFirestoreLog(log)).toEqual({ date: log.date, location: '', durationMinutes: 0 });
    });

    it('agregar y quitar usan la MISMA forma (no dos copias a mano)', () => {
        const fuente = readFileSync(join(__dirname, '../sermon.repository.impl.ts'), 'utf8');
        expect(fuente).toContain('arrayUnion(toFirestoreLog(log))');
        expect(fuente).toContain('arrayRemove(toFirestoreLog(log))');
    });
});
