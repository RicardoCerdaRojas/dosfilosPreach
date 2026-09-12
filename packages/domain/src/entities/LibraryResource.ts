import { WorkflowPhase } from './SermonWorkflow';
import type { SourceType as ExegesisSourceType } from '../exegesis/entities/SourceType';
import type { PageNumbering } from '../exegesis/outline/pageNumbering';
import type { ScriptCensus } from './extractionHealth';
import type { BibleBookId } from '../bible/canon/BibleCanon';
import type {
    License,
    IngestionStatus,
    RiskLevel,
    CitationTemplates,
} from './citationRights';

/**
 * Granularity of what a library resource covers (v1.7 paper-corpus
 * library match). Determines how the smart-match dialog interprets
 * `coversBibleBooks`:
 *
 *   - 'whole-bible' — lexicons, theological dictionaries, grammars
 *     covering the whole canon (BDAG, TDNT, BDF, Wallace). `coversBibleBooks`
 *     is expected to be empty.
 *   - 'whole-testament' — NT-only or OT-only references (NIDNTTE, HALOT,
 *     NA28). `coversBibleBooks` is expected to be empty.
 *   - 'book' — commentaries, monographs on a single book or a small
 *     cluster (Cockerill on Hebrews, Bauckham on 2 Peter & Jude).
 *     `coversBibleBooks` should list the covered books.
 *   - 'pericope' — narrow studies on a passage or section
 *     (a journal article on Romans 1:18-32). `coversBibleBooks` lists
 *     the host book(s).
 */
export type LibraryResourceScope = 'whole-bible' | 'whole-testament' | 'book' | 'pericope';

export type ResourceType =
    | 'theology'
    | 'grammar'
    | 'critical-text'
    | 'commentary'
    | 'exegetical-commentary'
    | 'theological-dictionary'
    | 'bible-dictionary'
    | 'historical-context'
    | 'biblical-survey'
    | 'article'
    | 'other';

export type TextExtractionStatus = 'pending' | 'processing' | 'ready' | 'failed';

/**
 * Which extractor produced the text content.
 * - '3.0-llamaparse': Primary, best quality (structured pages, preserves Greek/Hebrew/tables)
 * - '4.0-gemini-standard': Standard tier, Gemini Flash with the same `<!-- page: N -->`
 *   contract as LlamaParse — eligible for the auto-index trigger.
 * - '5.0-pdfparse-structured': Last-resort pdf-parse output enriched with synthetic
 *   page markers (form-feed boundaries or equal-segment splitting). Eligible for
 *   the auto-index trigger so the user always ends up with searchable content
 *   even when both premium engines fail.
 * - '2.0-gemini': Legacy Gemini extraction, predates the structured contract.
 * - 'fallback-pdfparse': Legacy pdf-parse output without page markers; not
 *   auto-indexable. Pre-v5 uploads only.
 */
export type ExtractionVersion =
    | '3.0-llamaparse'
    | '4.0-gemini-standard'
    | '5.0-pdfparse-structured'
    | '2.0-gemini'
    | 'fallback-pdfparse';

/**
 * Extraction versions whose output follows the `<!-- page: N -->`
 * structured-markdown contract, so the CLOUD indexer
 * (`indexStructuredDocument`) can chunk them with REAL page numbers,
 * section breadcrumbs and character offsets.
 *
 * This distinction is not cosmetic. The legacy browser-side indexer in
 * `RAGService` chunks the flat `textContent` field and FABRICATES the
 * page number (`Math.floor(chunkIndex / 3) + 1`). For a resource whose
 * extractor produced a structured document, routing to that path
 * silently replaces verifiable citations with invented ones — so
 * anything in this list must go to the cloud callable.
 *
 * The cloud functions keep their own copy in
 * `packages/functions/src/library/extractionVersions.ts` because
 * `packages/functions` deliberately does not depend on
 * `@dosfilos/domain`. That one duplication is accepted and documented;
 * every consumer on this side of the boundary imports from here.
 */
