/**
 * Phase 2.5 PR B (ADR-028) — Run one Socratic turn of the guided sermon
 * agent. Thin orchestrator: every step-specific decision lives in its
 * `IStepPolicy`. The use case only coordinates load → detect → call LLM
 * → parse → validate → persist → advance state → log → reply.
 *
 * NO `switch(stepKey)` here. OCP guarantee — adding a step never touches
 * this file.
 */

import {
    advance,
    appendDoubt,
    assertAiAssistAllowed,
    buildDoubtRoutingNote,
    detectRaisedDoubt,
    evaluatePastoralSeed,
    isLastStep,
    makeRaisedDoubt,
    PASTORAL_SEED_STEP_ORDER,
    retry,
    type AIChatMessage,
    type AiAssistType,
    type GuidedSermonSession,
    type IAIChatRepository,
    type ICoverageEngagementJudge,
    type IGenreEngagementJudge,
    type ILlmClient,
    type IPastoralSeedRepository,
    type IStepPolicyRegistry,
    type PastoralSeed,
    type PastoralSeedStepKey,
    type SocraticTurnOutput,
    type SocraticTurnResult,
    type TurnContext,
    type CommonMisreadingFeature,
    type CoverageReport,
    decideMisreadingTurn,
    featuresForStep,
    genreDiscernmentCriteriaFor,
    evaluateStructuralSufficiency,
    RECONFRONT_CAPS,
    GENRE_OVERRIDE_RECONFRONT_CAP,
    MISREADING_MIN_SUBSTANCE_CHARS,
    buildCoverageContract,
    buildCoverageStepTexts,
    computeCoverageSummary,
} from '@dosfilos/domain';

export interface RunSocraticTurnInput {
    userId: string;
    sessionId: string;
    pastorMessage: string;
    /**
     * ADR-035 enforce (D) — lo pasa el web desde `usePassageProfileEnforceGate`.
     * Default/ausente = false = clásico. Gatea nudges + confront de lectura
     * errónea. Inerte hasta el commit del dispatch (D commit 3).
     */
    enforceCoverage?: boolean;
    /**
     * Redacción v2 Fase 1 (§4.4) — enforce del override de género (paso 2). Lo
     * pasará el web desde el flag propio `genre_override_enforce` (A4). SEPARADO
     * de `enforceCoverage`. Ausente/false ⇒ el dispatch de género es no-op.
     */
    enforceGenreOverride?: boolean;
    /**
     * Redacción v2 Fase 1 (§4.5) B3 — enciende la ayuda estructural sensible al
     * género en el paso 3. Lo pasa el web desde el flag `step3_genre_help`.
     * Ausente/false ⇒ prompt clásico del paso 3.
     */
    enableGenreStructuralHelp?: boolean;
}

/** Heuristic confidence threshold for short-circuiting to a confrontation. */
const METHOD_ERROR_CONFIDENCE_THRESHOLD = 0.65;

function generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Compact summary of completed steps' text for cross-step grounding. */
function buildPriorSteps(seed: PastoralSeed): Partial<Record<PastoralSeedStepKey, string>> {
    return {
        reading: seed.reading?.firstImpression,
        contextGenre: seed.contextGenre?.genreImplication,
        structuralAnalysis: seed.structuralAnalysis?.mainClause?.pastorNote,
        wordStudies: (seed.wordStudies?.studies ?? [])
            .map((s) => `${s.word}: ${s.pastorDiscovery}`)
            .join(' | '),
        recognition: (seed.recognition?.parallels ?? [])
            .map((p) => `${p.reference}: ${p.relevanceNote}`)
            .join(' | '),
        function: seed.function?.originalAudienceFunction,
        timelessPrinciple: seed.timelessPrinciple?.principle,
    };
}

/**
 * Nota de método que se ADJUNTA a la respuesta cuando la heurística detecta
 * algo. No es un veredicto: es una observación que el pastor puede tomar o
 * dejar.
 */
