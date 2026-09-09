import {
    formatPassageReference,
    type IStepCorpusPlanner,
    type ProposeStepCorpusInput,
    type ProposeStepCorpusResult,
    type ProposedAllocation,
} from '@dosfilos/domain';
import { withGeminiRetry } from './geminiRetry';
import { runLlmPrompt } from '../llm/callableLlm';
import { LONG_GENERATION_TIMEOUT_MS } from '../llm/llmTimeouts';

/**
 * v1.7 — Gemini implementation of `IStepCorpusPlanner`.
 *
 * Given the paper's passage + brief + corpus + steps, asks Gemini to
 * propose `pinnedSources` per step. Returns a structured allocation
 * map the use case folds into `paper.stepPlan.perStep`.
 *
 * Why Pro 2.5 over Flash here:
 *   - The reasoning is "what belongs where" — quality of allocation
 *     matters more than throughput. A bad plan invites manual rework.
 *   - The corpus + steps fit comfortably in Pro's context (max ~50
 *     sources × ~30 steps = a tiny prompt).
 *   - Single-shot, low temperature (0.2) for deterministic output the
 *     user can compare across regenerations.
 *
 * Errors: parse failures throw with the raw response logged. The use
 * case is responsible for sanitizing hallucinated source ids — this
 * planner just returns whatever Gemini produced (after JSON parsing).
 */
export class GeminiStepCorpusPlanner implements IStepCorpusPlanner {
    private modelName: string;

    constructor(modelName?: string) {
        this.modelName = modelName || 'gemini-2.5-pro';
    }

    async propose(input: ProposeStepCorpusInput): Promise<ProposeStepCorpusResult> {
        const { systemInstruction, userMessage } = buildPlannerPrompt(input);

        console.log('[GeminiStepCorpusPlanner] proposing', {
            sourceCount: input.sources.length,
            stepCount: input.steps.length,
            language: input.language,
        });

        const rawJson = await withGeminiRetry(
            () => runLlmPrompt({
                feature: 'exegesis.planStepCorpus',
                model: this.modelName,
                system: systemInstruction,
                prompt: userMessage,
                responseMimeType: 'application/json',
                // Bumped from 0.2 → 0.4 so the model commits to assignments
                // instead of hedging when a verse is between two plausible
                // sources. Still well below the "creative" range, so output
                // stays comparable across regenerations.
                temperature: 0.4,
                topP: 0.9,
                // Bumped 8k → 32k after observing truncation on a paper
                // with 16 sources × 15 steps. The full coverage rules
                // (every step gets ≥1 source + every source appears ≥1
                // time) push the response into the 4-8k range easily,
                // and rationales add another 1-2k. 32k gives 4× headroom
                // even for ~30 sources × ~30 steps. Pro 2.5 supports up
                // to 65k so we're nowhere near the model ceiling.
                maxOutputTokens: 32768,
            }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS }),
            { contextLabel: 'GeminiStepCorpusPlanner' },
        );

        const parsed = parsePlannerJson(rawJson);
        const allocations = mapToAllocations(parsed);

        return {
            allocations,
            promptUsed: userMessage,
        };
    }
}

// ── Prompt construction ─────────────────────────────────────────────────

