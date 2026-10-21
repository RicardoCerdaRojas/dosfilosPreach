import { getFunctions, httpsCallable } from 'firebase/functions';

export type BulkUserAction = 'disable' | 'enable';

export interface BulkUserActionResult {
    userId: string;
    success: boolean;
    error?: string;
}

export interface BulkUserActionResponse {
    results: BulkUserActionResult[];
    ok: number;
    failed: number;
}

export interface ChangePlanForUserArgs {
    userId: string;
    newPlanId: string;
    billing?: 'monthly' | 'yearly';
}

export interface ChangePlanForUserResponse {
    success: boolean;
    fromPlan: string;
    toPlan: string;
    billing: 'monthly' | 'yearly';
    cancelAtPeriodEnd: boolean;
}

export interface ExtendTrialArgs {
    userId: string;
    days: number;
    reason: string;
}

export interface ResetUserPlanQuotaArgs {
    userId: string;
    reason: string;
}

export interface ResetUserPlanQuotaResponse {
    success: boolean;
    planId: string;
    appliedQuotas: {
        standardPages: number;
        premiumPages: number;
        exegesisUsd: number;
    };
}

export interface GrantUserCreditsArgs {
    userId: string;
    standardPages?: number;
    premiumPages?: number;
    /** US$ al balde `pack` de exégesis (TP #8, #41). */
    exegesisUsd?: number;
    reason: string;
}

export interface SetUserFeatureFlagsArgs {
    userId: string;
    flags: Record<string, boolean>;
}

export interface SetUserFeatureFlagsResponse {
    success: boolean;
    flags: Record<string, boolean>;
}

export interface ResendWelcomeEmailResponse {
    success: boolean;
    [key: string]: unknown;
}

/**
 * Thin facade over the admin user-management Cloud Functions. Each
 * method maps to one callable so the corresponding hook
 * (useDisableUser, useEnableUser, etc.) stays presenter-only and
 * doesn't need to import `firebase/functions` directly. Compliance
 * gate C7.3 — no Firebase SDK in `web/src/hooks`.
 *
 * No business logic lives here yet — these are pure SDK boundaries.
 * Callables return raw responses; UI feedback (toasts, optimistic
 * updates) stays in the hooks where it has React state to mutate.
 */
export class AdminUserService {
    async disableUser(userId: string): Promise<void> {
        const fn = httpsCallable(getFunctions(), 'disableUser');
        await fn({ userId });
    }

    async enableUser(userId: string): Promise<void> {
        const fn = httpsCallable(getFunctions(), 'enableUser');
        await fn({ userId });
    }

    async deleteUser(userId: string): Promise<void> {
        const fn = httpsCallable(getFunctions(), 'deleteUser');
        await fn({ userId });
    }

    async resendWelcomeEmail(userId: string): Promise<ResendWelcomeEmailResponse> {
        const fn = httpsCallable<{ userId: string }, ResendWelcomeEmailResponse>(
            getFunctions(),
            'resendWelcomeEmail',
        );
        const { data } = await fn({ userId });
        return data;
    }

    async extendUserTrial(args: ExtendTrialArgs): Promise<void> {
        const fn = httpsCallable(getFunctions(), 'extendUserTrialAdmin');
        await fn(args);
    }

    async grantUserCredits(args: GrantUserCreditsArgs): Promise<void> {
        const fn = httpsCallable(getFunctions(), 'grantUserCredits');
        await fn(args);
    }

    async resetUserPlanQuota(args: ResetUserPlanQuotaArgs): Promise<ResetUserPlanQuotaResponse> {
        const fn = httpsCallable<ResetUserPlanQuotaArgs, ResetUserPlanQuotaResponse>(
            getFunctions(),
            'resetUserPlanQuota',
        );
        const { data } = await fn(args);
        return data;
    }

    async changePlanForUser(args: ChangePlanForUserArgs): Promise<ChangePlanForUserResponse> {
        const fn = httpsCallable<ChangePlanForUserArgs, ChangePlanForUserResponse>(
            getFunctions(),
            'changePlanForUser',
        );
        const { data } = await fn(args);
        return data;
    }

    async bulkUserAction(
        action: BulkUserAction,
        userIds: string[],
    ): Promise<BulkUserActionResponse> {
        const fn = httpsCallable<{ action: BulkUserAction; userIds: string[] }, BulkUserActionResponse>(
            getFunctions(),
            'bulkUserAction',
        );
        const { data } = await fn({ action, userIds });
        return data;
    }

    async setUserFeatureFlags(args: SetUserFeatureFlagsArgs): Promise<SetUserFeatureFlagsResponse> {
        const fn = httpsCallable<SetUserFeatureFlagsArgs, SetUserFeatureFlagsResponse>(
            getFunctions(),
            'setUserFeatureFlags',
        );
        const { data } = await fn(args);
        return data;
    }
}

export const adminUserService = new AdminUserService();
