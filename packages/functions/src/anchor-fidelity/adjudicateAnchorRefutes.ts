import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { clientePorRuta } from '../llm/clientePorRuta';
import { adjudicateRefutes, type AdjudicateRefutesInput } from './adjudicateRefutes';

/**
 * ADR-036 PR3 — callable de adjudicación "¿el ancla refuta?" (tier Sonnet).
 *
 * Espeja `evaluateCoverageEngagement` (CA1): mismo tier, mismo manejo de secreto
 * + errores. Pensado para correr en INGEST/REVISIÓN del set crítico (PR4 lo
 * invoca al curar/revisar y cachea el verdict) — NO en el path runtime del
 * pastor. Gateo de rol (`floor-reviewer`) se aplica en el flujo de revisión
 * (PR4); aquí solo exige auth + secreto, como el callable de CA1.
 */

function str(v: unknown): string {
    return String(v ?? '').trim();
}

export const adjudicateAnchorRefutes = onCall(
    { ...appCheckCallableOptions(), secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'], timeoutSeconds: 60 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const data = request.data ?? {};
        const input: AdjudicateRefutesInput = {
            claim: str(data.claim),
            anchorReference: str(data.anchorReference),
            anchorVerseText: str(data.anchorVerseText),
            ...(str(data.whyWrong) ? { whyWrong: str(data.whyWrong) } : {}),
        };
        if (!input.claim) throw new HttpsError('invalid-argument', 'claim is required');
        if (!input.anchorVerseText) throw new HttpsError('invalid-argument', 'anchorVerseText is required');

        try {
            const sonnet = await clientePorRuta({
                usage: { feature: 'adjudicateAnchorRefutes', userId: request.auth?.uid },
                timeoutSeconds: 60,
            });
            const adjudication = await adjudicateRefutes(sonnet, input);
            return { adjudication, modelTier: 'sonnet' as const };
        } catch (err) {
            if (err instanceof HttpsError) throw err;
            console.error('[adjudicateAnchorRefutes] failed', err);
            throw new HttpsError('internal', err instanceof Error ? err.message : 'adjudicateAnchorRefutes failed');
        }
    },
);
