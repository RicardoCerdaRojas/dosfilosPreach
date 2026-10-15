import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { shadowLlmAllowed } from '../llm/llmBudget';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { clientePorRuta } from '../llm/clientePorRuta';
import { judgeGenreEngagement, type GenreEngagementInput, type GenreEngagementJudgment } from './genreEngagement';

/**
 * Redacción v2 Fase 1 (§4.4) A3 — callable del juicio de engagement de género
 * (tier Sonnet). Espeja `evaluateCoverageEngagement`. Muestreado en sombra (el
 * caller decide la tasa; sin costo por turno). SOLO juzga; la decisión
 * (accept/re-confront/override) la toma el dominio (`decideMisreadingTurn`).
 *
 * FAIL-CLOSED: una falla del modelo NO tumba el turno — devuelve un judgment
 * `unclear` (no confronta, no confirma; la sombra lo registra). Solo lanza en
 * errores de ENTRADA (caller bug), no en incertidumbre del juez.
 */

function str(v: unknown): string {
    return String(v ?? '').trim();
}

const UNCLEAR: GenreEngagementJudgment = {
    substantive: true,
    engagedAnchor: false,
    contradictsAnchor: false,
    verdict: 'unclear',
};

export const evaluateGenreEngagement = onCall(
    { ...appCheckCallableOptions(), secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'], timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const data = request.data ?? {};
        const input: GenreEngagementInput = {
            pastorMessage: str(data.pastorMessage),
            proposedGenre: str(data.proposedGenre),
            proposalRationale: str(data.proposalRationale),
            criteria: str(data.criteria),
            ...(typeof data.minSubstanceChars === 'number' ? { minSubstanceChars: data.minSubstanceChars } : {}),
        };
        if (!input.pastorMessage) throw new HttpsError('invalid-argument', 'pastorMessage is required');
        if (!input.proposedGenre) throw new HttpsError('invalid-argument', 'proposedGenre is required');

        // Cortacircuito de gasto: si el día ya alcanzó el tope, la sombra no
        // gasta. Se devuelve el mismo `unclear` del fail-closed — el pastor no
        // se entera y la medición se salta, que es justo el orden de sacrificio
        // que queremos (fail-open para él, fail-closed para el gasto).
        if (!(await shadowLlmAllowed())) {
            return { judgment: UNCLEAR, modelTier: 'sonnet' as const, skippedForBudget: true };
        }

        try {
            const sonnet = await clientePorRuta({
                usage: { feature: 'evaluateGenreEngagement', userId: request.auth?.uid },
                timeoutSeconds: 60,
            });
            const judgment = await judgeGenreEngagement(sonnet, input);
            return { judgment, modelTier: 'sonnet' as const };
        } catch (err) {
            // Fail-closed a unclear: la incertidumbre/caída del juez NO tumba el
            // turno ni cuenta como discrepancia. Se registra unclear.
            console.error('[evaluateGenreEngagement] failed → unclear', err);
            return { judgment: UNCLEAR, modelTier: 'sonnet' as const, failClosed: true };
        }
    },
);
