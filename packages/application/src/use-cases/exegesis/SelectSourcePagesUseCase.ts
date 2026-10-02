import {
    chunkRangesForSheets,
    clipRangesTo,
    computeExtractionFingerprint,
    formatPassageReference,
    normalizeSheetRanges,
    type ExcerptRecipe,
    type ExcerptSelectionMode,
    type IDocumentChunkReader,
    type IExegeticalPaperRepository,
    type PageIndexEntry,
    type ProjectSource,
    type ProjectSourceExcerpt,
    type SheetRange,
    type SourceRole,
    type SourceType,
} from '@dosfilos/domain';

/**
 * Materializa la elección del selector de páginas.
 *
 * El usuario eligió hojas; el prompt consume fragmentos. Este caso de uso hace
 * la traducción y guarda las DOS cosas: los `excerpts`, que son lo que se le
 * manda al modelo, y la `excerptRecipe`, que es lo que el usuario pidió.
 *
 * Guardar la receta es lo que permite reabrir el selector con la selección
 * intacta, distinguir lo que propuso el sistema de lo que agregó el usuario, y
 * avisar que la selección quedó vieja cuando cambia el pasaje del trabajo —en
 * vez de servir fragmentos de otro pasaje en silencio.
 *
 * Reusa una fuente existente cuando el documento ya está adjunto al trabajo, en
 * vez de crear una segunda. Sin eso, re-elegir páginas dejaría el mismo libro
 * dos veces en el corpus, que es exactamente lo que pasa hoy con la extracción
 * de fragmentos cuando la fuente no guarda el backref a la biblioteca.
 */

export interface SelectSourcePagesInput {
    ownerId: string;
    paperId: string;
    /** Recurso de biblioteca del que se eligieron las hojas. */
    libraryResourceId: string;
    displayLabel: string;
    sourceType: SourceType;
    /** Rol dialéctico elegido por el pastor. Sin él, lo resuelve el tipo. */
    chosenRole?: SourceRole | null;
    citationKey?: string | null;
    /** Lo que quedó en el carrito. */
    sheetRanges: ReadonlyArray<SheetRange>;
    /** Lo que el sistema había propuesto, aceptado o no. */
    proposedRanges: ReadonlyArray<SheetRange>;
    /** Tramos que entran a todos los pasos sin competir en el ranking. */
    pinnedRanges?: ReadonlyArray<SheetRange>;
    /** Índice de hojas del documento, ya cargado por la interfaz. */
    pageIndex: ReadonlyArray<PageIndexEntry>;
    /**
     * De dónde salió la selección. `'manual'` cuando el usuario la armó o la
     * corrigió en el selector; el modo de la propuesta cuando se aceptó tal
     * cual. Distinguirlas es lo que deja mostrar en el corpus cuál fuente pasó
     * por ojo humano y cuál se aceptó automáticamente.
     */
    selectionMode?: ExcerptSelectionMode;
}

export interface SelectSourcePagesResult {
    sourceId: string;
    excerptCount: number;
    /** Hojas pedidas que no produjeron ni un fragmento. */
    emptySheets: number;
    /** Fragmentos que la selección implicaba, según el índice de hojas. */
    expectedChunks: number;
    /**
     * `true` cuando volvieron menos fragmentos de los que la selección
     * implicaba.
     *
     * No es paranoia: en producción apareció una fuente cuya receta declaraba
     * 51 fragmentos y tenía 25 guardados, de hojas que la receta ni nombraba. A
     * partir de ahí el medidor de presupuesto sumaba una cosa y el prompt
     * recibía otra, y desde afuera no había forma de notarlo. Guardar en
     * silencio algo que se contradice es peor que avisar.
     */
    incomplete: boolean;
}

/**
 * Tope de texto guardado en el paper, sumando todas las fuentes.
 *
 * Las fuentes viven INLINE en el documento del paper y Firestore corta un
 * documento en 1 MiB. Pasarse no da un error entendible: da un fallo de
 * escritura del SDK, con el trabajo entero sin guardar y sin decir por qué.
 *
 * El margen es amplio a propósito — el resto del paper (pasos, rúbrica, plan)
 * también ocupa, y el tope tiene que avisar antes de que la escritura falle, no
 * después.
 */
const MAX_PAPER_TEXT_CHARS = 800_000;

export class PaperCorpusTooLargeError extends Error {
    constructor(readonly totalChars: number, readonly limit: number) {
        super(`El corpus del trabajo ocuparía ${totalChars} caracteres y el tope es ${limit}`);
        this.name = 'PaperCorpusTooLargeError';
        Object.setPrototypeOf(this, PaperCorpusTooLargeError.prototype);
    }
}