function buildMethodErrorNote(description: string): string {
    return `\n\nUna observación de método, por si te sirve: ${description} Tú decides si la tomas.`;
}

/**
 * ADR-035 (D) — confront de lectura errónea. La redacción depende de
 * `engagedAnchor` (B: no tocó el ancla / D: trabajó pero contradice), pero NO da
 * la respuesta. Es `kind:'confront'` ⇒ el dispatch existente lo mapea a retry.
 */
function buildMisreadingConfront(
    mis: CommonMisreadingFeature,
    engagedAnchor: boolean,
): SocraticTurnOutput {
    const anchors = mis.correctiveAnchor
        .map((a) => a.reference)
        .filter(Boolean)
        .join(', ');
    const reply = engagedAnchor
        ? `Trabajaste el texto, pero tu lectura sostiene "${mis.claim}", que ${anchors} matiza. ¿Cómo la sostiene el texto frente a ese ancla?`
        : `Tu respuesta toca la lectura "${mis.claim}" sin abordar ${anchors}, que suele matizarla. ¿Tu lectura la sostiene o la contradice?`;
    return {
        kind: 'confront',
        errorLabel: 'common-misreading',
        agentReply: reply,
        data: [mis.whyWrong],
        questions: ['¿Qué en el texto decide entre esa lectura y lo que el ancla establece?'],
    };
}

/**
 * Redacción v2 Fase 1 (§4.4) — confront del override de género (paso 2). Igual
 * que `buildMisreadingConfront`: `kind:'confront'` ⇒ el dispatch lo mapea a
 * retry. NO da el género; pregunta socráticamente qué hace el pasaje. La
 * redacción cambia por `engagedAnchor` (trabajó el discernimiento vs no lo tocó).
 */
function buildGenreConfront(proposedGenre: string, engagedAnchor: boolean): SocraticTurnOutput {
    const reply = engagedAnchor
        ? `Trabajaste el texto, pero lo estás leyendo como un género distinto al que el pasaje sugiere (${proposedGenre}). ¿Qué en la perícopa gobierna su género?`
        : `Tu lectura trata el pasaje como otro género sin abordar por qué se lee como ${proposedGenre}. ¿Qué hace el pasaje —argumenta, narra, canta/ora?`;
    return {
        kind: 'confront',
        errorLabel: 'genre-override',
        agentReply: reply,
        data: [`El sistema propone leerlo como ${proposedGenre}.`],
        questions: ['¿Cuál género gobierna tu perícopa, y qué en el texto lo decide?'],
    };
}

export class RunSocraticTurnUseCase {
    constructor(
        private readonly chatRepo: IAIChatRepository,
        private readonly seedRepo: IPastoralSeedRepository,
        private readonly llmClient: ILlmClient,
        private readonly registry: IStepPolicyRegistry,
        /**
         * ADR-035 CA1 (D) — juez de engagement (opcional). Ausente ⇒ el confront
         * de lectura errónea no corre (no-op). Lo consume el dispatch (D commit
         * 3); aquí solo se inyecta.
         */
        private readonly coverageJudge?: ICoverageEngagementJudge,
        /**
         * Redacción v2 Fase 1 (§4.4) — juez de engagement de género (opcional).
         * Ausente ⇒ el confront de override de género no corre (no-op). Lo
         * consume `maybeGenreConfront`; aquí solo se inyecta. Hermano del
         * coverageJudge (una responsabilidad por juez).
         */
        private readonly genreJudge?: IGenreEngagementJudge,
    ) {}

