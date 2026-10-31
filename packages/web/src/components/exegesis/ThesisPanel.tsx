import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Pencil, Target } from 'lucide-react';
import { toast } from 'sonner';
import { exegesisService } from '@dosfilos/application';
import { approvedThesisOf, type ExegeticalPaper } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';

/** Los criterios del curso para una tesis (bitácora del TI #2, §2). */
const CRITERIOS = ['interpretive', 'covers', 'supported', 'distinguishes', 'connects', 'answers'] as const;

/**
 * La tesis del trabajo (fase «Lecciones del TI #2», etapa 3.2; B63).
 *
 * Va entre la conclusión y la introducción, que es su lugar en el orden del
 * trabajo: se formula DESPUÉS de aceptar los análisis —el método va de la
 * observación a la síntesis— y la introducción termina con ella. La escribe
 * el estudiante y la aprueba; aprobada, la conclusión la retoma y la
 * introducción la enuncia, en vez de adivinarla.
 */
export function ThesisPanel({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const guardada = paper.thesis?.text ?? '';
    const aprobada = approvedThesisOf(paper);
    const [editando, setEditando] = useState(!aprobada);
    const [texto, setTexto] = useState(guardada);
    // Solo cuando cambia lo guardado: no pisar lo que se está escribiendo.
    useEffect(() => {
        setTexto(guardada);
        setEditando(!aprobada);
    }, [guardada, aprobada]);

    const versos = paper.steps.filter(s => s.kind === 'verse');
    const aceptados = versos.filter(s => s.accepted?.canonicalAnalysis).length;
    const pendientes = versos.length - aceptados;
    const seccionesYaAceptadas = paper.steps.some(s => (s.kind === 'conclusion' || s.kind === 'introduction') && s.accepted?.markdown?.trim());

    const guardar = useMutation({
        mutationFn: async ({ text, approve }: { text: string; approve: boolean }) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.setPaperThesis.execute({ ownerId: user.uid, paperId: paper.id, text, approve });
        },
        onSuccess: (_r, { approve }) => {
            if (approve) setEditando(false);
            toast.success(t(approve ? 'thesis.approvedToast' : 'thesis.savedToast'));
            return queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
        onError: err => {
            console.error('[exegesis] save thesis failed:', err);
            toast.error(t('thesis.saveFailed'));
        },
    });

    return (
        <section aria-labelledby={`thesis-${paper.id}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 mt-0.5 text-primary" aria-hidden="true" />
                    <div>
                        <h3 id={`thesis-${paper.id}`} className="text-sm font-semibold text-foreground">{t('thesis.title')}</h3>
                        <p className="text-xs text-muted-foreground">{t('thesis.subtitle')}</p>
                    </div>
                </div>
                {aprobada && !editando && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-subtle-foreground">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />{t('thesis.approvedBadge')}
                    </span>
                )}
            </header>

            {pendientes > 0 && (
                <p className="rounded-md bg-info-subtle px-3 py-2 text-xs text-info-subtle-foreground">
                    {t('thesis.pendingVerses', { count: pendientes })}
                </p>
            )}

            {aprobada && !editando ? (
                <div className="space-y-2">
                    <blockquote className="border-l-2 border-primary pl-3 text-sm leading-relaxed text-foreground">{aprobada}</blockquote>
                    {seccionesYaAceptadas && (
                        <p className="text-xs text-muted-foreground">{t('thesis.regenerateNote')}</p>
                    )}
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditando(true)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />{t('thesis.edit')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    <label htmlFor={`thesis-text-${paper.id}`} className="sr-only">{t('thesis.title')}</label>
                    <textarea
                        id={`thesis-text-${paper.id}`}
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        rows={3}
                        maxLength={800}
                        placeholder={t('thesis.placeholder')}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    />
                    <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">{t('thesis.criteriaTitle')}</summary>
                        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
                            {CRITERIOS.map(c => <li key={c}>{t(`thesis.criteria.${c}`)}</li>)}
                        </ol>
                    </details>
                    <div className="flex flex-wrap justify-end gap-2">
                        {aprobada && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setTexto(guardada); setEditando(false); }}>
                                {t('thesis.cancel')}
                            </Button>
                        )}
                        <Button
                            type="button" size="sm" variant="outline"
                            disabled={guardar.isPending || texto.trim() === guardada.trim()}
                            onClick={() => guardar.mutate({ text: texto, approve: false })}
                        >
                            {t('thesis.saveDraft')}
                        </Button>
                        <Button
                            type="button" size="sm"
                            disabled={guardar.isPending || !texto.trim()}
                            onClick={() => guardar.mutate({ text: texto, approve: true })}
                        >
                            {guardar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />}
                            {t('thesis.approve')}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
