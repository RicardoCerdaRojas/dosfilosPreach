import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CitationReview, VerifiedCitation } from './CitationVerification';
import type { CanonicalVerseAnalysis } from './CanonicalVerseAnalysis';

/**
 * One unit of work in the exegesis wizard.
 *
 * Step kinds and their order:
 *   1. 'verse'         — one per verse in the passage range. Generated first.
 *   2. 'conclusion'    — synthesizes accepted verses; no new arguments.
 *   3. 'introduction'  — written LAST (sees body + conclusion to set tesis).
 *   4. 'assembly'      — concatenates accepted markdown + applies TMS
 *                         footnote formatting. Mostly mechanical; user can
 *                         skip review and edit `assembledMarkdown` directly.
 *
 * State machine:
 *   pending → generating → awaiting-review → accepted
 *                    ↘                    ↗
 *                     failed (on error)
 *
 *   From 'awaiting-review' the user can also:
 *     - regenerate (with optional hint) → goes back to 'generating'
 *     - manually edit `accepted.markdown` → stays at 'accepted'
 *
 * History:
 *   `versions` is append-only — every generation, manual edit, and
 *   regeneration is preserved. `accepted` points at the version the user
 *   confirmed (or last edited). Regeneration creates a new version that
 *   becomes `accepted` only if the user explicitly accepts it.
 *
 * Citation verification in v1 is MANUAL (a button the user clicks). The
 * `verifications` field on the accepted version stays empty until the user
 * runs verify. v1.5 will populate it automatically post-generation.
 */
export interface ExegeticalStep {
    id: string;
    paperId: string;
    kind: ExegeticalStepKind;

    /**
     * For `kind === 'verse'`: the specific verse this step covers. Always a
     * single-verse range (chapterStart === chapterEnd, verseStart === verseEnd).
     * For other kinds: null (the step covers the whole paper or its accepted
     * sibling steps).
     */
    verseRef: PassageReference | null;

    /** Display order in the wizard (1, 2, 3, ...). */
    order: number;

    state: ExegeticalStepState;

    /**
     * Most recent generation, regardless of acceptance. While `state ===
     * 'generating'` this is null; it's populated when streaming completes.
     * Once 'accepted', this points to the same version as `accepted`.
     */
    current: ExegeticalStepVersion | null;

    /**
     * The version the user confirmed (or last edited manually). Once set,
     * this is what the assembly step concatenates. Null until the user
     * accepts at least one generation.
     */
    accepted: ExegeticalStepVersion | null;

    /**
     * Append-only history. Useful for "show me what was generated before
     * I edited" and for the `parentVersionId` chain that documents what
     * each regeneration was reacting to.
     */
    versions: ExegeticalStepVersion[];

    createdAt: Date;
    updatedAt: Date;
}

export type ExegeticalStepKind = 'verse' | 'conclusion' | 'introduction' | 'assembly';

export type ExegeticalStepState =
    | 'pending'
    | 'generating'
    | 'awaiting-review'
    | 'accepted'
    | 'failed';

/**
 * One iteration of generation or manual edit for a step.
 */
export interface ExegeticalStepVersion {
    id: string;
    /** The actual content (markdown). What gets concatenated into the paper. */
    markdown: string;

    /**
     * 'generated' — produced by the LLM; 'edited' — user typed over a prior
     * version and saved. 'edited' versions inherit the `parentVersionId`
     * pointing at what they were edited from.
     */
    origin: 'generated' | 'edited';

    /**
     * The version this version was derived from. Set when:
     *   - regeneration: points at the previous 'generated' version
     *   - edit: points at the version being edited
     * Null for the first generation of a step.
     */
    parentVersionId: string | null;

    /**
     * The model used to generate this version. Empty for 'edited' versions.
     * Useful for cost tracking and post-hoc quality analysis ("did Pro 2.5
     * generate better verse 3 than Flash?").
     */
    modelId: string | null;

    /**
     * Optional hint the user provided when triggering regeneration
     * (e.g. "más sintaxis", "cita más a Cockerill"). Recorded so we can
     * show "you asked for X, this is what came back".
     */
    regenerationHint: string | null;

    /** When this version was produced (or saved, for edits). */
    createdAt: Date;

    /**
     * Citation-verification results for this version. v1 leaves this empty
     * until the user clicks "verify"; v1.5 runs it automatically. The
     * `Citation` type is intentionally not modeled yet — citations live
     * inline in `markdown` for v1, and the verifier will introduce its own
     * structure when we build it.
     */
    verifications: VerificationSummary;

    /** Tokens consumed by the LLM for this generation. Null for edits. */
    tokensUsed: number | null;

    /**
     * Canonical structured analysis of the verse, populated when the
     * version was produced by `AnalyzeVerseUseCase` (the new
     * analysis-stage pipeline). Null for:
     *   - non-verse versions (introduction, conclusion, assembly)
     *   - legacy verse versions produced by the markdown-only
     *     `GenerateStepUseCase` before the architectural pivot
     *   - manual `edited` versions (the user edited the rendered
     *     markdown without touching the structured analysis)
     *
     * When present, downstream composers (academic, sermon, devotional)
     * read from this field to produce format-specific markdown — the
     * `markdown` field becomes a snapshot of one such composition.
     *
     * Persisted as a serialized object on Firestore. Forward-compatible
     * with legacy versions: omitting the field preserves prior
     * behavior.
     */
    canonicalAnalysis?: CanonicalVerseAnalysis | null;

