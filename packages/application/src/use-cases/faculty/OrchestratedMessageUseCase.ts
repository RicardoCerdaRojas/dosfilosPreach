import {
    conversationSourceScope,
    IAIChatRepository,
    IAIAgentRepository,
    IAIGeneratorService,
    IAIProjectRepository,
    AIChatMessage,
    AIAgent,
    SourceReference,
    ResponseMode,
    ConcreteResponseMode,
    DEFAULT_LANGUAGE,
    buildPaperStudyContext,
    resolveLocalized,
} from '@dosfilos/domain';
import type {
    SupportedLanguage,
    InlineAttachment,
    MessageAttachmentMeta,
    IExegeticalPaperRepository,
    ISeriesRepository,
    SermonSeriesEntity,
    PlannedSermon,
} from '@dosfilos/domain';
import { generateId } from '../../utils/generateId';
import { CoreLibraryRAGService, RetrievedChunk, getRetrievalConfigForMode } from '../../services/CoreLibraryRAGService';

// Phase 2 RAG retrieval — shared instance
const ragService = new CoreLibraryRAGService();

/** Separator between the paper's analysis and the retrieved library. */
function sectionBreak(language: SupportedLanguage): string {
    return language === 'en'
        ? '--- Retrieved from the library (secondary to the analysis above) ---'
        : '--- Recuperado de la biblioteca (secundario respecto al análisis de arriba) ---';
}

function chunksToSourcesP2(chunks: RetrievedChunk[]): SourceReference[] {
    const byDoc = new Map<string, { title: string; author: string; pages: Set<number>; sections: Set<string>; snippet: string; publiclyCitable: boolean }>();
    for (const c of chunks) {
        const key = `${c.resourceAuthor}||${c.resourceTitle}`;
        const entry = byDoc.get(key) ?? {
            title: c.resourceTitle,
            author: c.resourceAuthor,
            pages: new Set<number>(),
            sections: new Set<string>(),
            snippet: c.text.substring(0, 240).trim(),
            publiclyCitable: c.publiclyCitable === true,
        };
        if (c.metadata.page !== undefined) entry.pages.add(c.metadata.page);
        if (c.sectionBreadcrumb) entry.sections.add(c.sectionBreadcrumb);
        if (c.publiclyCitable === true) entry.publiclyCitable = true;
        byDoc.set(key, entry);
    }
    return Array.from(byDoc.values()).map(entry => {
        const ref: SourceReference = { title: entry.title };
        if (entry.author) ref.author = entry.author;
        const pagesArr = Array.from(entry.pages).sort((a, b) => a - b);
        if (pagesArr.length > 0) {
            ref.page = pagesArr[0];
            const sectionStr = entry.sections.size > 0
                ? Array.from(entry.sections).slice(0, 2).join(' · ')
                : '';
            const pagesStr = pagesArr.length === 1 ? `p. ${pagesArr[0]}` : `pp. ${pagesArr.join(', ')}`;
            ref.snippet = sectionStr ? `${pagesStr} — ${sectionStr}` : pagesStr;
        } else if (entry.snippet) {
            ref.snippet = entry.snippet;
        }
        ref.publiclyCitable = entry.publiclyCitable;
        return ref;
    });
}

/**
 * Defensive post-processor: strip bogus citations that slipped past the prompt.
 */
function cleanCitations(text: string, agentNames: string[] = []): string {
    let out = text;
    // 0) Strip leaked RAG context headers (ES + EN)
    out = out.replace(/\[(?:Fuente|Source)\s+\d+:[^\]]*\]\s*/g, '');
    // 0.b) Strip the retrieved-context preamble if the model echoes it
    //      literally. The pattern used to require the header alone on
    //      its line; the real prompt continues on the same line —
    //      "CONTEXTO RECUPERADO (usa esto como material primario…" —
    //      so nothing matched and a whole corpus dump reached the
    //      student as an answer. Anything from that header to the end
    //      of its line goes.
    out = out.replace(/^\s*(?:CONTEXTO RECUPERADO|RETRIEVED CONTEXT)\b.*(?:\r?\n)+/i, '');
    // 1) "Basado en <chunk-id-like-token>[, pág N][, citado por X]"
    out = out.replace(/\(Basado en [a-z0-9]{8,}[^)]*\)\.?/g, '');
    out = out.replace(/Basado en [a-z0-9]{8,},\s*pág\.?\s*\d+[^.]*\./gi, '');
    // 2) "(chunk-id, pág. N)" patterns — 10+ lowercase alphanumerics
    out = out.replace(/\([a-z0-9]{10,}\s*,\s*p(?:á|a)g\.?\s*\d+[^)]*\)/gi, '');
    // 2.b) Protected-source leaks. The system prompt forbids citing
    //      `Material especializado` / `Curated material` inline, but Gemini
    //      occasionally regurgitates the sentinel — including the multi-cite
    //      form with semicolon separators that the client extractor misses.
    out = out.replace(
        /\((?:Material\s+(?:especializado|curado)|Curated\s+material)[^)]*\)\.?/gi,
        '',
    );
    // 3) Self-citations of known agents
    const defaultAgents = [
        'Dr\\. Al[eé]theia', 'Dr\\. Berith', 'Dr\\. Cris[oó]stomo',
        'Dr\\. Calvino', 'Pastor Nout[eé]tico', 'Tutor Pastoral',
    ];
    const allAgents = [
        ...defaultAgents,
        ...agentNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    ];
    for (const name of allAgents) {
        out = out.replace(new RegExp(`\\(${name}(?:,\\s*[^)]*)?\\)\\.?`, 'g'), '');
        out = out.replace(new RegExp(`Seg[uú]n\\s+${name}\\s*,?\\s*`, 'g'), '');
    }
    // 4) "citado por Dr. X" residuals
    out = out.replace(/,?\s*citado\s+por\s+(Dr\.|Pastor)\s+[^).,]+\)?/gi, ')');
    // 5) Clean up orphan punctuation — IMPORTANT: preserve newlines for markdown
    out = out.replace(/\s*\(\s*\)/g, '');
    out = out.replace(/[ \t]{2,}/g, ' ');              // only collapse horizontal whitespace
    out = out.replace(/[ \t]+([.,;:])/g, '$1');        // remove space before punctuation (not newlines)
    out = out.replace(/\.{2,}/g, '.');                  // repeated dots
    out = out.replace(/\n{3,}/g, '\n\n');              // max 2 consecutive newlines (preserves paragraphs)
    // 6) Markdown table degeneration — Gemini occasionally enters a token
    //    repetition loop on a table separator row, emitting thousands of
    //    consecutive dashes that wreck the layout. Generation-config caps
    //    catch most cases, but the degeneration can finish before the cap
    //    kicks in, so we always sanitize the response.
    //
    //    a) Collapse any run of 20+ consecutive dashes anywhere in the text.
    //       Real markdown separators use ≤6 dashes per cell, so 20 is safe.
    //       We replace with three dashes (a valid separator cell or hr).
    out = out.replace(/-{20,}/g, '---');
    //    b) Squash sequences of repeated separator rows down to one.
    out = out.replace(/(\|[\s:|-]+\|\s*\n)(?:\|[\s:|-]+\|\s*\n){2,}/g, '$1');
    //    c) When the model fuses header + separator on a single line — e.g.
    //       `| A | B | C | |:--- |:--- |:--- |` — split them onto two lines so
    //       remark-gfm can recognize the table.
    out = out.replace(
        /(\|[^\n|]+(?:\|[^\n|]+)+\|)\s+(\|:?-+(?:\s*\|:?-+)+\s*\|?)/g,
        '$1\n$2',
    );
    return out.trim();
}

