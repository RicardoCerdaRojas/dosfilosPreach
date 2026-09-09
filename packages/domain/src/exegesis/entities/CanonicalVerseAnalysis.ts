import type { PassageReference } from '../../bible/canon/passage-reference';

/**
 * Canonical structured analysis of a single verse — the heart of the
 * exegesis module's data model.
 *
 * "Canonical" here is architectural, not biblical. The artifact is
 * produced ONCE per verse via deep exegetical work, persisted as the
 * source of truth, and then consumed by multiple format-specific
 * composers (academic paper, sermon, devotional, study guide). One
 * rigorous analysis → many ministerial expressions.
 *
 * The schema is intentionally denormalized: every canonical step of
 * the historical-grammatical-literal method is its own field. This
 * lets the student review, critique, and edit each step atomically;
 * lets the platform render distinct study/paper views from the same
 * data; and gives composers a stable surface to read from.
 *
 * Methodological foundation and rationale per field is documented in
 * `docs/exegesis/METODOLOGIA.md`. The 11 canonical steps + 5
 * differentiators map onto specific fields; the cross-reference is
 * inline below.
 *
 * Lifecycle: produced by `GenerateStepUseCase` (analysis stage),
 * persisted on the `ExegeticalPaper` document, consumed by composer
 * use cases that emit format-specific markdown.
 */
export interface CanonicalVerseAnalysis {
    /**
     * Verse identifier. Reuses `PassageReference` constrained to a
     * single verse or a tight contiguous range (e.g. 2 Pe 1:5-7 when
     * a sorites chain is treated as a unit). `chapterStart` and
     * `chapterEnd` always equal because verse-level analyses don't
     * cross chapters.
     */
    reference: PassageReference;

    /**
     * The Greek text of the verse per NA28/UBS5. Stored as the base
     * text the analysis works from. When `textualCriticism.variants`
     * indicates a different adopted reading, the academic composer
     * surfaces the variant in a dedicated paragraph; the base
     * `greekText` field still reflects the standard NA28 reading for
     * traceability.
     */
    greekText: string;

    /**
     * Step 1 (Layer 1 — Establishing the text): textual criticism.
     *
     * Differentiator 4: this field is ALWAYS present, never optional.
     * When the verse has no meaningful variants in the apparatus,
     * `variants` is empty and `note` records the review explicitly
     * (e.g. "Sin variantes significativas en el aparato NA28 para
     * este verso"). This forces the discipline rather than allowing
     * the student to silently skip textual criticism.
     */
    textualCriticism: {
        /**
         * Always present. Either confirms no significant variants
         * were found, or summarizes the variant landscape before the
         * detailed `variants` entries below.
         */
        note: string;
        /**
         * Detailed variants when applicable. Empty array when the
         * `note` says no significant variants exist.
         */
        variants: ReadonlyArray<TextualVariant>;
    };

    /**
     * Steps 2-3 (Layer 2 — Linguistic analysis): syntactic + morphological.
     *
     * Morphological data is intentionally INTEGRATED into syntactic
     * elements rather than separated into its own table. This matches
     * how academic exegetical prose actually reads ("the masculine
     * singular nominative «X» functions as a circumstantial temporal
     * participle"), and prevents the student from seeing morphology
     * as a parsing exercise disconnected from interpretation.
     */
    syntacticAnalysis: {
        /**
         * Main verb of the sentence containing this verse. May be
         * `null` when the verse is part of a longer sentence whose
         * main verb lives in a neighboring verse — common with
         * participial chains, μέν…δέ pairs, or extended periodic
         * sentences. When `null`, `mainVerbNote` explains where the
         * main verb sits and how the verse depends on it.
         */
        mainVerb: SyntacticElement | null;
        /** Required when `mainVerb` is null; otherwise optional. */
        mainVerbNote?: string;
        /**
         * Key syntactic constructions: participles and their function,
         * relative clauses, prepositional phrases with case nuance,
         * genitive constructions per Wallace's categories, etc. Each
         * carries its morphology + function + interpretive significance.
         */
        keyConstructions: ReadonlyArray<SyntacticElement>;
        /**
         * Step 5 — Discourse particles. Empty array when no particle
         * in the verse warrants comment. Anchored in Levinsohn /
         * Runge categories.
         */
        discourseParticles: ReadonlyArray<DiscourseParticle>;
    };

