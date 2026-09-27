import type {
    ExegeticalPaper,
    SourceRole,
    IExegeticalPaperRepository,
    StepSourcePlan,
    StepSourcePlanEntry,
} from '@dosfilos/domain';

export interface UpdateStepCorpusAllocationInput {
    ownerId: string;
    paperId: string;
    stepId: string;
    /**
     * Replacement set of `ProjectSource.id`s pinned to this step.
     * Order matters — first id is "most relevant" for the
     * orchestrator's prompt construction.
     *
     * Pass `[]` to clear (the step falls through to type-level
     * emphasis at generation time).
     */
    pinnedSources: ReadonlyArray<string>;
    /**
     * Optional rationale text. Pass `undefined` to leave the existing
     * note untouched, `null` to explicitly clear it, or a string to
     * replace it.
     */
    note?: string | null;
    /**
     * Roles elegidos a mano para las fuentes de este paso.
     *
     * `undefined` conserva los que ya tenía cada fuente que sigue pinchada,
     * que es lo que hace una edición de la lista de fuentes. Un mapa explícito
     * los REEMPLAZA, y es lo que manda el selector de rol.
     *
     * Las entradas que no correspondan a una fuente pinchada se descartan: su
     * insignia no tendría dónde anclarse.
     */
    pinnedSourceRoles?: Readonly<Record<string, SourceRole>>;
}

/**
 * v1.7 — Manual single-step edit of `pinnedSources` (the chip
 * add/remove operation in the corpus-usage planning UI).
 *
 * Distinct from `UpdateStepPlanUseCase` (which only edits per-kind
 * defaults). This is finer-grained: one step at a time.
 *
 * Validation:
 *   - The step must exist on the paper.
 *   - Each pinned id must reference an existing source on the paper.
 *     Unknown ids are rejected with a precise error so the UI can
 *     surface them (rather than silently dropping).
 *
 * Does NOT touch `proposedAt` or `proposalCorpusSourceIds` — those
 * are owned by the planner use case. A manual edit doesn't reset
 * the staleness signal.
 *
 * Los ROLES sobreviven a la edición, y eso hay que hacerlo a mano porque la
 * entrada se reconstruye entera. Se copiaban `emphasis`, `suppressedSources` y
 * la nota, y `pinnedSourceRoles` se había quedado afuera: quitar una fuente de
 * un paso borraba los roles de TODAS las demás. Lo encontró el fundador
 * editando Jonás 4:3 —las tres insignias desaparecieron de golpe—.
 *
 * Desde #698 eso ya no es un detalle de color: el analizador lee esos roles y
 * la instrucción le manda copiarlos en vez de reclasificar. Perderlos en una
 * edición devuelve ese paso al estado que #698 corrigió, y en silencio.
 *
 * La fuente que se AGREGA queda sin rol a propósito. El plan no la asignó y
 * heredar el rol de la que salió sería inventar una decisión que nadie tomó;
 * sin rol, el analizador la clasifica, que es lo que hacía siempre.
 */
export class UpdateStepCorpusAllocationUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdateStepCorpusAllocationInput): Promise<ExegeticalPaper> {
        if (!input.ownerId) throw new Error('UpdateStepCorpusAllocationUseCase: ownerId required');
        if (!input.paperId) throw new Error('UpdateStepCorpusAllocationUseCase: paperId required');
        if (!input.stepId) throw new Error('UpdateStepCorpusAllocationUseCase: stepId required');

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const step = paper.steps.find(s => s.id === input.stepId);
        if (!step) throw new Error(`Step ${input.stepId} not found on paper ${input.paperId}`);

        const validSourceIds = new Set(paper.sources.map(s => s.id));
        const unknownIds = input.pinnedSources.filter(id => !validSourceIds.has(id));
        if (unknownIds.length > 0) {
            throw new Error(`Unknown source ids in pinnedSources: ${unknownIds.join(', ')}`);
        }

        const existing = paper.stepPlan.perStep[input.stepId];

        // El rol de cada fuente que sigue en el paso. Las que se fueron no
        // dejan entrada huérfana —su insignia no tendría dónde anclarse— y las
        // que entran quedan sin rol, que es el estado honesto: el plan no las
        // asignó.
        // Un mapa explícito reemplaza; su ausencia conserva lo que había.
        const rolesPrevios = input.pinnedSourceRoles ?? existing?.pinnedSourceRoles ?? {};
        const sobreviven: Record<string, SourceRole> = {};
        for (const id of input.pinnedSources) {
            const rol = rolesPrevios[id];
            if (rol) sobreviven[id] = rol;
        }
        const rolesQueSobreviven = Object.keys(sobreviven).length > 0 ? sobreviven : null;
        const nextEntry: StepSourcePlanEntry = {
            stepId: input.stepId,
            kind: step.kind,
            emphasis: existing?.emphasis ?? {
                emphasizedTypes: [],
                deemphasizedTypes: [],
                citationOverrides: [],
            },
            pinnedSources: [...input.pinnedSources],
            ...(rolesQueSobreviven && { pinnedSourceRoles: rolesQueSobreviven }),
            suppressedSources: existing?.suppressedSources ?? [],
            note: input.note === undefined ? (existing?.note ?? null) : input.note,
        };

        const nextPlan: StepSourcePlan = {
            perStep: { ...paper.stepPlan.perStep, [input.stepId]: nextEntry },
            defaults: paper.stepPlan.defaults,
            updatedAt: new Date(),
            ...(paper.stepPlan.proposedAt !== undefined && { proposedAt: paper.stepPlan.proposedAt }),
            ...(paper.stepPlan.proposalCorpusSourceIds !== undefined && {
                proposalCorpusSourceIds: paper.stepPlan.proposalCorpusSourceIds,
            }),
        };

        return this.paperRepository.setStepPlan(input.ownerId, input.paperId, nextPlan);
    }
}
