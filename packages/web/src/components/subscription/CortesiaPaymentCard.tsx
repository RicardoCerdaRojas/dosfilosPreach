import { CreditCard, Gift } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface CortesiaPaymentCardProps {
    planName: string;
    /** Abre el checkout de Stripe con el precio mensual del plan actual. */
    onActivatePayment: () => void;
    loading: boolean;
}

/**
 * La cuenta tiene un plan de cortesía: lo asignó el equipo, sin suscripción en
 * Stripe. No hay nada que cancelar ni que cambiar por Stripe; para pagarlo con
 * tarjeta se pasa por el checkout, que cobra desde hoy (sin prueba).
 */
export function CortesiaPaymentCard({ planName, onActivatePayment, loading }: CortesiaPaymentCardProps) {
    const { t } = useTranslation('subscription');
    return (
        <Card className="mb-8 border-info/30 bg-info-subtle/40">
            <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg text-info-subtle-foreground">
                            <Gift className="h-5 w-5 shrink-0" aria-hidden="true" />
                            {t('cortesia.title', { plan: planName })}
                        </CardTitle>
                        <CardDescription className="mt-2">{t('cortesia.body')}</CardDescription>
                    </div>
                    <Button onClick={onActivatePayment} disabled={loading} className="shrink-0">
                        <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                        {t('cortesia.activateButton')}
                    </Button>
                </div>
            </CardHeader>
        </Card>
    );
}
