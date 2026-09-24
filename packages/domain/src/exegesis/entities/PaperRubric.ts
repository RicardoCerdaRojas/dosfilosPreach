import { SOURCE_TYPE_CATALOG, SOURCE_TYPE_GROUPS, type SourceType } from './SourceType';
import type { ExegeticalStepKind } from './ExegeticalStep';
import type { CourseBibliographyEntry } from '../services/courseBibliography';

/**
 * Paper-level rubric — the seminary's grading criteria for THIS paper,
 * structured so the system can both (a) check the user's corpus and
 * plan against the requirements (gap detection) and (b) teach a novice
 * student the rationale behind each requirement.
 *
 * Per the redesign discussion, the rubric is a first-class entity
 * separate from `UserStyleGuide`: the style guide is persistent at the
 * user level (the seminary's TMS guide changes once a year), whereas
 * the rubric is per-paper (one rubric for an exegetical paper on
 * Hebrews 1:1-4, a different one for the next assignment).
 *
 * Storage: stored inline inside `ExegeticalPaper.rubric`. No separate
 * collection — one rubric per paper, lifecycle bound to the paper.
 *
 * Source of truth: either uploaded by the student (PDF/text) and parsed
 * by `IPaperRubricExtractor`, or generated from `DEFAULT_RUBRIC_TEMPLATE`
 * when the student opts in to the system default (e.g. they don't have
 * a rubric from their professor for this assignment). The
 * `provenance` field keeps that distinction visible in the UI so
 * students know whether the requirements come from their seminary or
 * from a sensible default.
 */
export interface PaperRubric {
    /**
     * Where the rubric came from. Drives the UI hint shown alongside
     * each requirement (a system-default requirement is presented as
     * "suggested for academic rigor", whereas an extracted-from-document
     * requirement is presented as "your seminary requires").
     */
    provenance: RubricProvenance;

    /**
     * Free-text description of the assignment as parsed from the source
     * (or empty for system defaults). Useful context for the student to
     * confirm "yes, this is the rubric I expect".
     */
    description: string | null;

    /**
     * Expected length, expressed as a range in either pages or words.
     * Both bounds are nullable so partial information from the rubric
     * can be captured (e.g. "minimum 15 pages" with no upper bound).
     */
    expectedLength: ExpectedLengthRange | null;

    /**
     * Citation standard the rubric requires (e.g. "TMS 2024-25",
     * "Turabian 9th ed."). Used for cross-checking against the user's
     * active style guide — if the rubric says Turabian and the user's
     * style guide is SBL, we flag a mismatch in the setup UI.
     *
     * Free-form string (not enum) because the space of citation
     * standards is open and each seminary phrases them differently.
     */
    citationStandard: string | null;

    /**
     * Las obras que el curso manda leer, por su nombre.
     *
     * `sourceRequirements` dice CUÁNTAS fuentes de cada tipo hacen falta;
     * esto dice CUÁLES. La diferencia es la que el estudiante nota al
     * final: «tres comentarios críticos» se cumple con cualquier tres, y
     * «Ross, Craigie y Waltke–O'Connor» es lo que el profesor busca en las
     * notas al pie.
     *
     * Vacío por defecto: las rúbricas anteriores a este campo, y los
     * sílabos que no listan bibliografía, se deserializan como `[]`.
     */
    courseBibliography: ReadonlyArray<CourseBibliographyEntry>;

    /**
     * Per-`SourceType` quantitative requirements. The setup UI
     * computes "you have N of M required" against the user's corpus
     * and surfaces gaps. Empty array means the rubric has no
     * type-specific minimums (rare; used by the very-permissive
     * default).
     */
    sourceRequirements: ReadonlyArray<SourceRequirement>;

    /**
     * Per-step structural expectations. For each step kind, which
     * source types should appear and what to emphasize. Drives the
     * default `StepSourcePlan` proposed to the student.
     *
     * If empty, the system falls back to `SOURCE_TYPE_CATALOG`
     * `typicalUsage` defaults — coarser but still sensible.
     */
    structuralExpectations: ReadonlyArray<StructuralExpectation>;

