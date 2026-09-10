import type { SourceType } from './SourceType';
import type { SourceRole } from './StepSourcePlan';
import { isCitableSourceType } from './SourceType';

/**
 * A single source attached to an exegetical paper — typically an extract
 * from a commentary, lexicon, or critical apparatus that the user uploads
 * specifically for this paper.
 *
 * Lifecycle: project-scoped. When the user archives or deletes the paper,
 * these go with it (unless explicitly promoted to the user's library — a
 * v1.5 feature confirmed valuable but deferred).
 *
 * The actual text content is processed via the existing LlamaParse
 * pipeline and stored as a corpus referenced by `corpusId`. We don't
 * duplicate the text here — this entity is purely the relationship
 * (source → paper) with academic metadata for citation discipline.
 *
 * Two consumption modes:
 *   - `'full-document'` (default, retro-compat): the orchestrator reads
 *     the corpus's full `textContent` and inlines it in the prompt. Used
 *     when the user uploads a tightly-scoped extract directly to this
 *     paper (Caso 3 of the v1.5 design).
 *   - `'extracted-excerpts'` (v1.5+): the orchestrator inlines only the
 *     `excerpts` array, pre-curated from a larger library resource via
 *     semantic retrieval against the paper's passage. The library
 *     resource itself stays referenced via `sourceLibraryResourceId` so
 *     the user can "view original" and re-extract if needed.
 *
 * Taxonomy note: as of the rubric-driven redesign the `sourceType` field
 * uses the granular `SourceType` catalog (13 values with rigor tiers).
 * The earlier `role` field with 8 flat values (`primary-commentary`, etc.)
 * is migrated via `migrateLegacyRole` in `SourceType.ts`.
 */
export interface ProjectSource {
    id: string;
    paperId: string;

    /**
     * Reference to the corpus produced by the existing ingestion pipeline.
     * The corpus holds the parsed chunks with page anchoring; this entity
     * tells the LLM-orchestration layer how to USE it (type, citation key)
     * and the future `CitationVerifier` how to MATCH against it.
     */
    corpusId: string;

    /**
     * Granular academic type — drives rubric compliance (minimum counts
     * per type), per-step plan defaults (which step kinds typically use
     * this type), and the prompt's citation-discipline budget. See
     * `SOURCE_TYPE_CATALOG` for the metadata behind each value.
     *
     * The 'style-template-paper' type is special: it's used as a STYLE
     * template, not a source — citations from it must NEVER appear in
     * the output. The orchestrator enforces this via the catalog's
     * `defaultCitationDiscipline: 'never-cite'`.
     */
    sourceType: SourceType;

    /**
     * Rol dialéctico que el PASTOR eligió para esta fuente: ancla,
     * contraste o técnica.
     *
     * Existe porque el rol no se puede deducir del tipo. El tipo
     * responde «¿qué clase de obra es esto?» —y con eso se mide el
     * cumplimiento de la rúbrica—; el rol responde «¿qué trabajo hace
     * en MI argumento?», y eso solo lo sabe quien está armando el
     * trabajo. McComiskey, *The Minor Prophets: An Exegetical **and**
     * Expository Commentary*, es literalmente las dos cosas: ningún
     * mapa automático puede decidir si en este paper es el ancla o el
     * contraste.
     *
     * Antes de este campo el corpus deducía el rol de `sourceType` vía
     * `SUGGESTED_ROLE_BY_SOURCE_TYPE`, así que la interfaz ofrecía
     * botones «Elegir el ancla» cuya elección después descartaba: la
     * fuente aterrizaba donde mandara su tipo. El pastor elegía y el
     * sistema lo ignoraba.
     *
     * `null`/ausente = el pastor no se pronunció, y vale la sugerencia
     * del tipo. Así las fuentes anteriores a este campo siguen
     * clasificándose igual que siempre. Ver `resolveSourceRole`.
     *
     * NO confundir con el `role` legado de 8 valores planos que
     * `deserializeSource` migra a `sourceType`: ese campo murió, este
     * es otra cosa y por eso lleva otro nombre.
     */
    chosenRole?: SourceRole | null;

    /**
     * Human label as the user typed it on upload — "Lane WBC 47a, pp. 1-30"
     * or "Tuggy Léxico". Shown in the source list, not used for citation.
     */
    displayLabel: string;

    /**
     * Short author key for inline footnotes — "Lane", "Bruce", "Cockerill".
     * Optional because the LLM can derive it from the corpus metadata, but
     * the user can override here if the auto-derivation is wrong (e.g. two
     * Lanes in one paper need disambiguation).
     */
    citationKey: string | null;

    /** Display order in the source list. */
    order: number;

