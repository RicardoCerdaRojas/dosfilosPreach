import {
    buildPreachingStudyRubric,
    buildStrategyOnlyRubric,
    STRATEGY_ONLY_RUBRIC_PRESET_ID,
    type CreateExegeticalPaperInput,
    type ExegeticalPaper,
    type IExegeticalPaperRepository,
    type IUserRubricRepository,
    type PaperRubric,
    DEFAULT_STRATEGY_FOR_NEW_PAPER,
} from '@dosfilos/domain';

/**
 * Re-export so older callers (web hooks) that imported the sentinel
 * from the application barrel keep working. The domain is the source
 * of truth — see `PaperRubric.ts`.
 */
export { STRATEGY_ONLY_RUBRIC_PRESET_ID };

/**
 * Creates a new exegetical paper in 'configuring' phase.
 *
 * The use case trusts the caller to have validated the passage with
 * `parsePassageReference` or `buildPassageReference` first — it does NOT
 * re-parse. This keeps the boundary clean: parsing is presentation logic
 * (the UI tries multiple inputs); persistence is the use-case concern.
 *
 * `styleGuideId` is allowed to be null in v1 — the orchestrator will
 * reject generation until a guide is attached, but a paper can exist
 * without one.
 *
 * `assignmentBrief` is optional free text the professor or the student
 * provided to frame the paper. Stored verbatim; the orchestrator
 * threads it into every step's system prompt.
 *
 * `rubricTemplateId` resolution order:
 *   1. Explicit `rubricTemplateId` → copy that template's content.
 *   2. Omitted + user has a default template → copy the default.
 *   3. No default (or no rubricRepository wired) → repo's createPaper
 *      seeds the system default rubric.
 *
 * `initialSources` (las fuentes por defecto de la serie) se agregan al nacer,
 * sin fragmentos: llegan listas para extraer contra ESTE pasaje, igual que
 * las que se heredan de un trabajo hermano. Antes se aceptaban y se
 * descartaban, y la configuración exegética de la serie no llegaba a ningún
 * trabajo (etapa 0).
 */

/**
 * Normalizes a brief: trims whitespace, returns null for empty
 * strings. Keeps Firestore docs consistent (null vs. empty string is
 * a needless distinction the rest of the system would have to
 * handle).
 */
function normalizeBrief(brief: string | null | undefined): string | null {
    if (brief === undefined || brief === null) return null;
    const trimmed = brief.trim();
    return trimmed.length === 0 ? null : trimmed;
}