export const STRUCTURED_EXTRACTION_VERSIONS: readonly ExtractionVersion[] = [
    '3.0-llamaparse',
    '4.0-gemini-standard',
    '5.0-pdfparse-structured',
] as const;

/** Membership check for {@link STRUCTURED_EXTRACTION_VERSIONS}. */
export function isStructuredExtractionVersion(version: string | null | undefined): boolean {
    if (!version) return false;
    return (STRUCTURED_EXTRACTION_VERSIONS as readonly string[]).includes(version);
}

/**
 * Indexing job status (chunks + embeddings) written by the cloud
 * functions in `packages/functions/src/library/indexStructuredDocument.ts`.
 * Distinct from `textExtractionStatus` — a resource can be `ready`-extracted
 * but still `processing`/`failed` for indexing.
 */
export type IndexingStatus = 'processing' | 'ready' | 'failed';

/**
 * Combined readiness state for the v1.5 exegesis "extract from library"
 * flow. Computed by `LibraryService.getResourceIndexStatus()` from the
 * raw fields on the resource. Used by the corpus picker to badge each
 * library resource and gate the "extract excerpts" toggle.
 */
export type ResourceIndexStatus =
    | 'indexed'           // Ready to be queried via retrieveChunks (chunks + embeddings present)
    | 'extracting'        // Cloud Function is still parsing the file
    | 'indexing'          // Extraction done; auto-index trigger in flight
    | 'needs-extraction'  // No textExtractionStatus or 'pending' — never started
    | 'needs-indexing'    // Extraction ready but with a version that the indexer ignores (legacy)
    | 'failed';           // Either extraction or indexing reported failure

