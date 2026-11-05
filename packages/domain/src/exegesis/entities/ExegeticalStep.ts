import type { PassageReference } from '../../bible/canon/passage-reference';
import type { CitationReview, VerifiedCitation } from './CitationVerification';
import type { CanonicalVerseAnalysis } from './CanonicalVerseAnalysis';
import type { CitationCorrection } from '../services/citationCorrection';

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

    /**
     * Si este paso pertenece al DOCUMENTO que se va a entregar.
     *
     * Vive en el paso y no en una versión porque es una decisión del autor
     * sobre el entregable, no una propiedad de un texto generado.
     *
     * Existe porque antes la pertenencia se DEDUCÍA de tener prosa compuesta,
     * y eso usa una acción tomada con otro propósito como si fuera una
     * declaración. Falla en las dos direcciones: componer para ver cómo queda
     * —que es exploración legítima— metía el versículo al documento sin
     * remedio, y dejar un versículo como análisis a propósito no se podía
     * decir.
     *
     * Ausente equivale a `true`: todo paso aceptado se considera parte del
     * documento mientras nadie diga lo contrario, que es como se comportaban
     * los trabajos anteriores a este campo.
     *
     * Gobierna DOS cosas a la vez, y por eso es una sola marca y no dos: qué
     * entra al ensamble, y entre cuántas secciones se reparte la extensión que
     * exige la rúbrica. Sacar la introducción y la conclusión devuelve su
     * parte del presupuesto a los versículos.
     */
    includeInDocument?: boolean;

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
     * La versión que estaba aceptada al devolver el paso a revisión. Esa acción
     * suelta `accepted`, y es el camino normal para regenerar un paso aceptado:
     * sin esto no se sabría a cuál volver.
     */
    lastAcceptedVersionId?: string | null;

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

    /**
     * Con qué método del trabajo se generó este análisis (etapa 2, capa 3).
     * Ausente en lo generado antes del método o sin él. El aviso de la
     * observación mira esto y no el método actual: cambiar el método no
     * reprocha a los análisis ya hechos.
     */
    analysisMethod?: import('./ExegeticalPaper').ExegeticalMethod | null;

    /**
     * Lo que el análisis leyó de cada fuente: las hojas que quedaron en el
     * prompt tras la selección y el reparto, y si el reparto cortó (PR 1 de
     * «Del corpus al texto»). Ausente en lo generado antes.
     */
    materialRead?: ReadonlyArray<import('../services/materialRead').SourceMaterialRead> | null;

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

    /**
     * Qué citas se corrigieron a mano sobre este análisis, y desde qué
     * valor. Es el rastro de una edición que cambia el trabajo entregable:
     * sin él, una página corregida es indistinguible de una que el
     * analizador acertó a la primera.
     */
    citationCorrections?: ReadonlyArray<CitationCorrection>;

    /** Citas que alguien revisó a mano tras un «no encontrada». Ver `CitationReview`. */
    citationReviews?: ReadonlyArray<CitationReview>;

    /**
     * La prosa que había antes de recomponer el versículo, para deshacer.
     *
     * Recomponer escribe sobre esta misma versión, y copiar la versión entera
     * no cabe: una versión de versículo pesa unos 70 KB (análisis y
     * veredictos), y el TP #9 ya ocupa 912 KB del límite de 1 MB de Firestore.
     * La prosa sola pesa de 2 a 5 KB (medido, 2026-11-02). Los veredictos de
     * la prosa no se guardan: al deshacer, esas citas quedan sin verificar.
     */
    previousProse?: PreviousProse | null;
}