    async execute(input: RunSocraticTurnInput): Promise<SocraticTurnResult> {
        if (!input.pastorMessage?.trim()) {
            throw new Error('Empty pastor message cannot be a Socratic turn.');
        }
        const session = await this.chatRepo.getSession(input.userId, input.sessionId);
        if (!session) throw new Error(`Session ${input.sessionId} not found.`);

        const gss = session.guidedSermonSession;
        if (!gss || gss.status !== 'active') {
            throw new Error('Guided sermon mode is not active on this session.');
        }
        const seed = await this.seedRepo.getById(gss.seedId);
        if (!seed) throw new Error(`Pastoral seed ${gss.seedId} not found.`);

        const policy = this.registry.get(gss.currentStep);
        const ctx: TurnContext = {
            passage: gss.passage,
            currentStep: gss.currentStep,
            pastorDraft: input.pastorMessage,
            attemptIndex: gss.stepAttempts[gss.currentStep] ?? 0,
            genre: seed.contextGenre?.genre || undefined,
            priorSteps: buildPriorSteps(seed),
            // Step 4 accumulates word studies across turns — the policy merges
            // the saved set with the current message before validating.
            existingWordStudies: seed.wordStudies?.studies ?? [],
            // ADR-035 B — perfil cristalizado (si existe). El enforce (D) lo usa;
            // sin él el flujo es clásico (no-op). Solo transporte aquí.
            passageProfile: seed.passageProfile,
            // ADR-035 enforce (D) — gatea nudges + confront del perfil. Inerte
            // hasta el dispatch (commit 3).
            enforceCoverage: input.enforceCoverage === true,
            // Redacción v2 (§4.4) — enforce del override de género (paso 2),
            // SEPARADO. Inerte hasta que el web lo cablee (A4).
            enforceGenreOverride: input.enforceGenreOverride === true,
            // Redacción v2 (§4.5) — ayuda estructural sensible al género (paso 3),
            // flag-inert hasta la revisión del guidance por el fundador (B3).
            enableGenreStructuralHelp: input.enableGenreStructuralHelp === true,
        };

        // Persist the pastor's user message FIRST so it always appears in chat
        // history regardless of downstream outcome.
        await this.chatRepo.addMessageToSession(input.userId, input.sessionId, {
            id: generateId('msg'),
            role: 'user',
            content: input.pastorMessage,
            timestamp: new Date(),
        });

        // 0. ADR-035 (D) — confront de lectura errónea, GATED (enforceCoverage +
        // juez + feature misreading en este paso). Corre ANTES del heurístico.
        // re-confront ⇒ output confront (→ retry). accept-override ⇒ registra y
        // CAE al flujo normal (override floor, no encierra). accept/gate-minimo ⇒
        // cae al flujo normal. Inerte sin enforce/juez.
        let output: SocraticTurnOutput | undefined = await this.maybeMisreadingConfront(
            seed,
            gss.currentStep,
            ctx,
            input.pastorMessage,
        );

        // 0.5. Redacción v2 (§4.4) — confront del override de género, GATED
        // (enforceGenreOverride + juez), SOLO en el paso 2. Mismo molde: re-confront
        // ⇒ output confront (→ retry); accept-override ⇒ registra + cae al flujo
        // normal; accept/gate-minimo ⇒ flujo normal. Inerte sin enforce/juez.
        if (!output) {
            output = await this.maybeGenreConfront(seed, gss.currentStep, ctx, input.pastorMessage);
        }

        // 1. Heurística de error de método. Barata, sin LLM.
        //
        // YA NO HACE SHORT-CIRCUIT (decisión del fundador, 2026-08-21). Antes
        // un acierto de la heurística trababa el turno con un `confront`. Pero
        // esto es coincidencia de palabras, no juicio: bloquear el avance del
        // pastor porque escribió "genitivo" o "aplicado hoy" convierte una lista
        // de keywords en la vara. Lo que traba sigue siendo lo determinista (los
        // validadores de umbral); esto ahora se ADJUNTA como observación.
        //
        // El juicio fino no se pierde: el LLM confronta desde su prompt en TODOS
        // los pasos, y ese sí es juicio.
        const heuristicError = output ? null : policy.detectMethodError(input.pastorMessage, ctx);
        if (output) {
            // ya hay un confront de lectura errónea — se salta la heurística + LLM.
        } else {
            // 2. LLM call — the policy's system prompt encodes the full contract.
            const rawJson = await this.llmClient.generate({
                system: policy.buildSystemPrompt(ctx),
                prompt: input.pastorMessage,
                temperature: 0.3,
                responseMimeType: 'application/json',
            });
            output = policy.parseLlmReply(rawJson, input.pastorMessage);

            // 3. Safety net: domain validator has the final word on acceptance.
            // If the LLM said "accepted" but the validator disagrees, downgrade.
            if (output.kind === 'accepted') {
                const v = policy.validatePastorInput(input.pastorMessage, ctx);
                if (!v.valid) {
                    output = {
                        kind: 'orient',
                        reason: 'validator-disagrees-with-llm',
                        agentReply: 'Antes de avanzar revisemos lo que escribiste — todavía falta para satisfacer este paso.',
                        data: v.reasons,
                        questions: ['¿Qué te falta agregar para cumplir el mínimo del paso?'],
                    };
                }
            }
        }

        // 1b. La observación de método viaja en la respuesta, sin cambiar el
        // veredicto: el pastor la ve y sigue si quiere.
        if (heuristicError && heuristicError.confidence >= METHOD_ERROR_CONFIDENCE_THRESHOLD) {
            output = {
                ...output,
                agentReply: `${output.agentReply}${buildMethodErrorNote(heuristicError.description)}`,
            };
        }

        // 3b. Accumulating steps (e.g. Step 4 Word Studies): the pastor builds
        // the set one item per turn. Let the DOMAIN VALIDATOR — on the merged
        // total (saved items + this message) — decide accept vs orient,
        // independent of the LLM's guess; keep the LLM's reply for feedback.
        if (policy.accumulatesAcrossTurns && output.kind !== 'confront') {
            const accumulated = policy.validatePastorInput(input.pastorMessage, ctx);
            output = accumulated.valid
                ? { kind: 'accepted', pastorTextToPersist: input.pastorMessage, agentReply: output.agentReply }
                : {
                      kind: 'orient',
                      reason: 'accumulating-incomplete',
                      agentReply: output.agentReply,
                      data: output.kind === 'orient' ? output.data : [],
                      questions: output.kind === 'orient' ? output.questions : [],
                  };
        }

        // 4. Dispatch on output kind. Single `if` per branch — no switch on stepKey.
        let nextState: GuidedSermonSession;
        let sermonReady = false;
        let assistType: AiAssistType;
        let pastorTextPersisted: string | null = null;

        if (output.kind === 'accepted') {
            const patch = policy.persistTo(seed, output.pastorTextToPersist);
            await this.seedRepo.update(seed.id, patch);
            nextState = advance(gss);
            // Una sola fuente de verdad: el estudio está completo ⟺ los 8
            // validadores pasan sobre el estado fusionado, NO solo porque el
            // state-machine avanzó. Evita marcar `completed: true` con un paso
            // vacío (p.ej. Insight) — el bug que dejaba semillas en 7/8 con
            // badge "Listo para borrador" y rompía el handoff al wizard.
            const fullyValid = evaluatePastoralSeed({ ...seed, ...patch }).completed;
            sermonReady = nextState.status === 'completed' && fullyValid;
            if (nextState.status === 'completed') {
                await this.seedRepo.update(seed.id, {
                    completed: fullyValid,
                    ...(fullyValid ? { completedAt: new Date() } : {}),
                });
            }
            assistType = 'socraticGuidance';
            pastorTextPersisted = output.pastorTextToPersist;
        } else if (output.kind === 'confront') {
            nextState = retry(gss);
            assistType = 'socraticConfrontation';
        } else {
            nextState = retry(gss);
            assistType = 'stepOrientation';
            // Accumulating steps: save the valid partial so items build up
            // across turns even though the step isn't complete yet.
            if (policy.accumulatesAcrossTurns) {
                await this.seedRepo.update(seed.id, policy.persistTo(seed, input.pastorMessage));
            }
        }

        await this.chatRepo.updateGuidedSermonSession(
            input.userId,
            input.sessionId,
            nextState,
        );

        // 4b. ADR-034 — capture + route any doubt the pastor raised. The
        // routing is DETERMINISTIC (not model-dependent) and PERSISTED so the
        // doubt resurfaces later (Paso 8 / wizard) instead of being lost. We
        // never answer it — only pin "guárdala para el Paso N".
        const detected = detectRaisedDoubt(input.pastorMessage);
        let routingNote: string | null = null;
        if (detected) {
            const doubt = makeRaisedDoubt(gss.currentStep, detected);
            await this.seedRepo.update(seed.id, {
                openDoubts: appendDoubt(seed.openDoubts ?? [], doubt),
            });
            routingNote = buildDoubtRoutingNote(doubt, gss.currentStep);
        }

        // 5. Append the agent's reply. For accepted turns we add a brief
        // transition prompt for the next step (or the completion CTA), then the
        // deterministic doubt reminder (if any).
        const composedReply = this.composeAgentReply(output, nextState, sermonReady);
        const agentMessage: AIChatMessage = {
            id: generateId('msg'),
            role: 'model',
            content: routingNote ? `${composedReply}\n\n${routingNote}` : composedReply,
            timestamp: new Date(),
        };
        await this.chatRepo.addMessageToSession(input.userId, input.sessionId, agentMessage);

        // 6. Audit. Validation-tier assists are allowed on every step
        // (including reading + insight) by ADR-028.
        assertAiAssistAllowed(gss.currentStep, assistType);
        await this.seedRepo.appendAiAssistLog(seed.id, {
            userId: input.userId,
            stepKey: gss.currentStep,
            assistType,
            // Accepted = pastor wrote the persisted content (never edited by
            // the LLM); orient/confront = no persist. Either way the pastor's
            // voice stayed intact → `outputWasEditedByUser` semantics are N/A
            // for these tiers; we record `false` as the conservative default.
            outputWasEditedByUser: false,
        });

        // 7. Suppress unused warning while reserving the variable for Phase 4
        // ("% tuyo" needs a denominator of persisted-by-pastor text).
        void pastorTextPersisted;

        // 8. ADR-035 E — colector de cobertura al CIERRE (red de seguridad sobre
        // el Motor B). Solo al completar el estudio + enforce + perfil. Si quedó
        // un must-touch sin tratar, `gateStatus: 'soft-block'` → el web nudgea
        // (no bloquea, D1). Puro; no toca el dispatch del turno.
        let coverageReport: CoverageReport | undefined;
        if (sermonReady && ctx.enforceCoverage && seed.passageProfile) {
            coverageReport = computeCoverageSummary(
                buildCoverageContract(seed.passageProfile),
                buildCoverageStepTexts(seed),
            );
        }

        // 9. Redacción v2 (§4.4) — oportunidad de medición en sombra del override
        // de género: DATO PURO (sin LLM). Solo en el paso 2, con género propuesto
        // y mensaje sustantivo, y SOLO con enforce OFF (si on, el dispatch ya
        // juzgó). El web decide muestrear + registrar el verdict, fire-and-forget.
        const proposedGenre = ctx.genre ?? '';
        const genreShadow =
            gss.currentStep === 'contextGenre' &&
            !ctx.enforceGenreOverride &&
            proposedGenre &&
            input.pastorMessage.trim().length >= MISREADING_MIN_SUBSTANCE_CHARS
                ? {
                      seedId: seed.id,
                      passage: gss.passage,
                      proposedGenre,
                      criteria: genreDiscernmentCriteriaFor(proposedGenre),
                  }
                : undefined;

        // 10. Redacción v2 (§4.5) B2 — señal de sombra de la vara de suficiencia
        // estructural (paso 3). DETERMINISTA (sin LLM): calcula el verdict aquí y
        // lo expone; el web lo registra como sibling en passageProfileShadow (B5).
        // Lleva el género CALIFICADO (inferido en shadow) + su provenance
        // (contrato PR1, estructurado) para no conflar causas al leer la sombra.
        const structuralShadow =
            gss.currentStep === 'structuralAnalysis' &&
            input.pastorMessage.trim().length >= MISREADING_MIN_SUBSTANCE_CHARS
                ? {
                      seedId: seed.id,
                      passage: gss.passage,
                      qualifiedGenre: proposedGenre,
                      provenance: seed.contextGenre?.genreProvenance ?? ('aiProposed' as const),
                      verdict: evaluateStructuralSufficiency(proposedGenre, input.pastorMessage),
                      // §4.5 — género destino del override (estructurado), si el pastor
                      // corrigió en el paso 2; re-runnable offline.
                      ...(seed.contextGenre?.genreOverrideTarget
                          ? { overrideTargetGenre: seed.contextGenre.genreOverrideTarget }
                          : {}),
                  }
                : undefined;

        return {
            output,
            nextStep: nextState.currentStep,
            sermonReady,
            stepAttempts: nextState.stepAttempts,
            ...(coverageReport ? { coverageReport } : {}),
            ...(genreShadow ? { genreShadow } : {}),
            ...(structuralShadow ? { structuralShadow } : {}),
        };
    }

