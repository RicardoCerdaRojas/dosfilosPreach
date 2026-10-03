import type { ApproachType } from './HomileticalApproach';

export interface KeyWord {
    original: string;
    transliteration: string;
    lemma?: string; // Lema/Raíz de la palabra
    literalTranslation?: string; // Traducción literal
    morphology: string;
    syntacticFunction: string;
    significance: string;
}

// RAG source citation
export interface RAGSource {
    title: string;      // Document title
    author?: string;    // Document author if available
    page?: string;      // Page number or section
    usedFor: string;    // Brief description of how it was used
    /**
     * Stable manifest ID assigned at retrieval time (e.g. "S1", "S2"),
     * present on Phase-B and later outputs. The server-side validator
     * uses this to match the entry against the citation manifest the
     * LLM was given — anything without a matching id (or with one not
     * in the manifest) is dropped as a hallucination.
     *
     * Absent on legacy sermons generated before Phase B. Those still
     * render via the bibliography section but don't get inline
     * markers tied to specific prose locations.
     */
    sourceId?: string;
}

/**
 * Persisted snapshot of the citation manifest the server validated
 * against when the sermon was generated. Travels with the sermon
 * (`SermonContent.citationManifest` for drafts, mirrored into the
 * published copy) so the inline-marker renderer can dereference
 * `[N]` back to a real library chunk without re-running retrieval.
 *
 * Phase B v1 caps the manifest to top-K retrieved chunks (typically 10);
 * `excerpt` is truncated to 280 chars to keep the Firestore doc small.
 */
export interface CitationManifest {
    /** Schema version — increments when the manifest shape changes. */
    version: '1';
    entries: CitationManifestEntry[];
}

export interface CitationManifestEntry {
    /** Stable ID the LLM cites with: "S1", "S2", … */
    sourceId: string;
    /** Library resource doc the chunk belongs to. */
    resourceId: string;
    /**
     * De qué biblioteca salió: la del pastor o la compartida (CORE).
     *
     * Decide si se le puede OFRECER ABRIR la fuente: la suya está en su
     * biblioteca, la de CORE no aparece ahí y el enlace no llevaría a ninguna
     * parte. AUSENTE en los sermones anteriores a este campo — y ausente NO se
     * adivina: sin dato, no se ofrece el enlace. Es la misma regla que gobierna
     * la procedencia del borrador y la autoría.
     */
    scope?: 'personal' | 'core';
    /** Specific chunk within the resource (for back-traceability). */
    chunkId: string;
    /** Snapshot at generation time so the renderer doesn't re-query. */
    title: string;
    author?: string;
    page?: string;
    /**
     * Short excerpt (≤280 chars) from the chunk text — surfaces in the
     * inline-marker popover so the reader can sanity-check that the
     * citation matches what the prose claims.
     */
    excerpt: string;

    // ── Rights-aware fields (ADR-006, PR 0.3) ─────────────────────────
    //
    // Snapshot of the source's rights metadata at generation time. The
    // export pipeline (`aggregateRequiredAttributions`) reads these to
    // decide whether the artefact needs a mandatory attribution footer
    // (e.g. SBLGNT under CC BY 4.0) and to compose it without re-fetching
    // the source doc.

    /** Effective license (e.g. 'Public Domain', 'CC BY 4.0'). */
    license?: string;
    /** Canonical license URL (e.g. https://creativecommons.org/licenses/by/4.0/). */
    licenseUrl?: string;
    /** Verbatim copyright notice line attached by the source publisher. */
    copyright?: string;
    /**
     * Mandatory attribution lines that must appear in the rendered
     * artefact. Aggregated by the export pipeline across all manifest
     * entries; deduplicated so a single SBLGNT attribution renders once
     * per artefact regardless of how many Greek words are cited.
     */
    requiredAttribution?: string[];

    /**
     * ShareAlike trigger for SBLGNT chunks (Phase 3 PR 5, founder decision
     * 2026-05-30). Set to `true` only when this entry reproduces MorphGNT
     * **morphological tagging** (part-of-speech / parsing) in the output, not
     * just the surface Greek text. `aggregateRequiredAttributions` reads it
     * via `hasMorphologyRendered` to decide whether the CC BY-SA 4.0 MorphGNT
     * block must accompany the CC BY 4.0 base-text block.
     *
     * No current pipeline path sets it — `SBLGNTBibleProvider` discards the
     * parsing columns — so it is absent today and the morphology block stays
     * latent. Wired here so the export is correct the day a morphology path
     * lands, without revisiting the licence logic.
     */
    morphologyRendered?: boolean;
}