export interface LibraryResource {
    id: string;
    userId: string;
    title: string;
    author: string;
    type: ResourceType;
    storageUrl: string;
    textContent?: string | undefined; // Legacy: Extracted text directly (deprecated)
    textContentUrl?: string | undefined; // URL to text file in Cloud Storage
    structuredContentUrl?: string | undefined; // URL to structured Markdown (LlamaParse output)
    extractionVersion?: ExtractionVersion; // Which extractor produced textContent
    extractedWithLlamaParse?: boolean; // Convenience flag
    /**
     * Server-stamped timestamp set when the cascade transitions
     * `textExtractionStatus` to `'processing'`. The UI uses this to
     * render "Procesando hace 4m 23s" without depending on when the
     * page mounted, and without trusting client clock skew.
     * Undefined for legacy resources that finished extraction before
     * this field was introduced.
     */
    processingStartedAt?: Date;
    /**
     * Avance de una extracción que corre por rangos en una cola.
     *
     * Un libro largo dejó de extraerse en una invocación: ahora es una cadena
     * de tareas que puede durar más de una hora —un diccionario de 1 006
     * páginas son ~25 rangos—. Con `processingStartedAt` a solas la tarjeta
     * sólo podía decir «procesando hace 47 min», que para el usuario es
     * indistinguible de estar colgado.
     *
     * Lo escribe cada rango al terminar; desaparece cuando el libro queda
     * `ready`. Ausente en la ruta que extrae de una sola vez, donde no hay
     * avance parcial que contar.
     */
    extractionProgress?: {
        paginasHechas: number;
        totalPaginas: number;
        /** Tope 99: nunca dice 100 antes de que el libro esté guardado. */
        porcentaje: number;
        /** Último rango terminado, como «41-83». */
        ultimoRango: string | null;
        rangosEstimados: number;
    };
    /**
     * User-facing message written by the extraction pipeline when the
     * actual tier ended up below what the user requested (e.g. requested
     * Premium → got Standard because all LlamaParse accounts failed).
     * The card surfaces this in a tooltip on the engine badge so the
     * user can decide whether to reprocess. `null` / undefined means
     * extraction succeeded at the requested tier — no warning needed.
     */
    extractionWarning?: string | null;
    /**
     * Error message written when the cascade exhausted every extractor
     * and the resource ended up in `textExtractionStatus: 'failed'`.
     * Used by the failed-state callout to give the user a concrete
     * reason instead of a generic "something failed".
     */
    extractionError?: string;
    /**
     * Error message written when the indexer (chunks + embeddings)
     * failed AFTER extraction completed. Set when `indexingStatus`
     * is `'failed'`. The card surfaces this in a tooltip on the
     * "Por procesar" pill so the user knows what blocked indexing
     * (e.g. "All N chunks failed to embed") and can retry.
     * Cleared automatically on a successful re-index.
     */
    indexingError?: string | null;
    /**
     * Aviso en lengua llana cuando el índice quedó por debajo del libro.
     *
     * Lo escribe el indexador comparando la última página indexada
     * contra `pageCount`. Un índice que llega a la 433 de 711 mostraba
     * la misma tarjeta verde que uno completo, y lo que quedaba fuera
     * no aparecía en las búsquedas ni se podía citar. `null` significa
     * que se midió y cubre; ausente, que no se midió.
     */
    indexingWarning?: string | null;
    /**
     * Qué tanto del documento entró al índice. Escrito por el
     * indexador junto a `indexingWarning`. `null` cuando no hay contra
     * qué comparar (el documento no declara `pageCount`).
     */
    indexCoverage?: {
        firstIndexedPage: number;
        lastIndexedPage: number;
        pageCount: number;
        ratio: number;
        complete: boolean;
    } | null;
    /**
     * Cómo se traduce la hoja del PDF al número que el libro imprime.
     *
     * Los fragmentos anclan a la hoja física, que es lo único medible; una
     * cita académica habla de la página impresa. Sin esta tabla el sistema
     * sólo puede decir «hoja 32», y decir «p. 32» sería afirmar algo que no
     * sabe: en el comentario de Adamson la hoja 32 imprime 28, y en el de
     * Mayor la hoja 328 imprime 50.
     *
     * Se guarda por tramos porque un número por libro es un modelo falso para
     * dos formas corrientes —la cuenta que se corre a mitad del volumen y las
     * preliminares sin numeración arábiga—, ambas presentes en bibliotecas
     * reales. Ver `pageNumbering` en el módulo de exégesis.
     *
     * Lo propone el indexador (`origin: 'detected'`) y lo confirma una
     * persona contra el ejemplar (`origin: 'confirmed'`). Ausente o `null`
     * significa que no se sabe, y entonces las citas dicen «hoja N» — que es
     * incompleto pero verdadero, a diferencia de una página inventada.
     */
    pageNumbering?: PageNumbering | null;