    /**
     * Step 4 (Layer 2 — Linguistic analysis): lexical-semantic
     * analysis per key term in the verse.
     *
     * Differentiator 1: separates `generalSemanticRange` (what the
     * lexicons document across NT usage) from `verseSpecificLoading`
     * (how this verse's immediate context selects from the range).
     * The split is a salvaguard against Carson's "totalidad
     * transferida" fallacy — assuming the full semantic gamut is
     * active in every occurrence.
     */
    lexicalAnalyses: ReadonlyArray<LexicalAnalysis>;

    /**
     * Step 6 (Layer 3 — Hermeneutical context): argumentative role
     * of this verse in the pericope's flow.
     *
     * Differentiator 2: makes argumentative function an explicit,
     * required field. 1-2 sentences naming what this verse DOES in
     * the argument (establishes thesis, develops, contrasts,
     * exemplifies, transitions, concludes). Anchored in Runge's
     * discourse grammar categories.
     */
    argumentativeRole: string;

    /**
     * Step 7 (Layer 3 — Hermeneutical context): historical-cultural
     * background. Empty when the verse doesn't demand background;
     * present only when Greco-Roman, Second-Temple Jewish, or other
     * historical context genuinely informs the meaning. Discipline:
     * relevance, not completeness.
     */
    historicalContext: ReadonlyArray<HistoricalContextPoint>;

    /**
     * Step 8 (Layer 3 — Hermeneutical context): OT intertextual
     * links — quotations (with formula), allusions, echoes per Hays'
     * taxonomy. Empty when the verse has no canonical resonance.
     */
    oldTestamentLinks: ReadonlyArray<OldTestamentLink>;

    /**
     * Step 9 (Layer 4 — Source dialogue): engagement with
     * commentators following the platform's dialectical strategy
     * (anchor + contrast + technical, when applicable).
     *
     * NOT a list of citations — a list of POSITIONS. Each entry
     * articulates what the commentator argues about this specific
     * verse, in the analysis's own voice, with optional verbatim
     * quote when warranted. Anchored to a configured source via
     * `sourceKey`.
     */
    commentatorEngagement: ReadonlyArray<CommentatorPosition>;

    /**
     * Step 10 (Layer 5 — Translation decisions): contested
     * translation cruxes in this verse.
     *
     * Each crux is a problem the analysis takes a position on —
     * with the options on the table, what major commentators argue,
     * and the COMMITMENT chosen with rationale derived from the
     * preceding analysis. Translation is the OUTPUT of the
     * exegetical work, not a guess justified afterwards.
     */
    translationCruxes: ReadonlyArray<TranslationCrux>;

    /**
     * Working translation of the verse before the cruxes are
     * resolved. This is the "first pass" the student would write
     * upon reading the Greek. Surfaced in study mode so the student
     * can compare against the post-crux `finalTranslation` and see
     * which decisions actually shifted the rendering.
     */
    initialTranslation: string;

    /**
     * Final translation reflecting the commitments adopted in
     * `translationCruxes`. This is what the academic composer will
     * present as the paper's translation of the verse. When no
     * cruxes were identified, equals `initialTranslation`.
     */
    finalTranslation: string;

    /**
     * Step 11 (Layer 6 — Synthesis): the verse's thesis. 1-3
     * sentences articulating what THIS verse establishes given the
     * analysis above.
     *
     * May reference the IMMEDIATELY ADJACENT verse only when the
     * grammar of this verse demands it (μέν…δέ pairs, participial
     * chains spanning two verses, comparative pairs). Never
     * references distant verses, never recaps the pericope — that
     * synthesis is the job of the paper's conclusion step.
     */
    verseThesis: string;

    /**
     * Differentiator 5: theological loci this verse touches.
     *
     * Used by non-academic composers (sermon, devotional) where the
     * transition from exegesis to systematic theology is explicit.
     * The academic composer ignores this field — academic prose
     * derives implications inline, not as a tagged list.
     */
    theologicalHooks: ReadonlyArray<TheologicalHook>;

    /**
     * Differentiator 3: confidence flags for specific interpretive
     * claims, used by composers to calibrate hedge language.
     *
     * Composers consult flags when articulating prose: "high"
     * confidence claims earn definitive verbs ("demuestra",
     * "establece"); "medium" earn moderating verbs ("sostiene",
     * "argumenta"); "tentative" earn explicit hedges ("sugiere",
     * "podría leerse como"). Carson's safeguard against
     * over-confidence.
     */
    confidenceFlags: ReadonlyArray<ConfidenceFlag>;

