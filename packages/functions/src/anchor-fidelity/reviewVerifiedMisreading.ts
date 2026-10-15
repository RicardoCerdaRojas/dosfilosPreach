import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { writeAuditLog } from '../admin/auditLog';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import { clientePorRuta } from '../llm/clientePorRuta';
import { adjudicateRefutes, type RefutesVerdict } from './adjudicateRefutes';

/**
 * ADR-036 PR4 — revisión de una entrada del set crítico curado.
 *
 * Único escritor del estado de verificación + del flip `pending → reviewed`.
 * Role-gated igual que `updateSectionDoctrineLevel` (super_admin PLACEHOLDER del
 * rol `floor-reviewer`). Hace lo que el path runtime del pastor NO puede:
 *   - adjudicación Sonnet server-side ("¿el ancla refuta?") usando el TEXTO del
 *     verso que el app-layer resolvió (functions no lee texto bíblico, por eso
 *     `verseText` entra como input — advisory `versesExist` también).
 *   - resolución de procedencia (R3): lee `document_chunks/{sourceId}` (admin SDK)
 *     y cachea `{resourceTitle, page}` REAL del chunk, NO redactado.
 *
 * NO es el gate fail-closed: `versesExist` guardado es ADVISORY; la existencia
 * AUTORITATIVA se re-verifica en el merge (PR5) con la MISMA `verifyAnchorVerse`,
 * en el punto de uso. Aquí solo se registra para la cola + el display.
 *
 * functions NO importa @dosfilos/domain: la agregación espeja
 * `aggregateAnchorVerification` de packages/domain/src/services/anchorAdmission.ts.
 */

function str(v: unknown): string {
    return String(v ?? '').trim();
}

interface AnchorVerificationInput {
    reference: string;
    /** Texto del verso, resuelto app-layer (functions no lee la Biblia). */
    verseText: string;
    /** Existencia advisory, computada app-layer con `verifyAnchorVerse`. */
    versesExist: boolean;
}

interface PerAnchor {
    versesExist: boolean;
    refutes: RefutesVerdict;
}

/** Espeja `aggregateAnchorVerification` (domain). Fail-closed: solo anclas con verso cuentan. */
function aggregate(perAnchor: PerAnchor[]): { versesExist: boolean; refutes: RefutesVerdict } {
    const anyExists = perAnchor.some((a) => a.versesExist);
    const valid = perAnchor.filter((a) => a.versesExist);
    if (valid.some((a) => a.refutes === 'yes')) return { versesExist: anyExists, refutes: 'yes' };
    if (valid.some((a) => a.refutes === 'unclear')) return { versesExist: anyExists, refutes: 'unclear' };
    return { versesExist: anyExists, refutes: 'no' };
}

type SourceProvenance =
    | { kind: 'chunk'; resourceId: string; resourceTitle: string; page?: number }
    | { kind: 'sin-fuente-trazable' };

/** R3 — resuelve `sourceId` → chunk real. Si no resuelve → sin-fuente-trazable. */
async function resolveProvenance(
    db: admin.firestore.Firestore,
    sourceId: string | undefined,
): Promise<{ provenanceVerified: boolean; sourceProvenance: SourceProvenance }> {
    if (!sourceId) {
        return { provenanceVerified: false, sourceProvenance: { kind: 'sin-fuente-trazable' } };
    }
    const snap = await db.collection('document_chunks').doc(sourceId).get();
    if (!snap.exists) {
        return { provenanceVerified: false, sourceProvenance: { kind: 'sin-fuente-trazable' } };
    }
    const d = snap.data() ?? {};
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    const page = typeof meta.page === 'number' ? meta.page : undefined;
    return {
        provenanceVerified: true,
        sourceProvenance: {
            kind: 'chunk',
            resourceId: str(d.resourceId),
            resourceTitle: str(d.resourceTitle),
            ...(page !== undefined ? { page } : {}),
        },
    };
}