    /**
     * How this source contributes its text to the orchestrator prompt.
     * Default `'full-document'` keeps existing papers and the direct-
     * upload flow (Caso 3) working unchanged. `'extracted-excerpts'` is
     * the v1.5 curated-excerpt mode — only the chunks in `excerpts`
     * reach the prompt.
     */
    mode: ProjectSourceMode;

    /**
     * Pre-curated chunks for `mode === 'extracted-excerpts'`. Empty for
     * `'full-document'`. An empty array on an extracted source is a
     * valid state (UI surfaces a warning that the source won't
     * contribute) — it should NOT auto-delete the source.
     */
    excerpts: ReadonlyArray<ProjectSourceExcerpt>;

    /**
     * Cómo se eligieron los `excerpts`. `null` para fuentes en
     * `'full-document'` y para las extraídas antes de que existiera la
     * selección estructural.
     */
    excerptSelectionMode: ExcerptSelectionMode | null;

    /**
     * La receta con la que se armaron los `excerpts`. `null` en fuentes
     * anteriores al selector de páginas y en las que están en
     * `'full-document'`.
     */
    excerptRecipe: ExcerptRecipe | null;

    /**
     * Backref to the originating `library_resources/{id}` doc when the
     * source was created by the library-extraction flow. Lets the UI
     * offer "view original PDF" and lets the use case re-extract
     * against the same resource. Null for the direct-upload flow
     * (Caso 3) where the corpus is project-scoped.
     */
    sourceLibraryResourceId: string | null;

    /**
     * Timestamp of the last successful extraction run for this source.
     * Null for sources never extracted (`mode === 'full-document'`) or
     * pre-v1.5.1 sources that predate stale tracking.
     */
    extractedAt: Date | null;

    /**
     * Stable digest of `(passage + assignmentBrief)` at extraction
     * time. The UI compares this against the live paper's fingerprint
     * to decide whether the excerpts are stale (brief or passage edited
     * after extraction). Null for sources that don't have excerpts or
     * predate the field.
     *
     * Use `computeExtractionFingerprint()` from this module to compute
     * — never raw `JSON.stringify` so the format stays consistent
     * across writers.
     */
    extractionFingerprint: string | null;

    createdAt: Date;
}

/**
 * Discriminator for `ProjectSource.mode`. Kept as a top-level type so
 * downstream code can type-narrow without importing the whole entity.
 */
export type ProjectSourceMode = 'full-document' | 'extracted-excerpts';

/**
 * Cómo se eligieron los fragmentos de una fuente en modo
 * `'extracted-excerpts'`.
 *
 *   - `'structural'` — se leyó la tabla de contenidos del documento y se
 *     tomó la sección que trata el pasaje, corrida y en orden. Exacta.
 *   - `'semantic'` — se trajeron los fragmentos más cercanos a una consulta
 *     de embeddings. Aproximada, y la única posible en documentos que se
 *     extrajeron sin encabezados.
 *
 * Se persiste porque son dos niveles de confianza distintos y el usuario
 * tiene que poder verlos al revisar el corpus, no solo en el momento de
 * extraer. `null` en fuentes anteriores a la selección estructural.
 */
export type ExcerptSelectionMode = 'structural' | 'semantic' | 'manual';

/** Tramo de hojas físicas del PDF, ambos extremos inclusive. */
export interface SheetRange {
    start: number;
    end: number;
}

/**
 * Qué pidió el usuario, para poder reabrir el selector con su selección
 * intacta y volver a correrla si cambia el pasaje.
 *
 * La receta NO es lo que se le manda al modelo: eso son los `excerpts`, que se
 * materializan desde acá. Guardar las dos cosas separadas es lo que permite
 * editar una selección sin volver a empezar, y distinguir lo que propuso el
 * sistema de lo que agregó el usuario.
 *
 * Las hojas son FÍSICAS —la hoja N del PDF, que es lo que indexa
 * `metadata.page`—, no los números impresos en el libro. Los dos difieren por
 * las páginas preliminares.
 */
export interface ExcerptRecipe {
    /** Lo que quedó en el carrito. */
    sheetRanges: ReadonlyArray<SheetRange>;
    /** Lo que el sistema propuso, haya sido aceptado o no. */
    proposedRanges: ReadonlyArray<SheetRange>;
    /**
     * Tramos que entran a TODOS los pasos, sin competir en el ranking.
     *
     * Existe por un caso que la recuperación por cercanía no puede resolver: la
     * introducción al libro no menciona el versículo que se está estudiando, así
     * que pierde contra cualquier párrafo que sí lo mencione — y sin embargo el
     * usuario la eligió a propósito. Marcarla la vuelve obligatoria.
     *
     * Consume presupuesto en cada paso, así que el medidor lo muestra aparte:
     * fijar de más deja sin lugar a lo que el versículo sí necesita.
     */
    pinnedRanges: ReadonlyArray<SheetRange>;
    /**
     * Huella de (pasaje + encuadre) al momento de elegir. Cuando deja de
     * coincidir, la selección quedó vieja y la interfaz lo dice en vez de
     * servir fragmentos de otro pasaje en silencio.
     */
    passageFingerprint: string;
}

