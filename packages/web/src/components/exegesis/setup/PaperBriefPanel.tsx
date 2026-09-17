import { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ASSIGNMENT_BRIEF_MAX_CHARS, type ExegeticalPaper } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { AssignmentBriefPicker } from './AssignmentBriefPicker';
import { evaluarEdicionDelEncuadre } from './edicionDelEncuadre';

/**
 * El encuadre del trabajo, a la vista desde cualquier pestaña de la
 * configuración, y editable.
 *
 * Antes solo existía en la página de creación: después de crear el trabajo no
 * había dónde leerlo ni corregirlo, aunque el asistente lo usa en cada paso
 * (el caso de uso `updatePaperBrief` existía desde #76 sin ninguna pantalla
 * que lo llamara). Vive fuera de las pestañas para que un borrador a medio
 * escribir sobreviva al cambio de pestaña.
 */
interface PaperBriefPanelProps {
    paper: ExegeticalPaper;
}

export function PaperBriefPanel({ paper }: PaperBriefPanelProps) {
    const { t } = useTranslation('exegesis');
    const { updatePaperBrief } = useExegesisPapers();
    const [expandido, setExpandido] = useState(false);
    const [borrador, setBorrador] = useState<string | null>(null);

    const editando = borrador !== null;
    const actual = paper.assignmentBrief?.trim() ?? '';
    const edicion = editando ? evaluarEdicionDelEncuadre(paper.assignmentBrief, borrador) : null;
    const guardando = updatePaperBrief.isPending;

    const guardar = async () => {
        if (edicion?.tipo !== 'listo') return;
        try {
            await updatePaperBrief.mutateAsync({ paperId: paper.id, assignmentBrief: edicion.valor });
            toast.success(t('paperSetup.brief.saved'));
            setBorrador(null);
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el encuadre:', err);
            toast.error(t('paperSetup.brief.saveFailed'));
        }
    };

    return (
        <section className="rounded-2xl border border-border bg-card p-4 mb-6 space-y-3">
            <header className="flex items-start gap-3">
                <Lightbulb className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{t('paperSetup.brief.heading')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('paperSetup.brief.description')}</p>
                </div>
                {!editando && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setBorrador(paper.assignmentBrief ?? '')}
                        className="shrink-0 gap-1.5 text-xs"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('paperSetup.brief.edit')}
                    </Button>
                )}
            </header>

            {!editando && (actual ? (
                <div className="space-y-1">
                    <p className={cn(
                        'whitespace-pre-wrap text-sm leading-relaxed text-foreground',
                        !expandido && 'line-clamp-3',
                    )}>
                        {actual}
                    </p>
                    <button
                        type="button"
                        onClick={() => setExpandido(v => !v)}
                        aria-expanded={expandido}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                        {expandido ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {expandido ? t('paperSetup.brief.collapse') : t('paperSetup.brief.expand')}
                    </button>
                </div>
            ) : (
                <p className="text-sm italic text-muted-foreground">{t('paperSetup.brief.empty')}</p>
            ))}

            {editando && (
                <div className="space-y-2">
                    <AssignmentBriefPicker currentBody={borrador} onApply={setBorrador} />
                    <label htmlFor="paper-brief-editor" className="sr-only">{t('paperSetup.brief.heading')}</label>
                    <textarea
                        id="paper-brief-editor"
                        value={borrador}
                        onChange={e => setBorrador(e.target.value)}
                        rows={12}
                        disabled={guardando}
                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className={edicion?.tipo === 'excedido' ? 'text-destructive' : 'text-muted-foreground'}>
                            {edicion?.tipo === 'excedido'
                                ? t('paperSetup.brief.tooLong', { count: edicion.sobran })
                                : t('create.brief.characterCount', { count: borrador.trim().length, max: ASSIGNMENT_BRIEF_MAX_CHARS })}
                        </span>
                        {paper.steps.length > 0 && (
                            <span className="text-muted-foreground">{t('paperSetup.brief.appliesFromNow')}</span>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setBorrador(null)} disabled={guardando}>
                            {t('paperSetup.brief.cancel')}
                        </Button>
                        <Button type="button" size="sm" onClick={guardar} disabled={edicion?.tipo !== 'listo' || guardando}>
                            {guardando && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {t('paperSetup.brief.save')}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
