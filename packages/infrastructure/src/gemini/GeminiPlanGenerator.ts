import {
    IPlanGenerator,
    PlanGenerationRequest,
    GeneratedPlan,
    SeriesObjective,
    DocumentChunkEntity,
    Citation
} from '@dosfilos/domain';
import { GEMINI_CONFIG } from './config';
import { runLlmPrompt } from '../llm/callableLlm';
import { DocumentProcessingService } from '../services/DocumentProcessingService';

export class GeminiPlanGenerator implements IPlanGenerator {
    private documentProcessor: DocumentProcessingService;

    constructor() {
        this.documentProcessor = new DocumentProcessingService();
    }

    /**
     * Las dos llamadas comparten `GEMINI_CONFIG` — antes vivía en el modelo
     * construido una sola vez en el constructor, así que viaja igual en ambas.
     */
    private generate(feature: string, prompt: string): Promise<string> {
        return runLlmPrompt({
            feature,
            model: GEMINI_CONFIG.MODEL_NAME,
            prompt,
            maxOutputTokens: GEMINI_CONFIG.GENERATION_CONFIG.maxOutputTokens,
            temperature: GEMINI_CONFIG.GENERATION_CONFIG.temperature,
            responseMimeType: 'application/json',
        });
    }

    async generateSeriesObjective(request: PlanGenerationRequest): Promise<SeriesObjective> {
        // 1. Search for relevant chunks from user's library using RAG
        const resourceIds = request.contextResources.map(r => r.id);
        let relevantChunks: DocumentChunkEntity[] = [];

        if (resourceIds.length > 0) {
            const searchQuery = `${request.topicOrBook} ${request.subtopicsOrRange || ''}`;
            console.log(`🔍 [Objective] Searching for relevant chunks: "${searchQuery}"`);

            try {
                const searchResults = await this.documentProcessor.searchRelevantChunks(
                    searchQuery,
                    resourceIds,
                    20 // Get top 20 chunks for objective phase
                );
                relevantChunks = searchResults.map(r => r.chunk);
                console.log(`✅ [Objective] Found ${relevantChunks.length} relevant chunks from library`);
            } catch (error) {
                console.warn('⚠️ RAG search failed, falling back to basic context:', error);
            }
        }

        // 2. Build prompt with RAG context
        const prompt = this.buildObjectivePromptWithRAG(request, relevantChunks);
        console.log('📝 [Objective] Prompt built. Calling Gemini API...');

        try {
            const text = await this.generate('series.generateObjective', prompt);
            console.log('✅ [Objective] Gemini API response received');
            console.log('📄 [Objective] Raw response text length:', text.length);

            const cleanedJson = this.cleanJsonResponse(text);
            const parsed = JSON.parse(cleanedJson);
            console.log('✅ [Objective] Response successfully parsed');
            return parsed;
        } catch (error) {
            console.error('❌ [Objective] Error during generation or parsing:', error);
            throw error;
        }
    }

