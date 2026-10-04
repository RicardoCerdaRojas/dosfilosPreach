import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/i18n';

import { LegalText, countOf } from './LegalText';

/** DRAFT — pending review by legal counsel before production launch. */
export function PrivacyPolicyPage() {
    const { t, i18n } = useTranslation('legal');
    const has = (key: string) => i18n.exists(key, { ns: 'legal' });

    return (
        <div className="max-w-3xl mx-auto px-6 py-12">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-4 w-4" />
                {t('back')}
            </Link>

            <div className="mb-6 rounded-md border border-warning/30 bg-warning/10 p-4 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm text-foreground">
                    <strong>{t('privacy.draft')}</strong>
                </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight mb-2">{t('privacy.title')}</h1>
            <p className="text-sm text-muted-foreground mb-8">{t('privacy.updated')}</p>

            <div className="prose prose-slate dark:prose-invert max-w-none">
                {Array.from({ length: countOf(t, 'privacy.sections') }, (_, i) => {
                    const base = `privacy.sections.${i}`;
                    return (
                        <section key={i}>
                            <h2>{t(`${base}.title`)}</h2>
                            {has(`${base}.intro`) ? (
                                <p>
                                    <LegalText t={t} k={`${base}.intro`} />
                                </p>
                            ) : null}
                            {countOf(t, `${base}.items`) > 0 ? (
                                <ul>
                                    {Array.from({ length: countOf(t, `${base}.items`) }, (_, j) => (
                                        <li key={j}>
                                            <LegalText t={t} k={`${base}.items.${j}`} />
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {has(`${base}.outro`) ? (
                                <p>
                                    <LegalText t={t} k={`${base}.outro`} />
                                </p>
                            ) : null}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
