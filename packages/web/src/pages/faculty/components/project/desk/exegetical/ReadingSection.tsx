import { NotebookPen, Pencil, StickyNote } from 'lucide-react';
import { formatPassageForReader, type AIProject, type DeskFraming, type DeskPhase } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { DeskSection, EmptyState, TOUCH, WRAP_LABEL, deskSectionId, useDeskText } from '../primitives';
import { framingPassageLabel } from '../../ProjectFramingForm';

interface ReadingSectionProps {
    project: Pick<AIProject, 'id' | 'framing' | 'bibliographyCriteria'>;
    framing: DeskFraming;
    phase: DeskPhase | undefined;
    /** Abre el diálogo del encuadre tal como está guardado. */
    onEdit: () => void;
    /** Abre el diálogo con la nota de antes precargada (el pastor confirma). */
    onPassNote: () => void;
    /** El texto de la nota de antes, si hay. */
    note: { text: string | null; loading: boolean };
}

/** Lo que se muestra de la nota de antes en el escritorio: el comienzo. */
const NOTE_PREVIEW = 220;

/**
 * Fase 1 · «Tu lectura del libro»: la idea central vigente (la revisada si
 * está vigente; si no, la original) y los movimientos en miniatura. Si hay
 * una nota de antes, ya no completa la fase: se ofrece pasarla al encuadre,
 * copiada tal cual, para que el pastor la corrija y confirme.
 */
export function ReadingSection({ project, framing, phase, onEdit, onPassNote, note }: ReadingSectionProps) {
    const { t, i18n } = useTranslation('projectDeskExegetical');
    const { t: tp } = useTranslation('projects');
    const deskText = useDeskText();
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const vacia = framing.status === 'missing';
    const pasaje = framingPassageLabel(project, lang);
    const nota = note.text && note.text.length > NOTE_PREVIEW ? `${note.text.slice(0, NOTE_PREVIEW).trimEnd()}…` : note.text;

    const notaVieja = framing.oldNote && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-start" data-testid="desk-old-note">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{t('reading.oldNote.title')}</p>
                <p className="text-[13px] leading-relaxed text-foreground">{t('reading.oldNote.body')}</p>
                {note.loading
                    ? <p className="text-xs text-muted-foreground" role="status">{t('reading.oldNote.loading')}</p>
                    : nota
                        ? <blockquote className="whitespace-pre-line border-l-2 border-border pl-3 text-[13px] italic text-foreground/90">{nota}</blockquote>
                        : <p className="text-xs text-muted-foreground">{t('reading.oldNote.missing')}</p>}
            </div>
            <Button size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL)} onClick={onPassNote} disabled={note.loading || !note.text}>
                <NotebookPen className="h-3.5 w-3.5" aria-hidden />
                {t('reading.oldNote.action')}
            </Button>
        </div>
    );

    return (
        <DeskSection
            id={deskSectionId('passage')}
            phase={1}
            title={t('reading.title')}
            status={phase?.status}
            loading={phase?.loading}
            evidence={phase ? deskText(phase.evidence) : undefined}
            description={t('reading.description')}
            data-testid="desk-section-passage"
            actions={!vacia && (
                <Button size="sm" variant="outline" className={TOUCH} onClick={onEdit} aria-label={t('reading.editLabel')}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {t('reading.edit')}
                </Button>
            )}
            isEmpty={false}
        >
            {vacia ? (
                <div className="space-y-3">
                    {notaVieja}
                    <EmptyState
                        title={t('reading.emptyTitle')}
                        action={(
                            <Button size="sm" variant="outline" className={TOUCH} onClick={onEdit}>
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                {t('reading.write')}
                            </Button>
                        )}
                    >
                        {t('reading.empty')}
                    </EmptyState>
                </div>
            ) : (
                <div className="space-y-4">
                    {notaVieja}
                    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
                        {pasaje && (
                            <>
                                <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t('reading.passage')}</dt>
                                <dd className="text-foreground">{pasaje}</dd>
                            </>
                        )}
                        <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{t('reading.purpose')}</dt>
                        <dd className="text-foreground">{tp(`framing.purpose.${framing.purpose}`)}</dd>
                    </dl>

                    <div className="space-y-1.5" data-testid="desk-idea">
                        <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                            {t('reading.idea')}
                            {framing.ideaSource && (
                                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-foreground">
                                    {t(framing.ideaSource === 'revised' ? 'reading.ideaRevised' : 'reading.ideaOriginal')}
                                </span>
                            )}
                        </p>
                        {framing.idea
                            ? <p className="whitespace-pre-line font-reading text-[17px] leading-relaxed text-foreground">{framing.idea}</p>
                            : <p className="text-[13px] text-muted-foreground">{t('reading.noIdea')}</p>}
                    </div>

                    {framing.movements.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">{t('reading.movements', { count: framing.movements.length })}</p>
                            <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2" data-testid="desk-movements">
                                {framing.movements.map((m, i) => (
                                    <li key={i} className="flex min-w-0 gap-2 text-[13px]">
                                        <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground" aria-hidden>{i + 1}</span>
                                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatPassageForReader(m.passage, lang)}</span>
                                        <span className="min-w-0 text-foreground">{m.title || t('reading.untitledMovement')}</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            )}
        </DeskSection>
    );
}
