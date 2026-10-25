import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Compass, NotebookPen, Pencil, Sparkles } from 'lucide-react';
import {
    currentRevisedIdea,
    formatPassageForReader,
    framingStatus,
    getBookById,
    isRevisionStale,
    scopeFitsBooks,
    type AIProject,
    type NewHypothesisEntry,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { framingPassageLabel, highlightedNoteIds, notesForBooks, canonicalOrder } from './ProjectFramingForm';
import { HypothesisLogList, ProjectFramingLogDialog, type FramingStudy } from './ProjectFramingLogDialog';
import { ProjectFramingConsolidateDialog, type ConsolidateInput } from './ProjectFramingConsolidateDialog';
import { PreachingNotesList } from './ProjectFramingNotes';

interface ProjectFramingCardProps {
    project: Pick<AIProject, 'id' | 'framing' | 'bibliographyCriteria'>;
    /** Los estudios del proyecto, para anotar lo que dice cada uno. */
    studies: ReadonlyArray<FramingStudy>;
    onEdit: () => void;
    /** Agrega una anotación al registro guardado; lanza si falla (el diálogo queda abierto). */
    onAnnotate: (entry: NewHypothesisEntry) => Promise<void>;
    /** Consolida la idea; lanza si falla. */
    onConsolidate: (input: ConsolidateInput) => Promise<void>;
    saving: boolean;
}

/** Una fecha local `YYYY-MM-DD` para leer, sin pasar por UTC (sería el día anterior en América). */
function fechaLocal(iso: string, lang: string): string {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * La tarjeta «Encuadre» del proyecto Exegético (§2 pasos 2 y 10): el resumen
 * de la lectura del pastor, lo que falta (invita, no bloquea), el registro de
 * la hipótesis y su consolidación. Lo de aquí no entra a ningún prompt: solo
 * la idea consolidada y vigente llega al sermón.
 */
export function ProjectFramingCard({ project, studies, onEdit, onAnnotate, onConsolidate, saving }: ProjectFramingCardProps) {
    const { t, i18n } = useTranslation('projects');
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const [anotando, setAnotando] = useState(false);
    const [consolidando, setConsolidando] = useState(false);

    const f = project.framing ?? null;
    const books = useMemo(() => canonicalOrder(project.bibliographyCriteria?.bibleBooks ?? []), [project.bibliographyCriteria?.bibleBooks]);
    const { status, missing } = framingStatus(project);
    const notas = useMemo(() => notesForBooks(books), [books]);
    const alcance = f?.scope && scopeFitsBooks(f.scope, books) ? f.scope.passage : null;
    const resaltadas = highlightedNoteIds(notas, alcance);
    const registro = f?.hypothesisLog ?? [];
    const desactualizada = isRevisionStale(f);
    const vigente = currentRevisedIdea(f);
    const nombreLibros = books.map(b => (lang === 'en' ? getBookById(b)?.nameEn : getBookById(b)?.nameEs) ?? b).join(lang === 'en' ? ' and ' : ' y ');
    const pasaje = framingPassageLabel(project, lang);
    const ritmo = f?.purpose !== 'personal' && f?.rhythm
        ? [
            f.rhythm.sundays ? t('framing.card.rhythmSundays', { n: f.rhythm.sundays }) : null,
            f.rhythm.frequency ? t(`framing.frequency.${f.rhythm.frequency}`) : null,
            f.rhythm.startDate ? t('framing.card.rhythmStart', { date: fechaLocal(f.rhythm.startDate, lang) }) : null,
        ].filter(Boolean).join(' · ')
        : '';

    const fila = (etiqueta: string, valor: ReactNode) => (
        <div className="grid gap-0.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
            <dd className="text-sm text-foreground">{valor}</dd>
        </div>
    );

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby={`project-framing-title-${project.id}`} data-testid="project-framing-card">
            <header className="flex flex-wrap items-start gap-2">
                <Compass className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                    <h2 id={`project-framing-title-${project.id}`} className="text-sm font-semibold text-foreground">{t('framing.card.title')}</h2>
                    <p className="text-xs text-muted-foreground">{t('framing.card.hint')}</p>
                </div>
                <Button size="sm" variant={status === 'missing' ? 'default' : 'outline'} onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    {t(status === 'missing' ? 'framing.card.define' : 'framing.card.edit')}
                </Button>
            </header>

            {status === 'missing' ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{t('framing.card.empty')}</p>
            ) : (
                <dl className="space-y-2">
                    {pasaje && fila(t('framing.card.passage'), pasaje)}
                    {fila(t('framing.card.purpose'), t(`framing.purpose.${f?.purpose ?? 'preach'}`))}
                    {f?.centralIdea?.trim() && fila(t('framing.card.centralIdea'), <span className="whitespace-pre-line">{f.centralIdea}</span>)}
                    {(f?.structure?.length ?? 0) > 0 && fila(t('framing.card.structure'), (
                        <ol className="space-y-0.5">
                            {f!.structure!.map((m, i) => (
                                <li key={i} className="flex gap-2 text-[13px]">
                                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatPassageForReader(m.passage, lang)}</span>
                                    <span className="min-w-0">{m.title || <span className="text-muted-foreground">{t('framing.card.untitledMovement')}</span>}</span>
                                </li>
                            ))}
                        </ol>
                    ))}
                    {ritmo && fila(t('framing.card.rhythm'), ritmo)}
                </dl>
            )}

            {status !== 'missing' && missing.length > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="framing-missing">
                    {t('framing.card.missing', { fields: missing.map(m => t(`framing.field.${m}`)).join(', ') })}
                </p>
            )}

            {/* La idea consolidada: la única que llega al sermón, y solo vigente. */}
            {f?.revision && (
                desactualizada ? (
                    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2" role="status" data-testid="framing-stale">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-subtle-foreground" />
                        <p className="min-w-0 flex-1 text-xs text-warning-subtle-foreground">{t('framing.card.stale')}</p>
                        <Button size="sm" variant="outline" onClick={() => setConsolidando(true)}>{t('framing.card.consolidateAgain')}</Button>
                    </div>
                ) : vigente && (
                    <div className="rounded-lg border border-success/30 bg-success-subtle px-3 py-2 space-y-0.5" data-testid="framing-revision">
                        <p className="text-[11px] uppercase tracking-wide text-success-subtle-foreground">
                            {t('framing.card.revision')} · {t(`framing.revisionVerdict.${f.revision.verdict}`)} · {new Date(f.revision.revisedAt).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-line">{vigente}</p>
                    </div>
                )
            )}

            {registro.length > 0 && (
                <section className="space-y-1" aria-labelledby={`project-framing-log-${project.id}`}>
                    <h3 id={`project-framing-log-${project.id}`} className="text-xs font-medium text-foreground">{t('framing.card.log')}</h3>
                    <HypothesisLogList entries={registro} studies={studies} />
                </section>
            )}

            {status !== 'missing' && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {studies.length > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => setAnotando(true)}>
                            <NotebookPen className="h-3.5 w-3.5" />{t('framing.card.annotate')}
                        </Button>
                    ) : (
                        <p className="text-xs text-muted-foreground">{t('framing.card.annotateNoStudies')}</p>
                    )}
                    {registro.length > 0 && !desactualizada && (
                        <Button size="sm" variant="outline" onClick={() => setConsolidando(true)}>
                            <Sparkles className="h-3.5 w-3.5" />{t('framing.card.consolidate')}
                        </Button>
                    )}
                </div>
            )}

            {notas.length > 0 && (
                <details className="group rounded-lg border border-border/60 px-3 py-2" data-testid="framing-card-notes">
                    <summary className="cursor-pointer rounded-sm text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                        {t('framing.notes.title', { book: nombreLibros })}
                    </summary>
                    <div className="mt-2 space-y-2">
                        <p className="text-[11px] text-muted-foreground">{t('framing.notes.hint')}</p>
                        <PreachingNotesList notes={notas} highlighted={resaltadas} />
                    </div>
                </details>
            )}

            <ProjectFramingLogDialog
                open={anotando}
                onOpenChange={setAnotando}
                studies={studies}
                saving={saving}
                onSave={async entry => { await onAnnotate(entry); setAnotando(false); }}
            />
            <ProjectFramingConsolidateDialog
                open={consolidando}
                onOpenChange={setConsolidando}
                framing={f}
                studies={studies}
                saving={saving}
                onSave={async input => { await onConsolidate(input); setConsolidando(false); }}
            />
        </section>
    );
}
