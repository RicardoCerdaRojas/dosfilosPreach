import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

/**
 * Catalog of admin actions tracked in the audit log. Adding a new action:
 * append it here so the type narrows everywhere it's consumed.
 */
export type AdminAuditAction =
    | 'user.delete'
    | 'user.disable'
    | 'user.enable'
    | 'user.resend_welcome_email'
    | 'user.change_plan'
    | 'user.bulk_disable'
    | 'user.bulk_enable'
    | 'user.grant_credits'
    | 'user.reset_quota'
    | 'user.extend_trial'
    | 'user.set_feature_flags'
    | 'user.impersonate'
    | 'user.stop_impersonate'
    | 'user.self_delete_requested'
    | 'user.self_delete_completed'
    | 'core_library.ingest'
    | 'core_library.seed_ingest'
    | 'core_library.tag_doctrine_levels'
    | 'core_library.update_doctrine_level'
    | 'cross_references.ingest'
    | 'anchor_fidelity.ingest_misreading'
    | 'anchor_fidelity.review_misreading'
    | 'anchor_fidelity.update_misreading'
    | 'anchor_fidelity.delete_misreading';

interface WriteAuditLogParams {
    /** Firebase UID of the admin who triggered the action. */
    actorUid: string;
    /** Email of the admin (denormalized for fast UI rendering of the log). */
    actorEmail?: string;
    /** Action identifier — see `AdminAuditAction`. */
    action: AdminAuditAction;
    /** Firebase UID of the user the action targets (or undefined for bulk). */
    targetUid?: string;
    /** Email of the target user (denormalized so the log stays readable
     *  even after the user is deleted). */
    targetEmail?: string;
    /** Free-form metadata: previous plan, new plan, batch size, etc. */
    details?: Record<string, unknown>;
}

/**
 * Writes a single entry to the `admin_audit_log` collection. Best-effort —
 * an audit failure must never block the underlying admin action from
 * succeeding, so callers don't await this and we swallow errors with a log.
 *
 * Why a separate collection (not subcollection): aggregations across users
 * (e.g., "every action admin X performed last week") need a flat index.
 * Sub-collections force per-user reads which doesn't scale for compliance
 * reports.
 */
export function writeAuditLog(params: WriteAuditLogParams): void {
    const db = getFirestore();
    db.collection('admin_audit_log')
        .add({
            actorUid: params.actorUid,
            actorEmail: params.actorEmail ?? null,
            action: params.action,
            targetUid: params.targetUid ?? null,
            targetEmail: params.targetEmail ?? null,
            details: params.details ?? {},
            createdAt: FieldValue.serverTimestamp(),
        })
        .catch((err) => {
            logger.warn('[auditLog] Failed to write entry — non-blocking:', {
                action: params.action,
                actorUid: params.actorUid,
                error: String(err),
            });
        });
}