export interface ExegeticalStudy {
    passage: string;
    context: {
        historical: string;
        literary: string;
        audience: string;
    };
    keyWords: KeyWord[];
    exegeticalProposition: string;
    pastoralInsights: string[];
    ragSources?: RAGSource[];  // Sources used from library
    /**
     * ADR-035 R3 — paralelos canónicos / alusiones AT que el pastor marcó en el
     * estudio guiado (paso Reconocimiento). Opcional/aditivo. Se lleva EN LA
     * ENTIDAD para que lo consuman TANTO el bosquejo como el borrador (antes
     * moría en `seedToExegesis` y solo resucitaba tarde/blando en el draft). Sin
     * esto el sermón salía ciego a las alusiones del pastor (dolor original).
     */
    canonicalParallels?: { reference: string; relevanceNote: string }[];
}

import { HomileticalApproach } from './HomileticalApproach';

export interface HomileticalAnalysis {
    exegeticalStudy: ExegeticalStudy;

    /**
     * 🎯 NEW: Multiple homiletical approaches generated by AI
     * Allows preacher to choose the best direction for their context
     */
    homileticalApproaches?: HomileticalApproach[];

    /**
     * 🎯 NEW: ID of the approach selected by the user
     * Used to determine which approach drives the sermon draft
     */
    selectedApproachId?: string;

    /**
     * 🎯 Computed field: Formatted display text for the selected approach
     * Not stored in DB, computed on the fly for UI display
     */
    approachDisplay?: string;

    /**
     * Selected homiletical FORM for this sermon — the preacher's structural
     * choice, one of the six-form `ApproachType` catalog. Optional: unset when
     * no form has been selected yet. NEVER defaulted to a fabricated form
     * (expositivity is a condition, not a default form). Legacy stored values
     * (`expository`/`thematic`/`narrative`/`topical`) must be run through
     * `normalizeHomileticalApproach` on read.
     */
    homileticalApproach?: ApproachType;

    /**
     * LEGADO. La aplicación ahora vive en cada punto del bosquejo
     * (`outline.mainPoints[].application`), que es lo que permite saber dónde
     * va en el sermón. Este campo se conserva para los sermones anteriores y
     * para las vistas previas de enfoque; no se escribe contenido nuevo acá.
     */
    contemporaryApplication: string[];
    homileticalProposition: string;
    outlinePreview?: string[]; // 🎯 NEW: Preview of outline points for congregation
    outline: SermonOutline;
    ragSources?: RAGSource[];  // Sources used from library
}

/**
 * Sermon outline structure
 * Extracted as separate type for reusability
 */