    /**
     * v1.7+ qualitative grading criteria. The "rubric levels" half of
     * the dual model: each criterion (e.g. "Estilo de escritura",
     * "Coherencia y lógica") carries level-based descriptions
     * (Ejemplar / Competente / Aceptable / Deficiente) with optional
     * point ranges. Real-world seminary rubrics often live ENTIRELY in
     * this qualitative space — the prescriptive fields above
     * (`sourceRequirements`, `expectedLength`) stay empty for them.
     *
     * The composer emits these as a `## Criterios cualitativos de
     * evaluación` block so the model writes prose that targets the
     * exact dimensions the professor will grade.
     *
     * Empty by default. Backward-compatible: legacy rubrics (created
     * before this field existed) deserialize as `[]`.
     */
    qualityCriteria: ReadonlyArray<QualityCriterion>;

    /**
     * Optional pointer to the corpus that originated this rubric (for
     * uploaded rubrics). Null for system defaults and pasted-text
     * rubrics. Lets the UI offer "view original" and lets the
     * extractor re-parse if the user requests a refresh.
     */
    sourceCorpusId: string | null;

    /**
     * Free-text the user may paste in lieu of uploading a document
     * (e.g. they only have an email from their professor). Stored so
     * we can re-extract if the prompt evolves.
     */
    sourcePastedText: string | null;

    /**
     * Pointer to the `UserRubric` template this rubric was last applied
     * from. Set by `applyRubricTemplateToPaper` and by
     * `saveCurrentRubricAsTemplate`. Preserved across `updateRubric`
     * (manual edits keep the breadcrumb so the UI can pre-select the
     * "started from" template). Cleared by `extractRubricFromText` and
     * `resetRubric` (those create a fresh origin).
     *
     * Null for rubrics that never came from a saved template.
     */
    sourceTemplateId: string | null;

    /**
     * Cómo se maqueta el documento entregado.
     *
     * `null` significa «la guía de la casa»: Times New Roman 12 a doble
     * espacio, que es lo que pide TMS y lo que el exportador hacía cableado.
     *
     * Existe porque la norma de la casa y la norma de LA ENTREGA no siempre
     * coinciden, y hasta ahora ganaba la de la casa sin que nadie pudiera
     * cambiarlo. El trabajo práctico semanal de griego se pide a espacio
     * simple con una línea entre párrafos; el trabajo exegético largo, a
     * doble espacio. Es el mismo estudiante, el mismo seminario y dos
     * formatos, y quien los distingue es el encuadre de cada entrega.
     */
    formatting: PaperFormatting | null;

    /** When the rubric was first attached to the paper. */
    createdAt: Date;
    /** Last time the user edited or re-extracted the rubric. */
    updatedAt: Date;
}

/**
 * Interlineado del cuerpo. Los nombres son los de la guía, no los números:
 * quien llena el formulario lee «espacio simple» en su sílabo, no «240».
 */
export type LineSpacing = 'single' | 'one-and-a-half' | 'double';

export interface PaperFormatting {
    lineSpacing: LineSpacing;
    /**
     * Si entre párrafos va una línea en blanco.
     *
     * Va aparte del interlineado porque son decisiones independientes y los
     * sílabos las piden por separado: «espacio simple con una línea adicional
     * entre párrafos» son dos instrucciones, no una. En Word esto es el
     * espacio POSTERIOR del párrafo, no un renglón vacío de verdad —un
     * renglón vacío se descuadra al editar y cuenta como párrafo—.
     */
    blankLineBetweenParagraphs: boolean;
}

/** La maquetación de la casa, cuando la rúbrica no dice otra cosa. */
export const DEFAULT_PAPER_FORMATTING: PaperFormatting = {
    lineSpacing: 'double',
    blankLineBetweenParagraphs: false,
};

export type RubricProvenance =
    | 'extracted-from-document'   // Uploaded PDF parsed by the extractor
    | 'extracted-from-text'       // Pasted text parsed by the extractor
    | 'system-default'            // Hard-coded TMS exegetical default
    | 'from-template'             // Applied from the user's saved template library
    | 'user-edited';              // User hand-edited the rubric (any origin)

export interface ExpectedLengthRange {
    /** 'pages' or 'words'. Stored explicitly so the UI doesn't have to guess. */
    unit: 'pages' | 'words';
    min: number | null;
    max: number | null;
}

