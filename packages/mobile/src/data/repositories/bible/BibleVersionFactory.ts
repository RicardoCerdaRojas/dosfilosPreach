import { IBibleVersionRepository } from '@/domain/bible/ports/IBibleVersionRepository';
import { RVR1960Repository } from './RVR1960Repository';
import { ASVRepository } from './ASVRepository';

/**
 * Registry of available Bible versions
 */
const VERSIONS = [
    { id: 'RVR1960', name: 'Reina Valera 1960', language: 'es', repoClass: RVR1960Repository },
    { id: 'ASV', name: 'American Standard Version', language: 'en', repoClass: ASVRepository }
];

/**
 * Factory for creating Bible version repositories
 */
export class BibleVersionFactory {
    private static repositories = new Map<string, IBibleVersionRepository>();

    static getForLocale(locale: string): IBibleVersionRepository {
        const language = locale.startsWith('en') ? 'en' : 'es';
        const version = VERSIONS.find(v => v.language === language) || VERSIONS[0];
        return this.getByVersion(version.id);
    }

    /**
     * El id se normaliza a MAYÚSCULAS antes de buscar.
     *
     * El catálogo los tiene como `RVR1960`/`ASV` y la interfaz los pide como
     * `rvr1960`/`asv`. La comparación era exacta, así que NINGUNO de los dos
     * encontraba nada y todo caía en el `|| VERSIONS[0]` — que devuelve la
     * Reina Valera. Por eso pedir la ASV entregaba otra vez la RVR y el
     * paralelo mostraba dos veces el mismo texto: no fallaba, mentía.
     */
    static getByVersion(versionId: string): IBibleVersionRepository {
        const id = versionId.toUpperCase();
        if (!this.repositories.has(id)) {
            const versionConfig = VERSIONS.find(v => v.id === id) || VERSIONS[0];
            const repo = new versionConfig.repoClass();
            this.repositories.set(id, repo);
        }

        return this.repositories.get(id)!;
    }

    static getAllVersions(): { id: string; name: string; language: string }[] {
        return VERSIONS.map(({ id, name, language }) => ({ id, name, language }));
    }
}

/**
 * El mismo libro en otra versión (C1).
 *
 * Los ids NO cruzan entre versiones: en la RVR Jonás es `jn`, y en la ASV
 * `Jn` resuelve como alias de Juan. Cambiar de versión sin traducir por el
 * id canónico abría Juan en vez de Jonás —pasaba en la Biblia dentro del
 * atril—, o Génesis si el id no existía. El lector ya lo hacía bien; ahora
 * los dos usan esta función.
 */
export function bookIdInVersion(fromVersionId: string, toVersionId: string, bookId: string): string | null {
    const from = BibleVersionFactory.getByVersion(fromVersionId);
    const to = BibleVersionFactory.getByVersion(toVersionId);
    if (!from || !to) return null;
    return to.getBookIdForCanonical(from.getCanonicalBookId(bookId));
}