    /**
     * ADR-035 (D) — corre el juicio de engagement (CA1) cuando el paso actual
     * tiene una lectura errónea en el perfil y el enforce está on, y mapea el
     * veredicto con `decideMisreadingTurn` (tres estados). Devuelve un output
     * `confront` solo para `re-confront`; para `accept-override` registra la
     * discrepancia (override floor) y devuelve `undefined` (cae al flujo normal);
     * `accept`/`gate-minimo` también devuelven `undefined`. No-op sin enforce,
     * sin juez, o sin feature (todos los paths del flujo clásico intactos).
     */
    private async maybeMisreadingConfront(
        seed: PastoralSeed,
        currentStep: PastoralSeedStepKey,
        ctx: TurnContext,
        pastorMessage: string,
    ): Promise<SocraticTurnOutput | undefined> {
        if (!ctx.enforceCoverage || !this.coverageJudge) return undefined;
        const misreadings = featuresForStep(seed.passageProfile, currentStep).filter(
            (f): f is CommonMisreadingFeature => f.typeKey === 'common-misreading',
        );
        if (misreadings.length === 0) return undefined;
        if (misreadings.length > 1) {
            // No tirar en silencio (mismo principio que la telemetría de huecos):
            // v1 toma la primera; loguea el descarte para saber con dato si
            // "resto a futuro" es pronto o lejos.
            console.warn(
                `[coverage] ${misreadings.length} lecturas erróneas en el paso "${currentStep}"; v1 confronta la primera, difiere ${misreadings.length - 1}.`,
            );
        }
        const mis = misreadings[0];

        const judgment = await this.coverageJudge.judge({
            pastorMessage,
            claim: mis.claim,
            whyWrong: mis.whyWrong,
            correctiveAnchors: mis.correctiveAnchor.map((a) => a.reference).filter(Boolean),
            minSubstanceChars: MISREADING_MIN_SUBSTANCE_CHARS,
        });
        const outcome = decideMisreadingTurn(
            judgment,
            ctx.attemptIndex,
            RECONFRONT_CAPS['common-misreading'],
        );

        if (outcome === 're-confront') {
            return buildMisreadingConfront(mis, judgment.engagedAnchor);
        }
        if (outcome === 'accept-override') {
            // Override floor: agotó el tope sosteniendo su lectura → libera al
            // flujo normal con la discrepancia REGISTRADA (no encierra). Evento de
            // conducción in-step, NO un override del publish-gate.
            await this.seedRepo.appendAiAssistLog(seed.id, {
                userId: seed.userId,
                stepKey: currentStep,
                assistType: 'coverageMisreadingOverride',
                outputWasEditedByUser: false,
            });
        }
        // accept / accept-override(registrado) / gate-minimo → flujo normal.
        return undefined;
    }

