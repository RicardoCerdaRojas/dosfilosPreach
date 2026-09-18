import { useState } from 'react';
import { AlertTriangle, BookMarked, CheckCircle2, Pencil } from 'lucide-react';
import { formatBibliographyEntry, type ExegeticalPaper } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { usePaperBibliography, type PaperBibliographyRow } from '@/hooks/exegesis/usePaperBibliography';
import { BibliographyEditDialog } from './BibliographyEditDialog';

/**
 * Qué libro se puede citar con sus datos y cuál todavía no.
 *
 * El compositor solo tenía la clave de cita y el nombre del archivo, así
 * que ciudad, editorial y año los ponía el modelo: en el trabajo de Salmo
 * 23 llegaron inventados a la bibliografía y hubo que corregirlos contra
 * los ejemplares. Aquí se ve lo que falta ANTES de componer, y lo que se
 * escribe queda sobre el libro, no sobre el trabajo.
 */
export function PaperBibliographyCard({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const rows = usePaperBibliography(paper);
    const [editing, setEditing] = useState<PaperBibliographyRow | null>(null);

    if (rows.length === 0) return null;
    const incomplete = rows.filter(r => r.missing.length > 0).length;

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">{t('detail.bibliography.title')}</h3>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                    {rows.length - incomplete}/{rows.length}
                </span>
            </header>

            <p className="text-[11px] text-muted-foreground">
                {incomplete === 0
                    ? t('detail.bibliography.allComplete')
                    : t('detail.bibliography.someMissing', { count: incomplete })}
            </p>

            <ul className="space-y-2">
                {rows.map(row => (
                    <li key={row.sourceId} className="space-y-0.5">
                        <button
                            type="button"
                            onClick={() => setEditing(row)}
                            className="group flex w-full items-start gap-2 text-left"
                        >
                            {row.missing.length === 0
                                ? <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />}
                            <span className="flex-1 min-w-0">
                                <span className="block text-xs font-medium text-foreground truncate">{row.citationKey}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                    {row.missing.length === 0
                                        ? formatBibliographyEntry(row.data ?? {})
                                        : t('detail.bibliography.missingFields', {
                                            fields: row.missing.map(f => t(`detail.bibliography.fields.${f}`).toLocaleLowerCase()).join(', '),
                                        })}
                                </span>
                            </span>
                            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-0.5 shrink-0" />
                        </button>
                    </li>
                ))}
            </ul>

            {editing && (
                <BibliographyEditDialog
                    open={!!editing}
                    onOpenChange={open => { if (!open) setEditing(null); }}
                    resourceId={editing.resourceId}
                    displayLabel={editing.displayLabel}
                    data={editing.data}
                />
            )}
        </section>
    );
}
