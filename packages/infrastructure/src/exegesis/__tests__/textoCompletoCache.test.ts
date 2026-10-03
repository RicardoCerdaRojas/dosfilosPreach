import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let respuestas: string[] = [];
let pedidos = 0;
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => async () => ({ data: { text: respuestas[pedidos++] ?? '', chunkCount: 0 } }),
}));

const { fetchDocumentText, invalidateDocumentCaches } = await import('../DocumentPageIndexClient');
const { MAX_SOURCES_PER_CALL } = await import('../CallableCuratedCorpusRetriever');

/** Revisión adversarial de E2 y A4. */
describe('fetchDocumentText — caché', () => {
    beforeEach(() => { respuestas = []; pedidos = 0; });

    it('un documento todavía sin indexar no queda vacío toda la sesión', async () => {
        respuestas = ['', 'ya indexado'];
        expect(await fetchDocumentText('r1')).toBe('');
        await Promise.resolve();
        expect(await fetchDocumentText('r1')).toBe('ya indexado');
    });

    it('con texto se cachea, y la re-indexación lo olvida', async () => {
        respuestas = ['v1', 'v2'];
        expect(await fetchDocumentText('r2')).toBe('v1');
        expect(await fetchDocumentText('r2')).toBe('v1');
        invalidateDocumentCaches('r2');
        expect(await fetchDocumentText('r2')).toBe('v2');
    });
});

describe('tandas del recuperador — paridad con la callable', () => {
    it('el tamaño de tanda no pasa el tope que acepta retrieveCuratedCorpus', () => {
        // Si functions baja su tope, cada tanda se rechaza entera y todas sus
        // fuentes callan: el defecto que las tandas vinieron a cerrar.
        const src = readFileSync(join(__dirname, '../../../../functions/src/library/retrieveCuratedCorpus.ts'), 'utf8');
        const tope = Number(src.match(/const MAX_SOURCES = (\d+)/)?.[1]);
        expect(tope).toBeGreaterThan(0);
        expect(MAX_SOURCES_PER_CALL).toBeLessThanOrEqual(tope);
    });
});