    /**
     * Redacción v2 Fase 1 (§4.4) — dispatch del override de género (paso 2).
     * Hermano de `maybeMisreadingConfront`, mismo molde de tres estados con
     * `decideMisreadingTurn` REUSADO: re-confront ⇒ output confront (→ retry);
     * accept-override ⇒ registra la discrepancia (override floor) y devuelve
     * `undefined` (cae al flujo normal, no encierra); accept/gate-minimo ⇒
     * `undefined`. No-op fuera del paso 2, sin enforce, sin juez, o sin género
     * propuesto. Juzga ENGAGEMENT del discernimiento, no corrección: un pastor
     * que trabajó y sostiene otro género se acepta, su elección registrada.
     */
    private async maybeGenreConfront(
        seed: PastoralSeed,
        currentStep: PastoralSeedStepKey,
        ctx: TurnContext,
        pastorMessage: string,
    ): Promise<SocraticTurnOutput | undefined> {
        if (currentStep !== 'contextGenre') return undefined;
        if (!ctx.enforceGenreOverride || !this.genreJudge) return undefined;
        const proposedGenre = ctx.genre ?? '';
        if (!proposedGenre) return undefined; // nada propuesto → nada que confrontar

        const judgment = await this.genreJudge.judge({
            pastorMessage,
            proposedGenre,
            proposalRationale: `El sistema infirió "${proposedGenre}" por el libro del pasaje.`,
            // Disciplina 036 — el juez adjudica contra la vara estructurada del
            // género propuesto, no un juicio libre.
            criteria: genreDiscernmentCriteriaFor(proposedGenre),
            minSubstanceChars: MISREADING_MIN_SUBSTANCE_CHARS,
        });
        const outcome = decideMisreadingTurn(judgment, ctx.attemptIndex, GENRE_OVERRIDE_RECONFRONT_CAP);

        if (outcome === 're-confront') {
            return buildGenreConfront(proposedGenre, judgment.engagedAnchor);
        }
        if (outcome === 'accept-override') {
            // Override floor: sostuvo su género tras agotar el tope → libera al
            // flujo normal con la discrepancia REGISTRADA (no encierra). Evento
            // de conducción in-step; mide, no bloquea.
            await this.seedRepo.appendAiAssistLog(seed.id, {
                userId: seed.userId,
                stepKey: currentStep,
                assistType: 'genreOverride',
                outputWasEditedByUser: false,
            });
        }
        // accept / accept-override(registrado) / gate-minimo → flujo normal.
        return undefined;
    }