    async generateSeriesStructure(request: PlanGenerationRequest, objective: SeriesObjective): Promise<GeneratedPlan> {
        // 1. Search for relevant chunks from user's library
        const resourceIds = request.contextResources.map(r => r.id);
        let relevantChunks: DocumentChunkEntity[] = [];

        if (resourceIds.length > 0) {
            console.log(`Searching for relevant chunks in ${resourceIds.length} resources...`);
            // STRICT QUERY: Use ONLY user's input. AI titles/objectives can be hallucinated or abstract.
            // We want to find exactly what the user asked for in their library.
            const searchQuery = `${request.topicOrBook} ${request.subtopicsOrRange || ''}`;
            // Sin fuentes la estructura sale igual (como el objetivo, arriba):
            // un fallo de la búsqueda —p. ej. una pestaña abierta desde antes
            // de las reglas nuevas de `document_chunks`— no tumba el plan.
            try {
                const searchResults = await this.documentProcessor.searchRelevantChunks(
                    searchQuery,
                    resourceIds,
                    15 // Get top 15 most relevant chunks
                );
                relevantChunks = searchResults.map(r => r.chunk);
                console.log(`Found ${relevantChunks.length} relevant chunks`);
            } catch (err) {
                console.warn('No se pudieron leer los fragmentos para la estructura; sigue sin fuentes:', err);
            }
        }

        // 2. Build prompt with verified context
        const prompt = this.buildStructurePromptWithCitations(request, objective, relevantChunks);
        const text = await this.generate('series.generateStructure', prompt);
        const parsed = JSON.parse(this.cleanJsonResponse(text));

        // 3. Build citations array from chunks used
        const citations: Citation[] = this.buildCitationsFromResponse(parsed, relevantChunks);

        // Map response to GeneratedPlan structure
        return {
            series: {
                title: objective.title,
                description: objective.description,
                startDate: request.startDate,
                type: request.type,
                metadata: {
                    [request.type]: {
                        topic: request.topicOrBook,
                        subtopics: request.subtopicsOrRange ? request.subtopicsOrRange.split(',') : [],
                    }
                }
            },
            sermons: parsed.sermons,
            structureJustification: parsed.structureJustification,
            citations
        };
    }

    async generatePlan(request: PlanGenerationRequest): Promise<GeneratedPlan> {
        const objective = await this.generateSeriesObjective(request);
        return this.generateSeriesStructure(request, objective);
    }

    /**
     * Build objective prompt with VERIFIED content from user's indexed library
     */
    private buildObjectivePromptWithRAG(
        request: PlanGenerationRequest,
        relevantChunks: DocumentChunkEntity[]
    ): string {
        const language = request.language || 'es';

        let dateInstruction = '';
        if (request.startDate) {
            dateInstruction = request.endDate
                ? `Date Range: ${request.startDate} to ${request.endDate}. Frequency: ${request.frequency || 'Weekly'}. Calculate the number of sermons based on this range.`
                : `Start Date: ${request.startDate}. Frequency: ${request.frequency || 'Weekly'}.`;
        } else {
            dateInstruction = 'Date: Undetermined (The series is flexible/undated).';
        }

        const countInstruction = request.numberOfSermons
            ? `Target Number of Sermons: ${request.numberOfSermons}`
            : `Target Number of Sermons: AUTO (You decide based on the topic depth)`;

        // Build verified context from RAG chunks
        const hasLibraryContext = relevantChunks.length > 0;
        let verifiedContext: string;

        if (hasLibraryContext) {
            verifiedContext = relevantChunks.map((chunk, i) => {
                const pageInfo = chunk.metadata.page ? `, page ${chunk.metadata.page}` : '';
                return `[Source ${i + 1}] ${chunk.resourceAuthor} - "${chunk.resourceTitle}"${pageInfo}:
"${chunk.text.substring(0, 600)}..."`;
            }).join('\n\n');
        } else {
            // Fallback to resource names only
            verifiedContext = request.contextResources.map(r =>
                `- ${r.author}: "${r.title}"`
            ).join('\n');
        }

        return `
Act as an expert homiletics professor and pastoral mentor. Design the objective for a sermon series.

## Request Details:
- Type: ${request.type === 'thematic' ? 'Thematic Series' : 'Expository Series'}
- Topic/Book: ${request.topicOrBook}
${request.subtopicsOrRange ? `- Subtopics/Range: ${request.subtopicsOrRange}` : ''}
- ${dateInstruction}
- ${countInstruction}

## Theological Library Context:
${hasLibraryContext ? `
I have found the following relevant chunks in the pastor's indexed library:

${verifiedContext}

CRITICAL INSTRUCTION: Use this VERIFIED content to ground your suggestions. 
Specifically mention which authors and resources can be used and how.
` : `
The pastor has these resources available (not indexed yet):
${verifiedContext}
`}
${request.plannerNotes ? `
## Pastor's Focus & Notes:
The pastor has defined the following focus or key points:

${request.plannerNotes}

IMPORTANT: This info comes from a previous conversation. Use it as the main guide for the series title, description, and objective.
` : ''}

## Your Task:
1. Propose a creative and theologically deep title.
2. Write a description capturing the essence of the series.
3. Define the central objective.
4. In "pastoralAdvice", include:
   - Reflection on the viability of the sermon count.
   - How the pastor's resources can enrich the message.
   - Specific suggestions based on the library content.

## OUTPUT RULES:
- **LANGUAGE: You MUST output strictly in ${language}**.
- Transform all your homiletical advice and content into ${language}.
- **CRITICAL: ESCAPE ALL DOUBLE QUOTES** inside string values. 
  Example: "description": "He said \"Hello\"" 
  INCORRECT: "description": "He said "Hello""

## Response Format (JSON):
{
  "title": "Series Title (in ${language})",
  "description": "Description (in ${language})",
  "objective": "Central Objective (in ${language})",
  "pastoralAdvice": "Expert advice (in ${language})",
  "suggestedSermonCount": 4
}

JSON:
        `;
    }

