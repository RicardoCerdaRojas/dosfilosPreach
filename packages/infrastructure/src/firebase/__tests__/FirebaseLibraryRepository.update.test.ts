import { describe, it, expect } from 'vitest';
import type { PageNumbering } from '@dosfilos/domain';
import { FirebaseLibraryRepository } from '../FirebaseLibraryRepository';

/**
 * `update` arma su payload con una LISTA BLANCA: lo que no está enumerado se
 * descarta sin avisar. La numeración impresa estuvo así en producción — la
 * pantalla de calibración guardaba, la escritura llegaba a Firestore con
 * `updatedAt` y nada más, y el recurso seguía diciendo `origin: 'detected'`.
 * Desde afuera era indistinguible de un guardado exitoso, y sólo se vio
 * leyendo Firestore a mano.
 *
 * Se prueba el constructor del payload y no `update` entero porque el
 * alternativo pide Firestore vivo. Es el mismo criterio que
 * `FirebaseSeriesRepository.test.ts`.
 */
const repo = new FirebaseLibraryRepository();
const build = (u: any) => repo.buildFirestoreUpdates(u);

const numeracion: PageNumbering = {
    origin: 'confirmed',
    segments: [
        { fromSheet: 1, toSheet: 220, offset: -4 },
        { fromSheet: 221, toSheet: 240, offset: null },
    ],
};

describe('FirebaseLibraryRepository — payload de actualización', () => {
    it('deja pasar la numeración impresa', () => {
        expect(build({ pageNumbering: numeracion })).toEqual({ pageNumbering: numeracion });
    });

    it('conserva el origen confirmado, que es lo que habilita citar «p. N»', () => {
        const out = build({ pageNumbering: numeracion }) as { pageNumbering: PageNumbering };
        expect(out.pageNumbering.origin).toBe('confirmed');
    });

    it('conserva un tramo sin numeración arábiga', () => {
        // `null` es un valor legítimo: hay libros con preliminares en romanos.
        // Perderlo convertiría un hecho del libro en un hueco.
        const out = build({ pageNumbering: numeracion }) as { pageNumbering: PageNumbering };
        expect(out.pageNumbering.segments[1]!.offset).toBeNull();
    });

    it('permite borrar la numeración con null', () => {
        expect(build({ pageNumbering: null })).toEqual({ pageNumbering: null });
    });

    it('no inventa el campo cuando no se pidió cambiarlo', () => {
        expect(build({ title: 'Otro título' })).not.toHaveProperty('pageNumbering');
    });

    it('nunca emite undefined, que Firestore rechaza', () => {
        const out = build({ pageNumbering: numeracion, title: 'x', author: undefined });
        expect(Object.values(out).every(v => v !== undefined)).toBe(true);
    });
});
