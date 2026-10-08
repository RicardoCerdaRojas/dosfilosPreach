import { describe, it, expect, vi, beforeEach } from 'vitest';

/** G0 (fase módulos de idioma): «Re-analizar» borraba la traducción corregida por el usuario. */
const setDoc = vi.fn(); const updateDoc = vi.fn(); const getDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
    doc: (_db: unknown, _c: string, id: string) => ({ id }),
    getDoc: (...a: unknown[]) => getDoc(...a), setDoc: (...a: unknown[]) => setDoc(...a), updateDoc: (...a: unknown[]) => updateDoc(...a),
    collection: vi.fn(), getDocs: vi.fn(),
}));
vi.mock('../../config/firebase', () => ({ db: {} }));
const { FirebaseHebrewSessionRepository } = await import('../repositories/FirebaseHebrewSessionRepository');

beforeEach(() => { setDoc.mockReset(); updateDoc.mockReset(); getDoc.mockReset(); });

describe('la traducción que corrige el usuario', () => {
    it('REGRESIÓN: se guarda aparte del análisis generado', async () => {
        await new FirebaseHebrewSessionRepository().updateTranslation('Ruth.1.17', { fluidTranslation: 'Así me haga YHWH' });
        expect(updateDoc.mock.calls[0]![1]).toEqual({ 'userTranslations.fluid': 'Así me haga YHWH' });
    });

    it('REGRESIÓN: guardar un análisis nuevo reemplaza sólo lo generado', async () => {
        await new FirebaseHebrewSessionRepository().cacheAnalysis('Ruth.1.17', { literalTranslation: 'x' } as never);
        expect(setDoc.mock.calls[0]![2]).toEqual({ mergeFields: ['reference', 'analysis', 'cachedAt', 'usageCount'] });
    });

    it('al leer, la corrección del usuario va encima del análisis', async () => {
        getDoc.mockResolvedValue({ exists: () => true, data: () => ({ analysis: { literalTranslation: 'así hará', fluidTranslation: 'f' }, userTranslations: { literal: 'así haga' } }) });
        const a = await new FirebaseHebrewSessionRepository().getCachedAnalysis('Ruth.1.17');
        expect(a).toMatchObject({ literalTranslation: 'así haga', fluidTranslation: 'f' });
    });
});
