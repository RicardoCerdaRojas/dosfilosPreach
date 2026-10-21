import {
    collection,
    doc,
    getFirestore,
    limit as firestoreLimit,
    onSnapshot,
    orderBy,
    query,
    Timestamp,
    where,
    type QueryConstraint,
} from 'firebase/firestore';
import type { User } from '@dosfilos/domain';

export type AuditAction =
    | 'user.delete'
    | 'user.disable'
    | 'user.enable'
    | 'user.resend_welcome_email'
    | 'user.change_plan'
    | 'user.bulk_disable'
    | 'user.bulk_enable'
    | 'user.grant_credits'
    | 'user.extend_trial';

export interface AuditLogEntry {
    id: string;
    actorUid: string;
    actorEmail: string | null;
    action: AuditAction;
    targetUid: string | null;
    targetEmail: string | null;
    details: Record<string, unknown>;
    createdAt: Date;
}

export interface AuditLogServerFilters {
    targetUid?: string;
}

/**
 * Live read access to the `users` collection + `admin_audit_log`,
 * with the User entity hydration colocated. Hooks call `subscribe*`
 * methods and wire the resulting unsubscribe into their `useEffect`
 * cleanup — Firestore SDK stays out of the presenter (compliance
 * C7.3) and the User mapping no longer duplicates across hooks.
 *
 * Read-only subscriptions live here; mutations belong in
 * `AdminUserService` (callables). Two services on purpose: mixing
 * "subscribe + onChange" semantics with "fire and await" callable
 * semantics in one class makes it harder to read.
 */