export const reviewVerifiedMisreading = onCall(
    { ...appCheckCallableOptions(), secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'], timeoutSeconds: 120 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }
        const db = admin.firestore();
        const callerUid = request.auth.uid;

        const callerDoc = await db.collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'super_admin') {
            throw new HttpsError('permission-denied', 'Only the floor reviewer can review verified misreadings');
        }

        const data = request.data ?? {};
        const id = str(data.id);
        const approve = data.approve === true;
        if (!id) throw new HttpsError('invalid-argument', 'id is required');

        const verificationsByRef = new Map<string, AnchorVerificationInput>();
        if (Array.isArray(data.anchorVerifications)) {
            for (const v of data.anchorVerifications) {
                const reference = str((v as Record<string, unknown>)?.reference);
                if (!reference) continue;
                verificationsByRef.set(reference, {
                    reference,
                    verseText: str((v as Record<string, unknown>)?.verseText),
                    versesExist: (v as Record<string, unknown>)?.versesExist === true,
                });
            }
        }

        const ref = db.collection('verifiedMisreadings').doc(id);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpsError('not-found', `verifiedMisreading ${id} not found`);
        const entry = snap.data()!;
        const claim = str(entry.claim);
        const whyWrong = str(entry.whyWrong);
        const anchors = Array.isArray(entry.correctiveAnchors) ? entry.correctiveAnchors : [];

        const sonnet = await clientePorRuta({
            usage: { feature: 'reviewVerifiedMisreading', userId: request.auth?.uid },
            timeoutSeconds: 120,
        });
        const perAnchor: PerAnchor[] = [];
        const updatedAnchors: Record<string, unknown>[] = [];

        for (const a of anchors) {
            const reference = str((a as Record<string, unknown>)?.reference);
            const sourceId = str((a as Record<string, unknown>)?.sourceId) || undefined;
            const input = verificationsByRef.get(reference);
            const versesExist = input?.versesExist === true;
            const verseText = input?.verseText ?? '';

            // Adjudicación server-side (Sonnet). Sin verso existente/ texto → no
            // se adjudica (fail-closed): refutes 'no'.
            let refutes: RefutesVerdict = 'no';
            if (versesExist && verseText) {
                const adj = await adjudicateRefutes(sonnet, {
                    claim,
                    ...(whyWrong ? { whyWrong } : {}),
                    anchorReference: reference,
                    anchorVerseText: verseText,
                });
                refutes = adj.refutes;
            }
            perAnchor.push({ versesExist, refutes });

            const prov = await resolveProvenance(db, sourceId);
            updatedAnchors.push({
                reference,
                ...(str((a as Record<string, unknown>)?.note) ? { note: str((a as Record<string, unknown>).note) } : {}),
                ...(sourceId ? { sourceId } : {}),
                provenanceVerified: prov.provenanceVerified,
                sourceProvenance: prov.sourceProvenance,
            });
        }

        const verdict = aggregate(perAnchor);
        const verification = {
            versesExist: verdict.versesExist,
            refutes: verdict.refutes,
            adjudicatedAt: new Date().toISOString(),
            modelTier: 'sonnet' as const,
        };

        const update: Record<string, unknown> = {
            correctiveAnchors: updatedAnchors,
            verification,
            updatedAt: FieldValue.serverTimestamp(),
        };
        // El humano aprueba → reviewed. El gate (yes + reviewed) lo aplica el
        // merge (PR5): aprobar NO basta para confrontar si no refuta.
        if (approve) {
            update.reviewStatus = 'reviewed';
            update.reviewedBy = callerUid;
            update.reviewedAt = FieldValue.serverTimestamp();
        }

        await ref.update(update);

        writeAuditLog({
            actorUid: callerUid,
            actorEmail: callerDoc.data()?.email,
            action: 'anchor_fidelity.review_misreading',
            details: { id, approve, verification, anchorCount: anchors.length },
        });

        return { id, verification, reviewStatus: approve ? 'reviewed' : 'pending-pastoral-review' };
    },
);
