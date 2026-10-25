import { describe, it, expect, vi } from 'vitest';
import type { IExpositoryAssistant, IExpositoryAssistantCacheRepository } from '@dosfilos/domain';
import { CachedExpositoryAssistant } from '../CachedExpositoryAssistant';

/** Esdras y Daniel avisan de su arameo en el prompt: su caché no puede ser la de antes. */
describe('la caché del planificador por libro', () => {
    const panorama = { payload: { genre: 'narrative' }, modelId: 'm', tokensUsed: 1, passVersion: 'p' };
    const armar = () => {
        const repo = {
            get: vi.fn().mockResolvedValue(null),
            recordHit: vi.fn().mockResolvedValue(undefined),
            upsertPanorama: vi.fn().mockResolvedValue(undefined),
        } as unknown as IExpositoryAssistantCacheRepository;
        const wrapped = { runPanorama: vi.fn().mockResolvedValue(panorama) } as unknown as IExpositoryAssistant;
        return { repo, cached: new CachedExpositoryAssistant(wrapped, repo, 'v1') };
    };
    const entrada = (book: string) => ({ book, displayLanguage: 'es', verses: [] }) as never;

    it('Esdras y Daniel usan una versión propia; los demás libros conservan la suya', async () => {
        for (const [book, version] of [['Esdras', 'v1+arameo'], ['Daniel', 'v1+arameo'], ['Nehemías', 'v1'], ['Génesis', 'v1']] as const) {
            const { repo, cached } = armar();
            await cached.runPanorama(entrada(book));
            expect(repo.get).toHaveBeenCalledWith(expect.any(String), 'es', version);
            expect(repo.upsertPanorama).toHaveBeenCalledWith(expect.any(String), 'es', version, expect.anything(), 'm', 'p');
        }
    });
});
