import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lo que el panel del proyecto hacía con Firebase directo y ahora pasa por
 * `LibraryService` (fase «Escritorio del proyecto», etapa 0): pedir las
 * fuentes por id y «Procesar» una fuente por el camino que corresponde.
 */
const llamadas: Array<{ nombre: string; datos: unknown }> = [];
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: (_f: unknown, nombre: string) => async (datos: unknown) => { llamadas.push({ nombre, datos }); return { data: {} }; },
}));
vi.mock('firebase/firestore', () => ({ doc: () => ({}), getDoc: async () => ({}), getFirestore: () => ({}) }));
const porIds = vi.fn();
vi.mock('@dosfilos/infrastructure', () => ({
    FirebaseLibraryRepository: class { getResourcesByIds = porIds; },
    FirebaseStorageService: class {},
    GeminiEmbeddingService: class {},
    MemoryCacheService: class {},
    FirestoreVectorRepository: class {},
}));

const { LibraryService } = await import('../LibraryService');
const servicio = new LibraryService();

beforeEach(() => { llamadas.length = 0; porIds.mockReset(); });

describe('LibraryService — las fuentes del proyecto', () => {
    it('getResourcesByIds delega en el repositorio con el dueño y los ids', async () => {
        porIds.mockResolvedValue([{ id: 'f1' }]);
        expect(await servicio.getResourcesByIds('u1', ['f1'])).toEqual([{ id: 'f1' }]);
        expect(porIds).toHaveBeenCalledWith('u1', ['f1']);
    });

    it('extraída con la cadena vieja: vuelve a extraer, sin forzar', async () => {
        expect(await servicio.reprocessProjectSource({ id: 'r1', extractionVersion: '2.0-gemini' })).toBe('reextracted');
        expect(llamadas).toEqual([{ nombre: 'reprocessWithLlamaParse', datos: { resourceId: 'r1', force: false } }]);
    });

    it('sin versión de extracción: también vuelve a extraer', async () => {
        expect(await servicio.reprocessProjectSource({ id: 'r1' })).toBe('reextracted');
        expect(llamadas[0]!.nombre).toBe('reprocessWithLlamaParse');
    });

    it('ya con LlamaParse: solo re-indexa, forzado', async () => {
        expect(await servicio.reprocessProjectSource({ id: 'r1', extractionVersion: '3.0-llamaparse' })).toBe('reindexed');
        expect(llamadas).toEqual([{ nombre: 'indexStructuredDocument', datos: { resourceId: 'r1', force: true } }]);
    });
});