export interface PreviousProse {
    markdown: string;
    /** Las revisiones a mano de esa prosa: van por posición en su texto. */
    citationReviews?: ReadonlyArray<CitationReview>;
    /** `true` si esta es la prosa que se deshizo: ofrecerla es rehacer. */
    undone?: boolean;
    /** Cuándo se deshizo: lo escrito después es más reciente que ella. */
    undoneAt?: Date;
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
        /**
         * Citas cuya página no se pudo comprobar contra nada.
         *
         * Opcional: los resúmenes guardados antes de que existiera el estado
         * no lo traen, y ausente significa «no se midió», no cero.
         */
        pageUnverifiable?: number;
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
     * Citas de la PROSA que se entrega, verificadas junto con el análisis.
     * Ausente: no se midió (versiones anteriores, o sin prosa compuesta).
     * No entran en `counts`: esos deciden el bloqueo de aceptación, y una
     * cita de la prosa no bloquea (no tiene ruta para revisarla a mano).
     */
    proseCitations?: number;
    /** De ellas, cuántas no salieron verificadas. */
    proseCitationsWithIssues?: number;
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
        pageUnverifiable: 0,
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

/**
 * La versión cuyas citas se revisan: la que espera revisión, si hay una; si no,
 * la aceptada.
 *
 * Aceptar acepta SIEMPRE `current`, y el servidor la bloquea mientras tenga
 * citas sin revisar. La página de revisión y «Verificar» miraban `accepted ??
 * current`: en un paso regenerado después de aceptarse revisaban la versión
 * VIEJA, y la nueva seguía bloqueada sin camino (TP #7, #29).
 */
/** Qué se puede deshacer o rehacer en un paso, sobre la versión a la vista. */
export type StepHistoryMove =
    /** Intercambiar la prosa de la versión con la guardada al recomponer. */
    | { kind: 'prose'; versionId: string }
    /** Volver a otra versión del historial. */
    | { kind: 'version'; versionId: string; targetVersionId: string };

export interface StepHistoryMoves {
    undo: StepHistoryMove | null;
    redo: StepHistoryMove | null;
    /** Ir directo a la versión aceptada, si la que se ve es otra. */
    accepted: StepHistoryMove | null;
}

/** La versión aceptada o, si el paso volvió a revisión, la que lo estaba. */
export function lastAcceptedVersion(
    step: Pick<ExegeticalStep, 'accepted' | 'versions' | 'lastAcceptedVersionId'>,
): ExegeticalStepVersion | null {
    return step.accepted ?? step.versions.find(v => v.id === step.lastAcceptedVersionId) ?? null;
}

export function stepHistoryMoves(
    step: Pick<ExegeticalStep, 'state' | 'current' | 'accepted' | 'versions' | 'lastAcceptedVersionId'>,
): StepHistoryMoves {
    if (step.state !== 'accepted' && step.state !== 'awaiting-review') return { undo: null, redo: null, accepted: null };
    const shown = versionUnderReview(step);
    if (!shown) return { undo: null, redo: null, accepted: null };
    const prose = shown.previousProse?.markdown?.trim() ? shown.previousProse : null;
    const parent = shown.parentVersionId ? step.versions.find(v => v.id === shown.parentVersionId) : null;
    // La más reciente que salió de esta: es la que se deshizo.
    const child = [...step.versions].reverse().find(v => v.parentVersionId === shown.id && v.id !== shown.id);
    // Rehacer devuelve lo último que se dejó atrás: una edición hecha después
    // de deshacer la prosa va antes que esa prosa.
    const aceptada = lastAcceptedVersion(step);
    const childIsNewer = !!child && !!prose?.undoneAt
        && new Date(child.createdAt).getTime() > new Date(prose.undoneAt).getTime();
    return {
        undo: prose && !prose.undone
            ? { kind: 'prose', versionId: shown.id }
            : parent ? { kind: 'version', versionId: shown.id, targetVersionId: parent.id } : null,
        redo: prose?.undone && !childIsNewer
            ? { kind: 'prose', versionId: shown.id }
            : child ? { kind: 'version', versionId: shown.id, targetVersionId: child.id } : null,
        accepted: aceptada && aceptada.id !== shown.id
            ? { kind: 'version', versionId: shown.id, targetVersionId: aceptada.id }
            : null,
    };
}

/**
 * Qué número de versión se ve y cuál es la aceptada, contando desde la más
 * antigua que se conserva. `null` si la versión no está en la lista.
 */
export function stepVersionNumbers(
    step: Pick<ExegeticalStep, 'state' | 'current' | 'accepted' | 'versions' | 'lastAcceptedVersionId'>,
): { shown: number | null; accepted: number | null; total: number } {
    const numero = (id: string | undefined) => {
        const i = step.versions.findIndex(v => v.id === id);
        return i === -1 ? null : i + 1;
    };
    return {
        shown: numero(versionUnderReview(step)?.id),
        accepted: numero(lastAcceptedVersion(step)?.id),
        total: step.versions.length,
    };
}

/**
 * La versión con prosa recompuesta. Lo verificado y revisado de la prosa
 * anterior ya no aplica; si había prosa, se guarda para poder deshacer.
 */
export function withRecomposedProse(version: ExegeticalStepVersion, markdown: string): ExegeticalStepVersion {
    const esDeProsa = (path: string) => path.startsWith('prosa@');
    return {
        ...version,
        markdown,
        ...(version.markdown?.trim()
            ? {
                previousProse: {
                    markdown: version.markdown,
                    citationReviews: (version.citationReviews ?? []).filter(r => esDeProsa(r.path)),
                },
            }
            : {}),
        ...(version.citationVerdicts ? { citationVerdicts: version.citationVerdicts.filter(v => v.origin !== 'prose') } : {}),
        // Sus revisiones van por posición en el texto (`prosa@N`) y se pegarían
        // a otra cita (revisión de 8b).
        ...(version.citationReviews ? { citationReviews: version.citationReviews.filter(r => !esDeProsa(r.path)) } : {}),
    };
}

/** Las versiones que el recorte del historial no puede quitar al agregar otra. */
export function versionsToKeepOnAppend(
    step: Pick<ExegeticalStep, 'accepted' | 'lastAcceptedVersionId'>,
    added: Pick<ExegeticalStepVersion, 'id' | 'parentVersionId'>,
): Array<string | null | undefined> {
    // La anterior es a la que se vuelve al deshacer, y a la última aceptada se
    // vuelve de un salto.
    return [step.accepted?.id, step.lastAcceptedVersionId, added.id, added.parentVersionId];
}

/**
 * La versión con su prosa intercambiada por la guardada. Los veredictos de la
 * prosa saliente no valen para la entrante, y no se guardaron para ella.
 */
export function swapPreviousProse(version: ExegeticalStepVersion, now: Date = new Date()): ExegeticalStepVersion {
    const guardada = version.previousProse;
    if (!guardada) return version;
    const esDeProsa = (path: string) => path.startsWith('prosa@');
    const revisiones = version.citationReviews ?? [];
    return {
        ...version,
        markdown: guardada.markdown,
        ...(version.citationVerdicts ? { citationVerdicts: version.citationVerdicts.filter(v => v.origin !== 'prose') } : {}),
        citationReviews: [...revisiones.filter(r => !esDeProsa(r.path)), ...(guardada.citationReviews ?? [])],
        previousProse: {
            markdown: version.markdown,
            citationReviews: revisiones.filter(r => esDeProsa(r.path)),
            undone: !guardada.undone,
            ...(guardada.undone ? {} : { undoneAt: now }),
        },
    };
}

/**
 * El paso sin sus versiones más viejas, de a una, hasta que `cabe` o hasta que no
 * quede qué quitar. El último recurso antes de no poder guardar. Nunca quita aquello
 * de lo que dependen la pantalla y sus botones: lo aceptado, lo que se ve, a qué
 * vuelve «Deshacer» y qué recupera «Rehacer»; ni lo que `tocadas` dice que esta misma
 * escritura acaba de cambiar; ni, en el ensamble, lo generado, con lo que compara el
 * aviso al exportar. Las hijas de lo que sale pasan a su abuela: la cadena sigue.
 */
export function withoutOldestVersions(
    step: ExegeticalStep,
    cabe: (paso: ExegeticalStep) => boolean,
    tocadas: ReadonlyArray<string> = [],
): ExegeticalStep {
    const shown = versionUnderReview(step);
    const hija = [...step.versions].reverse().find(v => v.parentVersionId === shown?.id);
    const quedan = [
        step.accepted?.id, step.accepted?.parentVersionId, step.lastAcceptedVersionId,
        step.current?.id, shown?.parentVersionId, hija?.id, ...tocadas,
    ];
    let paso = step;
    for (const v of step.versions) {
        if (quedan.includes(v.id) || (step.kind === 'assembly' && v.origin === 'generated')) continue;
        // Su madre de ahora: la de la lista original pudo salir antes que ella.
        const madre = paso.versions.find(x => x.id === v.id)?.parentVersionId ?? null;
        const versions = paso.versions
            .filter(x => x.id !== v.id)
            .map(x => (x.parentVersionId === v.id ? { ...x, parentVersionId: madre } : x));
        const porId = (x: ExegeticalStepVersion | null) => (x && versions.find(y => y.id === x.id)) || x;
        paso = { ...paso, versions, current: porId(paso.current), accepted: porId(paso.accepted) };
        if (cabe(paso)) return paso;
    }
    return paso;
}

/**
 * Los punteros del paso al volver a otra versión.
 *
 * Volver nunca acepta: la anterior en el historial puede ser un borrador que
 * nadie aceptó, porque cada versión nace de `current`, y puede tener citas que
 * «Aceptar» bloquearía. Solo la versión ya aceptada vuelve a estarlo, también
 * la que lo estaba antes de devolver el paso a revisión. La aceptada no cambia
 * por otra, así que el documento tampoco.
 */
export function stepAfterVersionMove<S extends Pick<ExegeticalStep, 'state' | 'current' | 'accepted' | 'lastAcceptedVersionId'>>(
    step: S,
    target: ExegeticalStepVersion,
): S {
    if (step.accepted?.id === target.id) return { ...step, current: target, state: 'accepted' };
    if (!step.accepted && step.lastAcceptedVersionId === target.id) return { ...step, current: target, accepted: target, state: 'accepted' };
    return { ...step, current: target, state: 'awaiting-review' };
}

export function versionUnderReview(
    step: Pick<ExegeticalStep, 'state' | 'current' | 'accepted'>,
): ExegeticalStepVersion | null {
    // Sólo un paso aceptado revisa la aceptada. En `failed` o `generating`
    // aceptar también actúa sobre `current` (revisión adversarial de C).
    return step.state === 'accepted'
        ? step.accepted ?? step.current
        : step.current ?? step.accepted;
}

/**
 * El texto de un paso que se muestra y se edita.
 *
 * En el ENSAMBLE aceptado es el documento (`paper.assembledMarkdown`) y no
 * la versión del paso: otros caminos escriben el documento sin tocar el
 * paso —recomponer un versículo lo empalma, «Guardar al paper» lo
 * reemplaza—, y editar desde la versión vieja del paso pisaría ese texto
 * (revisión adversarial, 2026-10-15). En revisión manda el borrador nuevo.
 */
export function stepTextForEditing(
    step: Pick<ExegeticalStep, 'kind' | 'state' | 'current' | 'accepted'>,
    assembledMarkdown: string | null | undefined,
): string {
    if (step.kind === 'assembly' && step.state !== 'awaiting-review' && assembledMarkdown?.trim()) {
        return assembledMarkdown;
    }
    return versionUnderReview(step)?.markdown ?? '';
}
