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

describe('datos bibliográficos', () => {
    it('llegan a Firestore: sin esto la bibliografía la sigue inventando el modelo', () => {
        const repo = new FirebaseLibraryRepository();
        const updates = repo.buildFirestoreUpdates({
            bibliography: { author: 'Allen P. Ross', title: 'A Commentary on the Psalms', city: 'Grand Rapids', publisher: 'Kregel', year: '2011' },
        } as never);
        expect(updates.bibliography).toMatchObject({ publisher: 'Kregel', year: '2011' });
    });

    it('`null` los borra; `undefined` no toca lo guardado', () => {
        const repo = new FirebaseLibraryRepository();
        expect(repo.buildFirestoreUpdates({ bibliography: null } as never).bibliography).toBeNull();
        expect('bibliography' in repo.buildFirestoreUpdates({ title: 'x' } as never)).toBe(false);
    });
});

describe('texto escrito por el usuario', () => {
    it('la marca llega a Firestore: de ella depende que el perfil de voz lo encuentre', () => {
        const repo = new FirebaseLibraryRepository();
        expect(repo.buildFirestoreUpdates({ authoredByUser: true } as never).authoredByUser).toBe(true);
        expect(repo.buildFirestoreUpdates({ authoredByUser: false } as never).authoredByUser).toBe(false);
    });

    it('sin tocarla, no viaja: `undefined` no borra lo guardado', () => {
        const repo = new FirebaseLibraryRepository();
        expect('authoredByUser' in repo.buildFirestoreUpdates({ title: 'x' } as never)).toBe(false);
    });
});

describe('autoría al crear el recurso', () => {
    it('la marca viaja al documento nuevo: subir el texto propio es el camino natural', () => {
        const repo = new FirebaseLibraryRepository();
        const doc = (repo as unknown as { resourceToFirestore(r: unknown): Record<string, unknown> })
            .resourceToFirestore({
                userId: 'u1', title: 'Mi ensayo', author: 'Ricardo', type: 'other',
                storageUrl: 'gs://x', authoredByUser: true,
                createdAt: new Date(), updatedAt: new Date(),
            });
        expect(doc.authoredByUser).toBe(true);
    });

    it('sin declararla, no se escribe: ausente significa «no se sabe», no «no es suyo»', () => {
        const repo = new FirebaseLibraryRepository();
        const doc = (repo as unknown as { resourceToFirestore(r: unknown): Record<string, unknown> })
            .resourceToFirestore({
                userId: 'u1', title: 'Un comentario', author: 'Ross', type: 'commentary',
                storageUrl: 'gs://x', createdAt: new Date(), updatedAt: new Date(),
            });
        expect('authoredByUser' in doc).toBe(false);
    });
});
