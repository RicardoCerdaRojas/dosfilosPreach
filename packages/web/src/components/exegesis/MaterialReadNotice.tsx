import { BookOpenCheck } from 'lucide-react';
import type { SourceMaterialRead } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Lo que leyó el análisis: por fuente, las hojas que llegaron al prompt tras
 * la selección y el reparto («Del corpus al texto», PR 1). Cerrado por
 * defecto: es para cuando el análisis calla algo y hay que saber si la hoja
 * llegó. Informa; no cambia nada.
 */
export function MaterialReadNotice({ materialRead }: { materialRead: ReadonlyArray<SourceMaterialRead> | null | undefined }) {
    const { t } = useTranslation('exegesis');
    if (!materialRead || materialRead.length === 0) return null;
    return (
        <details className="mb-3 rounded-lg border border-border bg-card px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
                <span className="inline-flex items-center gap-1.5 align-middle"><BookOpenCheck className="h-3.5 w-3.5 text-muted-foreground" />{t('materialRead.title')}</span>
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">{t('materialRead.hint')}</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
                {materialRead.map((m, i) => (
                    <li key={`${m.sourceKey ?? m.label}-${i}`}>
                        <span className="font-medium">{m.sourceKey ?? m.label}</span>
                        {': '}
                        <span>{m.read ?? t('materialRead.noAnchors')}</span>
                        {m.pinnedCut
                            ? <span className="ml-1.5 text-warning-subtle-foreground">({t('materialRead.pinnedCut')})</span>
                            : m.truncated && <span className="ml-1.5 text-muted-foreground">({t('materialRead.truncated')})</span>}
                    </li>
                ))}
            </ul>
        </details>
    );
}