export class CreateExegeticalPaperUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        // Optional — when omitted the use case skips template
        // resolution entirely (paper gets the system default
        // rubric seeded by the repo). Wiring it on adds the
        // "auto-apply user default" behavior.
        private userRubricRepository?: IUserRubricRepository,
        /**
         * Para no agregar un libro que ya se borró de la biblioteca (la serie
         * guarda la referencia y el libro puede no estar). Uno por uno y no la
         * biblioteca entera: cada recurso pesa hasta 800 KB y una serie crea
         * varios trabajos a la vez; además así se encuentran los libros
         * compartidos de la plataforma. Sin él, se agregan todas.
         */
        private biblioteca?: { findById(id: string): Promise<{ id: string } | null> },
        /** Para comprobar que el proyecto de origen es del dueño. */
        private proyectos?: { getProject(id: string): Promise<{ id: string; userId: string; deletedAt?: Date } | null> },
    ) { }

    /**
     * El proyecto de origen, solo si es del dueño y no está en la papelera.
     * Si no, el estudio nace suelto: perder el trabajo por un proyecto mal
     * elegido sería peor que crearlo sin él (se asocia después).
     */
    private async ownProject(input: CreateExegeticalPaperInput): Promise<string | null> {
        if (!input.projectId) return null;
        if (!this.proyectos) return input.projectId;
        const p = await this.proyectos.getProject(input.projectId).catch(() => null);
        if (!p || p.userId !== input.ownerId || p.deletedAt) {
            console.warn('[CreateExegeticalPaper] proyecto no disponible; el estudio nace suelto', { projectId: input.projectId });
            return null;
        }
        return p.id;
    }

    private readonly existencia = new Map<string, { en: number; pregunta: Promise<boolean> }>();

    async execute(input: CreateExegeticalPaperInput): Promise<ExegeticalPaper> {
        if (!input.ownerId) {
            throw new Error('CreateExegeticalPaperUseCase: ownerId required');
        }
        if (!input.passage) {
            throw new Error('CreateExegeticalPaperUseCase: passage required');
        }

        const created = await this.paperRepository.createPaper({
            ownerId: input.ownerId,
            passage: input.passage,
            displayLanguage: input.displayLanguage,
            exegeticalStrategy: input.exegeticalStrategy ?? DEFAULT_STRATEGY_FOR_NEW_PAPER,
            title: input.title,
            assignmentBrief: normalizeBrief(input.assignmentBrief),
            styleGuideId: input.styleGuideId,
            sources: [],
            seriesId: input.seriesId ?? null,
            pericopeId: input.pericopeId ?? null,
            projectId: await this.ownProject(input),
            ...(input.cover ? { cover: input.cover } : {}),
        });
        // Primero la rúbrica y después las fuentes: si agregar una fuente
        // falla, el trabajo ya tiene la rúbrica que le toca (revisión de la
        // etapa 0; un trabajo de serie con la académica es Jonás 4:5-11).
        const conRubrica = await this.applyRubric(input, created);
        return this.addInitialSources(input, conRubrica);
    }

    private async applyRubric(input: CreateExegeticalPaperInput, created: ExegeticalPaper): Promise<ExegeticalPaper> {

        // Strategy-only preset short-circuits template resolution.
        // The repo seeded `buildDefaultRubric()` (TMS rigorous); we
        // overwrite with `buildStrategyOnlyRubric()` so the role-
        // coverage card falls back to the strategy's typical counts.
        if (input.rubricTemplateId === STRATEGY_ONLY_RUBRIC_PRESET_ID) {
            return this.paperRepository.setRubric(
                input.ownerId,
                created.id,
                buildStrategyOnlyRubric(),
            );
        }

        // Un trabajo de una serie de predicación es un estudio para predicar:
        // nace con esa rúbrica, no con la académica ni con la plantilla por
        // defecto del usuario (que suele ser la de su curso). Jonás 4:5-11 nació
        // con doce páginas y notas al pie. Una plantilla elegida para la serie
        // (`exegesisDefaults.rubricTemplateId`) sí manda.
        if (input.seriesId && !input.rubricTemplateId) {
            return this.paperRepository.setRubric(input.ownerId, created.id, buildPreachingStudyRubric());
        }

        // Resolve and apply rubric template if needed. The repo
        // already seeded `paper.rubric` with the system default, so
        // this only OVERRIDES when a template is explicitly chosen
        // or the user has a default template.
        const resolved = await this.resolveTemplateRubric(input);
        if (resolved) {
            const now = new Date();
            return this.paperRepository.setRubric(input.ownerId, created.id, {
                ...resolved.rubric,
                // Stamp the template id so the setup picker can
                // pre-select it. Survives manual edits via the same
                // preserve-on-update logic the regular apply flow uses.
                sourceTemplateId: resolved.templateId,
                // Same reasoning as ApplyRubricTemplateToPaperUseCase:
                // overwrite the template's inherited provenance so the
                // paper's badge says "from template" instead of
                // whatever the template was originally classified as.
                provenance: 'from-template',
                createdAt: now,
                updatedAt: now,
            });
        }

        return created;
    }

    /**
     * Agrega las fuentes iniciales y devuelve el trabajo con ellas. Mejor
     * esfuerzo: una fuente que no se pudo agregar se registra y se sigue; el
     * trabajo ya existe y su rúbrica ya está puesta.
     */
    private async addInitialSources(input: CreateExegeticalPaperInput, paper: ExegeticalPaper): Promise<ExegeticalPaper> {
        const pedidas = input.initialSources ?? [];
        if (pedidas.length === 0) return paper;
        const vistas = new Set<string>();
        let orden = 0;
        for (const s of pedidas) {
            const recurso = s.sourceLibraryResourceId ?? s.corpusId;
            if (vistas.has(recurso)) continue;
            vistas.add(recurso);
            if (s.sourceLibraryResourceId && !(await this.existe(s.sourceLibraryResourceId))) continue;
            try {
                await this.paperRepository.addSource(input.ownerId, paper.id, {
                    corpusId: s.corpusId,
                    sourceType: s.sourceType,
                    chosenRole: s.chosenRole ?? null,
                    displayLabel: s.displayLabel,
                    // Como `AddProjectSourceUseCase`: sin clave, la tarjeta de la fuente
                    // la propone desde el autor del libro.
                    citationKey: s.citationKey ?? null,
                    order: orden++,
                    // Siempre documento entero, como la herencia: un modo «fragmentos»
                    // sin fragmentos dejaría una fuente que no aporta nada y no avisa.
                    mode: 'full-document',
                    // Sin fragmentos: se extraen contra el pasaje de este trabajo.
                    excerpts: [],
                    excerptSelectionMode: null,
                    excerptRecipe: null,
                    sourceLibraryResourceId: s.sourceLibraryResourceId ?? null,
                    extractedAt: null,
                    extractionFingerprint: null,
                });
            } catch (err) {
                console.warn('[CreateExegeticalPaper] no se pudo agregar una fuente de la serie', { recurso, error: (err as Error).message });
            }
        }
        return (await this.paperRepository.getPaper(input.ownerId, paper.id).catch(() => null)) ?? paper;
    }

    /**
     * Si el libro sigue en la biblioteca. Se recuerda un minuto por recurso:
     * una serie crea sus trabajos a la vez y cada uno preguntaría por los
     * mismos libros (cada lectura trae el recurso entero, hasta 800 KB). Un
     * error al leer NO es «se borró»: la fuente se agrega igual.
     */
    private existe(resourceId: string): Promise<boolean> {
        if (!this.biblioteca) return Promise.resolve(true);
        const ahora = Date.now();
        const guardado = this.existencia.get(resourceId);
        // La misma promesa para los que preguntan a la vez: nadie lee un
        // «sí» provisional antes de que llegue la respuesta.
        if (guardado && ahora - guardado.en < 60_000) return guardado.pregunta;
        const pregunta = this.biblioteca.findById(resourceId)
            .then(r => !!r)
            .catch(err => {
                console.warn('[CreateExegeticalPaper] no se pudo comprobar el libro; se agrega igual', { resourceId, error: (err as Error).message });
                return true;
            });
        this.existencia.set(resourceId, { en: ahora, pregunta });
        return pregunta;
    }

    private async resolveTemplateRubric(
        input: CreateExegeticalPaperInput,
    ): Promise<{ rubric: PaperRubric; templateId: string } | null> {
        if (!this.userRubricRepository) return null;

        // Strategy-only is handled by the caller before this method
        // — it's not a real template.
        if (input.rubricTemplateId === STRATEGY_ONLY_RUBRIC_PRESET_ID) return null;

        // Explicit template wins.
        if (input.rubricTemplateId) {
            const template = await this.userRubricRepository.getRubric(
                input.ownerId,
                input.rubricTemplateId,
            );
            return template ? { rubric: template.rubric, templateId: template.id } : null;
        }

        // Otherwise, fall back to the user's default if any.
        // Explicit `null` is treated as "skip template, use system
        // default" — the UI sends null when the student picked
        // "Crear nueva sin plantilla".
        if (input.rubricTemplateId === null) return null;

        const defaultTemplate = await this.userRubricRepository.getDefaultRubric(input.ownerId);
        return defaultTemplate ? { rubric: defaultTemplate.rubric, templateId: defaultTemplate.id } : null;
    }
}
