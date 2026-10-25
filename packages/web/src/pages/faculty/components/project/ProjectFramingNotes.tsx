import { ChevronRight } from 'lucide-react';
import type { PreachingNote } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Las notas «Para predicar…» de un libro (fase «Encuadre de la serie»):
 * decisiones que el texto no resuelve solo, cada una con sus fuentes. Las
 * que toca el alcance del pastor van resaltadas.
 */
export function PreachingNotesList({ notes, highlighted }: { notes: ReadonlyArray<PreachingNote>; highlighted: ReadonlySet<string> }) {
    const { t } = useTranslation('projects');
    return (
        <ul className="space-y-2">
            {notes.map(n => {
                const resaltada = highlighted.has(n.id);
                return (
                    <li
                        key={n.id}
                        data-highlighted={resaltada || undefined}
                        className={cn('rounded-md border px-2.5 py-2', resaltada ? 'border-warning/40 bg-warning-subtle' : 'border-border/60')}
                    >
                        <details className="group">
                            <summary className="flex cursor-pointer list-none items-start gap-1 rounded-sm text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
                                <ChevronRight className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                                <span>{n.title}
                                {resaltada && <span className="ml-1.5 whitespace-nowrap text-[10px] font-normal text-warning-subtle-foreground">· {t('framing.notes.highlighted')}</span>}</span>
                            </summary>
                            <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{n.body}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{t('framing.notes.sources', { list: n.sources.join('; ') })}</p>
                        </details>
                    </li>
                );
            })}
        </ul>
    );
}