function buildPlannerPrompt(input: ProposeStepCorpusInput): {
    systemInstruction: string;
    userMessage: string;
} {
    const isSpanish = input.language === 'es';
    const passageLabel = formatPassageReference(input.passage, input.language);

    const systemInstruction = isSpanish
        ? `Eres un profesor experto en exégesis bíblica que asesora a un estudiante de seminario en cómo construir la bibliografía dialéctica de cada paso de su paper.

Tu tarea: para cada paso (versículo / introducción / conclusión), arma una **mini-bibliografía dialéctica** asignando 1-3 fuentes con ROLES explícitos. La idea NO es repartir fuentes por tipo — es construir el diálogo crítico que sostiene el argumento exegético del paso.

ESTRATEGIA DIALÉCTICA (este es el corazón de la tarea):

1. **ANCLA** (\`anchor\`) — UNA fuente que sirve como lectura base del paso. Típicamente el comentario expositivo más cercano al género del paper (NICNT, BECNT, Pillar) o el comentario crítico principal del libro si solo hay uno. Cada paso DEBE tener una ancla.

2. **CONTRASTE** (\`contrast\`) — UNA fuente que ofrece una voz distinta al ancla. Más técnica si el ancla es expositiva, otra escuela teológica, lectura alternativa documentada. Si todas las fuentes del corpus son de la misma escuela y registro, omite el contraste.

3. **TÉCNICA** (\`technical\`) — UNA fuente puntual que respalda una decisión léxico-sintáctica del verso: léxico (BDAG, HALOT), gramática (Wallace, BDF), aparato crítico (NA28, BHS). Solo cuando el verso pide decisión técnica concreta. Si el verso es transparente, omítela.

REGLAS DE COBERTURA:
- CADA paso debe tener al menos un ANCLA. Si dudas qué usar, el comentario expositivo más general es válido siempre.
- La cobertura del corpus aplica **solo a los pasos de tipo VERSO**: cada fuente del corpus debe aparecer al menos UNA VEZ en algún verso (ancla, contraste o técnica), salvo que sea genuinamente irrelevante para todo el pasaje.
- **Introducción y Conclusión NO son receptáculos para fuentes sobrantes.** Si una fuente no encuentra casa en ningún verso, déjala sin pinear — el orquestrador puede usarla en modo flexible y el alumno puede pinearla manualmente. Mejor una fuente sin asignar que saturar intro/conclusión.

ASIMETRÍA POR TIPO DE PASO (importantísimo — el método dialéctico no se aplica con la misma intensidad en cada paso):

- **Versos** (\`verse\`) — el corazón dialéctico. Aquí se ejerce el método con plenitud: 2-3 fuentes (ANCLA + CONTRASTE, +TÉCNICA si el verso pide una decisión léxico-sintáctica concreta). 4 es máximo absoluto.

- **Introducción** (\`introduction\`) — la voz del autor lidera. **POR DEFECTO: 1 SOLA FUENTE** — una ANCLA contextual (trasfondo histórico, diccionario teológico, o monografía relevante que enmarque el pasaje completo). Solo agrega un CONTRASTE si existe una voz crítica que reformule el marco interpretativo del pasaje entero (no para "agregar contraste por agregarlo"). **NUNCA TÉCNICA**. **MÁXIMO ABSOLUTO 2 fuentes**, y solo con justificación quirúrgica para el contraste.

- **Conclusión** (\`conclusion\`) — síntesis del autor. **POR DEFECTO: 1 SOLA FUENTE** — típicamente UNA monografía teológica o comentario expositivo como ANCLA integradora. Solo agrega CONTRASTE si una alternativa interpretativa específica DEBE quedar resuelta en el cierre del paper. **NUNCA TÉCNICA ni voces críticas nuevas**. **MÁXIMO ABSOLUTO 2 fuentes**, y solo con justificación quirúrgica.

Repaso mental antes de proponer intro/conclusión: "¿este contraste resuelve algo específico del marco/cierre del paper, o lo estoy metiendo solo porque sobró una fuente?". Si es lo segundo, asígnala 1 sola y déjala.

CRITERIOS POR TIPO (orientación, no obligación):
- Comentarios críticos (WBC, NIGTC, Hermeneia, ICC, Anchor): excelente como contraste a un ancla expositiva, o como ancla en versos densos.
- Comentarios expositivos (NICNT, BECNT, Pillar, Tyndale): el ancla por defecto en la mayoría de versos.
- Léxicos / gramáticas / aparato crítico: rol técnico exclusivamente, **solo en versos**.
- Trasfondo histórico, diccionarios teológicos: típicamente ancla o contraste de introducción y versos con tema doctrinal.
- Monografías teológicas: ancla o contraste en conclusión y versos clave.

JUSTIFICACIÓN: una sola oración en español, NOMBRA explícitamente los roles. Ejemplo: "Ancla: Cranfield orienta la lectura paulina del genitivo absoluto. Contraste: Moo añade la perspectiva crítica de la nueva perspectiva. Técnica: BDAG confirma el campo semántico de \`δικαιοσύνη\`."`
        : `You are an expert biblical exegesis professor advising a seminary student on how to build the dialectical bibliography for each step of their paper.

Task: for each step (verse / introduction / conclusion), construct a **dialectical mini-bibliography** by assigning 1-3 sources with EXPLICIT ROLES. The point is NOT to distribute sources by type — it's to build the critical dialogue that supports the step's exegetical argument.

DIALECTICAL STRATEGY (this is the heart of the task):

1. **ANCHOR** (\`anchor\`) — ONE source that serves as the step's base reading. Typically the expository commentary closest to the paper's genre (NICNT, BECNT, Pillar) or the principal critical commentary on the book if only one is available. Every step MUST have an anchor.

2. **CONTRAST** (\`contrast\`) — ONE source that brings a different voice from the anchor. More technical if the anchor is expository, a different theological school, a documented alternate reading. Skip when every corpus source shares the anchor's school and register.

3. **TECHNICAL** (\`technical\`) — ONE source that backs a specific lexical-syntactic decision in the verse: lexicon (BDAG, HALOT), grammar (Wallace, BDF), critical apparatus (NA28, BHS). Only when the verse calls for a concrete technical decision. Skip when the verse is transparent.

COVERAGE RULES:
- EVERY step must have at least an ANCHOR. If unsure, the most general expository commentary is always valid.
- Corpus coverage applies **only to VERSE steps**: every corpus source should appear at least ONCE in some verse (as anchor, contrast, or technical), unless genuinely irrelevant to the whole passage.
- **Introduction and Conclusion are NOT dumping grounds for leftover sources.** If a source finds no home in any verse, leave it unpinned — the orchestrator can still surface it in flexible mode and the student can pin it manually. Better an unpinned source than over-sourced intro/conclusion.

ASYMMETRY BY STEP TYPE (critical — the dialectical method does NOT apply with equal intensity at every step):

- **Verses** (\`verse\`) — the dialectical heart. Here the method is fully exercised: 2-3 sources (ANCHOR + CONTRAST, + TECHNICAL when the verse calls for a concrete lexical/syntactic decision). 4 is the absolute ceiling.

- **Introduction** (\`introduction\`) — the author's voice leads. **DEFAULT: 1 SINGLE SOURCE** — a contextual ANCHOR (historical background, theological dictionary, or relevant monograph that frames the passage as a whole). Only add a CONTRAST if a critical voice reframes the passage's interpretive frame (NOT to "add contrast for the sake of it"). **NEVER TECHNICAL**. **HARD CAP 2 sources**, and only with surgical justification for the contrast.

- **Conclusion** (\`conclusion\`) — the author's synthesis. **DEFAULT: 1 SINGLE SOURCE** — typically ONE theological monograph or expository commentary as integrative ANCHOR. Only add CONTRAST if a specific interpretive alternative MUST be resolved in the paper's closing. **NEVER TECHNICAL nor new critical voices**. **HARD CAP 2 sources**, and only with surgical justification.

Mental check before proposing intro/conclusion: "does this contrast resolve something specific about the paper's framing/closing, or am I just placing a leftover source?". If the latter, assign 1 source and leave the rest.

TYPE CRITERIA (guidance, not obligation):
- Critical commentaries (WBC, NIGTC, Hermeneia, ICC, Anchor): excellent as contrast to an expository anchor, or as anchor on dense verses.
- Expository commentaries (NICNT, BECNT, Pillar, Tyndale): the default anchor on most verses.
- Lexicons / grammars / critical apparatus: technical role exclusively, **verses only**.
- Historical background, theological dictionaries: usually anchor or contrast in introduction and theme-heavy verses.
- Theological monographs: anchor or contrast in conclusion and key verses.

JUSTIFICATION: one sentence in English, NAME the roles explicitly. Example: "Anchor: Cranfield orients the Pauline reading of the genitive absolute. Contrast: Moo adds the New Perspective's critical angle. Technical: BDAG confirms the semantic range of \`δικαιοσύνη\`."`;

    const passageLine = isSpanish
        ? `**Pasaje del paper:** ${passageLabel}`
        : `**Paper passage:** ${passageLabel}`;
    const briefLine = input.assignmentBrief
        ? (isSpanish
            ? `**Brief del estudiante:** ${input.assignmentBrief.trim().slice(0, 1000)}`
            : `**Student brief:** ${input.assignmentBrief.trim().slice(0, 1000)}`)
        : null;

    const sourcesSection = isSpanish ? '**Fuentes en el corpus:**' : '**Sources in the corpus:**';
    const sourcesList = input.sources
        .map(s => `- id="${s.id}" · type=${s.sourceType} · ${s.displayLabel}${s.citationKey ? ` (${s.citationKey})` : ''}`)
        .join('\n');

    const stepsSection = isSpanish ? '**Pasos del paper:**' : '**Paper steps:**';
    const stepsList = input.steps
        .map(s => `- id="${s.id}" · kind=${s.kind} · ${s.label}`)
        .join('\n');

    const schemaSection = isSpanish
        ? `**Devuelve JSON con esta estructura exacta:**`
        : `**Return JSON with this exact structure:**`;
    const schemaExample = `{
  "allocations": {
    "<step-id>": {
      "pinnedSources": ["<source-id-anchor>", "<source-id-contrast>", "<source-id-technical>"],
      "pinnedSourceRoles": {
        "<source-id-anchor>": "anchor",
        "<source-id-contrast>": "contrast",
        "<source-id-technical>": "technical"
      },
      "rationale": "${isSpanish ? 'Una oración breve nombrando los roles.' : 'One short sentence naming the roles.'}"
    }
  }
}`;

    const constraints = isSpanish
        ? `Restricciones:
- Usa SOLO los ids exactos listados arriba (no inventes nuevos).
- Usa SOLO ids de pasos listados arriba.
- TODOS los pasos deben aparecer en "allocations" con al menos 1 fuente con rol "anchor".
- TODAS las fuentes deben aparecer al menos una vez en algún paso, salvo que sean claramente irrelevantes.
- Cada id en "pinnedSources" DEBE tener una entrada correspondiente en "pinnedSourceRoles".
- Máximo 4 fuentes por paso. Apunta a 2-3.`
        : `Constraints:
- Use ONLY the exact ids listed above (don't invent new ones).
- Use ONLY step ids listed above.
- ALL steps must appear in "allocations" with at least 1 source with role "anchor".
- ALL sources must appear at least once in some step, unless clearly irrelevant.
- Every id in "pinnedSources" MUST have a corresponding entry in "pinnedSourceRoles".
- Max 4 sources per step. Aim for 2-3.`;

    const userMessage = [
        passageLine,
        briefLine,
        '',
        sourcesSection,
        sourcesList,
        '',
        stepsSection,
        stepsList,
        '',
        schemaSection,
        '```json',
        schemaExample,
        '```',
        '',
        constraints,
    ].filter(Boolean).join('\n');

    return { systemInstruction, userMessage };
}

