import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FRAMING_TEXT_MAX, REVISION_VERDICTS, isRevisionStale, type FramingRevision, type ProjectFraming, type RevisionVerdict } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { HypothesisLogList, VerdictPicker, type FramingStudy } from './ProjectFramingLogDialog';

const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export type ConsolidateInput = Pick<FramingRevision, 'centralIdea' | 'verdict' | 'why'>;

interface ProjectFramingConsolidateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    framing: Pick<ProjectFraming, 'centralIdea' | 'hypothesisLog' | 'revision'> | null | undefined;
    studies: ReadonlyArray<FramingStudy>;
    /** Guarda con `consolidateIdea` (helper de dominio); lanza si falla. */
    onSave: (input: ConsolidateInput) => Promise<void>;
    saving: boolean;
}

/**
 * «Consolidar la idea» (§2 paso 10): la síntesis consolida el registro, no lo
 * inicia. Muestra la idea original y lo anotado; pide la idea revisada, un
 * veredicto y el porqué. Solo esta idea, vigente, llega al sermón.
 */
export function ProjectFramingConsolidateDialog({ open, onOpenChange, framing, studies, onSave, saving }: ProjectFramingConsolidateDialogProps) {
    const { t } = useTranslation('projects');
    const [idea, setIdea] = useState('');
    const [verdict, setVerdict] = useState<RevisionVerdict | ''>('');
    const [why, setWhy] = useState('');
    useEffect(() => {
        if (!open) return;
        // Parte de la revisión anterior si sigue vigente; si no, de la idea original.
        const rev = framing?.revision;
        const vigente = rev && !isRevisionStale(framing);
        setIdea(vigente ? rev.centralIdea : framing?.centralIdea ?? '');
        setVerdict(vigente ? rev.verdict : '');
        setWhy(vigente ? rev.why : '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const listo = !!idea.trim() && !!verdict;
    const guardar = async () => {
        if (!listo) return;
        try {
            await onSave({ centralIdea: idea.trim(), verdict, why: why.trim() });
        } catch {
            // Quien guarda avisa; el diálogo queda abierto.
        }
    };

    return (
        <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('framing.consolidate.title')}</DialogTitle>
                    <DialogDescription>{t('framing.consolidate.description')}</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                    <section className="space-y-1">
                        <h3 className="text-sm font-medium text-foreground">{t('framing.consolidate.original')}</h3>
                        {framing?.centralIdea?.trim()
                            ? <blockquote className="border-l-2 border-border pl-3 text-sm text-foreground/90" data-testid="framing-original-idea">{framing.centralIdea}</blockquote>
                            : <p className="text-xs text-muted-foreground">{t('framing.consolidate.noOriginal')}</p>}
                    </section>
                    {(framing?.hypothesisLog?.length ?? 0) > 0 && (
                        <section className="space-y-1">
                            <h3 className="text-sm font-medium text-foreground">{t('framing.consolidate.log')}</h3>
                            <HypothesisLogList entries={framing!.hypothesisLog!} studies={studies} />
                        </section>
                    )}
                    <label className="block space-y-1">
                        <span className="text-sm font-medium text-foreground">{t('framing.consolidate.revised')}</span>
                        <textarea rows={3} maxLength={FRAMING_TEXT_MAX} className={campo} value={idea} onChange={e => setIdea(e.target.value)} />
                    </label>
                    <VerdictPicker
                        name="framing-revision-verdict"
                        label={t('framing.consolidate.verdict')}
                        options={REVISION_VERDICTS}
                        value={verdict}
                        onChange={setVerdict}
                        labelOf={v => t(`framing.revisionVerdict.${v}`)}
                    />
                    <label className="block space-y-1">
                        <span className="text-sm font-medium text-foreground">{t('framing.consolidate.why')}</span>
                        <textarea rows={3} maxLength={FRAMING_TEXT_MAX} className={campo} placeholder={t('framing.consolidate.whyPlaceholder')} value={why} onChange={e => setWhy(e.target.value)} />
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('framing.dialog.cancel')}</Button>
                    <Button onClick={guardar} disabled={saving || !listo}>
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('framing.consolidate.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
