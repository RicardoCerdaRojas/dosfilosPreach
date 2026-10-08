import type { ChapterStructure, ILanguageStructureProvider, StructureLanguage } from '@dosfilos/domain';

/**
 * Lee la estructura por capítulo que sirve el propio sitio
 * (`/language-data/v1/...`, generada por `scripts/language-structure/build.mjs`
 * a partir de versiones FIJADAS de MACULA, MorphGNT y OSHB).
 *
 * Reemplaza la descarga en el navegador desde GitHub en `@master`: un capítulo
 * pesa 7-30 KB comprimido, contra los 16,7 MB de un libro de MACULA.
 */
export class HostedLanguageStructureProvider implements ILanguageStructureProvider {
    private readonly cache = new Map<string, Promise<ChapterStructure | null>>();

    constructor(
        private readonly baseUrl = '/language-data/v1',
        private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    ) { }

    getChapter(lang: StructureLanguage, book: string, chapter: number): Promise<ChapterStructure | null> {
        const key = `${lang}/${book}/${chapter}`;
        const enCurso = this.cache.get(key);
        if (enCurso) return enCurso;
        const pedido = this.descargar(key).catch(err => {
            // Un fallo de red no se queda guardado: el próximo pedido reintenta.
            this.cache.delete(key);
            throw err;
        });
        this.cache.set(key, pedido);
        return pedido;
    }

    private async descargar(key: string): Promise<ChapterStructure | null> {
        const res = await this.fetchImpl(`${this.baseUrl}/${key}.json`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`language-data ${key}: HTTP ${res.status}`);
        // El hosting reescribe toda ruta inexistente a index.html con 200: un
        // capítulo que no existe llega como HTML, no como 404.
        if (!(res.headers.get('content-type') ?? '').includes('json')) return null;
        return (await res.json()) as ChapterStructure;
    }
}