    /**
     * Footnote-worthy extensions. Each entry anchors to a phrase in
     * one of the prose-bearing fields and carries a 1-3 sentence
     * extension of the argument with its sources. The academic
     * composer renders these as proper footnotes; the sermon and
     * devotional composers either inline them lightly or omit them.
     */
    footnoteExtensions: ReadonlyArray<FootnoteExtension>;

    /**
     * When this analysis was first generated. Set by
     * `GenerateStepUseCase`.
     */
    createdAt: Date;
    /**
     * When this analysis was last updated — either by a
     * regeneration or a user-edit pass. Composers use this to
     * decide whether their cached compositions are stale.
     */
    updatedAt: Date;
}

// ── Sub-types ───────────────────────────────────────────────────────────

/**
 * A textual variant in the verse.
 *
 * The schema records each candidate reading with its supporting
 * witnesses (per the apparatus' siglum convention: 𝔓⁴⁶, ℵ, A, B, C,
 * D, etc.) plus the analysis's adopted reading and rationale.
 *
 * Following Metzger's methodology: the rationale should name the
 * canons of textual criticism that informed the choice (e.g. "lectio
 * brevior", "lectio difficilior", manuscript family weight,
 * scribal-tendency analysis).
 */
export interface TextualVariant {
    /** The contested word/phrase in Greek. */
    lemma: string;
    /** Variant readings observed in the apparatus. */
    readings: ReadonlyArray<{
        /** The reading text in Greek. */
        text: string;
        /**
         * Witnesses supporting this reading. Use standard apparatus
         * sigla: papyri (𝔓⁴⁶), majuscules (ℵ, A, B, C, D), versions
         * (lat, syr, cop), patristic citations.
         */
        witnesses: ReadonlyArray<string>;
    }>;
    /** The reading adopted by this analysis. */
    adoptedReading: string;
    /**
     * Justification — should reference the canons of textual
     * criticism that informed the choice (lectio brevior, lectio
     * difficilior, witness weight, etc.). 1-3 sentences.
     */
    rationale: string;
    /**
     * Optional reference to the apparatus footnote (e.g. "NA28 ad
     * loc.", "UBS5 {B} reading"). Helps verifiability.
     */
    apparatusReference?: string;
}

/**
 * A single syntactic element of the verse — a participle, clause,
 * phrase, genitive construction, or the main verb itself. Carries
 * morphology + syntactic function + why it matters interpretively.
 *
 * Designed so academic prose can lift directly: e.g.
 *   - text: "λαλήσας"
 *   - morphology: "participio aoristo activo, nominativo masculino singular"
 *   - syntacticFunction: "participio circunstancial temporal"
 *   - interpretiveSignificance: "Indica acción anterior al verbo principal del v. 2; sujeto «ὁ θεὸς»"
 *
 * Renders to academic prose as:
 *   "el nominativo masculino singular «λαλήσας» («habiendo hablado»)
 *    funciona como un participio circunstancial temporal, indicando
 *    una acción anterior al verbo principal del versículo 2."
 */
export interface SyntacticElement {
    /** Greek text fragment as it appears in the verse. */
    text: string;
    /**
     * Morphological description in natural language matching the
     * paper's display language. Examples (Spanish):
     *   - "participio aoristo activo, nominativo masculino singular"
     *   - "frase preposicional con dativo"
     *   - "verbo aoristo indicativo activo, 3a persona singular"
     */
    morphology: string;
    /**
     * Syntactic function in the sentence. Anchor in Wallace's
     * categories. Examples:
     *   - "circunstancial temporal" (for participles)
     *   - "esfera locativa" (for ἐν + dativo)
     *   - "verbo principal de la oración"
     *   - "cláusula relativa restrictiva"
     *   - "genitivo descriptivo"
     */
    syntacticFunction: string;
    /**
     * Why this element matters for the verse's meaning. 1-2
     * sentences. Sources cited inline within the prose using
     * `(Author, "Title", p. N)` format.
     */
    interpretiveSignificance: string;
}

/**
 * A discourse particle and its argumentative function in this verse.
 * Anchor in Levinsohn / Runge discourse-grammar categories.
 */
export interface DiscourseParticle {
    /** Greek particle (δέ, γάρ, οὖν, μέν, καί, ἀλλά, ὅτι, etc.). */
    particle: string;
    /**
     * Argumentative function. Examples (per Runge):
     *   - "marcador de desarrollo" (δέ)
     *   - "marcador de fundamento" (γάρ)
     *   - "marcador de inferencia" (οὖν)
     *   - "primer miembro de un par contrastivo" (μέν…δέ)
     */
    function: string;
    /**
     * How the particle operates in this specific verse. 1-2
     * sentences. May cite Runge or Levinsohn inline.
     */
    note: string;
}

