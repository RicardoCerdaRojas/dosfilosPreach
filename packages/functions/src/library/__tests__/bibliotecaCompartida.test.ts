import { describe, expect, it, vi, beforeEach } from 'vitest';

let lecturas = 0;
let falla = false;
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: () => ({
        collection: () => ({
            where: () => ({
                select: () => ({
                    get: async () => {
                        lecturas++;
                        await new Promise(r => setTimeout(r, 5));
                        if (falla) throw new Error('UNAVAILABLE');
                        return { docs: [{ id: 'jfb', data: () => ({ publiclyCitable: true, pageCount: 0 }) }, { id: 'p', data: () => ({}) }] };
                    },
                }),
            }),
        }),
    }),
}));
const { aRecursoCompartido, duenoDe, legibles, olvidarRecursosCompartidos, recursosCompartidos } = await import('../bibliotecaCompartida');

beforeEach(() => { lecturas = 0; falla = false; olvidarRecursosCompartidos(); });

describe('bibliotecaCompartida (A8c)', () => {
    it('el texto solo si es citable públicamente; sin permiso, ni se pide', async () => {
        const m = await recursosCompartidos();
        expect(legibles(m)).toEqual(['jfb']);
        expect(duenoDe('jfb', 'yo', m)).toBe('__system__');
        expect(duenoDe('p', 'yo', m)).toBeNull();
        expect(duenoDe('mio', 'yo', m)).toBe('yo');
    });

    it('se cita por sección solo un texto sin páginas: JFB sí; un PDF sin calibrar o con páginas, no', () => {
        expect(aRecursoCompartido('jfb', { pageCount: 0 }).citaPorSeccion).toBe(true);
        expect(aRecursoCompartido('pdf', { pageCount: 540 }).citaPorSeccion).toBe(false);
        expect(aRecursoCompartido('c', { pageCount: 0, pageNumbering: { segments: [{ offset: -10 }] } }).citaPorSeccion).toBe(false);
        expect(aRecursoCompartido('m', { pageCount: 0, pageNumbering: { segments: [{ offset: null }], sheetPages: { 5: {} } } }).citaPorSeccion).toBe(false);
        expect(aRecursoCompartido('n', { pageCount: 1, pageNumbering: { segments: [{ offset: null }] } }).citaPorSeccion).toBe(true);
    });

    it('dos búsquedas en paralelo con la caché fría leen una sola vez, y después sale de la caché', async () => {
        await Promise.all([recursosCompartidos(), recursosCompartidos()]);
        await recursosCompartidos();
        expect(lecturas).toBe(1);
    });

    it('si no se puede leer, sigue sin la biblioteca compartida (nadie lee un compartido)', async () => {
        falla = true;
        const m = await recursosCompartidos();
        expect(m.size).toBe(0);
        expect(duenoDe('jfb', 'yo', m)).toBe('yo');
    });
});