    /**
     * Cuántos caracteres de cada alfabeto trajo la extracción, contados sobre
     * el texto COMPLETO —`textContent` va truncado a 800 KB—.
     *
     * Es lo que permite decir que un comentario del texto hebreo con cero
     * letras hebreas está roto. Ausente en todo recurso extraído antes de que
     * esto existiera; ahí no se juzga nada.
     */
    scriptCensus?: ScriptCensus | null;
    /**
     * Por qué falló la extracción, en categorías que el producto puede
     * tratar distinto: `timeout` (la invocación se quedó sin tiempo),
     * `stalled` (se interrumpió y no dejó resultado, lo detecta el
     * barrido) o `error` (el código vio el fallo y lo escribió).
     */
    extractionFailureReason?: 'timeout' | 'stalled' | 'error';
    /**
     * Mode the user explicitly requested at upload time:
     *   - 'standard' → skip LlamaParse, use Gemini → pdf-parse fallback.
     *     Debits standard pages from the user's balance.
     *   - 'premium' → try LlamaParse first (best quality for tables /
     *     multi-column / scanned). Debits premium when LlamaParse runs
     *     successfully; falls back to Gemini and debits standard if
     *     LlamaParse fails.
     *
     * Undefined for legacy resources uploaded before this field
     * existed — the cloud function falls back to its previous
     * "premium-first cascade" behavior in that case.
     */
    requestedExtractionMode?: 'standard' | 'premium';
    textExtractionStatus: TextExtractionStatus;
    /**
     * Indexing job status (chunks + embeddings) written by the
     * `indexStructuredDocument` cloud function. Undefined for legacy
     * resources that were never indexed. The auto-index trigger fires
     * after extraction completes and updates this field.
     */
    indexingStatus?: IndexingStatus;
    /**
     * Indexer schema version (e.g. '2.0-structured'). Used by the
     * auto-index trigger to detect already-indexed resources and skip
     * re-work. Also used by the readiness probe to flag resources
     * indexed under an older schema.
     */
    indexerVersion?: string;
    /**
     * Granular exegesis classification (commit 6 of v1.5). Cached on
     * the resource the first time the user picks it for excerpt
     * extraction so subsequent papers get a pre-filled type instead
     * of the always-generic default. Distinct from `type` (the coarse
     * theology/commentary/grammar trio used by Faculty + Sermon
     * Generator) — exegesis cares about much finer distinctions
     * (`commentary-critical` vs `commentary-expository`,
     * `lexicon-technical` vs `theological-dictionary`, etc.). Storing
     * it here means it follows the resource across all papers; the
     * user only classifies once per recurso, not once per paper.
     *
     * Optional: legacy resources don't have it; the extraction
     * dialog falls back to a coarse-type-derived default when absent.
     */
    exegeticalType?: ExegesisSourceType;
    mimeType: string;
    sizeBytes: number;
    characterCount?: number; // Total character count of extracted text
    pageCount?: number; // Total page count from extraction

    // 🎯 Core Library: Stores this document is included in (can be multiple)
    coreStores?: ('exegesis' | 'homiletics' | 'generic')[];

    /**
     * Whether this document's citations may be shown to non-admin users.
     * When false (default), the document is still used for RAG retrieval (admin sees
     * citations + bibliography) but non-admin users see responses with citations stripped.
     * Flip to true ONLY for public-domain / openly-licensed material (Calvino, Spurgeon,
     * Patrística, Gesenius, etc.) or material with an explicit signed license.
     */
    publiclyCitable?: boolean;

    // Phase preference: documents preferred for specific workflow phases
    preferredForPhases?: WorkflowPhase[];

    /**
     * Bible books this resource covers, by canonical id (e.g. ['2PE', 'JUD']
     * for Bauckham WBC; ['HEB'] for Cockerill NICNT). Used by the v1.7
     * paper-corpus smart-match to filter the resource list to those
     * covering the paper's passage's book.
     *
     * Empty array semantics depend on `scope`:
     *   - scope === 'whole-bible' or 'whole-testament' → empty is correct
     *     (the resource covers the whole scope, not specific books)
     *   - scope === 'book' or 'pericope' → empty means UNCLASSIFIED
     *     (UI should nudge the user to fill it in)
     *
     * Optional for legacy resources uploaded before v1.7 — repos return
     * `[]` in that case, callers treat absent + 'book' scope as
     * "unclassified" the same way.
     */
    coversBibleBooks?: ReadonlyArray<BibleBookId>;

    /**
     * Granularity of coverage. See `LibraryResourceScope` for semantics.
     * Optional for legacy resources — repos default to `'book'` (the
     * most common case for a pastor's library) when absent.
     */
    scope?: LibraryResourceScope;

    // Extensible metadata (e.g. for Gemini File URIs)
    metadata?: Record<string, any>;

    /**
     * Marks a resource as a system source — preloaded by the platform
     * (e.g. SBL Greek New Testament critical text), available to every
     * user without consuming their library quota or processing balance.
     * The `userId` field for system sources is the sentinel
     * `SYSTEM_SOURCE_OWNER_ID` so per-user queries skip them; the
     * library service unions user-owned + system-owned resources for
     * UI display.
     *
     * System resources are read-only: the UI hides edit / delete
     * controls and the orchestrator treats them as non-billable.
     */
    isSystemSource?: boolean;

