import { parseBibleReferenceParts } from '@dosfilos/domain';
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

/**
 * El texto de una referencia escrita en el manuscrito, en la versión del
 * pastor (RVR1960 por defecto). Acepta «.» como separador («Sal 103.8»).
 * `null` si no se puede leer: la capa lo dice en vez de inventar.
 */
export function verseTextFor(reference: string, versionId = 'rvr1960'): string | null {
    const repo = BibleVersionFactory.getByVersion(versionId);
    if (!repo) return null;
    return repo.getVerses(reference) ?? repo.getVerses(reference.replace(/(\d)\.(\d)/, '$1:$2'));
}

export interface ReadingPassage {
    /** Cómo se anuncia: «Jonás 4:5-11». */
    title: string;
    verses: { number: number; text: string }[];
}

/**
 * El pasaje del sermón, listo para leerlo en voz alta (C7, «Lectura»).
 *
 * Antes de predicar se lee el texto, y el pastor tenía que salir del sermón,
 * abrir la Biblia y buscarlo con la congregación esperando. Toma la PRIMERA
 * referencia que se pueda leer; sin versículos, el capítulo entero.
 */
export function readingPassageFor(references: readonly string[], versionId = 'rvr1960'): ReadingPassage | null {
    const repo = BibleVersionFactory.getByVersion(versionId);
    if (!repo) return null;
    for (const reference of references) {
        const parts = parseBibleReferenceParts(reference);
        if (!parts) continue;
        const bookId = repo.resolveBookId(parts.bookKey);
        const chapter = repo.getChapterContent(bookId, parts.chapter);
        if (!chapter?.length) continue;
        const from = parts.verseStart > 0 ? parts.verseStart : 1;
        const to = parts.verseStart > 0 ? (parts.verseEnd ?? parts.verseStart) : chapter.length;
        const verses = chapter
            .slice(from - 1, to)
            .map((text, i) => ({ number: from + i, text }))
            .filter((v) => v.text);
        if (verses.length) return { title: reference.trim(), verses };
    }
    return null;
}