/**
 * One curated chunk extracted from a library resource, ranked by
 * similarity to the paper's passage. Mirrors the `document_chunks`
 * shape one-to-one (one excerpt = one chunk at extraction time) but
 * the user can edit the text afterwards — `userEdited` records that.
 */
export interface ProjectSourceExcerpt {
    /**
     * The actual chunk text. Can be edited by the user after
     * extraction; if so, `userEdited` flips to true so re-extraction
     * knows to preserve this entry instead of overwriting it.
     */
    text: string;

    /**
     * Citation anchor extracted from the chunk's metadata at retrieval
     * time — typically `"p. 47"` or `"comm. on v.1"`. Surfaced to the
     * orchestrator so the prompt can ask Gemini to cite using this
     * label, and shown in the UI next to the excerpt for review.
     */
    sourceLocation: string;

    /**
     * Hoja física del archivo de la que salió el fragmento.
     *
     * `sourceLocation` es texto YA FORMATEADO —«p. 47»— que el extractor
     * escribió cuando la numeración del recurso todavía no existía, y dice
     * «p.» sobre una hoja. Guardar el número aparte deja que quien cite lo
     * traduzca a página impresa sin tener que parsear una cadena.
     *
     * Ausente en todo extracto anterior a este campo; ahí se sigue parseando
     * `sourceLocation`, que es lo que hace `relabelExcerptAnchor`.
     */
    sheet?: number;

    /** Sección del fragmento, cuando el documento la declara. */
    section?: string;

    /**
     * Cosine similarity score from the embedding retrieval, normalized
     * to `[0, 1]`. Used by the UI to rank/filter excerpts; not passed
     * to the orchestrator (the LLM should treat all excerpts as
     * equally relevant once the user accepted them).
     */
    relevanceScore: number;

    /**
     * Marks excerpts the user has touched (text edited or manually
     * added). Re-extraction PRESERVES these — never overwrites — and
     * appends fresh excerpts after them. Set automatically on the
     * first text-change in the UI.
     */
    userEdited: boolean;

    /**
     * When the user last edited this excerpt. Null for excerpts the
     * user never touched (matches `userEdited === false`). Useful for
     * audit trails and stale-excerpt detection.
     */
    editedAt: Date | null;
}

/**
 * Pure helper to derive the extraction fingerprint from the inputs
 * the extractor actually feeds the retriever. Anything that affects
 * which chunks come back belongs in here.
 *
 * Caller formats `passage` to its display string (typically via
 * `formatPassageReference`) — keeping this helper string-only avoids
 * a circular import with `bible/canon`.
 *
 * Format is stable so the UI's stale check works across different
 * writers (use case + future migrators). Don't change without
 * bumping a version prefix.
 */
export function computeExtractionFingerprint(
    passageRef: string,
    assignmentBrief: string | null,
): string {
    const passageNorm = (passageRef ?? '').trim().toLowerCase();
    // Brief is sliced to the same window the extractor uses (first 500
    // chars per v1.5 spec). Keep this in sync with
    // `RetrieveChunksExcerptExtractor`'s query construction — if the
    // window grows there, grow it here too.
    const briefNorm = (assignmentBrief ?? '').trim().slice(0, 500);
    return `v1|${passageNorm}|${briefNorm}`;
}

/**
 * Returns true when the source's excerpts were extracted against a
 * passage/brief that has since been edited. UI uses this to surface
 * a "re-extract" banner. Returns false for sources never extracted
 * (no fingerprint) — not stale, just empty.
 *
 * Caller passes the LIVE passage as a formatted string so the helper
 * stays decoupled from the `bible/canon` module.
 */
export function isExcerptSetStale(
    source: Pick<ProjectSource, 'mode' | 'extractionFingerprint'>,
    livePaper: { passageRef: string; assignmentBrief: string | null },
): boolean {
    if (source.mode !== 'extracted-excerpts') return false;
    if (!source.extractionFingerprint) return false;
    return source.extractionFingerprint !== computeExtractionFingerprint(livePaper.passageRef, livePaper.assignmentBrief);
}

/**
 * @deprecated Use `SourceType` from './SourceType'. Retained as a
 * type alias only so transitional code compiles. Remove once the
 * pre-redesign references in legacy snapshots have all been migrated.
 */
export type ProjectSourceRole = SourceType;

/** @deprecated Use `isCitableSourceType` from './SourceType'. */
export function isCitable(type: SourceType): boolean {
    return isCitableSourceType(type);
}