/**
 * OrchestratedMessageUseCase — Fan-out Multi-Agent Coordinator
 *
 * Architecture:
 *
 *   User message
 *       │
 *       ▼
 *   [Step 1] Router Agent (lightweight Gemini call ~1s)
 *            Analyzes the question, returns:
 *            - strategy: 'single' | 'fanout'
 *            - agentIds: string[]
 *       │
 *       ├─ strategy: 'single' ──► Specialist responds directly (streaming)
 *       │
 *       └─ strategy: 'fanout' ──► Parallel calls to all selected specialists
 *                                 │
 *                                 ▼
 *                            [Step 3] Synthesis Agent
 *                            Consolidates all specialist responses
 *                            into a single coherent answer (streaming)
 *       │
 *       ▼
 *   Response saved to Firestore with agent attribution
 */

interface RouterDecision {
    strategy: 'single' | 'fanout';
    agentIds: string[];
    reasoning?: string;
    /** Response mode inferred by the router; consumed when the user picked 'auto'. */
    suggestedMode?: ConcreteResponseMode;
}

export class OrchestratedMessageUseCase {
    constructor(
        private agentRepository: IAIAgentRepository,
        private chatRepository: IAIChatRepository,
        private generatorService: IAIGeneratorService,
        private projectRepository?: IAIProjectRepository,
        // Optional refs for the Phase 4 enrichment block. Both are
        // additive: when omitted, the orchestrator skips the
        // hydration step and behaves as before. The composition root
        // wires them in `FacultyService` so any chat session can
        // surface paper / series / pericope context the user opened
        // it from.
        private paperRepository?: IExegeticalPaperRepository,
        private seriesRepository?: ISeriesRepository,
    ) { }