    // ── Rights-aware citation metadata (ADR-006, PR 0.3) ──────────────
    //
    // Mirrors the two-axis model from [07-citation-policy.md]:
    //   `ingestionStatus` × `license` → operational behaviour at render
    //   + export time. Legacy chunks default to
    //   { license: 'unknown', ingestionStatus: 'requires_manual_review' }
    //   on read (FirebaseLibraryRepository) so existing rows behave
    //   conservatively without a destructive backfill.

    /**
     * Effective copyright license for the source text. Drives whether
     * the export pipeline emits a mandatory attribution footer
     * (CC BY / CC BY-SA) and whether the citation engine treats the
     * source as freely renderable, attributed, or restricted.
     */
    license?: License;
    licenseUrl?: string;
    /**
     * Human-readable copyright line attached to the source (e.g.
     * "Copyright 2010 Logos Bible Software and SBL"). Rendered verbatim
     * in the export attribution footer.
     */
    copyrightNotice?: string;
    ingestionStatus?: IngestionStatus;
    riskLevel?: RiskLevel;
    /**
     * Mandatory attribution lines that must appear in every exported
     * artefact that cites this source. The export pipeline aggregates
     * these across the artefact's citation manifest and renders them in
     * an "Atribuciones" section after the bibliography.
     */
    requiredAttribution?: string[];
    /**
     * Free-form policy hints (e.g. "Verify edition before ingestion",
     * "Quote only under fair use"). Surfaced in CoreLibraryAdmin so the
     * admin can read the source's rights status at a glance.
     */
    specialHandling?: string[];
    /**
     * Citation render templates per context (sermon / bible_study /
     * essay_or_article / rag_answer). Populated from the JSON canonical
     * seed for CORE Library sources; per-user uploads inherit defaults
     * derived from `author` + `title`.
     */
    citation?: CitationTemplates;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Sentinel `userId` used by every `LibraryResource` flagged as
 * `isSystemSource: true`. The double-underscore prefix is impossible
 * for a Firebase Auth uid, which guarantees no collision with real
 * user-owned resources. Repos query system resources by this
 * sentinel and the library service unions them with the requesting
 * user's own library before rendering.
 */
export const SYSTEM_SOURCE_OWNER_ID = '__system__';

export class LibraryResourceEntity implements LibraryResource {
    public preferredForPhases?: WorkflowPhase[];
    public metadata?: Record<string, any>;
    public coreStores?: ('exegesis' | 'homiletics' | 'generic')[];
    /**
     * Set post-construct via `(entity as any).exegeticalType = …`
     * by the repo deserializer (commit 6 of v1.5). Declared here so
     * `Partial<LibraryResourceEntity>` patches accept it — the class
     * doesn't take it through the constructor because all the v1.5
     * cache fields are owned by deserialization, not creation.
     */
    public exegeticalType?: ExegesisSourceType;
    /**
     * Set at upload time when the user explicitly chose a tier.
     * Persisted to Firestore so the storage-trigger cloud function can
     * read it and respect the user's choice instead of always running
     * the default premium-first cascade.
     */
    public requestedExtractionMode?: 'standard' | 'premium';
    /**
     * v1.7 smart-match metadata. Set either at upload (autocompleted by
     * `inferBibleBooksFromTitle`) or in the metadata editor. Owned by
     * deserialization — not a constructor param.
     */
    public coversBibleBooks?: ReadonlyArray<BibleBookId>;
    public scope?: LibraryResourceScope;
    /**
     * v1.7 Sprint 2 — owned by deserialization. Repos set this when
     * the Firestore doc carries `isSystemSource: true`. UI uses it to
     * render the "system" badge and to suppress edit/delete controls.
     */
    public isSystemSource?: boolean;
    /**
     * Extraction + indexing pipeline metadata, written by the cloud
     * functions and owned by deserialization — none of it goes through
     * the constructor.
     *
     * These are declared on the interface but were missing from the
     * class. Because they're optional, `implements LibraryResource`
     * never complained, so every consumer that read one got
     * `TS2339: Property does not exist` and worked around it with an
     * inline cast (`(resource as { indexingError?: string }).indexingError`)
     * or simply added to the type-check ratchet's frozen debt. Declaring
     * them here is what those casts were standing in for.
     */
    public textContentUrl?: string;
    public structuredContentUrl?: string;
    public extractionVersion?: ExtractionVersion;
    public extractedWithLlamaParse?: boolean;
    public extractionWarning?: string | null;
    public extractionError?: string;
    public indexingStatus?: IndexingStatus;
    /**
     * Numeración impresa por tramos. La escribe la calibración; el
     * deserializador la repone. Ver `pageNumbering` en la interfaz.
     */
    public pageNumbering?: PageNumbering | null;
    public indexingError?: string | null;
    public indexingWarning?: string | null;
    public indexCoverage?: LibraryResource['indexCoverage'];
    public extractionFailureReason?: 'timeout' | 'stalled' | 'error';
    public indexerVersion?: string;
    public characterCount?: number;
    public processingStartedAt?: Date;
    /** Avance de una extracción por rangos en cola. Ver `LibraryResource`. */
    public extractionProgress?: LibraryResource['extractionProgress'];
    /**
     * ADR-006 / PR 0.3 — rights-aware citation metadata. Owned by
     * deserialization; legacy docs default to `license: 'unknown'` +
     * `ingestionStatus: 'requires_manual_review'` in the repo so the
     * citation engine treats them conservatively until classified.
     */
    public license?: License;
    public licenseUrl?: string;
    public copyrightNotice?: string;
    public ingestionStatus?: IngestionStatus;
    public riskLevel?: RiskLevel;
    public requiredAttribution?: string[];
    public specialHandling?: string[];
    public citation?: CitationTemplates;