/**
 * Lexical-semantic analysis of one key term in the verse.
 *
 * Implements Differentiator 1: the schema FORCES the student to
 * articulate `verseSpecificLoading` as separate from
 * `generalSemanticRange`. This makes the contextual selection
 * explicit and auditable — preventing the silent slide from "this
 * word can mean X, Y, or Z" to "therefore it means all of them
 * here".
 */
export interface LexicalAnalysis {
    /** Greek term as it appears in the verse (inflected). */
    term: string;
    /** Lemma (dictionary form). */
    lemma: string;
    /** Initial gloss for non-specialist readers. */
    gloss: string;
    /**
     * General semantic range — what the term carries across NT
     * usage. Cite lexicons (BDAG, LSJ, Louw-Nida).
     */
    generalSemanticRange: {
        /** Possible glosses across the term's range. */
        glosses: ReadonlyArray<string>;
        /** Sources documenting the range. */
        sources: ReadonlyArray<SourceCitation>;
    };
    /**
     * Differentiator 1: how the immediate context of this verse
     * selects from the general range. 1-3 sentences. Names the
     * specific contextual pressure (e.g. "el dativo locativo activa
     * la lectura de esfera, no la instrumental"; "el contraste con
     * el verso siguiente fuerza el matiz preparatorio").
     */
    verseSpecificLoading: string;
    /**
     * Sources cited specifically for the verse-specific loading
     * argument (often distinct from the lexicon citations above —
     * commentators or specialized articles that discuss this verse).
     */
    loadingSources: ReadonlyArray<SourceCitation>;
}

/**
 * A point of historical-cultural background relevant to the verse.
 * Surface ONLY when the verse genuinely requires the background to
 * make sense — not as decorative color. deSilva's honor-shame
 * analysis, Keener's Greco-Roman background, ABD entries are typical
 * sources.
 */
export interface HistoricalContextPoint {
    /**
     * Aspect being explained. Examples:
     *   - "dinámica patrón-cliente"
     *   - "imaginería atlética greco-romana"
     *   - "convenciones del testamento como género literario"
     */
    aspect: string;
    /**
     * How this aspect bears on the verse's meaning. 1-2 sentences.
     * Sources cited inline.
     */
    relevance: string;
    /** Sources backing the historical claim. */
    sources: ReadonlyArray<SourceCitation>;
}

/**
 * An OT intertextual link from this verse — taxonomy from Richard
 * Hays' *Echoes of Scripture in the Letters of Paul*.
 *
 *   - 'quotation' → explicit quote, often with formula (γέγραπται,
 *                    καθὼς εἴρηται, διὰ τοῦ προφήτου).
 *   - 'allusion'  → no formula, but identifiable vocabulary or
 *                    concept that points the reader to a specific
 *                    OT passage.
 *   - 'echo'      → subtler thematic resonance; lower confidence,
 *                    typically argued via cumulative criteria.
 */
export interface OldTestamentLink {
    type: 'quotation' | 'allusion' | 'echo';
    /**
     * OT passage referenced (e.g. "Salmos 110:1", "Génesis 1:26",
     * "Isaías 53:5"). Free-form; not validated against the canon
     * model at the schema level (the analysis layer trusts the LLM /
     * student to produce well-formed references).
     */
    sourcePassage: string;
    /**
     * For quotations, the citation formula present in the verse
     * (γέγραπται, καθὼς εἴρηται, etc.). Empty for allusions/echoes.
     */
    citationFormula?: string;
    /**
     * What the connection contributes interpretively. 1-2 sentences.
     */
    interpretiveBearing: string;
    /**
     * Sources supporting the identification — typically Beale &
     * Carson's *Commentary on the NT Use of the OT*, Hays, or
     * specialized articles.
     */
    sources: ReadonlyArray<SourceCitation>;
}

/**
 * Qué clase de número es el de una cita.
 *
 * Existe porque una hoja del archivo y una página impresa son ambas
 * `number`, y esa ambigüedad es la causa raíz de que el mismo defecto
 * apareciera en seis lugares distintos sin que nadie lo notara: nada en el
 * tipo impedía escribir una donde se esperaba la otra.
 *
 * Ausente significa `'sheet'`, y eso describe con exactitud todo lo escrito
 * antes de la calibración: aquellas citas llevan la hoja del PDF. Rendirlas
 * como «hoja N» es incompleto pero verdadero; rendirlas como «p. N» sería
 * repetir el error sobre trabajos ya entregados.
 */