// ── Response parsing ────────────────────────────────────────────────────

interface ParsedPlannerResponse {
    allocations?: Record<string, {
        pinnedSources?: unknown;
        pinnedSourceRoles?: unknown;
        rationale?: unknown;
    }>;
}

const VALID_ROLES = new Set(['anchor', 'contrast', 'technical']);

function parsePlannerJson(rawJson: string): ParsedPlannerResponse {
    try {
        const parsed = JSON.parse(rawJson);
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Top-level value is not an object');
        }
        return parsed as ParsedPlannerResponse;
    } catch (err) {
        console.error('[GeminiStepCorpusPlanner] failed to parse response', { sample: rawJson.slice(0, 500) });
        throw new Error(`GeminiStepCorpusPlanner: invalid JSON: ${(err as Error).message}`);
    }
}

function mapToAllocations(parsed: ParsedPlannerResponse): Record<string, ProposedAllocation> {
    const out: Record<string, ProposedAllocation> = {};
    if (!parsed.allocations || typeof parsed.allocations !== 'object') return out;
    for (const [stepId, raw] of Object.entries(parsed.allocations)) {
        if (typeof stepId !== 'string' || stepId.length === 0) continue;
        const pinned = Array.isArray(raw?.pinnedSources)
            ? raw.pinnedSources.filter((id): id is string => typeof id === 'string' && id.length > 0)
            : [];
        // Sanitize roles: keep only entries where value is a valid
        // role string AND the key is in pinnedSources (drops orphaned
        // role entries that the model may invent on its own).
        const pinnedSet = new Set(pinned);
        const roles: Record<string, 'anchor' | 'contrast' | 'technical'> = {};
        if (raw?.pinnedSourceRoles && typeof raw.pinnedSourceRoles === 'object') {
            for (const [id, role] of Object.entries(raw.pinnedSourceRoles as Record<string, unknown>)) {
                if (!pinnedSet.has(id)) continue;
                if (typeof role !== 'string' || !VALID_ROLES.has(role)) continue;
                roles[id] = role as 'anchor' | 'contrast' | 'technical';
            }
        }
        const rationale = typeof raw?.rationale === 'string' ? raw.rationale.trim() : '';
        out[stepId] = {
            pinnedSources: pinned,
            ...(Object.keys(roles).length > 0 ? { pinnedSourceRoles: roles } : {}),
            rationale,
        };
    }
    return out;
}
