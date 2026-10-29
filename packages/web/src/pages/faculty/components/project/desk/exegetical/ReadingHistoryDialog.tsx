import type { FramingRevision, HypothesisEntry } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { HypothesisLogList, type FramingStudy } from '../../ProjectFramingLogDialog';
import { TOUCH } from '../primitives';

interface ReadingHistoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** La idea que escribió primero (la del encuadre). */
    originalIdea: string | null;
    /** El registro completo, en el orden guardado (el más viejo primero). */
    log: ReadonlyArray<HypothesisEntry>;
    /** La revisión guardada, vigente o no. */
    revision: FramingRevision | null;
    /** La revisión quedó vieja: la idea original cambió después. */
    stale: boolean;
    studies: ReadonlyArray<FramingStudy>;
}

/**
 * «Ver cómo cambió tu lectura»: la idea original → lo que anotó de cada
 * estudio → la idea revisada, con su veredicto y su porqué. Solo entradas del
 * pastor: nada que haya escrito el asistente.
 */
export function ReadingHistoryDialog({ open, onOpenChange, originalIdea, log, revision, stale, studies }: ReadingHistoryDialogProps) {
    const { t, i18n } = useTranslation('projectDeskExegetical');
    const { t: tp } = useTranslation('projects');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
    const paso = 'space-y-1.5 border-l-2 border-border pl-4';
    const titulo = 'text-sm font-semibold text-foreground';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[92dvh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{t('history.title')}</DialogTitle>
                    <DialogDescription>{t('history.description')}</DialogDescription>
                </DialogHeader>
                <ol className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1" data-testid="reading-history">
                    <li className={paso}>
                        <h3 className={titulo}>{t('history.original')}</h3>
                        {originalIdea
                            ? <p className="whitespace-pre-line font-reading text-[15px] leading-relaxed text-foreground" data-testid="history-original">{originalIdea}</p>
                            : <p className="text-[13px] text-muted-foreground">{t('history.noOriginal')}</p>}
                    </li>
                    <li className={paso}>
                        <h3 className={titulo}>{t('history.log', { count: log.length })}</h3>
                        {log.length > 0
                            // La lista pone lo más nuevo arriba; aquí se lee en orden, como pasó.
                            ? <HypothesisLogList entries={[...log].reverse()} studies={studies} />
                            : <p className="text-[13px] text-muted-foreground">{t('history.noLog')}</p>}
                    </li>
                    <li className={paso}>
                        <h3 className={titulo}>{t('history.revised')}</h3>
                        {revision ? (
                            <div className="space-y-1.5" data-testid="history-revised">
                                <p className="text-xs text-muted-foreground">
                                    {tp(`framing.revisionVerdict.${revision.verdict}`)} · {new Date(revision.revisedAt).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                                <p className="whitespace-pre-line font-reading text-[15px] leading-relaxed text-foreground">{revision.centralIdea}</p>
                                {revision.why && (
                                    <p className="text-[13px] text-foreground"><span className="font-medium">{t('history.why')}</span> {revision.why}</p>
                                )}
                                {stale && <p className="text-[13px] text-foreground" role="status">{t('history.stale')}</p>}
                            </div>
                        ) : (
                            <p className="text-[13px] text-muted-foreground">{t('history.noRevision')}</p>
                        )}
                    </li>
                </ol>
                <DialogFooter>
                    <Button variant="outline" className={TOUCH} onClick={() => onOpenChange(false)}>{t('history.close')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