export type CitationPageKind = 'printed' | 'sheet';

/**
 * A commentator's position on this verse, anchored to the dialectical
 * source strategy.
 *
 * The `position` field is NOT a quote — it's the analysis's synthesis
 * of what the commentator argues, in the analysis's voice. When a
 * verbatim quote is warranted (the commentator phrases something
 * pointedly that direct citation captures better), populate
 * `verbatimQuote` with the exact wording.
 */
export interface CommentatorPosition {
    /** Citation key matching a configured source on the paper. */
    sourceKey: string;
    /** Page number where the position is articulated. */
    page: number;
    /** Si `page` es la página impresa o la hoja del archivo. Ausente = hoja. */
    pageKind?: CitationPageKind;
    /**
     * Dialectical role of this engagement on this verse. Maps to the
     * platform's anchor / contrast / technical strategy.
     */
    role: 'anchor' | 'contrast' | 'technical';
    /**
     * What this commentator argues about this verse. 1-3 sentences,
     * paraphrased in the analysis's voice.
     */
    position: string;
    /**
     * Verbatim quote when the commentator's exact wording captures
     * something paraphrase would lose. Wrapped in quotes by the
     * composer; must be present in the cited source at that page.
     * Empty/absent when paraphrase suffices.
     */
    verbatimQuote?: string;
}

/**
 * A translation crux — a contested decision in this verse with
 * options, commentator positions, and committed resolution.
 *
 * The structure makes the analysis-to-translation derivation
 * transparent: each crux carries the options the student
 * considered, what major commentators argue, and the choice with
 * rationale. The academic composer renders this as the closing
 * synthesis paragraph's "Por esta razón, en este trabajo se
 * adoptará la traducción «X» en lugar de «Y»…" formula.
 */
export interface TranslationCrux {
    /** The Greek phrase or term whose translation is at stake. */
    phrase: string;
    /**
     * Brief description of why this is a crux. 1-2 sentences.
     * Examples:
     *   - "La preposición ἐν + dativo admite tanto el matiz
     *      instrumental ('por medio de') como el locativo ('en')."
     *   - "El término «ἀπαύγασμα» puede leerse como pasivo
     *      ('reflejo') o activo ('resplandor')."
     */
    description: string;
    /** Translation options on the table. */
    options: ReadonlyArray<{
        translation: string;
        /** Brief characterization of this option's interpretive load. */
        characterization: string;
    }>;
    /**
     * What major commentators argue about this crux. Each entry
     * indicates which `options` index the commentator supports.
     */
    commentatorPositions: ReadonlyArray<{
        sourceKey: string;
        page: number;
        /** Si `page` es la página impresa o la hoja del archivo. Ausente = hoja. */
        pageKind?: CitationPageKind;
        /** 1-2 sentence summary of the position. */
        summary: string;
        /** Index into `options` indicating which option this commentator supports. */
        supports: number;
        /**
         * The source's own words behind `summary`, copied exactly from
         * the text the analyzer was given.
         *
         * A crux enlists an author as a witness FOR one option, which
         * is the strongest claim the analysis makes about anyone else's
         * work — and it was the one attribution with nowhere to show
         * its evidence. `verifyAttributedQuotes` checks this against
         * the text that actually reached the model, so a summary can no
         * longer put a position in an author's mouth unchallenged.
         *
         * Optional for backward compatibility: analyses produced before
         * this field existed have no quote, and are left alone rather
         * than retroactively invalidated.
         */
        verbatimQuote?: string;
    }>;
    /** The translation committed to in this paper, with rationale. */
    commitment: {
        /** The chosen translation. */
        chosen: string;
        /**
         * Rationale derived from the analysis above. 1-3 sentences.
         * Should connect back to specific syntactic/lexical findings
         * in `syntacticAnalysis` or `lexicalAnalyses`.
         */
        rationale: string;
    };
}

/**
 * Theological locus touched by the verse. The list is fixed (with
 * 'otro' as escape hatch) so composers can dispatch on locus type.
 *
 * Used by sermon and devotional composers — invisible in the
 * academic paper, where doctrinal implications surface inline within
 * the prose.
 */
