import type {
    AssistantVerseInput,
    BibleBookId,
    BookPanorama,
    ExegeticalUnit,
    FidelityReview,
    MacroSection,
    PreachableUnit,
} from '@dosfilos/domain';

/**
 * localStorage draft persistence for the v1.5 expository assistant
 * wizard. v1.5 doesn't persist intermediate runs in Firestore — only
 * the final SermonSeries lives server-side. The draft saves the
 * pastor from losing 90 seconds of pipeline work to an accidental
 * tab close.
 *
 * Contract:
 *   - One key per entry: the generic planner keeps the historic key, and
 *     a planner opened from a project (`?projectId=`) uses the same key
 *     plus `:<projectId>`. Within a key, only one draft at a time; new runs
 *     overwrite it (the pastor explicitly clicked "Iniciar análisis" again).
 *     That way a loose 2 Peter run and a project's Nehemiah series never
 *     overwrite each other, and the generic entry never reads a project
 *     draft.
 *   - 24h TTL. Stale drafts are dropped on hydration to avoid
 *     showing a pastor a week-old run when they return to the page.
 *   - Schema versioning so v1.6 can ignore v1.5 drafts cleanly.
 *   - SSR-safe: every accessor checks `typeof window !== 'undefined'`.
 */

const DRAFT_KEY = 'dosfilos.expositoryAssistant.draft';
const DRAFT_SCHEMA_VERSION = 'v1';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** No scope = the historic key, so drafts saved before projects still load. */
function draftKey(scope?: string | null): string {
    return scope ? `${DRAFT_KEY}:${scope}` : DRAFT_KEY;
}

export interface ExpositoryDraft {
    schemaVersion: typeof DRAFT_SCHEMA_VERSION;
    /** ISO timestamp the draft was last written. Used for TTL. */
    savedAt: string;
    /** The ANALYZED book, not whatever the picker shows afterwards. */
    bookId: BibleBookId;
    /** Project the planner was opened from; absent or null = loose series. */
    projectId?: string | null;
    displayLanguage: 'es' | 'en';
    bookDisplay: string;
    targetPreachableCount?: number;
    verses: AssistantVerseInput[];
    panorama?: BookPanorama;
    macroSections?: MacroSection[];
    exegeticalUnits?: ExegeticalUnit[];
    preachableUnits?: PreachableUnit[];
    fidelityReview?: FidelityReview;
    /**
     * Pase 5 issue triage: indices the pastor explicitly marked as
     * "addressed" (acted upon, e.g. via inline edit in Pase 4) or
     * "ignored" (read but chose to keep the original division).
     * Indices reference positions in `fidelityReview.issues[]`. The
     * two sets are mutually exclusive — toggling one removes the
     * other.
     */
    addressedIssueIndices?: number[];
    ignoredIssueIndices?: number[];
}

export function saveExpositoryDraft(
    draft: Omit<ExpositoryDraft, 'schemaVersion' | 'savedAt'>,
    scope?: string | null,
): void {
    if (typeof window === 'undefined') return;
    try {
        const payload: ExpositoryDraft = {
            schemaVersion: DRAFT_SCHEMA_VERSION,
            savedAt: new Date().toISOString(),
            ...draft,
        };
        window.localStorage.setItem(draftKey(scope), JSON.stringify(payload));
    } catch (err) {
        // localStorage can throw on quota exceeded or in private mode;
        // a failed save is a non-fatal degradation (the wizard still
        // works in-memory).
        console.warn('[expository] saveDraft failed:', err);
    }
}

export function loadExpositoryDraft(scope?: string | null): ExpositoryDraft | null {
    if (typeof window === 'undefined') return null;
    const key = draftKey(scope);
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ExpositoryDraft;
        if (parsed.schemaVersion !== DRAFT_SCHEMA_VERSION) return null;
        const savedAt = Date.parse(parsed.savedAt);
        if (!Number.isFinite(savedAt) || Date.now() - savedAt > DRAFT_TTL_MS) {
            // Stale — drop it so the pastor doesn't see ancient state.
            window.localStorage.removeItem(key);
            return null;
        }
        return parsed;
    } catch (err) {
        console.warn('[expository] loadDraft failed:', err);
        return null;
    }
}

export function clearExpositoryDraft(scope?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(draftKey(scope));
    } catch (err) {
        console.warn('[expository] clearDraft failed:', err);
    }
}