    async execute(
        userId: string,
        sessionId: string,
        messageContent: string,
        onChunk?: (text: string) => void,
        onAgentsSelected?: (agents: AIAgent[]) => void,
        lengthPreference?: ResponseMode,
        onSources?: (sources: SourceReference[]) => void,
        onModeInferred?: (mode: ConcreteResponseMode, wasAuto: boolean) => void,
        language: SupportedLanguage = DEFAULT_LANGUAGE,
        attachments?: InlineAttachment[],
        attachmentsMeta?: MessageAttachmentMeta[],
        /**
         * Super-admin only: keep the real author/title of protected sources in
         * the model context so they appear as inline citations. Default false
         * (legal masking on). See `CoreLibraryRAGService.formatContextForPrompt`.
         */
        revealProtectedCitations = false,
    ): Promise<{ response: string; selectedAgents: AIAgent[]; effectiveMode: ConcreteResponseMode }> {
        const session = await this.chatRepository.getSession(userId, sessionId);
        if (!session) throw new Error('Session not found');

        const allAgents = await this.agentRepository.getAllAgents();
        const activeAgents = allAgents.filter(a => a.isActive);
        if (activeAgents.length === 0) throw new Error('No active agents available');

        // ── Step 1: Route ─────────────────────────────────────────────────────────
        const decision = await this.routeQuestion(activeAgents, session.messages, messageContent, language);

        const selectedAgents = decision.agentIds
            .map(id => activeAgents.find(a => a.id === id))
            .filter((a): a is AIAgent => !!a);

        const finalAgents = selectedAgents.length > 0 ? selectedAgents : [activeAgents[0]];

        onAgentsSelected?.(finalAgents);

        // Resolve the effective response mode. When the user selected 'auto', take
        // the router's suggestion; otherwise honor the user's explicit choice.
        const wasAuto = lengthPreference === 'auto' || !lengthPreference;
        const effectiveMode: ConcreteResponseMode = wasAuto
            ? (decision.suggestedMode ?? 'detailed')
            : (lengthPreference as ConcreteResponseMode);
        if (wasAuto) {
            console.log(`[Orchestrator] Auto-detected mode: "${effectiveMode}" (reasoning: ${decision.reasoning ?? 'n/a'})`);
        }
        onModeInferred?.(effectiveMode, wasAuto);

        // ── Step 2: Save user message ─────────────────────────────────────────────

        const userMessage: AIChatMessage = {
            id: generateId(),
            role: 'user',
            content: messageContent,
            timestamp: new Date(),
            ...(attachmentsMeta && attachmentsMeta.length > 0 && { attachments: attachmentsMeta }),
        };

        try {
            await this.chatRepository.addMessageToSession(userId, sessionId, userMessage);
        } catch (error) {
            console.error('[OrchestratedMessageUseCase] Failed to save user message:', error);
            throw error;
        }

        // ── Project context injection ─────────────────────────────────────────
        // If the session belongs to a project, extract:
        //   1. contextNote  → prepended to the message (behavioural framing)
        //   2. sourceIds    → used below to scope RAG retrieval to just those docs
        //                     (NotebookLM-style workspace behavior)
        let enrichedMessage = messageContent;
        let projectSourceIds: string[] | undefined;
        if (session.projectId && this.projectRepository) {
            const project = await this.projectRepository.getProject(session.projectId);
            if (project?.contextNote) {
                enrichedMessage = language === 'en'
                    ? `[Project context "${project.title}": ${project.contextNote}]\n\n${messageContent}`
                    : `[Contexto del proyecto "${project.title}": ${project.contextNote}]\n\n${messageContent}`;
            }
            if (project?.sourceIds && project.sourceIds.length > 0) {
                // La conversación de un estudio busca también en sus fuentes
                // (ADR-046): acotada solo al proyecto, el tutor no veía los
                // comentarios que el estudio usa.
                const estudio = session.context?.paperId && this.paperRepository
                    ? await this.paperRepository.getPaper(userId, session.context.paperId).catch(() => null)
                    : null;
                projectSourceIds = conversationSourceScope(project.sourceIds, estudio?.sources);
                console.log(`[Orchestrator] Project "${project.title}" scopes RAG to ${projectSourceIds?.length ?? 0} source(s)`);
            }
        }

        // ── Paper / series / pericope context enrichment ──────────────────────
        // Sessions launched from an exegetical paper, a series detail,
        // or a specific pericope carry refs in `session.context`. We
        // hydrate them and prepend a block to the user message so the
        // model knows the surface the question is anchored on.
        //
        // For a paper the block carries the accepted analysis itself,
        // not just the paper's name. The earlier reasoning here — that
        // the deep material could ride RAG — did not hold: RAG searches
        // the student's LIBRARY, and the paper's own conclusions are in
        // no corpus. Left out, they reached the tutor through nothing at
        // all. `buildPaperStudyContext` bounds what that costs.
        const contextBlock = await this.buildSessionContextBlock(userId, session.context, language);
        // Prepended here so retrieval also searches on it; when RAG
        // returns anything the block MOVES to the front of the primary
        // material below, and this copy is dropped so it is not sent
        // twice.
        if (contextBlock) {
            enrichedMessage = `${contextBlock}\n\n${enrichedMessage}`;
        }

        const history = [...session.messages, userMessage];
        let finalResponse = '';
        let capturedSources: SourceReference[] = [];

        const handleSources = (sources: SourceReference[]) => {
            capturedSources = sources;
            onSources?.(sources);
        };

        // PHASE 2 — Retrieve relevant chunks for each participating specialist.
        // We aggregate by corpus so each specialist gets its own context.
        //
        // Scope resolution order per agent:
        //   1. agent.stores (Core Library keys, e.g. ['exegesis']) — preferred
        //   2. agent.corpusIds (legacy Gemini URIs) — server reverse-resolves to keys
        //
        // After the migrateAgentStores admin function runs, every agent has `stores`
        // populated and the corpusIds path becomes dead code.
        const retrievedContextByAgent = new Map<string, { context: string; chunks: RetrievedChunk[] }>();
        const agentScope = (a: { stores?: string[]; corpusIds?: string[] }) => {
            const stores = a.stores && a.stores.length > 0 ? a.stores : undefined;
            const corpusIds = a.corpusIds && a.corpusIds.length > 0 ? a.corpusIds : undefined;
            return { stores, corpusIds };
        };
        const agentScopeKey = (a: { stores?: string[]; corpusIds?: string[] }) => {
            const { stores, corpusIds } = agentScope(a);
            if (stores) return `stores:${[...stores].sort().join('|')}`;
            if (corpusIds) return `corpus:${[...corpusIds].sort().join('|')}`;
            return '';
        };

        try {
            const uniqueScopes = new Map<string, { stores?: string[]; corpusIds?: string[] }>();
            for (const a of finalAgents) {
                const key = agentScopeKey(a);
                if (!key) continue;
                if (!uniqueScopes.has(key)) uniqueScopes.set(key, agentScope(a));
            }
            // Retrieve once per unique scope (usually 1-2 calls).
            // topK and minSimilarity are tuned per response mode so that concise queries
            // get tight context and academic queries get a wider net.
            const retrievalConfig = getRetrievalConfigForMode(effectiveMode);
            console.log(`[Orchestrator] Retrieval tuned for mode "${effectiveMode}": topK=${retrievalConfig.topK}, minSim=${retrievalConfig.minSimilarity}`);
            const retrievalResults = await Promise.all(
                Array.from(uniqueScopes.entries()).map(async ([key, scope]) => {
                    const chunks = await ragService.retrieve(enrichedMessage, {
                        stores: scope.stores,
                        corpusIds: scope.corpusIds,
                        topK: retrievalConfig.topK,
                        minSimilarity: retrievalConfig.minSimilarity,
                    });
                    return { key, chunks };
                })
            );
            // Parallel retrieval: user's personal library (always scoped to userId).
            // Scale topK down so personal library complements but doesn't swamp the
            // Core Library context. Safe to call even when the user has no uploads —
            // returns empty instantly.
            //
            // When the session belongs to a project with attached sources, we further
            // restrict retrieval to only those resourceIds — NotebookLM-style scoping,
            // so a sermon series project retrieves only from the books the user
            // curated for that project, not their whole library. We also switch to
            // per-source retrieval (one findNearest per source) so every curated source
            // contributes its top chunks. Without this, a single global topK can starve
            // sources whose chunks happen to score below dominant ones — even when the
            // user explicitly named that source's author.
            const personalTopK = Math.max(3, Math.floor(retrievalConfig.topK / 2));
            const isProjectScope = !!projectSourceIds && projectSourceIds.length > 0;
            const perResourceTopK = isProjectScope
                ? Math.max(2, Math.ceil(personalTopK / Math.max(1, projectSourceIds!.length)))
                : 0;
            const personalChunks = await ragService.retrieve(enrichedMessage, {
                userId,
                resourceIds: projectSourceIds,
                topK: personalTopK,
                minSimilarity: retrievalConfig.minSimilarity,
                perResourceTopK,
            });
            if (personalChunks.length > 0) {
                const scope = projectSourceIds ? `project (${projectSourceIds.length} docs)` : 'personal library';
                console.log(`[Orchestrator] ${scope}: ${personalChunks.length} chunks retrieved`);
            }

            // Assign to each agent by its scope (stores or corpusIds), appending personal
            // library chunks so the model sees both Core and user's own material.
            for (const a of finalAgents) {
                const key = agentScopeKey(a);
                const coreChunks = key
                    ? (retrievalResults.find(r => r.key === key)?.chunks ?? [])
                    : [];
                const combined = [...coreChunks, ...personalChunks];
                if (combined.length > 0) {
                    // The paper's own accepted analysis leads the primary
                    // material, ahead of anything retrieved.
                    //
                    // Order decides what the model treats as authoritative:
                    // the transport labels this slot "CONTEXTO RECUPERADO
                    // (usa esto como MATERIAL PRIMARIO)" and the system
                    // prompt repeats it, while the user message — where the
                    // block used to sit alone — reads as the question.
                    // Asked for the exact wording behind an attribution, the
                    // model went to the library's OCR and rebuilt the
                    // sentence letter by letter, with the clean quote
                    // already recorded a few thousand characters below in
                    // the part it had been told was secondary.
                    const retrieved = CoreLibraryRAGService.formatContextForPrompt(combined, language, { revealProtected: revealProtectedCitations });
                    retrievedContextByAgent.set(a.id, {
                        context: contextBlock
                            ? `${contextBlock}\n\n${sectionBreak(language)}\n\n${retrieved}`
                            : retrieved,
                        chunks: combined,
                    });
                }
            }

            // Aggregate all sources for the UI (Core + Personal, deduped by doc)
            const allChunks = [
                ...retrievalResults.flatMap(r => r.chunks),
                ...personalChunks,
            ];
            if (allChunks.length > 0) {
                const aggregatedSources = chunksToSourcesP2(allChunks);
                capturedSources = aggregatedSources;
                onSources?.(aggregatedSources);
                console.log(`[OrchestratedMessage] Phase 2 RAG: ${allChunks.length} chunks total (${personalChunks.length} personal) across ${retrievedContextByAgent.size} agent(s)`);
            }
        } catch (err: any) {
            console.warn('[OrchestratedMessage] Phase 2 RAG retrieval failed:', err?.message ?? err);
        }

        // The block now leads the primary material for every agent that
        // got one, so its copy inside the question is redundant — and at
        // ~50k characters, sending it twice is not a rounding error.
        if (contextBlock && retrievedContextByAgent.size === finalAgents.length) {
            enrichedMessage = enrichedMessage.slice(contextBlock.length + 2);
        }

        if (decision.strategy === 'fanout' && finalAgents.length > 1) {
            // ── Step 3a: Fan-out — call all specialists in parallel.
            // With Phase 2 RAG, we inject retrieved context per agent (no more grounding metadata).
            const specialistResponses = await Promise.all(
                finalAgents.map(async (agent) => {
                    const agentContext = retrievedContextByAgent.get(agent.id)?.context;
                    try {
                        if (agentContext) {
                            // Phase 2 path: use sendMessageStream with no-op chunker + retrievedContext
                            // We need the full response here, so collect via stream (ignoring chunks).
                            let full = '';
                            await this.generatorService.sendMessageStream(
                                agent, history, enrichedMessage,
                                (c) => { full += c; },
                                effectiveMode,
                                undefined,
                                agentContext,
                                language,
                            );
                            return { agent, response: full, sources: [] as SourceReference[] };
                        } else {
                            // Legacy path: sendMessageWithSources (Gemini fileSearch)
                            const result = await this.generatorService.sendMessageWithSources(
                                agent, history, enrichedMessage, effectiveMode, language,
                            );
                            return { agent, response: result.response, sources: result.sources };
                        }
                    } catch {
                        return null;
                    }
                })
            );

            const validResponses = specialistResponses.filter(
                (r): r is { agent: AIAgent; response: string; sources: SourceReference[] } => !!r
            );

            if (validResponses.length === 0) throw new Error('All specialist calls failed');

            // Merge legacy-path sources (if any) with Phase 2 sources already captured
            const legacySources = this.dedupSources(validResponses.flatMap(r => r.sources));
            if (legacySources.length > 0 && capturedSources.length === 0) {
                capturedSources = legacySources;
                onSources?.(legacySources);
            }

            // ── Step 3b: Synthesis — consolidate & stream ─────────────────────────
            finalResponse = await this.synthesize(
                validResponses,
                enrichedMessage,
                onChunk,
                effectiveMode,
                language,
            );
        } else {
            // ── Step 3 (single): Stream directly from the selected specialist ──────
            const soloContext = retrievedContextByAgent.get(finalAgents[0].id)?.context;
            if (onChunk) {
                finalResponse = await this.generatorService.sendMessageStream(
                    finalAgents[0],
                    history,
                    enrichedMessage,
                    onChunk,
                    effectiveMode,
                    soloContext ? undefined : handleSources,  // Skip legacy sources if Phase 2 provides context
                    soloContext,
                    language,
                    attachments,
                );
            } else {
                finalResponse = await this.generatorService.sendMessage(
                    finalAgents[0],
                    history,
                    enrichedMessage,
                    effectiveMode,
                    undefined,
                    language,
                );
            }
        }

        // Defensive cleanup: strip self-citations and chunk-ID citations that leaked past the prompt
        const agentNames = finalAgents.map(a => resolveLocalized(a.name, language));
        const cleanedResponse = cleanCitations(finalResponse, agentNames);

        const modelMessage: AIChatMessage = {
            id: generateId(),
            role: 'model',
            content: cleanedResponse,
            timestamp: new Date(),
            ...(capturedSources.length > 0 && { sources: capturedSources }),
            modeUsed: effectiveMode,
            modeWasAuto: wasAuto,
        };
        await this.chatRepository.addMessageToSession(userId, sessionId, modelMessage);

        // Generate contextual session title on the FIRST exchange — awaited so UI refetch sees it
        if (session.messages.length === 0) {
            try {
                const title = await this.generateSessionTitle(messageContent, language);
                if (title) {
                    await this.chatRepository.renameSession(userId, sessionId, title);
                }
            } catch (err) {
                console.warn('[OrchestratedMessage] Title generation failed:', err);
            }
        }

        return { response: cleanedResponse, selectedAgents: finalAgents, effectiveMode };
    }