export interface SermonOutline {
    mainPoints: {
        title: string;
        description: string;
        scriptureReferences: string[];
        /**
         * EL PASAJE QUE ESTE PUNTO EXPONE, escrito por el PASTOR.
         *
         * Distinto de `scriptureReferences`, que son las de apoyo y las propuso
         * el generador. La diferencia importa porque decide quién gana: entre un
         * campo que el pastor mantiene y uno que el generador dejó, gana el
         * suyo. Cuando este campo está, manda sobre todo lo demás.
         *
         * POR QUÉ HIZO FALTA: hasta ahora el pasaje del punto se DEDUCÍA del
         * título —del "(vv. 3)" entre paréntesis— y si el título no lo llevaba,
         * se caía a `scriptureReferences[0]`, que nadie mantiene. El caso real:
         * el título decía "(vv. 3)" y la referencia heredada seguía apuntando a
         * "Jonás 1:3a", del bosquejo de tres puntos que él ya había reemplazado.
         * Ninguna pantalla la mostraba, así que no había forma de corregirla.
         *
         * Ausente = seguir deduciendo del título. No se rellena solo: un campo
         * que aparece lleno sin que el pastor lo escribiera volvería a ser un
         * dato que nadie mantiene.
         */
        passageRef?: string;
        /**
         * La aplicación de ESTE punto — una por punto (decisión del fundador,
         * 2026-08-23).
         *
         * Vive EN el punto, no en una lista aparte, y eso responde por
         * construcción la pregunta que la lista suelta no podía responder:
         * dónde va cada aplicación en el sermón. Antes existía
         * `contemporaryApplication: string[]` a nivel del análisis: se generaba,
         * el pastor la editaba, y el prompt del borrador NUNCA la leía —
         * el borrador inventaba sus propias `implications` desde cero.
         *
         * ORDEN HERMENÉUTICO, no negociable: `texto → punto → aplicación`.
         * La aplicación se DERIVA del punto (que el texto ya gobierna); NO
         * dirige la exposición, la recibe. Es el componente 5 de los 6 de la
         * anatomía del movimiento (Redacción v2 §5); el obligatorio es la
         * explicación exegética. Escribir el punto "hacia" su aplicación sería
         * moralismo con pasos previos — exactamente lo que el descalificador
         * global G3 nombra.
         *
         * Se ancla contra dos anclas que ya existen (§5): la condición real que
         * el pastor nombró y el llamado a la acción de la proposición.
         */
        application?: string;
        /**
         * La DIRECTIVA DEL PASTOR para este punto (decisión del fundador,
         * 2026-08-23). El agente NUNCA la escribe: ni al generar el bosquejo
         * ni al refinarlo por chat. Es el único campo del punto que es voz del
         * pastor, y por eso es atribuible por construcción — sin necesidad de
         * marcar procedencia campo por campo.
         *
         * POR QUÉ NO SE REUSÓ `description`: la descripción la redacta el
         * agente. Volverla vinculante ataría el borrador a la salida anterior
         * del propio modelo y amplificaría su deriva en lugar de la intención
         * del pastor. Un campo que sólo él escribe no tiene ese problema.
         *
         * Son DOS COSAS DISTINTAS, y por eso son dos campos:
         *
         * - `emphasis` MODULA. Es el ángulo desde el cual se expone el punto
         *   ("Dios habla, pero su palabra no es sin propósito: habla para
         *   dirigir a su pueblo"). Gobierna toda la exposición del punto.
         *
         * - `exegeticalNotes` OBLIGA. Son datos del texto que deben aparecer
         *   sí o sí ("'y pagando su pasaje': el hebreo no dice pasaje personal,
         *   personifica a la nave"). Entran al bloque de palabras clave del
         *   borrador, no al fondo de un JSON donde compiten con las que el
         *   modelo eligió por su cuenta.
         *
         * NO altera el orden hermenéutico: la directiva dirige cómo se EXPONE
         * el texto, nunca sustituye lo que el texto dice.
         */
        pastorDirective?: {
            emphasis?: string;
            exegeticalNotes?: string[];
        };
        /**
         * La descripción ya no corresponde al punto que el pastor definió.
         *
         * La redacta el agente para un título y un pasaje dados. Cuando el
         * pastor cambia cualquiera de los dos, el texto sigue describiendo el
         * punto ANTERIOR — y nada en pantalla lo delata. Caso real: un punto
         * quedó en "Jonás 1:16" con una descripción que narraba el versículo
         * 13, y el pastor la leyó como si el sistema le hubiera pegado la
         * descripción del punto vecino.
         *
         * Se MARCA, no se borra ni se regenera sola: borrarla perdería trabajo
         * por corregir una coma del título, y regenerarla gastaría tokens en
         * cada tecleo y pisaría los ajustes hechos a mano. El pastor decide.
         *
         * La marca la pone `applyPropositionContract` y la levanta cualquier
         * reescritura de `description`.
         */
        descriptionStale?: boolean;
    }[];
}


