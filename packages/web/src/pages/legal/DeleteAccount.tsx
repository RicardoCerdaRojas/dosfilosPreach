import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n';

import { LegalText, countOf } from './LegalText';

/**
 * Cómo borrar la cuenta (B2 de la fase Púlpito premium).
 *
 * Google Play pide, en el formulario de seguridad de datos, una dirección
 * pública donde se explique cómo pedir el borrado de la cuenta y de los datos,
 * aunque no se tenga la app instalada. Esta es esa página. El plazo de gracia
 * es el de `ACCOUNT_DELETION_GRACE_DAYS` en el servidor (lo vigila una prueba
 * de mobile contra `legal.json`).
 */
export function DeleteAccountPage() {
    const { t } = useTranslation('legal');
    const list = (key: string) => (
        <ul>
            {Array.from({ length: countOf(t, key) }, (_, i) => (
                <li key={i}>
                    <LegalText t={t} k={`${key}.${i}`} />
                </li>
            ))}
        </ul>
    );

    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-4 w-4" />
                {t('back')}
            </Link>

            <h1 className="text-3xl font-bold tracking-tight mb-2">{t('deleteAccount.title')}</h1>
            <p className="text-sm text-muted-foreground mb-8">{t('deleteAccount.lead')}</p>

            <div className="prose prose-slate dark:prose-invert max-w-none">
                <h2>{t('deleteAccount.howTitle')}</h2>
                {list('deleteAccount.how')}

                <h2>{t('deleteAccount.afterTitle')}</h2>
                {list('deleteAccount.after')}
            </div>
        </div>
    );
}
