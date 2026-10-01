import { describe, it, expect } from 'vitest';
import { deriveCitationKeyFromAuthor, workTitleFromLabel } from '../citationKeyFromAuthor';

describe('deriveCitationKeyFromAuthor', () => {
    it('apellido según la forma del autor', () => {
        expect(deriveCitationKeyFromAuthor('Daniel B. Wallace')).toBe('Wallace');
        expect(deriveCitationKeyFromAuthor('Bauckham, Richard')).toBe('Bauckham');
        expect(deriveCitationKeyFromAuthor('Barrick & Busenitz')).toBe('Barrick');
        expect(deriveCitationKeyFromAuthor('deSilva')).toBe('deSilva');
    });

    it('sin autor no inventa una clave', () => {
        expect(deriveCitationKeyFromAuthor('')).toBe('');
        expect(deriveCitationKeyFromAuthor(null)).toBe('');
    });
});

/**
 * La cita salió «(McCartney, James — Baker Exegetical Commentary on the New
 * Testament, 173)»: sin título en la ficha, el rótulo del archivo entero hacía
 * de título (TP Santiago 2:14-26).
 */
describe('workTitleFromLabel', () => {
    it('corta la colección pegada al título', () => {
        expect(workTitleFromLabel('James — Baker Exegetical Commentary on the New Testament')).toBe('James');
        expect(workTitleFromLabel('Santiago – Comentario Bíblico Mundo Hispano')).toBe('Santiago');
    });

    it('un rótulo sin colección queda igual', () => {
        expect(workTitleFromLabel('A Grammar of the Greek New Testament')).toBe('A Grammar of the Greek New Testament');
        expect(workTitleFromLabel('Romanos — una lectura pastoral')).toBe('Romanos — una lectura pastoral');
    });
});
