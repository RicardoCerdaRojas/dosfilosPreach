import { describe, it, expect } from 'vitest';
import { citedVerses } from '../bibleReferencePattern';
import { LocalBibleService } from '@/services/LocalBibleService';

/**
 * Chat de consulta del Taller: los versículos que nombra el asistente se
 * muestran con el texto REAL de la Biblia, y el que no existe se marca.
 */
describe('citedVerses', () => {
    const lookup = {
        verses: (r: string) => LocalBibleService.getVerses(r),
        readable: (r: string) => LocalBibleService.isValidBook(r.replace(/\s*\d+[:.]\d+.*$/, '').trim()),
    };

    it('trae el texto real de cada referencia, una vez', () => {
        const v = citedVerses('Mira Jonás 4:2 y también el Salmo 103:8; de nuevo Jonás 4:2.', lookup);
        expect(v.map(x => x.reference)).toEqual(['Jonás 4:2', 'Salmo 103:8']);
        expect(v[0]!.text).toMatch(/clemente y piadoso/i);
        expect(v[1]!.text).toBeTruthy();
    });

    it('una referencia que no existe queda sin texto (se marca en pantalla)', () => {
        const [v] = citedVerses('Como dice Jonás 4:30, Dios se compadece.', lookup);
        expect(v).toEqual({ reference: 'Jonás 4:30', status: 'missing', text: null });
    });

    it('una abreviatura que la Biblia local no lee no se acusa de inexistente (revisión adversarial de R3)', () => {
        const v = citedVerses('Como en Mi 6:8.', lookup);
        expect(v.map(x => x.status)).not.toContain('missing');
    });

    it('«Sal. 103:8» con punto se detecta, y un rango entre capítulos se comprueba por su inicio', () => {
        const v = citedVerses('Ver Sal. 103:8 y Juan 3:16-4:2.', lookup);
        expect(v.map(x => [x.reference, x.status])).toEqual([['Sal. 103:8', 'found'], ['Juan 3:16-4:2', 'found']]);
    });
});