export interface TheologicalHook {
    /** Locus name from the standard systematic-theology loci. */
    locus:
        | 'cristologia'
        | 'soteriologia'
        | 'eclesiologia'
        | 'antropologia'
        | 'pneumatologia'
        | 'escatologia'
        | 'bibliologia'
        | 'teologia-propia'
        | 'angelologia-demonologia'
        | 'etica-cristiana'
        | 'otro';
    /** Custom name when `locus === 'otro'`. */
    customLocus?: string;
    /**
     * What the verse specifically contributes to this locus. 1-2
     * sentences. NOT a doctrinal statement — a claim about what
     * THIS verse supports for this doctrine.
     */
    contribution: string;
}

/**
 * Confidence flag for a specific interpretive claim. Implements
 * Differentiator 3 — calibration of hedge language during prose
 * composition.
 */
export interface ConfidenceFlag {
    /**
     * The claim being flagged. Should be specific enough to anchor
     * to a particular interpretive move:
     *   - "el dativo en ἐν τῇ πίστει funciona como locativo de esfera"
     *   - "Hughes' reading of ὑπόστασις como 'naturaleza' supera
     *      la lectura como 'persona'"
     */
    claim: string;
    /** Confidence level. */
    level: 'high' | 'medium' | 'tentative';
    /**
     * Hedge phrases the composer should prefer when articulating
     * this claim. Composers select from this list to calibrate prose:
     *   - high      → ["demuestra", "establece"]
     *   - medium    → ["sostiene", "argumenta"]
     *   - tentative → ["sugiere", "podría leerse como"]
     */
    preferredHedges: ReadonlyArray<string>;
}

/**
 * A footnote-worthy extension of an inline argument. Composers
 * (especially the academic one) render these as proper footnotes;
 * the sermon and devotional composers may inline them lightly or
 * omit them as appropriate to register.
 *
 * The `anchorPhrase` is a verbatim fragment from one of the
 * prose-bearing fields (argumentativeRole, verseThesis,
 * `interpretiveSignificance` of a syntactic element, etc.). The
 * composer fuzzy-matches the anchor in the rendered prose and
 * places the footnote marker after that phrase.
 */
export interface FootnoteExtension {
    /**
     * Verbatim phrase from one of the analysis's prose fields.
     * Composers fuzzy-match this against the rendered prose to
     * place the footnote marker correctly.
     */
    anchorPhrase: string;
    /** The footnote text body. 1-3 sentences. */
    text: string;
    /** Sources cited within the footnote. */
    sources: ReadonlyArray<SourceCitation>;
}

/**
 * A bibliographic citation used inline or in a footnote. Renders to
 * `(Author, "Title", p. N)` format via the academic composer.
 */
export interface SourceCitation {
    /** Key matching a configured source on the paper. */
    sourceKey: string;
    /** Page number(s). Use 0 only when the source has no pagination. */
    page: number;
    /** Si `page` es la página impresa o la hoja del archivo. Ausente = hoja. */
    pageKind?: CitationPageKind;
    /**
     * Optional disambiguator when sourceKey isn't enough — volume
     * number, section reference, or position when the work is large
     * (e.g. "vol. 2", "§142", "ad loc."). Empty string when not
     * needed.
     */
    locator?: string;
}

// ── Empty-state factory ─────────────────────────────────────────────────

/**
 * Builds an empty `CanonicalVerseAnalysis` for a given verse reference.
 * Useful as initial state before the LLM populates fields, or as a
 * test fixture.
 *
 * `note` on textualCriticism is set to a non-empty default so the
 * "always-present" invariant of Differentiator 4 is preserved even
 * in the empty state.
 */
export function buildEmptyCanonicalVerseAnalysis(reference: PassageReference): CanonicalVerseAnalysis {
    const now = new Date();
    return {
        reference,
        greekText: '',
        textualCriticism: {
            note: 'Pendiente de revisión del aparato crítico.',
            variants: [],
        },
        syntacticAnalysis: {
            mainVerb: null,
            keyConstructions: [],
            discourseParticles: [],
        },
        lexicalAnalyses: [],
        argumentativeRole: '',
        historicalContext: [],
        oldTestamentLinks: [],
        commentatorEngagement: [],
        translationCruxes: [],
        initialTranslation: '',
        finalTranslation: '',
        verseThesis: '',
        theologicalHooks: [],
        confidenceFlags: [],
        footnoteExtensions: [],
        createdAt: now,
        updatedAt: now,
    };
}