    /**
     * Composes the agent's chat reply message. For `accepted`, adds a
     * transition to the next step (or a completion CTA on the last). For
     * `orient`/`confront`, just surfaces the LLM's pastoral reply + data +
     * questions in a compact block.
     */
    private composeAgentReply(
        output: SocraticTurnOutput,
        nextState: GuidedSermonSession,
        sermonReady: boolean,
    ): string {
        if (output.kind === 'accepted') {
            if (sermonReady) {
                return `${output.agentReply}\n\n¡Tu sermón está listo! Has completado los 8 pasos del estudio. Haz clic en **"Pasar al sermón"** para abrir el wizard y comenzar la homilética.`;
            }
            const nextIdx = PASTORAL_SEED_STEP_ORDER.indexOf(nextState.currentStep) + 1;
            return `${output.agentReply}\n\n**Paso ${nextIdx} de 8 — ${stepDisplayName(nextState.currentStep)}.**\n${STEP_INSTRUCTIONS[nextState.currentStep]}`;
        }
        // orient / confront — render data + questions
        const dataBlock = output.data.length > 0
            ? `\n\nDatos para considerar:\n${output.data.map((d) => `- ${d}`).join('\n')}`
            : '';
        const questionsBlock = output.questions.length > 0
            ? `\n\nPreguntas para pensar:\n${output.questions.map((q) => `- ${q}`).join('\n')}`
            : '';
        return `${output.agentReply}${dataBlock}${questionsBlock}`;
    }
}