export interface GenerationRules {
    theologicalBias?: string; // e.g., "Reformed", "Charismatic"
    preferredBibleVersion?: string; // e.g., "RV1960", "NVI"
    tone?: 'pastoral' | 'expositivo' | 'narrativo';
    targetAudience?: 'general' | 'youth' | 'children' | 'adults' | 'seniors';
    customInstructions?: string; // User-defined prompt additions
    /** El estilo del manuscrito del usuario (`PhaseConfiguration.manuscriptStyle`). Ausente = el del sistema. */
    manuscriptStyle?: string;
    /**
     * Optional pastoral personalization (situational context,
     * congregation description, illustrations, preacher notes…).
     * When present, the draft prompt prepends a "Voz del Predicador"
     * block so the wizard reaches Faculty parity for occasion-specific
     * sermons.
     */
    personalization?: import('./SermonPersonalization').SermonPersonalization;
    /**
     * Audience rigor tier. Controls how technical the prompt is:
     *   - 'beginner' (default): pastor sin formación teológica formal —
     *     simpler vocabulary, fewer Greek/Hebrew technicalities,
     *     accessible illustrations, less assumed knowledge of systematic
     *     categories.
     *   - 'seminary': pastor con formación seminarista (TMS / reformada
     *     / similar) — deeper morphological + syntactic analysis,
     *     explicit Reformed theological framing where applicable, denser
     *     citations, higher tolerance for technical vocabulary.
     *
     * Affects prompts that build the sermon body (`buildSermonDraftPrompt`).
     * Undefined / 'beginner' = current behavior unchanged.
     */
    audienceRigor?: 'beginner' | 'seminary';
    /**
     * Optional provenance context (audit T3 #16 Fase 1). When the
     * sermon was derived from a paper, the caller can pass the source
     * material here so the draft prompt prepends a "Contexto de
     * origen" block. Lets regenerate calls see the same source
     * material the original pre-population saw, instead of collapsing
     * to homiletics+rules alone.
     *
     * Fase 1 ships paperContext only — Faculty and project follow in
     * Fase 2.
     */
    paperContext?: {
        /** Reference of the paper's primary passage. */
        passage: string;
        /** Paper title for grounding the prompt. */
        title?: string;
        /** Full assembled markdown the paper composed (8-15k chars). */
        assembledMarkdown: string;
        /** Optional homiletical brief authored on the paper. */
        assignmentBrief?: string;
    };
    /**
     * Faculty session context (audit T3 #16 Fase 2). When the sermon
     * was derived from a Faculty conversation, the caller can pass the
     * approved outline + the personalization the user attached at the
     * preview-modal step. Lets regenerate preserve the same outline
     * structure + pastoral framing without forcing the user back to
     * Faculty to re-approve.
     *
     * Faculty's full chat transcript is intentionally NOT included —
     * outline + personalization already capture the actionable content,
     * and the transcript would add 10k+ tokens of conversational noise
     * for marginal quality lift.
     */
    facultyContext?: {
        /** Title of the originating Faculty session. */
        sessionTitle: string;
        /** Approved sermon outline. */
        outline: {
            title: string;
            passage: string;
            proposition: string;
            points: { title: string; verses: string }[];
        };
    };
    /**
     * Project context (audit T3 #16 Fase 2). When the sermon belongs
     * to an AIProject with a contextNote, the caller can pass the
     * project's name + note so the draft adapts tone, depth, and
     * applications to the project's congregational reality (already
     * the pattern in Faculty's `ExtractTheologicalContentUseCase`).
     *
     * Applies independently of paperContext / facultyContext — a
     * paper-derived sermon can also belong to a project; both blocks
     * stack in the prompt.
     */
    projectContext?: {
        /** Project name (display only). */
        name: string;
        /** Free-form project description / context note. */
        contextNote: string;
    };
    /**
     * Pastoral Fidelity seed (Phase 1). When the pastor produced a
     * `PastoralSeed` via the six-step spine, the prompt builder
     * prepends a `PRIMARY VOICE` block + `DEVELOPMENT INSTRUCTIONS`
     * that anchor the draft on the pastor's own central idea,
     * observations, parallels, anecdote, and doxological application.
     * The LLM develops, never originates. Idea central must appear
     * verbatim; the post-gen verbatim check warns if it doesn't.
     */
    /**
     * Fase 4 — fragmentos de sermones que ESTE pastor armó, para que el
     * borrador suene a él. Ausente cuando todavía no hay material suyo del que
     * aprender: entonces el sermón se escribe como se escribe hoy y no se le
     * avisa de ninguna carencia.
     */
    voiceSamples?: readonly { sermonId: string; title: string; excerpt: string }[];
    pastoralSeed?: {
        centralIdea: string;
        observations: string[];
        openQuestion: string;
        pastoralAnecdote: string;
        doxologicalApplication: string;
        mainClauseReference: string;
        mainClauseNote: string;
        /**
         * El estudio de palabra del pastor, y —cuando existe— EL DATO LÉXICO
         * REAL que lo respalda.
         *
         * DOS COSAS DISTINTAS QUE NO PUEDEN CONFUNDIRSE. `discovery` es lo que
         * el pastor vio; `semanticRange` y `useInVerse` son el análisis
         * cacheado (`PastoralWordAnalysis`, Fase 1.5). Antes sólo viajaba
         * `discovery`, así que el borrador imprimía el comentario del pastor
         * bajo el rótulo "Palabras Clave" — como si fuera la glosa léxica. El
         * fundador lo llamó por su nombre: una asociación forzada.
         *
         * El análisis ya existía, cacheado por palabra, y el prompt del sermón
         * nunca lo leía. Misma clase que `contemporaryApplication`: un dato que
         * se genera, se guarda, y ningún consumidor abre.
         */
        wordStudies: {
            word: string;
            reference: string;
            /** Lo que el PASTOR descubrió. Nunca es la glosa. */
            discovery: string;
            /** 3-5 sentidos, ordenados por relevancia al versículo. */
            semanticRange?: string[];
            /** Función gramatical EN ESTE VERSÍCULO — no un paradigma. */
            useInVerse?: string;
            /** Por qué la palabra pesa acá, en 2-3 frases. */
            theologicalWeight?: string;
            /** Léxico usado como fuente primaria, para atribuir. */
            lexiconSource?: string;
        }[];
        parallels: { reference: string; relevance: string }[];
        originalAudienceFunction: string;
        /**
         * Phase 1.6 (ADR-022/024) — genre governs the rules of reading
         * (paso 2). The pastor's own interpretive implication of the
         * genre anchors the draft's reading conventions.
         */
        genre?: string;
        genreImplication?: string;
        bookLocationNote?: string;
        /**
         * Phase 1.6 — the timeless theological principle (paso 7, the
         * Kaiser/Robinson bridge). Distinct from `centralIdea` (the
         * homiletical idea in the preacher's voice): the principle is the
         * transcultural truth the draft must remain faithful to.
         */
        timelessPrinciple?: string;
    };
}