/**
 * Quantitative requirement: at least `minimum` and at most `maximum`
 * sources of the given type. The student's corpus is checked against
 * this and gaps are surfaced before generation can start.
 */
export interface SourceRequirement {
    sourceType: SourceType;
    /** Minimum number of sources of this type required. 0 = explicitly optional. */
    minimum: number;
    /** Optional maximum. Null means no upper bound. */
    maximum: number | null;
    /**
     * One-line rationale shown to the student ("para análisis lexical
     * técnico el seminario espera al menos un BDAG/HALOT"). Localized
     * already — the extractor produces the rationale in the paper's
     * `displayLanguage`, and system defaults provide both languages
     * via i18n keys.
     *
     * For rubrics extracted from a document this is a verbatim or
     * paraphrased justification from the source; for system defaults
     * it's a curated explanation we own.
     */
    justification: string;
}

/**
 * Section-level expectation. For each step kind (introduction, verse,
 * conclusion), which source types should be emphasized. The setup
 * UI's "structural plan" step pre-fills its picker from this and lets
 * the student override.
 *
 * The `assembly` step is intentionally omitted — assembly is purely
 * mechanical concatenation, no source emphasis applies.
 */
export interface StructuralExpectation {
    /** 'introduction' | 'verse' | 'conclusion'. */
    section: Exclude<ExegeticalStepKind, 'assembly'>;
    /**
     * Source types that should typically contribute to this section.
     * The orchestrator weights them up; types not in this list are
     * still allowed but de-emphasized.
     */
    emphasizedTypes: ReadonlyArray<SourceType>;
    /**
     * Pedagogical rationale shown in the plan UI. Kept as a plain
     * string for back-compat with rubrics extracted from a user
     * upload (where the LLM produces a free-form justification we
     * can't translate). System-default rubrics ALSO populate
     * `justificationKey` so the UI can render a localized version.
     */
    justification: string;
    /**
     * Optional i18n key. When present, the UI prefers
     * `t(justificationKey)` over the literal `justification` so
     * system-default rubrics render in the user's display language.
     * Absent for user-extracted rubrics (no key to look up).
     */
    justificationKey?: string;
}

/**
 * v1.7+ qualitative grading criterion. One row of the classic
 * "levels-based" rubric grid (Estilo de escritura, Coherencia y
 * lógica, Evidencia de investigación, etc.). The composer surfaces
 * these to the model so the prose targets the dimensions the
 * professor will grade.
 */
export interface QualityCriterion {
    /** Stable id within the rubric (e.g. "qc-style", "qc-coherence"). */
    id: string;
    /** Short label as it appears in the rubric grid ("Estilo de escritura y formato"). */
    name: string;
    /**
     * One-line description of what this criterion evaluates. Optional —
     * many real-world rubrics use the criterion name + the level
     * descriptions as the whole signal.
     */
    description?: string;
    /**
     * Maximum points the criterion can earn (e.g. 15 for "Estilo",
     * 25 for "Organización"). Optional for rubrics that grade
     * without numeric weights. When present, the editor surfaces a
     * compact "X pts max" badge so the student sees the relative
     * weight of each criterion.
     */
    maxPoints?: number;
    /**
     * Level-by-level descriptors. The ordering is meaningful: highest
     * quality first (Ejemplar → Competente → Aceptable → Deficiente).
     * Typically 4 levels but the schema accepts 2-5 so rubrics with
     * different banding (e.g. "Outstanding / Satisfactory /
     * Unsatisfactory") fit.
     */
    levels: ReadonlyArray<QualityCriterionLevel>;
}

export interface QualityCriterionLevel {
    /** Label of the level ("Ejemplar", "Competente", "Excellent"). */
    label: string;
    /** Full description of what work at this level looks like. */
    description: string;
    /**
     * Points awarded at this level. Optional. When present, must
     * not exceed the parent criterion's `maxPoints`.
     */
    points?: number;
}

