import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FRAMING_TEXT_MAX, HYPOTHESIS_VERDICTS, type HypothesisVerdict } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

/**
 * Anotar en el registro de la lectura lo que este estudio hace con ella
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, U7). Vive aparte del panel para
 * que el panel siga siendo solo lectura del proyecto.
 *
 * No va a ningún prompt: escribe `hypothesisEntry` y nada más. La idea se
 * revisa en el proyecto, por eso el enlace «Ir al proyecto».
 */
export function ReadingAnnotateForm({ paperId, projectId }: { paperId: string; projectId: string }) {
    const { t } = useTranslation('exegesis');
    const { updateProject } = useFacultyProjects();
    const baseId = useId();
    const [verdict, setVerdict] = useState<HypothesisVerdict | ''>('');
    const [note, setNote] = useState('');

    const save = async () => {
        if (!verdict) return;
        try {
            // El caso de uso lee el registro GUARDADO y agrega: no se manda el
            // registro entero desde aquí, que podría venir de una caché vieja.
            await updateProject.mutateAsync({
                projectId,
                hypothesisEntry: { source: 'study', studyId: paperId, verdict, note: note.trim() },
            });
            setVerdict('');
            setNote('');
            toast.success(t('readingPanel.toast.saved'));
        } catch (err) {
            console.error('[exegesis] reading panel annotate failed:', err);
            toast.error(t('readingPanel.toast.failed'));
        }
    };

    return (
        <form
            className="space-y-3 rounded-xl border border-border bg-muted/40 p-4"
            onSubmit={e => {
                e.preventDefault();
                void save();
            }}
        >
            <h3 className="text-sm font-semibold">{t('readingPanel.form.title')}</h3>
            <fieldset>
                <legend className="text-xs text-muted-foreground">{t('readingPanel.form.verdictLabel')}</legend>
                <RadioGroup
                    value={verdict}
                    onValueChange={v => setVerdict(v as HypothesisVerdict)}
                    className="mt-2 flex flex-wrap gap-x-5 gap-y-2"
                >
                    {HYPOTHESIS_VERDICTS.map(v => (
                        <div key={v} className="flex min-h-11 items-center gap-2 sm:min-h-0">
                            <RadioGroupItem value={v} id={`${baseId}-${v}`} />
                            <Label htmlFor={`${baseId}-${v}`} className="font-normal">
                                {t(`readingPanel.verdict.${v}`)}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </fieldset>
            <div className="space-y-1.5">
                <Label htmlFor={`${baseId}-note`}>{t('readingPanel.form.noteLabel')}</Label>
                <Textarea
                    id={`${baseId}-note`}
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={t('readingPanel.form.notePlaceholder')}
                    maxLength={FRAMING_TEXT_MAX}
                    rows={3}
                />
            </div>
            <p className="text-xs text-muted-foreground">
                {t('readingPanel.form.private')}{' '}
                <Link
                    to={`/dashboard/projects/${encodeURIComponent(projectId)}`}
                    className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-0"
                >
                    {t('readingPanel.form.goToProject')}
                </Link>
            </p>
            <Button type="submit" size="sm" className="min-h-11 sm:min-h-0" disabled={!verdict || updateProject.isPending}>
                {updateProject.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {t(updateProject.isPending ? 'readingPanel.form.saving' : 'readingPanel.form.save')}
            </Button>
        </form>
    );
}
