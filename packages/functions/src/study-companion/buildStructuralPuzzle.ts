import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { GeminiLlmClient } from '../llm/GeminiLlmClient';
import type { ILlmClient } from '../llm/LlmClient';

/**
 * Phase 2.5 Tier 3 (proposal `structural-puzzle-tier3.md`) — build a
 * structural-puzzle dataset for the given passage.
 *
 * The pastor reconstructs the clause hierarchy interactively: pieces
 * (clauses) get placed into zones (climactic | preparatory | development).
 * This callable produces the canonical answer + Socratic hints, but
 * NEVER shows the answer to the pastor before he tries — the client
 * reveals the role only after correct placement; on a wrong placement
 * it surfaces the hint without naming the right zone.
 *
 * Verifier-orienter: like all Phase 2.5 callables, this hands scholarship
 * (clause splits, structural roles) — never theological interpretation.
 */

const MAX_CLAUSES = 8;
/**
 * Word-count ceiling for puzzle build. Beyond this the LLM has to drop
 * clauses to honor MAX_CLAUSES, so the puzzle silently loses parts of the
 * passage and the canonical answer drifts. Forcing the pastor to acotar a
 * pericope keeps the structural exercise honest. Tuned to ~5-6 verses of
 * narrative prose.
 *
 * Caveat: this counts words of the input STRING, not the expanded biblical
 * text. A bare-book reference like "Filemón" passes (1 word) and the LLM
 * then receives the whole letter — bypassing the spirit of the guard. The
 * chapter-verse guard below catches that.
 */
const MAX_INPUT_WORDS = 150;