/**
 * User-facing instruction surfaced when the agent advances to each step, so the
 * pastor always knows WHAT to write next (not just the step name). Phrased as
 * the agent's ask; never proposes content (P1/P2). Mirrors the welcome message
 * style used for step 1 at activation.
 */
const STEP_INSTRUCTIONS: Record<PastoralSeedStepKey, string> = {
    reading:
        'Lee el pasaje completo y comparte tu primera impresión, con tus palabras: ¿qué te llamó la atención, qué sentiste, qué preguntas surgen?',
    contextGenre:
        'Con tus palabras, explica qué IMPLICA el género del texto para tu manera de leerlo — no solo nombrarlo, sino cómo cambia tu forma de interpretarlo.',
    structuralAnalysis:
        'Identifica la oración o idea PRINCIPAL del pasaje (con su referencia) y escribe una nota tuya sobre cómo se organiza el argumento alrededor de ella. Ejemplo del método (otro pasaje, para que veas cómo — no es tu respuesta): en Romanos 12:1 la idea principal es "presentad vuestros cuerpos en sacrificio vivo"; lo demás la rodea — el motivo ("por las misericordias de Dios") y la valoración ("vuestro culto racional"). Haz lo mismo con tu pasaje.',
    wordStudies:
        'Elige al menos 2 palabras clave. Para CADA una escribe: la palabra, una referencia (ej. 2 Pedro 2:1) y qué descubriste de su significado, con tus palabras.',
    recognition:
        'Anota de 1 a 3 pasajes paralelos. Para CADA uno escribe la referencia (ej. Judas 4) y, con tus palabras, por qué se relaciona con este texto.',
    function:
        'Describe qué BUSCABA LOGRAR este texto en su audiencia original — no qué dice, sino qué les HACÍA: ¿advertir, consolar, exhortar, corregir, dar seguridad, mover a actuar? Piensa en la situación concreta de ellos. Ejemplo del método (otro pasaje, no es tu respuesta): Filipenses 4:6-7 buscaba calmar la ansiedad de una iglesia presionada, llevándolos a confiar en Dios mediante la oración. Hazlo con tu pasaje, con tus palabras.',
    timelessPrinciple:
        'Toma lo que el texto HACÍA a su audiencia original (Paso 6) y destílalo en una verdad transferible que aplica a cualquier creyente, en cualquier época — no el mandato específico de aquel contexto, sino el principio perdurable detrás. Ejemplo del método (otro pasaje, para que veas cómo — no es tu respuesta): si la función de Josué 1:9 era animar a Josué a ser valiente al entrar a Canaán, el principio atemporal sería "Dios sostiene a su pueblo en cada tarea que les encomienda". Hazlo con tu pasaje, con tus palabras.',
    insight:
        'Cierra tu estudio con un mensaje que tenga estas 5 partes — usa estos rótulos para que queden bien guardadas:\n\n- **Idea central:** la afirmación central de tu sermón, en una frase.\n- **Observaciones:** al menos 3, una por línea (cada una con cuerpo, ~40+ caracteres).\n- **Pregunta abierta:** una pregunta que el texto deja para reflexionar.\n- **Anécdota:** una ilustración o anécdota pastoral (un par de frases).\n- **Aplicación doxológica:** cómo esto te lleva a adorar y responder a Dios (un par de frases).\n\nTodo con tus palabras.',
};

const STEP_NAMES: Record<PastoralSeedStepKey, string> = {
    reading: 'Lectura',
    contextGenre: 'Contexto y Género',
    structuralAnalysis: 'Análisis Estructural',
    wordStudies: 'Estudio de Palabras',
    recognition: 'Reconocimiento canónico',
    function: 'Función para la audiencia original',
    timelessPrinciple: 'Principio Atemporal',
    insight: 'Insight',
};

function stepDisplayName(key: PastoralSeedStepKey): string {
    return STEP_NAMES[key];
}

// Re-export `isLastStep` if needed by callers (kept here as an explicit
// import to make the SRP boundary visible — this use case checks it
// internally via `advance` setting `status: 'completed'`).
void isLastStep;