    /**
     * Router: lightweight Gemini call that decides strategy and which agents to use.
     *
     * Why localized: the manifest lists agent names + routing descriptions to
     * the model so it can match the user's question. If the user asks in
     * English, an all-Spanish manifest forces the model to translate-and-match
     * which adds latency and routing errors. We hand it the manifest in the
     * same language as the question.
     */
    private async routeQuestion(
        agents: AIAgent[],
        history: AIChatMessage[],
        message: string,
        language: SupportedLanguage,
    ): Promise<RouterDecision> {
        const agentManifest = agents
            .map(a => {
                const name = resolveLocalized(a.name, language);
                const routing = resolveLocalized(a.routingDescription, language)
                    || resolveLocalized(a.expertiseArea, language);
                return `  - id: "${a.id}" | name: "${name}"\n    routing: "${routing}"`;
            })
            .join('\n');

        const routerPrompt = language === 'en'
            ? buildRouterPromptEn(agentManifest, message, history)
            : buildRouterPromptEs(agentManifest, message, history);

        const routerAgent: AIAgent = {
            id: '__router__',
            name: { es: 'Router', en: 'Router' },
            role: 'orchestrator',
            systemInstruction: {
                es: 'Responde SOLO con JSON válido.',
                en: 'Respond ONLY with valid JSON.',
            },
            expertiseArea: { es: 'routing', en: 'routing' },
            description: { es: 'Internal routing agent', en: 'Internal routing agent' },
            isActive: true,
        };

        try {
            const raw = await this.generatorService.sendMessage(
                routerAgent, [], routerPrompt, undefined, undefined, language,
            );
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as RouterDecision;
                if (parsed.strategy && Array.isArray(parsed.agentIds) && parsed.agentIds.length > 0) {
                    // Validate suggestedMode — drop it if the LLM returned something unknown
                    const validModes: ConcreteResponseMode[] = ['concise', 'detailed', 'academic', 'pastoral', 'layperson'];
                    if (parsed.suggestedMode && !validModes.includes(parsed.suggestedMode)) {
                        console.warn(`[Router] Invalid suggestedMode "${parsed.suggestedMode}", defaulting to "detailed"`);
                        parsed.suggestedMode = 'detailed';
                    }
                    return parsed;
                }
            }
        } catch {
            // Fallthrough to fallback
        }

