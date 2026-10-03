/**
 * «¿Cómo elegir?» del paso 2a. Era el panel derecho fijo de la página y
 * ocupaba el espacio de las tarjetas (#31); ahora se abre a pedido dentro de
 * `ApproachSelectionView`.
 */

import { Target, Users, BookOpen } from 'lucide-react';
import { useTranslation } from '@/i18n';

export function ApproachSelectionHelp() {
    const { t } = useTranslation('generator');

    return (
        <div className="mt-3 grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-3">
            {[
                { Icon: Target, title: 'homiletics.typesTitle', body: 'homiletics.typesDesc' },
                { Icon: Users, title: 'homiletics.audienceTitle', body: 'homiletics.audienceDesc' },
                { Icon: BookOpen, title: 'homiletics.developmentTitle', body: 'homiletics.developmentDesc' },
            ].map(({ Icon, title, body }) => (
                <div key={title} className="flex gap-3">
                    <Icon className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden />
                    <div>
                        <h4 className="text-sm font-medium">{t(title)}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">{t(body)}</p>
                    </div>
                </div>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-3">
                <span className="font-medium text-primary">{t('homiletics.tip')}</span> {t('homiletics.tipText')}
            </p>
        </div>
    );
}