export class SelectSourcePagesUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private chunkReader: IDocumentChunkReader,
    ) { }

    async execute(input: SelectSourcePagesInput): Promise<SelectSourcePagesResult> {
        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const sheetRanges = normalizeSheetRanges(input.sheetRanges);
        if (sheetRanges.length === 0) {
            throw new Error('La selección no tiene ninguna hoja');
        }

        const chunkRanges = chunkRangesForSheets(input.pageIndex, sheetRanges);
        const expectedChunks = chunkRanges.reduce((n, r) => n + (r.end - r.start + 1), 0);
        const chunks = chunkRanges.length > 0
            ? await this.chunkReader.readChunks(input.libraryResourceId, chunkRanges)
            : [];

        const incomplete = chunks.length < expectedChunks;
        if (incomplete) {
            console.warn('[SelectSourcePages] volvieron menos fragmentos de los pedidos', {
                libraryResourceId: input.libraryResourceId,
                sheetRanges,
                expectedChunks,
                receivedChunks: chunks.length,
            });
        }

        // El texto NO se guarda en el paper. Con doce fuentes son ~514 KB
        // contra un tope de documento de 1 MiB, y ese texto ya no alimenta el
        // prompt: cada paso pide lo suyo al corpus. Lo que se guarda es la
        // receta, que son cientos de bytes.
        //
        // Se leen igual para poder informar cuántos fragmentos implica la
        // selección —es lo que alimenta el medidor y la guardia de
        // consistencia— pero se descartan al escribir.
        const excerpts: ProjectSourceExcerpt[] = [];
        const materializedChunks = chunks.length;

        const passageRef = formatPassageReference(paper.passage, paper.displayLanguage);
        const recipe: ExcerptRecipe = {
            sheetRanges,
            proposedRanges: normalizeSheetRanges(input.proposedRanges),
            // Lo fijado se recorta a lo elegido: marcar una hoja y después
            // quitarla del carrito dejaría al medidor contando material que la
            // fuente ya no declara.
            pinnedRanges: clipRangesTo(input.pinnedRanges ?? [], sheetRanges),
            passageFingerprint: computeExtractionFingerprint(passageRef, paper.assignmentBrief),
        };

        const existing = findExistingSource(paper.sources, input.libraryResourceId);

        // Cuánto ocuparía el paper con esta fuente ya reemplazada. Se mide antes
        // de escribir porque el fallo de Firestore llega sin explicación y deja
        // el guardado a medias.
        const othersChars = paper.sources
            .filter(s => s.id !== existing?.id)
            .reduce((sum, s) => sum + s.excerpts.reduce((n, e) => n + e.text.length, 0), 0);
        const selectionChars = 0;
        if (othersChars + selectionChars > MAX_PAPER_TEXT_CHARS) {
            throw new PaperCorpusTooLargeError(othersChars + selectionChars, MAX_PAPER_TEXT_CHARS);
        }

        const extractedAt = new Date();

        if (existing) {
            await this.paperRepository.updateSource(input.ownerId, input.paperId, existing.id, {
                sourceType: input.sourceType,
                // Sólo se pisa el rol cuando el pastor eligió uno en esta
                // pasada; si no, se respeta el que ya tuviera la fuente.
                ...(input.chosenRole !== undefined ? { chosenRole: input.chosenRole } : {}),
                displayLabel: input.displayLabel,
                ...(input.citationKey !== undefined ? { citationKey: input.citationKey } : {}),
                // Igual que al extraer: con páginas elegidas, ya no es el
                // documento completo.
                mode: 'extracted-excerpts',
                excerpts,
                excerptSelectionMode: input.selectionMode ?? 'manual',
                excerptRecipe: recipe,
                extractedAt,
                extractionFingerprint: recipe.passageFingerprint,
            });
            return {
                sourceId: existing.id,
                excerptCount: materializedChunks,
                emptySheets: countEmptySheets(input.pageIndex, sheetRanges),
                expectedChunks,
                incomplete,
            };
        }

        const created = await this.paperRepository.addSource(input.ownerId, input.paperId, {
            corpusId: input.libraryResourceId,
            sourceType: input.sourceType,
            chosenRole: input.chosenRole ?? null,
            displayLabel: input.displayLabel,
            citationKey: input.citationKey ?? null,
            order: paper.sources.length,
            mode: 'extracted-excerpts',
            excerpts,
            excerptSelectionMode: input.selectionMode ?? 'manual',
            excerptRecipe: recipe,
            sourceLibraryResourceId: input.libraryResourceId,
            extractedAt,
            extractionFingerprint: recipe.passageFingerprint,
        });

        return {
            sourceId: created.id,
            excerptCount: materializedChunks,
            emptySheets: countEmptySheets(input.pageIndex, sheetRanges),
            expectedChunks,
            incomplete,
        };
    }
}

/**
 * Busca el documento entre las fuentes del trabajo.
 *
 * Mira el backref a la biblioteca Y el `corpusId`: las fuentes adjuntadas por
 * la ruta vieja —«agregar desde mi biblioteca»— guardan el id en `corpusId` y
 * dejan el backref en null. Mirar solo el backref las daría por inexistentes y
 * duplicaría el libro.
 */
function findExistingSource(
    sources: ReadonlyArray<ProjectSource>,
    libraryResourceId: string,
): ProjectSource | null {
    return sources.find(
        s => s.sourceLibraryResourceId === libraryResourceId || s.corpusId === libraryResourceId,
    ) ?? null;
}


/**
 * Hojas elegidas que no aportan texto. Un documento puede saltear números
 * cuando una página no produjo fragmentos —en blanco, ilegible—, y decirlo es
 * mejor que dejar al usuario creyendo que se llevó doce hojas cuando nueve
 * traían contenido.
 */
function countEmptySheets(
    pageIndex: ReadonlyArray<PageIndexEntry>,
    ranges: ReadonlyArray<SheetRange>,
): number {
    const present = new Set(pageIndex.map(p => p.sheet));
    let empty = 0;
    for (const range of ranges) {
        for (let sheet = range.start; sheet <= range.end; sheet++) {
            if (!present.has(sheet)) empty++;
        }
    }
    return empty;
}