        return { strategy: 'single', agentIds: [agents[0].id], suggestedMode: 'detailed' };
    }

    /**
     * Synthesis: consolidates multiple specialist responses into one
     * coherent document and streams the result to the UI.
     */
    private async synthesize(
        specialistResponses: { agent: AIAgent; response: string }[],
        originalQuestion: string,
        onChunk?: (text: string) => void,
        lengthPreference?: ResponseMode,
        language: SupportedLanguage = DEFAULT_LANGUAGE,
    ): Promise<string> {
        const specialistSection = specialistResponses
            .map(({ agent, response }) =>
                `=== ${resolveLocalized(agent.name, language)} (${resolveLocalized(agent.expertiseArea, language)}) ===\n${response}`
            )
            .join('\n\n');

        const synthesisPrompt = language === 'en'
            ? buildSynthesisPromptEn(originalQuestion, specialistSection)
            : buildSynthesisPromptEs(originalQuestion, specialistSection);

        const synthAgent: AIAgent = {
            id: '__synthesizer__',
            name: { es: 'Sintetizador', en: 'Synthesizer' },
            role: 'synthesizer',
            systemInstruction: {
                es: 'Integras respuestas de múltiples especialistas teológicos en un documento cohesivo.',
                en: 'You integrate responses from multiple theological specialists into a cohesive document.',
            },
            expertiseArea: { es: 'synthesis', en: 'synthesis' },
            description: { es: 'Internal synthesis agent', en: 'Internal synthesis agent' },
            isActive: true,
        };

        if (onChunk) {
            return this.generatorService.sendMessageStream(
                synthAgent, [], synthesisPrompt, onChunk, lengthPreference, undefined, undefined, language,
            );
        }
        return this.generatorService.sendMessage(
            synthAgent, [], synthesisPrompt, lengthPreference, undefined, language,
        );
    }

    /**
     * Generate a concise contextual title from the first user message.
     * Keeps session list readable (e.g., "Salmo 1: Consejería Pastoral" instead of "Sesión con Dr. Alétheia").
     */
    private async generateSessionTitle(
        firstMessage: string,
        language: SupportedLanguage,
    ): Promise<string | null> {
        const titleAgent: AIAgent = {
            id: '__title_gen__',
            name: { es: 'TitleGenerator', en: 'TitleGenerator' },
            role: 'title',
            systemInstruction: {
                es: 'Generas títulos breves y descriptivos en español. Responde SOLO con el título, sin comillas, sin puntuación final, sin prefijos.',
                en: 'You generate brief, descriptive titles in English. Respond ONLY with the title, no quotes, no trailing punctuation, no prefixes.',
            },
            expertiseArea: { es: 'title-generation', en: 'title-generation' },
            description: { es: 'Internal title generator', en: 'Internal title generator' },
            isActive: true,
        };

        const prompt = language === 'en'
            ? `Generate a VERY brief title (max 6 words) summarizing the topic of this theological question:

"${firstMessage}"

Examples of good titles:
- "Psalm 1: Pastoral Counseling"
- "Exegesis of Hebrews 1:1-4"
- "Koine Greek: Aorist"
- "Premarital Counseling"
- "Covenant Theology"

Respond only with the title, no quotes.`
            : `Genera un título MUY breve (máximo 6 palabras) que resuma el tema de esta pregunta teológica:

"${firstMessage}"

Ejemplos de buenos títulos:
- "Salmo 1: Consejería Pastoral"
- "Exégesis de Hebreos 1:1-4"
- "Griego Koiné: Aoristo"
- "Consejería Prematrimonial"
- "Teología del Pacto"

Responde solo con el título, sin comillas.`;

        try {
            const raw = await this.generatorService.sendMessage(
                titleAgent, [], prompt, undefined, undefined, language,
            );
            const cleaned = raw
                .trim()
                .replace(/^["'«]|["'»]$/g, '')
                .replace(/\.$/, '')
                .trim();
            // Validate: non-empty, not too long
            if (cleaned.length > 0 && cleaned.length <= 80) return cleaned;
        } catch {
            // Silent fail — title generation is non-critical
        }
        return null;
    }

    /**
     * Deduplicate sources by author+title, merging page lists when applicable.
     */
    private dedupSources(sources: SourceReference[]): SourceReference[] {
        const byKey = new Map<string, SourceReference>();
        for (const src of sources) {
            const key = src.author ? `${src.author}||${src.title}` : `store||${src.title}`;
            if (!byKey.has(key)) {
                byKey.set(key, { ...src });
            }
            // If duplicate, keep the first one (pages already aggregated per specialist)
        }
        return Array.from(byKey.values());
    }

    /**
     * Builds the context block prepended to the user message when the
     * session was launched from a paper / series / pericope. Returns
     * null when there's no context (or all refs failed to hydrate) so
     * the caller can skip prepending entirely.
     *
     * A paper contributes its identity, its citable sources and the
     * verse analyses the student accepted (see
     * `buildPaperStudyContext`). A series contributes its title and the
     * anchored pericope's syntactic justification.
     *
     * Missing repositories or unresolvable ids are silently dropped so
     * the chat keeps working with a weaker prompt instead of throwing.
     */
    private async buildSessionContextBlock(
        userId: string,
        context: { paperId?: string; seriesId?: string; pericopeId?: string } | undefined,
        language: SupportedLanguage,
    ): Promise<string | null> {
        if (!context) return null;
        if (!context.paperId && !context.seriesId) return null;

        const isSpanish = language !== 'en';
        const lines: string[] = [];

        // Paper enrichment. The repo's `getPaper(ownerId, paperId)`
        // gate ensures we don't leak across users — we pass the
        // session's userId, which the chat repo already validated
        // owns the session.
        if (context.paperId && this.paperRepository) {
            try {
                const paper = await this.paperRepository
                    .getPaper(userId, context.paperId)
                    .catch(() => null);
                if (paper) {
                    // The paper's own analysis rides along — not just its
                    // name. `getPaper` is one document read and the steps
                    // come embedded, so the accepted `canonicalAnalysis`
                    // is already in hand; leaving it out was what made the
                    // tutor unable to explain the very decisions the
                    // student had open on screen.
                    const study = buildPaperStudyContext(paper, {
                        language: isSpanish ? 'es' : 'en',
                    });
                    if (study.text) lines.push(study.text);
                }
            } catch (err) {
                console.warn('[Orchestrator] paper hydration failed:', err);
            }
        }

        // Series + pericope enrichment.
        if (context.seriesId && this.seriesRepository) {
            try {
                const series = await this.seriesRepository.findById(context.seriesId);
                if (series) {
                    const seriesLine = isSpanish
                        ? `Serie expositiva en curso: "${series.title}".`
                        : `Active expository series: "${series.title}".`;
                    lines.push(seriesLine);
                    if (context.pericopeId) {
                        const pericope = findPericope(series, context.pericopeId);
                        if (pericope?.syntacticUnit) {
                            const u = pericope.syntacticUnit;
                            const passageLabel = formatUnitPassage(u);
                            if (isSpanish) {
                                lines.push(`Perícopa anclada: "${pericope.title}" (${passageLabel}).`);
                                if (u.justification) {
                                    lines.push(`Justificación sintáctica: ${u.justification}`);
                                }
                            } else {
                                lines.push(`Anchored pericope: "${pericope.title}" (${passageLabel}).`);
                                if (u.justification) {
                                    lines.push(`Syntactic justification: ${u.justification}`);
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('[Orchestrator] series hydration failed:', err);
            }
        }

        if (lines.length === 0) return null;
        const header = isSpanish ? '[Contexto del usuario]' : '[User context]';
        return `${header}\n${lines.join('\n')}`;
    }
}

function findPericope(
    series: SermonSeriesEntity,
    pericopeId: string,
): PlannedSermon | null {
    const planned = series.metadata?.plannedSermons ?? [];
    return planned.find((p) => p.id === pericopeId) ?? null;
}

function formatUnitPassage(unit: {
    book: string;
    chapterStart: number;
    verseStart: number;
    chapterEnd: number;
    verseEnd: number;
}): string {
    const { book, chapterStart, verseStart, chapterEnd, verseEnd } = unit;
    if (chapterStart === chapterEnd) {
        if (verseStart === verseEnd) return `${book} ${chapterStart}:${verseStart}`;
        return `${book} ${chapterStart}:${verseStart}-${verseEnd}`;
    }
    return `${book} ${chapterStart}:${verseStart}-${chapterEnd}:${verseEnd}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Localized prompt builders. Kept at module scope so the class body shows the
// orchestration flow without 200 lines of prompt copy interleaved.
// Both variants must enforce identical contracts (JSON schema for the router,
// citation rules for the synthesizer); when you edit one, mirror in the other.
// ────────────────────────────────────────────────────────────────────────────

function buildRouterPromptEs(
    agentManifest: string,
    message: string,
    history: AIChatMessage[],
): string {
    return `
Eres el enrutador de un sistema multi-agente para un seminario teológico.
Analiza la pregunta y decide DOS cosas: (A) qué especialistas deben responderla y (B) qué modo de respuesta le conviene al usuario.

ESPECIALISTAS DISPONIBLES:
${agentManifest}

PREGUNTA: "${message}"

HISTORIAL RECIENTE:
${history.slice(-2).map(m => `${m.role}: ${m.content.substring(0, 120)}`).join('\n')}

REGLAS DE ENRUTAMIENTO:
1. Si la pregunta cae claramente en UNA sola especialidad → strategy: "single"
2. Si la pregunta abarca EXPLÍCITAMENTE 2+ especialidades distintas → strategy: "fanout"
3. Prefiere "single" cuando tengas dudas (menor costo y latencia)
4. Máximo 3 agentes en fanout

REGLAS DE MODO DE RESPUESTA (clasifica a UNO de estos 5 valores):

• "concise" — pregunta muy corta, pide un resumen/dato puntual, usa palabras como "breve", "resume", "en una frase", "rápido". También cuando el mensaje es <6 palabras sin contexto pidiendo elaboración.
  Ejemplos: "¿qué significa qatal?", "dame una definición corta de aoristo", "resume el cap 3 de Gén"

• "academic" — pregunta técnica exegética/morfológica/gramatical con jerga del campo; pide análisis profundo, paradigmas, comparación entre binyanim/casos, etimología, crítica textual.
  Ejemplos: "analiza morfológicamente ἐγένετο en Jn 1:14", "compara el perfecto con el imperfecto hebreo", "explica exhaustivamente el aoristo"

• "pastoral" — pregunta sobre predicación, aplicación al rebaño, consejería, sermón, homilética práctica, cómo enseñar/aplicar un pasaje a la congregación.
  Ejemplos: "cómo predico Rom 12:1-2", "qué aplicación pastoral tiene este texto", "cómo explico el evangelio a una familia en duelo"

• "layperson" — pregunta de alguien SIN formación teológica; pide explicación simple, sin tecnicismos, con analogías, "para principiantes", "sin jerga", "para niños", "sencillo".
  Ejemplos: "explícame el bautismo como si fuera nuevo en la fe", "qué significa gracia en lenguaje simple", "por qué los cristianos leen la Biblia (sin tecnicismos)"

• "detailed" — DEFAULT cuando la pregunta merece explicación completa pero no cae claramente en ninguna de las 4 categorías anteriores. Preguntas genuinas de estudio que no son ni super técnicas, ni pastorales, ni para laicos.

PRINCIPIOS:
- Prefiere "detailed" cuando dudes. Es el modo neutro.
- "academic" solo si la pregunta USA jerga del campo o pide explícitamente rigor técnico.
- "pastoral" solo si hay contexto claro de predicación/aplicación, no solo porque mencione la Biblia.
- "layperson" solo si hay señal explícita de falta de formación o pedido de simplicidad.

Responde ÚNICAMENTE con JSON válido sin texto adicional:
{"strategy":"single","agentIds":["id1"],"reasoning":"una línea","suggestedMode":"detailed"}
`.trim();
}

function buildRouterPromptEn(
    agentManifest: string,
    message: string,
    history: AIChatMessage[],
): string {
    return `
You are the router for a multi-agent system serving a theological seminary.
Analyze the question and decide TWO things: (A) which specialists should answer it and (B) which response mode best fits the user.

AVAILABLE SPECIALISTS:
${agentManifest}

QUESTION: "${message}"

RECENT HISTORY:
${history.slice(-2).map(m => `${m.role}: ${m.content.substring(0, 120)}`).join('\n')}

ROUTING RULES:
1. If the question clearly falls in ONE single specialty → strategy: "single"
2. If the question EXPLICITLY spans 2+ different specialties → strategy: "fanout"
3. Prefer "single" when in doubt (lower cost and latency)
4. Maximum 3 agents in fanout

RESPONSE MODE RULES (classify into ONE of these 5 values):

• "concise" — very short question, asks for a summary/specific datum, uses words like "brief", "summarize", "in one sentence", "quick". Also when the message is <6 words without context asking for elaboration.
  Examples: "what does qatal mean?", "give me a short definition of aorist", "summarize Gen ch. 3"

• "academic" — technical exegetical/morphological/grammatical question with field jargon; asks for in-depth analysis, paradigms, comparison between binyanim/cases, etymology, textual criticism.
  Examples: "morphologically analyze ἐγένετο in Jn 1:14", "compare the Hebrew perfect with the imperfect", "exhaustively explain the aorist"

• "pastoral" — question about preaching, application to the flock, counseling, sermon, practical homiletics, how to teach/apply a passage to the congregation.
  Examples: "how do I preach Rom 12:1-2", "what pastoral application does this text have", "how do I explain the gospel to a family in mourning"

• "layperson" — question from someone WITHOUT theological training; asks for simple explanation, no jargon, with analogies, "for beginners", "no jargon", "for kids", "simple".
  Examples: "explain baptism to me as if I were new in the faith", "what does grace mean in simple language", "why do Christians read the Bible (no jargon)"

• "detailed" — DEFAULT when the question deserves a full explanation but does not clearly fit any of the 4 categories above. Genuine study questions that are not super technical, pastoral, or for laypeople.

PRINCIPLES:
- Prefer "detailed" when in doubt. It is the neutral mode.
- "academic" only if the question USES field jargon or explicitly demands technical rigor.
- "pastoral" only if there is clear preaching/application context, not just because it mentions the Bible.
- "layperson" only if there is an explicit signal of lack of training or request for simplicity.

Respond ONLY with valid JSON, no additional text:
{"strategy":"single","agentIds":["id1"],"reasoning":"one line","suggestedMode":"detailed"}
`.trim();
}

function buildSynthesisPromptEs(originalQuestion: string, specialistSection: string): string {
    return `
Eres un sintetizador de respuestas teológicas. Tu trabajo es integrar las contribuciones de varios especialistas en UN SOLO documento cohesivo.

PREGUNTA ORIGINAL: "${originalQuestion}"

RESPUESTAS DE LOS ESPECIALISTAS:
${specialistSection}

REGLAS DE SÍNTESIS (CRÍTICAS):

1. NUNCA atribuyas ideas a los tutores/especialistas. Los tutores NO son fuentes.
   PROHIBIDO: "(Dr. Berith, Exégesis Hebrea)", "(Pastor Noutético)", "Según Dr. Crisóstomo...", "Basado en la perspectiva del Dr. X"
   Los tutores son internos; el usuario final no debe verlos citados.

2. PRESERVA las citas válidas a documentos reales que usen el formato (Autor, Título, p. N).
   Ejemplos válidos que debes mantener: "(Kidner, Psalms 1-72, p. 45)", "(Wallace, Gramática Griega, p. 213)"

3. ELIMINA cualquier cita sospechosa:
   - Secuencias alfanuméricas sin sentido como "(lkxxzy9wx7z7, pág. 184)" — bórralas.
   - Citas genéricas como "(Pastor Noutético)" o "(Dr. Berith)" — bórralas.
   - Si un especialista dijo "Basado en <algo_extraño>, citado por Dr. X" — elimina esa atribución.

4. Integra las perspectivas SIN decir de qué especialista provienen. El resultado debe leerse como UN solo autor experto.

5. Si una misma cita aparece en varios especialistas, inclúyela UNA VEZ.

6. Usa Markdown para estructurar. Comienza directamente con el contenido integrado, sin preámbulos.
`.trim();
}

function buildSynthesisPromptEn(originalQuestion: string, specialistSection: string): string {
    return `
You are a synthesizer of theological responses. Your job is to integrate the contributions of several specialists into ONE cohesive document.

ORIGINAL QUESTION: "${originalQuestion}"

SPECIALIST RESPONSES:
${specialistSection}

SYNTHESIS RULES (CRITICAL):

1. NEVER attribute ideas to the tutors/specialists. Tutors are NOT sources.
   FORBIDDEN: "(Dr. Berith, Hebrew Exegesis)", "(Pastor Noutetic)", "According to Dr. Crisóstomo...", "Based on Dr. X's perspective"
   Tutors are internal; the end user must not see them cited.

2. PRESERVE valid citations to real documents using the format (Author, Title, p. N).
   Valid examples to keep: "(Kidner, Psalms 1-72, p. 45)", "(Wallace, Greek Grammar, p. 213)"

3. REMOVE any suspicious citation:
   - Meaningless alphanumeric sequences like "(lkxxzy9wx7z7, p. 184)" — delete them.
   - Generic citations like "(Pastor Noutetic)" or "(Dr. Berith)" — delete them.
   - If a specialist said "Based on <strange_thing>, cited by Dr. X" — remove that attribution.

4. Integrate the perspectives WITHOUT stating which specialist they come from. The result must read as ONE expert author.

5. If the same citation appears in several specialists, include it ONCE.

6. Use Markdown for structure. Begin directly with the integrated content, no preambles.
`.trim();
}
