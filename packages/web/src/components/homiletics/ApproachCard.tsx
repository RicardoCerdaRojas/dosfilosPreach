/**
 * Una opción de enfoque homilético, como radio dentro de la grilla de
 * `ApproachSelectionView`.
 *
 * Rediseño de #31 (ejercicio de Jonás 4:5-11): las tarjetas iban apiladas en
 * una columna angosta y no se podían comparar. Ahora caben dos por fila; el
 * recorrido va como pasos numerados y «Por qué funciona» se abre a pedido.
 */

import type { HomileticalApproachPreview } from '@dosfilos/domain';
import { CheckCircle2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { approachRoute } from './approachRoute';

interface ApproachCardProps {
    approach: Pick<
        HomileticalApproachPreview,
        'type' | 'tone' | 'direction' | 'purpose' | 'targetAudience' | 'suggestedStructure' | 'rationale'
    >;
    isSelected: boolean;
    onSelect: () => void;
}

export function ApproachCard({ approach, isSelected, onSelect }: ApproachCardProps) {
    const { t } = useTranslation('generator');
    const route = approachRoute(approach.suggestedStructure);

    return (
        <div
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
            className={cn(
                'h-full rounded-xl border bg-card p-5 text-left transition-colors cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected ? 'border-primary ring-2 ring-primary/40 bg-primary/5' : 'hover:border-primary/40',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10 capitalize">{approach.type}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{approach.tone}</Badge>
                </div>
                <CheckCircle2
                    className={cn('h-5 w-5 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground/30')}
                    aria-hidden
                />
            </div>

            <h3 className="mt-3 text-base font-semibold leading-snug">{approach.direction}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{approach.purpose}</p>

            <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                <span>
                    <span className="font-medium text-foreground">{t('homiletics.selection.audience')}:</span>{' '}
                    {approach.targetAudience}
                </span>
            </p>

            {route.length > 0 && (
                <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('homiletics.selection.route')}
                    </p>
                    <ol className="mt-2 space-y-1.5">
                        {route.map((paso, i) => (
                            <li key={i} className="flex gap-2 text-sm">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                                    {i + 1}
                                </span>
                                <span className="leading-snug">{paso}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {approach.rationale && (
                <details className="mt-4 border-t pt-3 group" onClick={e => e.stopPropagation()}>
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                        {t('homiletics.selection.why')}
                    </summary>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{approach.rationale}</p>
                </details>
            )}
        </div>
    );
}
