import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { shadowLlmAllowed } from '../llm/llmBudget';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { clientePorRuta } from '../llm/clientePorRuta';
import { judgeEngagement, type EngagementInput } from './coverageEngagement';

/**
 * ADR-035 CA1 — callable del juicio de engagement (tier Sonnet, decisión del
 * founder 2026-06-22). Espeja el patrón de `evaluateClaimSourceFidelity` (mismo
 * tipo de juicio: ¿el ancla respalda lo afirmado? → mismo modelo, coherencia).
 *
 * SOLO juzga (3 booleanos); la decisión (accept/re-confront/override) la toma el
 * dominio (`decideMisreadingTurn`) en el use case. Escalación a Pro solo si
 * Sonnet falla la fila D de forma reproducible en el corpus (criterio medible).
 */

function str(v: unknown): string {
    return String(v ?? '').trim();
}

export const evaluateCoverageEngagement = onCall(
    { ...appCheckCallableOptions(), secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'], timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const data = request.data ?? {};
        const input: EngagementInput = {
            pastorMessage: str(data.pastorMessage),
            claim: str(data.claim),
            whyWrong: str(data.whyWrong),
            correctiveAnchors: Array.isArray(data.correctiveAnchors)
                ? data.correctiveAnchors.map(str).filter(Boolean).slice(0, 10)
                : [],
            ...(typeof data.minSubstanceChars === 'number' ? { minSubstanceChars: data.minSubstanceChars } : {}),
        };
        if (!input.pastorMessage) throw new HttpsError('invalid-argument', 'pastorMessage is required');
        if (!input.claim) throw new HttpsError('invalid-argument', 'claim is required');

        // Cortacircuito de gasto (ver `llmBudget`): la sombra es lo primero que se
        // sacrifica cuando el día se pone caro. Mismo `unclear` del fail-closed.
        if (!(await shadowLlmAllowed())) {
            // Mismo veredicto neutro que el gate de sustancia: ni trabajó ni
            // contradijo. El cliente ya sabe tratarlo como "sin señal".
            return {
                judgment: { substantive: false, engagedAnchor: false, contradictsAnchor: false },
                modelTier: 'sonnet' as const,
                skippedForBudget: true,
            };
        }

        try {
            const sonnet = await clientePorRuta({
                usage: { feature: 'evaluateCoverageEngagement', userId: request.auth?.uid },
                timeoutSeconds: 60,
            });
            const judgment = await judgeEngagement(sonnet, input);
            return { judgment, modelTier: 'sonnet' as const };
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            console.error('[evaluateCoverageEngagement] failed', err);
            throw new HttpsError('internal', err instanceof Error ? err.message : 'evaluateCoverageEngagement failed');
        }
    },
);