function countPassageWords(passage: string): number {
    return passage.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Short biblical books where a chapter-less reference is a legitimate
 * perícopa for the puzzle: the entire letter / chapter is short enough
 * that the LLM can render its macro-rhetorical structure in <= 8 slots
 * without truncation. Includes Spanish + English forms + common
 * abbreviations.
 *
 * Prefix-matched on word boundary so all of these pass:
 *   "Filemón" / "Filemón 8-21" / "Filemón 1:8-21" / "Phlm 8-21"
 * (single-chapter books are routinely cited without `:`).
 */
const ALLOWED_WHOLE_BOOK_PATTERNS = [
    /^(filem[oó]n|philemon|phlm)(\s|$)/i,
    /^(judas|jude|jud)(\s|$)/i,
    /^(2\s*(juan|john|jn)|ii\s*(juan|john|jn))(\s|$)/i,
    /^(3\s*(juan|john|jn)|iii\s*(juan|john|jn))(\s|$)/i,
    /^(abd[ií]as|obadiah|obad|abd)(\s|$)/i,
];

function isAllowedWholeBook(ref: string): boolean {
    const normalized = ref.trim();
    return ALLOWED_WHOLE_BOOK_PATTERNS.some((p) => p.test(normalized));
}

/**
 * Heuristic for "does the reference include a verse range?". We accept a
 * colon `:` (e.g. "Juan 3:16", "Romanos 8:28-30") as the canonical
 * marker. Chapter-only references like "Génesis 1" pass `/\d/.test` but
 * still expand to ~30 verses, so the colon — not just any digit — is the
 * right discriminator.
 */
function hasVerseRange(ref: string): boolean {
    return ref.includes(':');
}

const SYSTEM = `Eres un experto en exégesis estructural. Tu tarea: dividir un pasaje bíblico en sus cláusulas constitutivas y clasificarlas estructuralmente.

Reglas:
- Divide el pasaje en cláusulas distinguibles por conectores y verbos finitos. Máximo ${MAX_CLAUSES} cláusulas.
- Para cada cláusula identifica su rol estructural:
  * "climactic": la afirmación central que el resto del pasaje sostiene.
  * "preparatory": cláusulas que preceden y preparan la climática.
  * "development": cláusulas que siguen y desarrollan o aplican la climática.
- Para cada cláusula escribe UNA pista socrática accionable, estructurada en DOS partes en UNA sola frase:
  (a) qué observar en la cláusula misma (conjunción coordinante, verbo subordinado, posición, paralelo, etc.) — referencia un rasgo CONCRETO del texto de esa cláusula, no algo genérico que aplique a varias.
  (b) una pregunta que el pastor pueda hacerse para reclasificarla, SIN nombrar el rol correcto.
  Ejemplo de forma: "Fíjate en X (rasgo concreto): ¿qué te indica eso sobre Y?"
- La pista NUNCA debe revelar el rol correcto. NUNCA debe ser genérica al punto que sirva para varias cláusulas del mismo pasaje. Si dos cláusulas comparten un rasgo (p. ej. ambas empiezan con "y"), la pista debe distinguirlas por otro rasgo.
- Estilo: español neutral latinoamericano, "tú", pastoral. Una frase, máximo dos.

Devuelve SIEMPRE JSON válido (sin Markdown):
{
  "clauses": [
    { "id": "c1", "text": "fragmento textual de la cláusula tal como aparece en el pasaje", "reference": "ej. Juan 1:1a" }
  ],
  "mainClauseId": "c1",
  "roles": { "c1": "climactic", "c2": "preparatory", "c3": "development" },
  "hints": { "c1": "pista socrática", "c2": "pista socrática", "c3": "pista socrática" }
}`;

interface PuzzleClause {
    id: string;
    text: string;
    reference: string;
}
type PuzzleRole = 'climactic' | 'preparatory' | 'development';

interface PuzzleResult {
    clauses: PuzzleClause[];
    mainClauseId: string;
    roles: Record<string, PuzzleRole>;
    hints: Record<string, string>;
}

function safeParseJson(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const first = cleaned.search(/[{[]/);
    const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (first === -1 || last === -1) throw new Error('Respuesta sin JSON detectable.');
    return JSON.parse(cleaned.substring(first, last + 1));
}

function normalizeRole(value: unknown): PuzzleRole | null {
    if (value === 'climactic' || value === 'preparatory' || value === 'development') return value;
    return null;
}

export const buildStructuralPuzzle = onCall(
    { ...appCheckCallableOptions(), secrets: ['GEMINI_API_KEY'], timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new HttpsError('failed-precondition', 'GEMINI_API_KEY secret not configured');
        }
        const data = request.data ?? {};
        const passage = String(data.passage ?? '').trim();
        if (!passage) throw new HttpsError('invalid-argument', 'passage es requerido.');

        // Reference-shape guard. The string word-count guard below can't
        // catch bare-book references (e.g. "Filemón" = 1 word) — the LLM
        // expands the whole book and silently shifts the analysis level
        // from clause-structural to epistle-rhetorical without telling
        // the pastor. We enforce chapter:verse explicitly, with a tight
        // whitelist of short books whose entire content IS a valid
        // perícopa (Filemón / Judas / 2-3 Juan / Abdías).
        if (!hasVerseRange(passage) && !isAllowedWholeBook(passage)) {
            throw new HttpsError(
                'failed-precondition',
                `Especifica capítulo y versículos del pasaje (ej. "Juan 3:16" o "Romanos 8:28-30"). El puzzle estructural requiere una perícopa concreta.`,
                { code: 'passage_needs_chapter_verse' },
            );
        }

        // Length guard. The puzzle is a perícope exercise; whole chapters /
        // letters overflow the clause cap and produce a silently-truncated
        // canonical answer. Refuse explicitly and let the client surface an
        // "acota tu pasaje" UI with the actual word count.
        const wordCount = countPassageWords(passage);
        if (wordCount > MAX_INPUT_WORDS) {
            throw new HttpsError(
                'failed-precondition',
                `El puzzle estructural funciona sobre perícopas de hasta ~${MAX_INPUT_WORDS} palabras (este pasaje tiene ${wordCount}). Acota tu enfoque a 1-5 versículos clave.`,
                { code: 'passage_too_long', wordCount, maxWords: MAX_INPUT_WORDS },
            );
        }

        try {
            const llm: ILlmClient = new GeminiLlmClient(apiKey);
            const raw = await llm.generate({
                system: SYSTEM,
                prompt: `Construye el puzzle estructural para: ${passage}`,
                temperature: 0.2,
                responseMimeType: 'application/json',
            });
            const parsed = safeParseJson(raw);

            const rawClauses = Array.isArray(parsed.clauses) ? parsed.clauses : [];
            const clauses: PuzzleClause[] = rawClauses
                .slice(0, MAX_CLAUSES)
                .map((c: any, i: number) => ({
                    id: String(c?.id ?? `c${i + 1}`),
                    text: String(c?.text ?? '').trim(),
                    reference: String(c?.reference ?? '').trim(),
                }))
                .filter((c) => c.text.length > 0);

            if (clauses.length === 0) {
                throw new HttpsError('internal', 'El modelo no pudo dividir el pasaje en cláusulas.');
            }

            const rawRoles = (parsed.roles ?? {}) as Record<string, unknown>;
            const rawHints = (parsed.hints ?? {}) as Record<string, unknown>;
            const roles: Record<string, PuzzleRole> = {};
            const hints: Record<string, string> = {};
            for (const c of clauses) {
                const r = normalizeRole(rawRoles[c.id]);
                if (r) roles[c.id] = r;
                const h = String(rawHints[c.id] ?? '').trim();
                if (h) hints[c.id] = h;
            }
            const mainClauseId = String(parsed.mainClauseId ?? '');
            const finalMainId = clauses.some((c) => c.id === mainClauseId)
                ? mainClauseId
                : clauses.find((c) => roles[c.id] === 'climactic')?.id ?? clauses[0].id;
            // Ensure the climactic role is set on the main clause.
            roles[finalMainId] = 'climactic';

            const result: PuzzleResult = {
                clauses,
                mainClauseId: finalMainId,
                roles,
                hints,
            };
            return result;
        } catch (err) {
            console.error('[buildStructuralPuzzle] llm failed', err);
            if (err instanceof HttpsError) throw err;
            throw new HttpsError('internal', err instanceof Error ? err.message : 'Puzzle build failed');
        }
    },
);