export interface SermonContent {
    /**
     * Por qué camino nació este borrador — ADR-037: "la autoría queda baja y
     * el sermón LO DICE". `workshop` = ensamblado desde las decisiones del
     * taller; `generated` = escrito por el modelo de una vez (la salida de
     * emergencia). AUSENTE en borradores anteriores a este campo: la ausencia
     * de dato no es evidencia de nada, y la UI no muestra insignia — nunca se
     * acusa por falta de registro.
     */
    assembledFrom?: 'workshop' | 'generated';
    title: string;
    introduction: string;
    body: {
        point: string;
        content: string;
        /**
         * Pasaje que ESTE punto expone. Distinto de `scriptureReferences`, que
         * son las de apoyo: el texto expuesto abre el punto, las cruzadas lo
         * respaldan después.
         */
        mainPassageRef?: string;
        /**
         * Palabras clave del estudio que pertenecen a ESTE punto, una por
         * entrada ("*original* (transliteración) — significado / uso aquí").
         * Material ya trabajado en la exégesis: el borrador lo muestra, no lo
         * reinventa. Va después de la exposición y antes de las referencias.
         */
        keyWords?: string[];
        scriptureReferences?: string[]; // Referencias cruzadas
        illustration?: string;
        implications?: string[]; // Implicaciones (al menos 2)
        /**
         * Cita de autoridad. OPCIONAL. Null when no verifiable quote
         * exists in the source material. PR #217 hardened the prompt
         * to refuse invention of attributed quotes — when the LLM has
         * no verified source, it returns null and the renderer skips
         * the block. Never accept a fabricated quote here.
         */
        authorityQuote?: string | null;
        transition?: string; // Transición al siguiente punto
    }[];
    conclusion: string;
    callToAction?: string;
    ragSources?: RAGSource[];  // Sources used from library
    /**
     * Phase B: snapshot of the citation manifest the server validated
     * against at generation time. Drives the inline-marker renderer —
     * each `[N]` in the prose dereferences to a `CitationManifestEntry`.
     * Absent on pre-Phase-B sermons (renderer falls back to
     * bibliography-only mode).
     */
    citationManifest?: CitationManifest;
    /**
     * Phase B telemetry: counts of valid vs. dropped citation markers
     * + dropped `ragSources` entries from the post-generation validator
     * pass. Persisted so engineering can audit how often the LLM
     * drifts off the citation contract without re-running generation.
     *
     * `markersDropped > 0` or `droppedEntries.length > 0` means the
     * LLM hallucinated IDs that the server stripped — the user never
     * saw them. Surfaces below 0.5% in production are healthy; spikes
     * suggest prompt regression or a model change worth investigating.
     */
    citationValidation?: CitationValidationStats;
    /**
     * Fidelidad de citas en la redacción (opción B): resultado del sanitizado de
     * citas atribuidas SIN respaldo en las fuentes. `removed` = cuántas se quitaron
     * (conservando la idea); `residual` = si algo no se pudo limpiar en las rondas
     * (el gate de publicación lo caza). Lo pobla `SermonGeneratorService`.
     */
    citationSanitization?: { removed: number; residual: boolean };
}

/**
 * Telemetry counts emitted by `validateCitations`. Stored on
 * `SermonContent.citationValidation` so the in-app debug surfaces and
 * any downstream analytics pipeline can query them after the fact.
 *
 * Kept here (not in services/) so the persistence layer can import
 * the type without dragging the validator's implementation.
 */
export interface CitationValidationStats {
    markersValid: number;
    markersDropped: number;
    droppedEntries: { reason: 'unknown-id' | 'no-id'; entry: RAGSource }[];
    surfaces: ('introduction' | 'body' | 'conclusion' | 'callToAction')[];
}