    /**
     * Build structure prompt with VERIFIED citations from user's library
     */
    private buildStructurePromptWithCitations(
        request: PlanGenerationRequest,
        objective: SeriesObjective,
        relevantChunks: DocumentChunkEntity[]
    ): string {
        const language = request.language || 'es';

        // Build verified context from chunks
        const hasLibraryContext = relevantChunks.length > 0;

        let verifiedContext: string;
        if (hasLibraryContext) {
            verifiedContext = relevantChunks.map((chunk, i) => {
                const pageInfo = chunk.metadata.page ? `, p.${chunk.metadata.page}` : '';
                return `[SOURCE ${i + 1}: ${chunk.resourceAuthor} - "${chunk.resourceTitle}"${pageInfo}]\n${chunk.text}\n[/SOURCE ${i + 1}]`;
            }).join('\n\n');
        } else {
            verifiedContext = 'No library resources provided for this topic.';
        }

        const frequencyInstruction = request.frequency
            ? `Frequency: ${request.frequency} (Adjust dates accordingly)`
            : 'Frequency: Flexible/Self-paced (Do not assign specific dates)';

        const countInstruction = request.numberOfSermons
            ? `Number of Sermons: ${request.numberOfSermons}`
            : `Number of Sermons: AUTO (Propose an optimal number based on the topic depth).`;

        const dateInstruction = request.startDate
            ? `Start Date: ${request.startDate}`
            : `Start Date: TBD (Undated Series)`;

        const passageInstruction = request.type === 'expository'
            ? `For expository series, divide the book/passage range logically. Each sermon should cover a specific passage range.`
            : `For thematic series, suggest a primary biblical passage that best supports each sermon's theme.`;

        // Citation rules based on whether we have library context
        let citationRules: string;
        if (hasLibraryContext) {
            citationRules = `
CITATION RULES (VERY IMPORTANT):
1. PRIORITIZE user provided sources (marked as [SOURCE N]).
2. When using info from PROVIDED SOURCES, cite as: "[Library: Author, Title]" (translated to ${language})
3. If using general theological knowledge NOT in sources, mark as: "[General Knowledge]" (translated to ${language})
4. NEVER invent citations or attribute ideas to authors not in the provided sources.
5. If an idea comes from user sources, indicate which one (e.g., see Source 1).`;
        } else {
            citationRules = `
SOURCE NOTES:
- No library resources provided.
- You may use general theological knowledge, but clearly indicate: "[General Knowledge]" (translated to ${language})
- DO NOT attribute specific citations unless absolutely certain.`;
        }

        const justificationInstruction = hasLibraryContext
            ? `Reference library sources where appropriate, initializing as [Library: Author, Title]`
            : `Indicate [General Knowledge] when using unverified concepts`;

        return `
            Act as an expert homiletics professor.
            Create a sermon structure for the following series.

            **TOPIC ADHERENCE & CONTEXT USAGE:**
            The user explicitly requested a series on: "**${request.topicOrBook}**".
            The Objective is: "${objective.objective}".

            **INSTRUCTIONS FOR LIBRARY CONTEXT:**
            The "VERIFIED CONTEXT" below comes from the user's library.
            
            --------------------------------------------------
            ${verifiedContext}
            --------------------------------------------------

            1. **Primary Goal:** Use this context to ENRICH the sermons with specific quotes, insights, or theological arguments.
            2. **Relevance Check:**
               - IF the context supports the topic (even indirectly, e.g. systematic theology, broad biblical principles applying to the topic), **USE IT** and cite it.
               - IF the context is clearly about a **COMPLETELY DIFFERENT TOPIC** (e.g. context is about "The Temple in Ezra" but topic is "Marriage"), then IGNORE that specific piece of context.
            3. **Do not hallucinate:** If the context is empty or irrelevant, use your [General Knowledge] but DO NOT invent fake library sources.

            **FAILURE CONDITIONS:**
            - Generating sermons about a wrong book/topic (e.g. "Romans" when asked for "Genesis").
            - Ignoring useful, relevant context just because it doesn't contain the exact keyword.

            **OUTPUT RULES (CRITICAL):**
            1. Response must be valid JSON.
            2. **ESCAPE ALL DOUBLE QUOTES** inside string values. Example: "content": "He said \"Hello\"" NOT "content": "He said "Hello""
            3. Do not use trailing commas.
            4. **LANGUAGE: ${language}** (All fields must be in ${language})
            5. **Every sermon MUST be directly related to: ${request.topicOrBook}**.

            Output a JSON object with:
            
            1. "structureJustification": A 2-3 paragraph explanation IN ${language} of WHY you structured the series this way. 
               - **Explicitly mention how you integrated the Library Context (or why you couldn't).**
               - Explain the theological/narrative logic.
               - Why you selected these specific passages.
               - ${justificationInstruction}
            
            2. "sermons": An array where each sermon object has:
               - title: Sermon title (creative and engaging) IN ${language}.
               - description: Brief description of focus and key theology IN ${language}.
               - passage: The primary biblical passage. REQUIRED.
               - week: Sermon number (1 to N).
            
            3. "sourcesUsed": An array of objects indicating which sources you used:
               - type: "library" or "general"
               - author: Author name (if library source)
               - title: Resource title (if library source)
               - description: Brief note on how you used this source
            
            JSON:
        `;
    }

