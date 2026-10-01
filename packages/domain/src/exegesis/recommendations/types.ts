import type { BibleBookId } from '../../bible/canon/BibleCanon';
import type { SourceType } from '../entities/SourceType';

/**
 * Curated bibliographic recommendation surfaced under a paper's rubric
 * gap (v1.7 corpus recommendations feature). Catalog is hand-curated
 * static data — no LLM at suggestion time, since LLM-generated citations
 * routinely hallucinate authors, editions, ISBNs (catastrophic in a
 * seminary context).
 *
 * Shape covers the minimum needed for academic credibility:
 *   - author + title + series + publisher + year
 *   - ISBN for future affiliate / library lookup
 *   - tier for visual badge (essential / recommended / standard)
 *   - languages so an ES paper can prefer Spanish editions when they exist
 *   - rationaleI18nKey for the orchestrator + UI hint
 */
export interface SourceRecommendation {
    /** Display author. Last name first for academic norm: "Cockerill, Gareth Lee". */
    author: string;
    /** Full work title with subtitle if relevant. */
    title: string;
    /** Series + volume number if applicable: "NICNT", "WBC 47A". null when standalone. */
    series: string | null;
    /** Publisher: "Eerdmans", "Zondervan Academic", "Word", "Hendrickson". */
    publisher: string;
    /** Year of the cited edition (latest if revised). */
    year: number;
    /** ISBN-13 of the cited edition. null when not yet captured (don't fabricate). */
    isbn: string | null;
    /**
     * Academic tier — drives the badge color in the UI:
     *   'essential'    — peak (e.g. WBC, NIGTC, Hermeneia for crit. commentary)
     *   'recommended'  — strong mid-tier (e.g. NICNT, BECNT for expository)
     *   'standard'     — accessible/popular but academically defensible
     */
    tier: 'essential' | 'recommended' | 'standard';
    /**
     * Languages the work is published in. The UI surfaces ES editions
     * first for Spanish papers (when an ES translation exists).
     */
    languages: ReadonlyArray<'es' | 'en' | 'de' | 'fr'>;
    /**
     * Los libros que la obra comenta, cuando son menos que los de su grupo.
     *
     * Las entradas de GRUPO valen para todos los libros del grupo, y eso está
     * bien para una obra sobre las cartas pastorales; no para un comentario
     * de Judas y 2 Pedro, que se ofrecía para Santiago como «En tu
     * biblioteca · Agregar al corpus» (TP Santiago 2:14-26). Ausente: la obra
     * cubre el grupo entero.
     */
    covers?: ReadonlyArray<BibleBookId>;
    /**
     * Optional one-line note explaining what this work uniquely
     * contributes. Plain string (NOT i18n key) for catalog brevity in
     * v1.7; can switch to i18n keys later if we need translations.
     * Surfaced inline below the title in the recommendation card.
     */
    rationale?: string;
    /**
     * Testament scope. Used by `getSourceRecommendations` to filter
     * invariant entries against the paper's passage so OT lexicons
     * don't surface for NT papers and vice-versa.
     *
     *   - `'NT'`          → only New Testament papers
     *   - `'OT'`          → only Old Testament papers
     *   - `'whole-bible'` → both testaments (e.g. Anchor Bible Dictionary,
     *                       Sanders' Judaism, Josephus, Rahlfs LXX)
     *   - `undefined`     → no filter (legacy entries; treated as
     *                       whole-bible for back-compat)
     *
     * For BOOK-SPECIFIC entries this field is redundant (the bookId
     * already determines the testament) so it can stay undefined.
     * For INVARIANT entries the field is essential to keep the catalog
     * relevant per testament.
     */
    testament?: 'NT' | 'OT' | 'whole-bible';
}

/**
 * All curated recommendations for a single Bible book, indexed by
 * `SourceType`. Empty arrays mean "no curation yet for this combination
 * — UI shows a fallback hint and the gap surface emits a telemetry
 * event so we know what to curate next."
 */
export interface BookRecommendations {
    bookId: BibleBookId;
    /** Indexed by SourceType. Missing keys = no curation. */
    bySourceType: Partial<Record<SourceType, ReadonlyArray<SourceRecommendation>>>;
}
