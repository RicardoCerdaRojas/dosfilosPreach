import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import { mapAuthErrorCodeToKey } from './authErrorMessages';

interface ActionResetFormProps {
    email: string;
    onConfirm: (newPassword: string) => Promise<void>;
}

export function ActionResetForm({ email, onConfirm }: ActionResetFormProps) {
    const { t } = useTranslation('auth');
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const schema = z
        .object({
            password: z.string().min(6, t('action.errors.passwordMin')),
            confirm: z.string(),
        })
        .refine((d) => d.password === d.confirm, {
            path: ['confirm'],
            message: t('action.errors.passwordMismatch'),
        });

    type FormData = z.infer<typeof schema>;

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormData>({ resolver: zodResolver(schema) });

    const onSubmit = async (data: FormData) => {
        setSubmitting(true);
        try {
            await onConfirm(data.password);
            toast.success(t('action.reset.successToast'));
            navigate('/login', { replace: true });
        } catch (err: unknown) {
            console.error('[ActionResetForm] reset failed:', err);
            const code = (err as { code?: string })?.code ?? null;
            toast.error(t(mapAuthErrorCodeToKey(code)));
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            eyebrow={t('action.reset.eyebrow')}
            title={t('action.reset.title')}
            subtitle={t('action.reset.subtitle', { email })}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="rounded-xl border border-border bg-muted/60 p-4 flex gap-3">
                    <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-[2px]" aria-hidden />
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                        {t('action.reset.hint')}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
                        {t('action.reset.password')}
                    </Label>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t('action.reset.passwordPlaceholder')}
                        {...register('password')}
                        disabled={submitting}
                        className="h-11 border-border focus-visible:ring-ring"
                    />
                    {errors.password && (
                        <p className="text-xs text-destructive">{errors.password.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirm" className="text-[13px] font-medium text-foreground">
                        {t('action.reset.confirm')}
                    </Label>
                    <Input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t('action.reset.confirmPlaceholder')}
                        {...register('confirm')}
                        disabled={submitting}
                        className="h-11 border-border focus-visible:ring-ring"
                    />
                    {errors.confirm && (
                        <p className="text-xs text-destructive">{errors.confirm.message}</p>
                    )}
                </div>

                <Button
                    type="submit"
                    className="w-full h-11 bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover font-medium"
                    disabled={submitting}
                >
                    {submitting ? t('action.reset.submitting') : t('action.reset.submit')}
                </Button>

                <Link to="/login" className="block">
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full h-10 text-muted-foreground hover:text-foreground"
                    >
                        {t('action.reset.cancel')}
                    </Button>
                </Link>
            </form>
        </AuthLayout>
    );
}