    constructor(
        public id: string,
        public userId: string,
        public title: string,
        public author: string,
        public type: ResourceType,
        public storageUrl: string,
        public mimeType: string,
        public sizeBytes: number,
        public textExtractionStatus: TextExtractionStatus = 'pending',
        public textContent?: string,
        public createdAt: Date = new Date(),
        public updatedAt: Date = new Date(),
        preferredForPhases?: WorkflowPhase[],
        metadata?: Record<string, any>,
        public pageCount?: number,
        coreStores?: ('exegesis' | 'homiletics' | 'generic')[],
        isSystemSource?: boolean
    ) {
        if (preferredForPhases) {
            this.preferredForPhases = preferredForPhases;
        }
        if (metadata) {
            this.metadata = metadata;
        }
        if (coreStores) {
            this.coreStores = coreStores;
        }
        if (isSystemSource) {
            this.isSystemSource = isSystemSource;
        }
        this.validate();
    }

    private validate(): void {
        if (!this.title || this.title.trim().length < 3) {
            throw new Error('El título del recurso debe tener al menos 3 caracteres');
        }
        // System sources (seed catalog ingested from
        // `core-library-seed.json`) are metadata-only: they describe a
        // canonical source whose full text either lives elsewhere
        // (`/confessions/`, public URL) or is intentionally not indexed
        // (modern statements under `approved_metadata_only`). They
        // legitimately have neither `storageUrl` nor `textContent`.
        if (this.isSystemSource) {
            return;
        }
        // User-uploaded resources MUST carry either a Cloud Storage
        // object or inline text — otherwise extraction/indexing has
        // nothing to chew on.
        if (!this.storageUrl && !this.textContent) {
            throw new Error('El recurso debe tener una URL de almacenamiento o contenido de texto');
        }
    }

    static create(
        data: Omit<LibraryResource, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
    ): LibraryResourceEntity {
        return new LibraryResourceEntity(
            data.id ?? crypto.randomUUID(),
            data.userId,
            data.title,
            data.author,
            data.type,
            data.storageUrl,
            data.mimeType,
            data.sizeBytes,
            data.textExtractionStatus,
            data.textContent,
            new Date(),
            new Date(),
            data.preferredForPhases,
            data.metadata,
            data.pageCount
        );
    }
}
