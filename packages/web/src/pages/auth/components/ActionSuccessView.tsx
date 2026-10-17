import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import type { AuthActionMode } from '../hooks/useAuthAction';

const REDIRECT_AFTER_VERIFY_MS = 2500;

interface ActionSuccessViewProps {
    mode: AuthActionMode;
    continueUrl: string | null;
}

export function ActionSuccessView({ mode, continueUrl }: ActionSuccessViewProps) {
    const { t } = useTranslation('auth');
    const navigate = useNavigate();
    const { user } = useFirebase();
    const [countdown, setCountdown] = useState<number | null>(null);

    const isVerify = mode === 'verifyEmail';
    const target = user ? '/dashboard' : continueUrl || '/login';

    useEffect(() => {
        if (!isVerify) return;
        setCountdown(Math.ceil(REDIRECT_AFTER_VERIFY_MS / 1000));
        const tick = setInterval(() => {
            setCountdown((c) => (c === null ? null : Math.max(0, c - 1)));
        }, 1000);
        const redirect = setTimeout(() => {
            navigate(target, { replace: true });
        }, REDIRECT_AFTER_VERIFY_MS);
        return () => {
            clearInterval(tick);
            clearTimeout(redirect);
        };
    }, [isVerify, navigate, target]);

    return (
        <AuthLayout
            eyebrow={isVerify ? t('action.success.eyebrowVerify') : t('action.success.eyebrowGeneric')}
            title={isVerify ? t('action.success.titleVerify') : t('action.success.titleGeneric')}
            subtitle={isVerify ? t('action.success.subtitleVerify') : undefined}
        >
            <div className="space-y-6">
                <div className="rounded-2xl border border-success/30 bg-success-subtle p-6 text-center">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-success/15 mb-3">
                        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
                    </div>
                    <p className="text-sm text-success-subtle-foreground max-w-[280px] mx-auto leading-relaxed">
                        {isVerify ? t('action.success.bodyVerify') : t('action.success.bodyGeneric')}
                    </p>
                </div>

                {isVerify && countdown !== null && countdown > 0 && (
                    <p className="text-center text-[12px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                        {t('action.success.redirecting', { n: countdown })}
                    </p>
                )}

                <Button
                    onClick={() => navigate(target, { replace: true })}
                    className="w-full h-11 bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover font-medium"
                >
                    {user ? t('action.success.ctaDashboard') : t('action.success.ctaLogin')}
                    <ArrowRight className="h-4 w-4 ml-2" aria-hidden />
                </Button>
            </div>
        </AuthLayout>
    );
}