    /**
     * Build Citation objects from the AI response and matched chunks
     */
    private buildCitationsFromResponse(
        parsed: { sourcesUsed?: Array<{ type: string; author?: string; title?: string; description?: string }> },
        chunks: DocumentChunkEntity[]
    ): Citation[] {
        const citations: Citation[] = [];

        if (parsed.sourcesUsed) {
            for (const source of parsed.sourcesUsed) {
                if (source.type === 'library' && source.author && source.title) {
                    // Find matching chunk
                    const matchingChunk = chunks.find(
                        c => c.resourceAuthor === source.author || c.resourceTitle.includes(source.title || '')
                    );

                    citations.push({
                        id: crypto.randomUUID(),
                        text: source.description || '',
                        sourceType: 'library',
                        resourceId: matchingChunk?.resourceId,
                        resourceTitle: source.title,
                        resourceAuthor: source.author,
                        chunkId: matchingChunk?.id
                    });
                } else if (source.type === 'general') {
                    citations.push({
                        id: crypto.randomUUID(),
                        text: source.description || 'Conocimiento teológico general',
                        sourceType: 'general'
                    });
                }
            }
        }

        return citations;
    }

    private cleanJsonResponse(text: string): string {
        // Remove markdown fences if present (Native JSON mode might omit them)
        let cleaned = text.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        }

        const firstBrace = cleaned.indexOf('{');
        if (firstBrace === -1) return '{}';

        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace !== -1) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        } else {
            cleaned = cleaned.substring(firstBrace);
        }

        // Basic sanitization for common LLM JSON errors
        // 1. Remove control characters
        cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => {
            return ["\b", "\f", "\n", "\r", "\t"].includes(c) ? c : "";
        });

        return cleaned;
    }
}
