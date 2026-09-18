import {
    citationAnchorFor,
    isCitableSourceType,
    type BibliographicData,
    type ComposerSourceMetadata,
    type ExegeticalPaper,
    type IBibliographyReader,
    type ICuratedCorpusReader,
    type IPageNumberingReader,
    type IResourceContentReader,
    type ProjectSource,
} from '@dosfilos/domain';
import { loadSourceNumberings } from './sourceNumberings';

/**
 * Lectores con los que se arma el texto de las fuentes asignadas a un paso de
 * composición (paper completo, conclusión, introducción).
 */
export interface PinnedContentReaders {
    /**
     * Datos de portada de cada fuente. Sin él se cita con la clave y el
     * nombre del archivo, que es como estaba.
     */
    bibliography?: IBibliographyReader;
    contentReader: IResourceContentReader;
    /** Lee las hojas que la fuente admite. Sin él se cae al texto completo. */
    corpusReader?: ICuratedCorpusReader;
    /** Numeración impresa, para rotular cada fragmento con su página. */
    pageNumbering?: IPageNumberingReader;
}

/**
 * Fuentes citables del trabajo; las asignadas al paso llevan su contenido.
 *
 * El contenido de una fuente asignada son LAS HOJAS QUE EL PASTOR ELIGIÓ
 * (`excerptRecipe.sheetRanges`), rotuladas con su página impresa. Antes era el
 * texto completo del libro, y el compositor lo cortaba en sus primeros 80.000
 * caracteres: en un comentario de 900 páginas eso es la introducción general y
 * los primeros salmos, nunca la perícopa. La conclusión de un trabajo sobre
 * Sal 23 se «ancló» en el arranque del comentario de Ross.
 *
 * Una fuente sin receta —adjuntada antes del selector de páginas— o cuya
 * lectura por hojas falle cae al texto completo, que es lo que había.
 *
 * Vive aparte porque estaba copiada en tres casos de uso, y las tres copias
 * tenían el mismo defecto.
 */
/**
 * La ficha de una fuente tal como la ve el compositor.
 *
 * Manda lo que una persona copió de la portada; lo que falte se queda
 * fuera. Antes esto era `author: key, title: displayLabel` —la clave de
 * cita y el nombre del archivo— y el modelo completaba ciudad, editorial
 * y año por su cuenta: así llegaron datos inventados al trabajo de
 * Salmo 23.
 */
export async function composerSourceOf(
    source: ProjectSource,
    reader?: IBibliographyReader,
): Promise<ComposerSourceMetadata> {
    const key = source.citationKey ?? deriveCitationKey(source.displayLabel);
    const fallback: ComposerSourceMetadata = { citationKey: key, author: key, title: source.displayLabel };
    if (!reader) return fallback;

    const resourceId = source.sourceLibraryResourceId ?? source.corpusId;
    const data = await reader.bibliographyFor(resourceId).catch(() => null);
    if (!data) return fallback;

    return {
        citationKey: key,
        author: (data.author ?? '').trim() || key,
        title: (data.title ?? '').trim() || source.displayLabel,
        ...(data.subtitle?.trim() ? { subtitle: data.subtitle.trim() } : {}),
        ...(seriesVolumeOf(data) ? { seriesVolume: seriesVolumeOf(data) } : {}),
        ...(data.city?.trim() ? { city: data.city.trim() } : {}),
        ...(data.publisher?.trim() ? { publisher: data.publisher.trim() } : {}),
        ...(data.year?.trim() && Number.isFinite(Number(data.year)) ? { year: Number(data.year) } : {}),
        ...(data.edition?.trim() ? { edition: data.edition.trim() } : {}),
    };
}

/** «Kregel Exegetical Library 1» — serie y volumen, como los pide el compositor. */
function seriesVolumeOf(data: BibliographicData): string | undefined {
    const parts = [data.series?.trim(), data.volume?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : undefined;
}

export async function buildComposerSourcesWithPinnedContent(
    paper: ExegeticalPaper,
    pinnedIds: ReadonlySet<string>,
    readers: PinnedContentReaders,
): Promise<ComposerSourceMetadata[]> {
    const citable = paper.sources.filter(s => isCitableSourceType(s.sourceType));
    const pinned = citable.filter(s => pinnedIds.has(s.id));
    const numberings = await loadSourceNumberings(readers.pageNumbering, pinned);

    return Promise.all(citable.map(async s => {
        const base: ComposerSourceMetadata = {
            ...await composerSourceOf(s, readers.bibliography),
            isPinned: pinnedIds.has(s.id),
        };
        if (!base.isPinned) return base;

        const admitted = await readAdmittedText(s, readers.corpusReader, numberings.get(s.id) ?? null);
        if (admitted) return { ...base, textContent: admitted };

        try {
            const text = await readers.contentReader.getTextContent(s.corpusId);
            return { ...base, textContent: text ?? '' };
        } catch (err) {
            console.warn('[compose] failed to load pinned source textContent:', s.corpusId, err);
            return base;
        }
    }));
}

async function readAdmittedText(
    source: ProjectSource,
    corpusReader: ICuratedCorpusReader | undefined,
    numbering: Parameters<typeof citationAnchorFor>[1],
): Promise<string | null> {
    const sheetRanges = source.excerptRecipe?.sheetRanges;
    if (!corpusReader || !sheetRanges || sheetRanges.length === 0) return null;
    const resourceId = source.sourceLibraryResourceId ?? source.corpusId;
    try {
        const chunks = await corpusReader.readAdmitted({ resourceId, sheetRanges });
        const text = chunks
            .filter(c => c.text.trim().length > 0)
            .map(c => {
                const anchor = citationAnchorFor({ sheet: c.sheet ?? null, section: c.section ?? null }, numbering);
                return anchor ? `--- ${anchor} ---\n${c.text}` : c.text;
            })
            .join('\n\n');
        return text.trim() ? text : null;
    } catch (err) {
        // Una fuente que no se pudo leer por hojas no tumba la composición: se
        // sigue con el texto completo, y queda en el log por qué.
        console.warn('[compose] no se pudieron leer las hojas de la fuente asignada; se usa el texto completo:', resourceId, err);
        return null;
    }
}

/**
 * Clave de cita corta cuando el pastor no fijó una: la primera palabra
 * significativa del rótulo. Misma heurística que `GenerateStepUseCase`.
 */
export function deriveCitationKey(displayLabel: string): string {
    const trimmed = (displayLabel ?? '').trim();
    if (!trimmed) return 'Source';
    return trimmed.split(/[\s,;:.\-—]+/)[0] || 'Source';
}