/**
 * El saldo de procesamiento tal como lo guarda Firestore, con los Timestamp ya
 * convertidos. Exportada para probarla sin Firestore.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProcessingBalance(raw: Record<string, any> | null | undefined): User['processingBalance'] {
    return raw ? {
        planStandardPages: raw.planStandardPages ?? 0,
        planPremiumPages: raw.planPremiumPages ?? 0,
        packStandardPages: raw.packStandardPages ?? 0,
        packPremiumPages: raw.packPremiumPages ?? 0,
        standardPagesAvailable: raw.standardPagesAvailable ?? 0,
        premiumPagesAvailable: raw.premiumPagesAvailable ?? 0,
        standardSpentTotal: raw.standardSpentTotal ?? 0,
        premiumSpentTotal: raw.premiumSpentTotal ?? 0,
        // Los baldes de exégesis (US$). Sin ellos el diálogo de otorgar
        // mostraba «Balance actual: US$ 0,00» aunque hubiera saldo
        // (TP #8, #41; revisión adversarial).
        planExegesisUsd: raw.planExegesisUsd ?? 0,
        packExegesisUsd: raw.packExegesisUsd ?? 0,
        exegesisUsdAvailable: raw.exegesisUsdAvailable ?? 0,
        exegesisSpentTotalUsd: raw.exegesisSpentTotalUsd ?? 0,
        updatedAt: raw.updatedAt?.toDate(),
    } : undefined;
}

export class AdminUserQueryService {
    /**
     * Subscribes to a single user doc. `onChange` fires with `null`
     * when the doc is missing so callers can render a "not found"
     * state without inventing a sentinel.
     */
    subscribeUser(
        userId: string,
        onChange: (user: User | null) => void,
        onError: (err: Error) => void,
    ): () => void {
        const db = getFirestore();
        return onSnapshot(
            doc(db, 'users', userId),
            (snap) => {
                if (!snap.exists()) {
                    onChange(null);
                    return;
                }
                onChange(this.mapUser(snap.id, snap.data()));
            },
            (err) => onError(err),
        );
    }

    /**
     * Subscribes to the full `users` collection (no server-side
     * filtering — the admin currently has <10K users so bandwidth is
     * cheaper than composite indexes per filter combination). Mapping
     * errors per row are logged + the row falls back to a minimal
     * skeleton so a single bad doc doesn't blank the table.
     */
    subscribeAllUsers(
        onChange: (users: User[]) => void,
        onError: (err: Error) => void,
    ): () => void {
        const db = getFirestore();
        return onSnapshot(
            query(collection(db, 'users')),
            (snapshot) => {
                const users = snapshot.docs.map((d) => {
                    try {
                        return this.mapUser(d.id, d.data());
                    } catch (err) {
                        console.error('[AdminUserQueryService] mapUser failed:', d.id, err);
                        return this.fallbackUser(d.id, d.data());
                    }
                });
                onChange(users);
            },
            (err) => onError(err),
        );
    }

    /**
     * Subscribes to `admin_audit_log` ordered by `createdAt desc`,
     * capped by `hardLimit`. Only `targetUid` is filtered server-side
     * (the common admin-detail-modal path); other filters happen
     * client-side because composite indexes per combination are too
     * many to precompute.
     */
    subscribeAuditLog(
        filters: AuditLogServerFilters,
        hardLimit: number,
        onChange: (entries: AuditLogEntry[]) => void,
        onError: (err: Error) => void,
    ): () => void {
        const db = getFirestore();
        const constraints: QueryConstraint[] = [
            orderBy('createdAt', 'desc'),
            firestoreLimit(hardLimit),
        ];
        if (filters.targetUid) {
            constraints.unshift(where('targetUid', '==', filters.targetUid));
        }
        return onSnapshot(
            query(collection(db, 'admin_audit_log'), ...constraints),
            (snapshot) => {
                const entries: AuditLogEntry[] = snapshot.docs.map((d) => {
                    const data = d.data();
                    return {
                        id: d.id,
                        actorUid: data.actorUid ?? '',
                        actorEmail: data.actorEmail ?? null,
                        action: data.action,
                        targetUid: data.targetUid ?? null,
                        targetEmail: data.targetEmail ?? null,
                        details: data.details ?? {},
                        createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date(),
                    };
                });
                onChange(entries);
            },
            (err) => onError(err),
        );
    }

    /**
     * Hydrates a raw Firestore user doc into the domain `User` entity.
     * Single place so `useUserProfile` and `useAllUsers` never drift
     * on which optional fields are mapped or how Timestamps are
     * converted.
     */
    private mapUser(id: string, data: Record<string, any>): User {
        return {
            id,
            email: data.email || '',
            displayName: data.displayName || null,
            photoURL: data.photoURL || null,
            role: data.role,
            status: data.status || 'active',
            stripeCustomerId: data.stripeCustomerId,
            preferredLanguage: data.preferredLanguage,
            subscription: data.subscription ? {
                id: data.subscription.id || '',
                planId: data.subscription.planId || 'free',
                status: data.subscription.status || 'active',
                stripePriceId: data.subscription.stripePriceId || '',
                cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd ?? false,
                startDate: data.subscription.startDate?.toDate(),
                currentPeriodStart: data.subscription.currentPeriodStart?.toDate(),
                currentPeriodEnd: data.subscription.currentPeriodEnd?.toDate(),
                cancelledAt: data.subscription.cancelledAt?.toDate(),
                trialEnd: data.subscription.trialEnd?.toDate(),
                trialStartedAt: data.subscription.trialStartedAt?.toDate(),
                gracePeriodEnd: data.subscription.gracePeriodEnd?.toDate(),
                failedPaymentAttempts: data.subscription.failedPaymentAttempts,
                updatedAt: data.subscription.updatedAt?.toDate(),
                lastPaymentError: data.subscription.lastPaymentError ? {
                    ...data.subscription.lastPaymentError,
                    attemptedAt: data.subscription.lastPaymentError.attemptedAt?.toDate(),
                } : undefined,
            } : undefined,
            analytics: data.analytics ? {
                lastLoginAt: data.analytics.lastLoginAt?.toDate() || new Date(),
                lastActivityAt: data.analytics.lastActivityAt?.toDate() || new Date(),
                loginCount: data.analytics.loginCount || 0,
                sessionCount: data.analytics.sessionCount || 0,
                totalSessionDuration: data.analytics.totalSessionDuration || 0,
                sermonsCreated: data.analytics.sermonsCreated || 0,
                sermonsPublished: data.analytics.sermonsPublished || 0,
                sermonsGenerated: data.analytics.sermonsGenerated || 0,
                greekTutorSessions: data.analytics.greekTutorSessions || 0,
                greekTutorCompleted: data.analytics.greekTutorCompleted || 0,
                libraryUploads: data.analytics.libraryUploads || 0,
                seriesCreated: data.analytics.seriesCreated || 0,
                preachingPlansCreated: data.analytics.preachingPlansCreated || 0,
                contentCreatedToday: data.analytics.contentCreatedToday || 0,
                contentCreatedThisWeek: data.analytics.contentCreatedThisWeek || 0,
                engagementScore: data.analytics.engagementScore || 0,
                riskLevel: data.analytics.riskLevel || 'low',
                firstSermonAt: data.analytics.firstSermonAt?.toDate(),
                firstAIGenerationAt: data.analytics.firstAIGenerationAt?.toDate(),
                lastContentCreatedAt: data.analytics.lastContentCreatedAt?.toDate(),
            } : undefined,
            processingBalance: mapProcessingBalance(data.processingBalance),
            metadata: data.metadata,
            featureFlags: data.featureFlags ?? undefined,
            declaredConfession: data.declaredConfession ?? undefined,
            confessionAffirmedAt: data.confessionAffirmedAt?.toDate?.() ?? undefined,
            confessionVisibility: data.confessionVisibility ?? undefined,
            useConfessionalWitnesses: data.useConfessionalWitnesses !== false,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
        };
    }

    private fallbackUser(id: string, data: Record<string, any>): User {
        return {
            id,
            email: data.email || 'unknown',
            displayName: data.displayName || null,
            photoURL: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
}

export const adminUserQueryService = new AdminUserQueryService();
