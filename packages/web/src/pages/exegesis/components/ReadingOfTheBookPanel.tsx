import { useEffect, useId, useMemo, useState } from 'react';
import { BookMarked, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    FRAMING_TEXT_MAX,
    HYPOTHESIS_VERDICTS,
    currentRevisedIdea,
    formatPassageForReader,
    referenceContains,
    referencesOverlap,
    type AIProject,
    type ExegeticalPaper,
    type FramingMovement,
    type HypothesisEntry,
    type HypothesisVerdict,
    type PassageReference,
    type ProjectFraming,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';

/**
 * «Tu lectura del libro», al final del estudio de una perícopa
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, U7).
 *
 * El pastor escribió en el proyecto su idea central y los movimientos del
 * libro ANTES de estudiar. Aquí los vuelve a ver para compararlos con lo que
 * encontró, y anota si este estudio confirma, matiza o contradice su lectura.
 *
 * Va AL FINAL y PLEGADO a propósito: primero se observa el texto sin la
 * hipótesis y después se compara (lectura inductiva: Traina, *Methodical
 * Bible Study*; Osborne, *The Hermeneutical Spiral*). Abierto arriba, el
 * pastor leería la perícopa desde su hipótesis.
 *
 * Nada de esto va a un prompt: el panel solo lee el proyecto y escribe en su
 * registro (`hypothesisEntry`). No toca los pasos ni su entrada.
 */
export function ReadingOfTheBookPanel({ paper }: { paper: ExegeticalPaper }) {
    const { projects } = useFacultyProjects();
    const project = useMemo(() => projectWithReading(paper, projects ?? []), [paper, projects]);
    if (!project) return null;
    return <PanelBody paper={paper} project={project} framing={project.framing!} />;
}

// ── Reglas (puras, probadas aparte) ────────────────────────────────────

/** Hay algo que comparar: una idea central o al menos un movimiento. */
export function framingHasReading(framing: ProjectFraming | null | undefined): boolean {
    return !!(framing?.centralIdea?.trim() || (framing?.structure?.length ?? 0) > 0);
}

/**
 * El proyecto cuya lectura se muestra. Primero el de ORIGEN, que define el
 * encargo del estudio; si no tiene encuadre, el primer proyecto vinculado
 * que lo tenga. Ese caso es real: un estudio que nació en un curso y quedó
 * vinculado a la serie de un proyecto al ligarla (`SeriesService.linkSeriesToProject`).
 * Uno en la papelera no cuenta; uno archivado sí: la lectura sigue siendo suya.
 */
export function projectWithReading(
    paper: Pick<ExegeticalPaper, 'projectId' | 'linkedProjectIds'>,
    projects: ReadonlyArray<AIProject>,
): AIProject | null {
    const ids = [paper.projectId, ...(paper.linkedProjectIds ?? [])].filter((id): id is string => !!id);
    for (const id of ids) {
        const p = projects.find(x => x.id === id);
        if (p && !p.deletedAt && framingHasReading(p.framing)) return p;
    }
    return null;
}

export type MovementMatch = 'contains' | 'overlaps' | null;

/**
 * Dónde cae el pasaje del estudio en cada movimiento del pastor.
 *
 * NUMERACIÓN: los dos lados están en la del TEXTO ORIGINAL. El pasaje del
 * estudio se guarda así (convención del módulo de exégesis), y el encuadre
 * guarda su alcance y sus movimientos así (§3 del documento de fase); solo
 * se traducen a la numeración del lector para mostrarlos. Comparar uno
 * traducido con otro sin traducir resaltaría el movimiento vecino en los
 * libros donde difieren.
 *
 * `contains`: el movimiento cubre todo el pasaje. `overlaps`: el pasaje
 * cruza la frontera entre dos movimientos y toca este. Los dos se resaltan:
 * que un estudio quede a caballo entre dos movimientos ya dice algo de la
 * estructura propuesta.
 */
export function matchMovements(
    structure: ReadonlyArray<FramingMovement>,
    passage: PassageReference,
): MovementMatch[] {
    return structure.map(m =>
        referenceContains(m.passage, passage) ? 'contains' : referencesOverlap(m.passage, passage) ? 'overlaps' : null,
    );
}

/** Las anotaciones de ESTE estudio, la más reciente primero. */
export function entriesOfStudy(framing: ProjectFraming, studyId: string): HypothesisEntry[] {
    return (framing.hypothesisLog ?? [])
        .filter(e => e.source === 'study' && e.studyId === studyId)
        .slice()
        .sort((a, b) => b.at.localeCompare(a.at));
}

// ── Plegado, recordado por estudio ─────────────────────────────────────

const OPEN_KEY_PREFIX = 'dosfilos.exegesis.readingPanel.open.';

function readOpen(paperId: string): boolean {
    try {
        return window.localStorage.getItem(OPEN_KEY_PREFIX + paperId) === '1';
    } catch {
        return false;
    }
}

function writeOpen(paperId: string, open: boolean): void {
    try {
        if (open) window.localStorage.setItem(OPEN_KEY_PREFIX + paperId, '1');
        else window.localStorage.removeItem(OPEN_KEY_PREFIX + paperId);
    } catch {
        // Sin almacenamiento (ventana privada): el panel vuelve plegado, que es lo seguro.
    }
}

// ── Vista ──────────────────────────────────────────────────────────────

function PanelBody({ paper, project, framing }: { paper: ExegeticalPaper; project: AIProject; framing: ProjectFraming }) {
    const { t, i18n } = useTranslation('exegesis');
    const lang: 'es' | 'en' = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';
    const contentId = useId();
    const [open, setOpen] = useState<boolean>(() => readOpen(paper.id));
    useEffect(() => writeOpen(paper.id, open), [paper.id, open]);

    const idea = framing.centralIdea?.trim() || null;
    const revised = currentRevisedIdea(framing);
    const structure = framing.structure ?? [];
    const matches = matchMovements(structure, paper.passage);
    const entries = entriesOfStudy(framing, paper.id);

    return (
        <section
            aria-labelledby={`${contentId}-title`}
            className="rounded-2xl border border-border bg-card text-card-foreground"
        >
            <h2 id={`${contentId}-title`} className="m-0">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={contentId}
                    onClick={() => setOpen(o => !o)}
                    className="flex w-full items-start gap-3 rounded-2xl px-6 py-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                        <span className="block font-serif text-base font-semibold">{t('readingPanel.title')}</span>
                        <span className="block text-xs text-muted-foreground">
                            {t('readingPanel.subtitle', { project: project.title })}
                        </span>
                    </span>
                    <ChevronDown
                        className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>
            </h2>

            {!open && (
                <p className="px-6 pb-4 -mt-1 text-xs text-muted-foreground">{t('readingPanel.whyFolded')}</p>
            )}

            {open && (
                <div id={contentId} className="space-y-6 border-t border-border px-6 py-5">
                    <div className="space-y-3">
                        <IdeaBlock label={t('readingPanel.centralIdea')} text={idea ?? t('readingPanel.noIdea')} muted={!idea} />
                        {revised && <IdeaBlock label={t('readingPanel.revisedIdea')} text={revised} />}
                    </div>

                    {structure.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold">{t('readingPanel.structure')}</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">{t('readingPanel.readerNumbering')}</p>
                            <ol className="mt-2 space-y-1.5">
                                {structure.map((m, i) => {
                                    const match = matches[i];
                                    return (
                                        <li
                                            key={i}
                                            data-match={match ?? undefined}
                                            aria-current={match === 'contains' ? 'location' : undefined}
                                            className={`rounded-lg border px-3 py-2 text-sm ${match
                                                ? 'border-info/50 bg-info-subtle text-info-subtle-foreground border-l-4'
                                                : 'border-border'}`}
                                        >
                                            <span className="font-medium">{formatPassageForReader(m.passage, lang)}</span>
                                            <span> · {m.title?.trim() || t('readingPanel.untitled')}</span>
                                            {match && (
                                                <span className="mt-0.5 block text-xs font-semibold">
                                                    {t(match === 'contains' ? 'readingPanel.here' : 'readingPanel.touches')}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                            {!matches.some(Boolean) && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {t('readingPanel.noMovement', { passage: formatPassageForReader(paper.passage, lang) })}
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <h3 className="text-sm font-semibold">{t('readingPanel.log.title')}</h3>
                        {entries.length === 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">{t('readingPanel.log.empty')}</p>
                        ) : (
                            <ul className="mt-2 space-y-2">
                                {entries.map(e => (
                                    <li key={e.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                                        <span className="font-semibold">{t(`readingPanel.verdict.${e.verdict}`)}</span>
                                        <span className="text-xs text-muted-foreground"> · {formatDate(e.at, lang)}</span>
                                        {e.note && <p className="mt-1 whitespace-pre-line">{e.note}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <AnnotateForm paperId={paper.id} projectId={project.id} />
                </div>
            )}
        </section>
    );
}

function IdeaBlock({ label, text, muted = false }: { label: string; text: string; muted?: boolean }) {
    return (
        <div>
            <h3 className="text-sm font-semibold">{label}</h3>
            <p className={`mt-1 whitespace-pre-line text-sm ${muted ? 'italic text-muted-foreground' : ''}`}>{text}</p>
        </div>
    );
}

function AnnotateForm({ paperId, projectId }: { paperId: string; projectId: string }) {
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
            <p className="text-xs text-muted-foreground">{t('readingPanel.form.private')}</p>
            <Button type="submit" size="sm" disabled={!verdict || updateProject.isPending}>
                {updateProject.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {t(updateProject.isPending ? 'readingPanel.form.saving' : 'readingPanel.form.save')}
            </Button>
        </form>
    );
}

function formatDate(iso: string, lang: 'es' | 'en'): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es', { day: 'numeric', month: 'short', year: 'numeric' });
}