/**
 * Default rubric for TMS-style exegetical papers — applied when the
 * user has no per-paper rubric to upload. Numbers are deliberately
 * conservative (achievable for a serious student paper) but enforce
 * the academic-rigor floor we want to teach.
 *
 * Justifications use generic English here; the UI layer translates
 * them via i18n keys keyed off `sourceType` when rendering. A future
 * refactor can replace these strings with i18n keys directly so
 * non-English rendering doesn't go through a translation table —
 * deferred because it makes this constant noisier without changing
 * runtime behavior.
 */
export const DEFAULT_TMS_EXEGETICAL_RUBRIC: PaperRubric = {
    provenance: 'system-default',
    description:
        'Applied when no seminary-specific rubric is provided. Reflects the academic-rigor expectations of a Master\'s-level TMS / Turabian exegetical paper.',
    expectedLength: { unit: 'pages', min: 15, max: 25 },
    citationStandard: 'TMS / Turabian',
    sourceRequirements: [
        {
            sourceType: 'biblical-text-edition',
            minimum: 1,
            maximum: 2,
            justification: 'A serious exegetical paper engages the original-language text edition (NA28 / BHS / Rahlfs LXX).',
        },
        {
            sourceType: 'lexicon-technical',
            minimum: 1,
            maximum: null,
            justification: 'Word-level decisions must be grounded in a technical lexicon (BDAG / HALOT / LSJ), not a popular dictionary.',
        },
        {
            sourceType: 'theological-dictionary',
            minimum: 1,
            maximum: null,
            justification: 'A theological dictionary (TDNT / NIDNTTE / EDNT) supports semantic-domain and theological-context decisions beyond the lexicon.',
        },
        {
            sourceType: 'grammar-syntax',
            minimum: 1,
            maximum: null,
            justification: 'Syntactic claims must be supported by a technical grammar (BDF / Wallace / Robertson) — not just commentary opinion.',
        },
        {
            sourceType: 'commentary-critical',
            minimum: 2,
            maximum: null,
            justification: 'Two or more critical-technical commentaries (WBC / NIGTC / Hermeneia / ICC) anchor the paper\'s exegetical argument in current scholarship.',
        },
        {
            sourceType: 'commentary-expository',
            minimum: 1,
            maximum: 3,
            justification: 'A mid-level expository commentary (NICOT/NICNT / BECNT / Pillar) bridges the technical exegesis to its theological synthesis.',
        },
        {
            sourceType: 'historical-background',
            minimum: 1,
            maximum: null,
            justification: 'Historical-cultural context (deSilva / Keener / ABD) prevents ahistorical readings.',
        },
        {
            sourceType: 'theological-monograph',
            minimum: 0,
            maximum: null,
            justification: 'A focused monograph adds depth on a specific theological theme — recommended but not strictly required.',
        },
        {
            sourceType: 'journal-article',
            minimum: 0,
            maximum: null,
            justification: 'Recent peer-reviewed articles surface current scholarly debate — recommended for upper-level work.',
        },
        {
            sourceType: 'primary-source-ancient',
            minimum: 0,
            maximum: null,
            justification: 'Ancient primary sources (Josephus / Philo / Apostolic Fathers) strengthen background claims.',
        },
    ],
    courseBibliography: [],
    structuralExpectations: [
        {
            section: 'introduction',
            emphasizedTypes: ['historical-background', 'theological-monograph', 'commentary-expository'],
            justification:
                'The introduction frames the passage and presents the thesis — historical context and theological positioning carry it; technical lexical/syntactic analysis belongs in the body.',
            justificationKey: 'paperSetup.subSteps.plan.rubricJustification.introduction',
        },
        {
            section: 'verse',
            emphasizedTypes: [
                'biblical-text-edition',
                'critical-apparatus',
                'lexicon-technical',
                'theological-dictionary',
                'grammar-syntax',
                'commentary-critical',
            ],
            justification:
                'Verse-by-verse work is where text-critical, lexical, and syntactic decisions live. Critical commentaries lead the discussion; expository commentaries play a supporting role.',
            justificationKey: 'paperSetup.subSteps.plan.rubricJustification.verse',
        },
        {
            section: 'conclusion',
            emphasizedTypes: ['commentary-critical', 'commentary-expository', 'theological-monograph'],
            justification:
                'The conclusion synthesizes the verse-level findings into a coherent theological reading — commentaries and monographs provide the integrative voice; lexicons step back.',
            justificationKey: 'paperSetup.subSteps.plan.rubricJustification.conclusion',
        },
    ],
    qualityCriteria: [],
    sourceCorpusId: null,
    sourcePastedText: null,
    sourceTemplateId: null,
    formatting: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

/**
 * Builds a fresh instance of the default rubric with current
 * timestamps. Used at paper-creation time when the user opts in to
 * the system default. Returning a fresh instance avoids accidental
 * mutation of the shared template constant.
 */
export function buildDefaultRubric(): PaperRubric {
    const now = new Date();
    return {
        ...DEFAULT_TMS_EXEGETICAL_RUBRIC,
        // Spread copies the shape; explicit overrides for the date
        // fields ensure each new paper records when its rubric was
        // applied (vs. the 1970-epoch sentinel on the template).
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Builds a "strategy-only" rubric: zero per-type minimums, kept
 * structural expectations from the default. Use when the student
 * wants to lean on the dialectical strategy as their sole guidance
 * without the seminary-rigor type counts.
 *
 * The role-coverage card falls back to the strategy's typical
 * counts (4 anchors, 4 contrasts, 3 technicals) when the rubric has
 * no per-role minimum — see `computeEffectiveRoleTargets`. So this
 * preset doesn't lose all guidance: it transfers it from rubric to
 * strategy.
 */
/**
 * Sentinel id used by the create + apply flows to request the
 * strategy-only preset instead of a real `UserRubric` template id.
 * Distinct from any real Firestore id because it begins with `__`,
 * which the create/apply use cases never persist.
 *
 * Lives in the domain so both `CreateExegeticalPaperUseCase` and
 * `ApplyStrategyOnlyRubricToPaperUseCase` can share the constant
 * without one importing the other.
 */
export const STRATEGY_ONLY_RUBRIC_PRESET_ID = '__strategy-only';

export function buildStrategyOnlyRubric(): PaperRubric {
    const now = new Date();
    return {
        provenance: 'system-default',
        description:
            'Sin minimums por tipo. La estrategia dialéctica (anclas + contrastes + técnicas) actúa como guía única; el alumno arma el corpus por rol según el método.',
        expectedLength: { unit: 'pages', min: 10, max: 25 },
        citationStandard: null,
        sourceRequirements: [],
        courseBibliography: [],
        // Keep the structural expectations from the default — they're
        // useful guidance for the planner regardless of whether the
        // rubric specifies per-type minimums.
        structuralExpectations: DEFAULT_TMS_EXEGETICAL_RUBRIC.structuralExpectations,
        qualityCriteria: [],
        sourceCorpusId: null,
        sourcePastedText: null,
        sourceTemplateId: null,
        formatting: null,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Compliance result of checking a corpus (a list of `ProjectSource`
 * sourceTypes) against a rubric. The setup UI renders this as the gap
 * widget and gates the "Continue to plan" button.
 *
 * Pure data — no behavior. Computed by a free function in the
 * application layer (not on the entity itself) so callers can choose
 * when to recompute (e.g. on every source change vs. on demand).
 */
export interface RubricComplianceReport {
    /** Per-requirement breakdown — one entry per `SourceRequirement`. */
    requirements: ReadonlyArray<RequirementCheck>;
    /** True when every minimum is met. */
    meetsMinimums: boolean;
    /** Sum of `minimum - have` across requirements with `have < minimum`. */
    totalMissing: number;
}

export interface RequirementCheck {
    sourceType: SourceType;
    required: number;
    have: number;
    missing: number;
    /** True iff `have >= required`. */
    satisfied: boolean;
    /** Justification copied verbatim from the matching `SourceRequirement`. */
    justification: string;
}

/**
 * Computes how a list of source types stacks up against a rubric's
 * `sourceRequirements`. Pure function: same inputs → same output.
 *
 * Lives on the entity module (not in application or web) because
 * (a) it depends only on domain types and (b) both surfaces — the
 * setup UI's gap card and the future generation gate — need to call
 * it identically. Co-locating with the entity keeps the rule "what
 * counts as compliant" anchored to the rubric definition.
 *
 * Counts every requirement listed on the rubric, including those
 * with `minimum: 0` (which always end up satisfied). The UI hides
 * zero-minimum requirements that are also empty so the card stays
 * focused; the report itself stays exhaustive so analytics and the
 * orchestrator can audit "are optional types being engaged?".
 */
export function computeRubricCompliance(
    sourceTypes: ReadonlyArray<SourceType>,
    rubric: PaperRubric,
): RubricComplianceReport {
    const counts = new Map<SourceType, number>();
    for (const t of sourceTypes) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    const requirements: RequirementCheck[] = rubric.sourceRequirements.map(req => {
        const have = counts.get(req.sourceType) ?? 0;
        const missing = Math.max(0, req.minimum - have);
        return {
            sourceType: req.sourceType,
            required: req.minimum,
            have,
            missing,
            satisfied: have >= req.minimum,
            justification: req.justification,
        };
    });
    const meetsMinimums = requirements.every(r => r.satisfied);
    const totalMissing = requirements.reduce((sum, r) => sum + r.missing, 0);
    return { requirements, meetsMinimums, totalMissing };
}

/**
 * Categorical academic level a rubric makes feasible. Computed from
 * `assessRubricRigor`. The thresholds are calibrated against
 * real-world expectations:
 *
 *   - **pastoral** — sermon prep / Bible-study notes; 1-2
 *     commentaries + maybe a lexicon. Defensible biblical work,
 *     not academic.
 *   - **seminary** — typical undergraduate/MDiv exegetical paper:
 *     2-3 critical commentaries + a lexicon + a theological
 *     dictionary + some background.
 *   - **research** — ThM / advanced seminary / dissertation
 *     chapter: heavy on tier-3 sources across multiple groups.
 *   - **publishable** — peer-reviewed journal / monograph: dense
 *     coverage of every group with multiple tier-3 sources each.
 */
export type RubricRigorLevel = 'pastoral' | 'seminary' | 'research' | 'publishable';

export interface RubricRigorAssessment {
    /**
     * Sum of `minimum` across requirements with `minimum > 0`.
     * Reflects how many sources the rubric REQUIRES (regardless of
     * what the user has actually added to their corpus).
     */
    totalMinimum: number;
    /**
     * Weighted academic score: sum(minimum × catalog.rigorTier).
     * A `commentary-critical` minimum of 2 contributes 2×3 = 6;
     * a `commentary-expository` minimum of 2 contributes 2×2 = 4.
     * Drives the `level` bucketing.
     */
    rigorScore: number;
    /**
     * Number of distinct `SOURCE_TYPE_GROUPS` covered by required
     * requirements (0–5). High score with low breadth (e.g. 6
     * critical commentaries, nothing else) flags an unbalanced
     * rubric — the UI can warn separately if needed.
     */
    groupBreadth: number;
    /** Categorical level surfaced to the user. */
    level: RubricRigorLevel;
}

const RIGOR_LEVEL_THRESHOLDS: ReadonlyArray<{ level: RubricRigorLevel; minScore: number }> = [
    { level: 'publishable', minScore: 50 },
    { level: 'research', minScore: 25 },
    { level: 'seminary', minScore: 10 },
    { level: 'pastoral', minScore: 0 },
];

export function assessRubricRigor(rubric: PaperRubric): RubricRigorAssessment {
    let totalMinimum = 0;
    let rigorScore = 0;
    const groupsSeen = new Set<string>();
    for (const req of rubric.sourceRequirements) {
        if (req.minimum <= 0) continue;
        totalMinimum += req.minimum;
        const tier = SOURCE_TYPE_CATALOG[req.sourceType].rigorTier;
        rigorScore += req.minimum * tier;
        const group = SOURCE_TYPE_GROUPS.find(
            g => (g.types as ReadonlyArray<string>).includes(req.sourceType),
        );
        if (group) groupsSeen.add(group.groupKey);
    }
    const level = (RIGOR_LEVEL_THRESHOLDS.find(t => rigorScore >= t.minScore) ?? RIGOR_LEVEL_THRESHOLDS[RIGOR_LEVEL_THRESHOLDS.length - 1]).level;
    return {
        totalMinimum,
        rigorScore,
        groupBreadth: groupsSeen.size,
        level,
    };
}
