import { AlertTriangle } from 'lucide-react';
import type { UnreadableOriginalClaim } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Formas en lengua original atribuidas a un libro cuyo texto leído no tiene
 * ninguna. Sale de la página de revisión tal cual, para que la página no
 * pase de tamaño al sumar la prosa (TP #9, B41).
 */
export function UnreadableOriginalNotice({ claims, onSelect }: {
    claims: ReadonlyArray<UnreadableOriginalClaim>;
    onSelect: (path: string) => void;
}) {
    const { t } = useTranslation('exegesis');
    if (claims.length === 0) return null;
    return (
        <section className="rounded-xl border border-warning/40 bg-warning-subtle/40 px-4 py-3 space-y-1.5">
            <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-subtle-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('canonical.review.unreadableOriginal.title', { count: claims.length })}
            </h2>
            <p className="text-[11px] text-warning-subtle-foreground">
                {t('canonical.review.unreadableOriginal.body')}
            </p>
            <ul className="space-y-0.5">
                {claims.map(c => (
                    <li key={c.path}>
                        <button
                            type="button"
                            onClick={() => onSelect(c.path)}
                            className="text-[11px] text-warning-subtle-foreground underline-offset-2 hover:underline"
                        >
                            {t('canonical.review.unreadableOriginal.item', { form: c.form, source: c.sourceKey })}
                        </button>
                    </li>
                ))}
            </ul>
            {/* Qué hacer depende de POR QUÉ falta, y son dos cosas
                distintas: un libro que translitera no se
                re-extrae. Se agrupan las razones presentes para no
                repetir el mismo párrafo por cada afirmación. */}
            {[...new Set(claims.map(c => c.absence))].map(razon => (
                <p key={razon} className="text-[11px] text-muted-foreground">
                    {t(`canonical.review.unreadableOriginal.${razon}`)}
                </p>
            ))}
        </section>
    );
}