    /**
     * Veredicto por cita de la última verificación de esta versión.
     *
     * Se guarda para que la interfaz señale cada cita sin volver a pagar la
     * verificación, y para poder medir el verificador contra una auditoría
     * hecha a mano. Ausente en versiones verificadas antes de que existiera
     * el campo, y en las que nunca se verificaron.
     */
    citationVerdicts?: ReadonlyArray<VerifiedCitation>;

    /** Citas que alguien revisó a mano tras un «no encontrada». Ver `CitationReview`. */
    citationReviews?: ReadonlyArray<CitationReview>;
}

/**
 * Summary of citation verification for a step version. Keeps the shape
 * stable across v1 (manual) and v1.5 (automatic) — the difference is
 * who fills the counts.
 */
export interface VerificationSummary {
    /** When verification last ran for this version. Null if never. */
    lastRunAt: Date | null;
    /** 'manual-v1' or 'auto-v1.5'. */
    verifierVersion: string | null;
    /** Counters by status. Sum may differ from total citations if some are unparseable. */
    counts: {
        verified: number;
        pageMismatch: number;
        notFound: number;
        fuzzyLow: number;
        manualPending: number;
    };
    /** Total citations parsed from the markdown — independent of verification. */
    totalCitations: number;
    /**
     * Fuentes del corpus que el texto NOMBRA sin citarlas en un
     * formato que el verificador sepa leer.
     *
     * Un paper sin citas detectadas pasaba como verificado: verde por
     * vacío. Pero «no hay nada que verificar» y «no supe leer lo que
     * hay» son cosas distintas, y sólo la primera es una buena
     * noticia. Este contador separa las dos.
     *
     * Opcional: los resúmenes guardados antes de que existiera el
     * campo no lo traen, y ausente significa «no se midió», no cero.
     */
    sourcesNamedWithoutCitation?: number;
    /**
     * Citas del análisis que atribuyen palabras a un autor —posturas de
     * comentaristas, testigos de un cruce— sin traer la oración textual.
     * No son errores: son citas que solo se pueden verificar juzgando la
     * paráfrasis, y la meta es que este número baje a cero.
     */
    citationsWithoutVerbatim?: number;
    /**
     * Afirmaciones sobre evidencia manuscrita —códices, papiros,
     * testigos— que ninguna cita de la misma oración respalda.
     *
     * El corpus de crítica textual suele ser parcial: el comentario del
     * aparato sólo discute las variantes que su comité juzgó
     * importantes. Donde calla, la tentación es rellenar de memoria, y
     * una lista de testigos inventada tiene forma de erudición. Este
     * contador la saca del silencio.
     *
     * Opcional: ausente significa «no se midió», no cero.
     */
    witnessClaimsWithoutCitation?: number;
}

export const EMPTY_VERIFICATION_SUMMARY: VerificationSummary = {
    lastRunAt: null,
    verifierVersion: null,
    counts: {
        verified: 0,
        pageMismatch: 0,
        notFound: 0,
        fuzzyLow: 0,
        manualPending: 0,
    },
    totalCitations: 0,
    sourcesNamedWithoutCitation: 0,
    witnessClaimsWithoutCitation: 0,
};

/**
 * Cuánto puede durar `generating` antes de considerarse abandonado.
 *
 * `generating` lo escribe el NAVEGADOR antes de llamar al modelo, y el
 * rollback a `failed` también. Si la pestaña se cierra, navega, recarga o
 * pierde la red en el medio, el `catch` que limpia nunca corre y la bandera
 * queda huérfana: la tarjeta gira para siempre, sobrevive al reload y no hay
 * forma de reintentar desde la UI. Pasó en producción — un paso quedó en
 * `generating` tres horas con su contenido ya generado al lado.
 *
 * El umbral es el techo del servidor (`timeoutSeconds: 540`) más un minuto. Por
 * debajo de eso una generación lenta sigue siendo legítima y no hay que
 * ofrecerle al usuario un reintento que duplicaría el trabajo en curso; por
 * encima, el servidor ya cortó y no queda nadie generando.
 */
export const ABANDONED_GENERATION_AFTER_MS = 600_000;

/**
 * ¿Esta generación quedó huérfana?
 *
 * NO cambia el estado —`state` sigue siendo la fuente de verdad y el documento
 * sigue siendo legible por sí solo, que es la invariante de `StepCard`. Sólo
 * responde si vale la pena ofrecer el reintento, que es una pregunta sobre el
 * reloj y no sobre la máquina de estados.
 */
export function isAbandonedGeneration(
    step: Pick<ExegeticalStep, 'state' | 'updatedAt'>,
    now: Date = new Date(),
): boolean {
    if (step.state !== 'generating') return false;
    const updatedAt = step.updatedAt?.getTime?.();
    // Un `updatedAt` ausente o corrupto no puede probar abandono. Ante la duda
    // se deja girar: ofrecer un reintento sobre una generación viva es peor
    // —cobra dos veces— que dejar una tarjeta girando de más.
    if (typeof updatedAt !== 'number' || Number.isNaN(updatedAt)) return false;
    return now.getTime() - updatedAt > ABANDONED_GENERATION_AFTER_MS;
}
