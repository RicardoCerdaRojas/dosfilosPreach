import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, Loader2, Plus, X } from 'lucide-react';
import {
    FRAMING_FREQUENCIES,
    FRAMING_GENRES,
    FRAMING_PURPOSES,
    FRAMING_TEXT_MAX,
    FRAMING_TITLE_MAX,
    FRAMING_MAX_MOVEMENTS,
    FRAMING_MAX_SUNDAYS,
    getBookById,
    type AIProject,
    type BibleBookId,
    type FramingFrequency,
    type FramingGenre,
    type FramingPurpose,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { BibleBooksPicker } from '@/pages/projects/stateOfArt/BibliographyCriteriaPanel';
import {
    GENRE_QUESTIONS,
    canonicalOrder,
    chaptersToTitle,
    formErrors,
    formFromProject,
    formScope,
    highlightedNoteIds,
    newMovementRow,
    notesForBooks,
    saveFromForm,
    scopeAllowed,
    type FramingForm,
    type FramingSave,
} from './ProjectFramingForm';
import { PreachingNotesList } from './ProjectFramingNotes';

interface ProjectFramingDialogProps {
    project: Pick<AIProject, 'id' | 'framing' | 'bibliographyCriteria'>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Guarda en UNA llamada (`framingPatch` + `bibleBooks`) y avisa; lanza si falla, para no cerrar. */
    onSave: (save: FramingSave) => Promise<void>;
    saving: boolean;
}

const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

/**
 * «Pasaje y propósito»: el encuadre del proyecto Exegético (fase «Encuadre de
 * la serie», §2 paso 1). El pastor escribe su lectura del libro ANTES de ver
 * el panorama (Osborne, *The Hermeneutical Spiral*); nada se genera aquí y
 * ningún campo es obligatorio salvo un libro.
 */
export function ProjectFramingDialog({ project, open, onOpenChange, onSave, saving }: ProjectFramingDialogProps) {
    const { t, i18n } = useTranslation('projects');
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const [form, setForm] = useState<FramingForm>(() => formFromProject(project, lang));
    // Cada vez que se abre, parte de lo guardado.
    useEffect(() => {
        if (open) setForm(formFromProject(project, lang));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const set = <K extends keyof FramingForm>(k: K, v: FramingForm[K]) => setForm(f => ({ ...f, [k]: v }));
    const nombre = (b: BibleBookId) => (lang === 'en' ? getBookById(b)?.nameEn : getBookById(b)?.nameEs) ?? b;

    const errores = formErrors(form);
    const capitulos = chaptersToTitle(form);
    const notas = useMemo(() => notesForBooks(form.books), [form.books]);
    const resaltadas = highlightedNoteIds(notas, formScope(form));
    const personal = form.purpose === 'personal';
    const conEsdrasNehemias = form.books.some(b => b === 'EZR' || b === 'NEH');
    const librosTitulo = canonicalOrder(form.books).map(nombre).join(lang === 'en' ? ' and ' : ' y ');

    const guardar = async () => {
        if (errores.length) return;
        try {
            await onSave(saveFromForm(form));
        } catch {
            // Quien guarda avisa del error; el diálogo queda abierto para reintentar.
        }
    };

    const etiqueta = 'block text-sm font-medium text-foreground';
    const ayuda = 'block text-xs text-muted-foreground';
    const legend = 'text-[10px] uppercase tracking-[0.2em] text-primary font-medium';

    /** Un campo de la lectura con su «versículos que lo sostienen» (Kaiser). */
    const conVersiculos = (id: string, k: 'occasion' | 'centralIdea' | 'christTrajectory', ke: 'occasionEvidence' | 'centralIdeaEvidence' | 'christTrajectoryEvidence', hint?: string) => (
        <div className="space-y-1.5">
            <label htmlFor={`framing-${id}`} className={etiqueta}>{t(`framing.dialog.${k}`)}</label>
            {hint && <span className={ayuda}>{hint}</span>}
            <textarea id={`framing-${id}`} rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form[k]} onChange={e => set(k, e.target.value)} />
            <label className="block space-y-1">
                <span className="text-[11px] text-muted-foreground">{t('framing.dialog.evidence')}</span>
                <input className={campo} maxLength={FRAMING_TEXT_MAX} placeholder={t('framing.dialog.evidencePlaceholder')} value={form[ke]} onChange={e => set(ke, e.target.value)} />
            </label>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="sm:max-w-5xl max-h-[92vh] flex flex-col gap-0 p-0">
                <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
                    <DialogTitle>{t('framing.dialog.title')}</DialogTitle>
                    <DialogDescription>{t('framing.dialog.description')}</DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="space-y-6">
                            {/* 1. El pasaje */}
                            <fieldset className="space-y-3">
                                <legend className={legend}>{t('framing.dialog.sections.passage')}</legend>
                                <div className="space-y-1">
                                    <span className={etiqueta}>{t('framing.dialog.books')}</span>
                                    <BibleBooksPicker
                                        books={form.books}
                                        listLabel={t('framing.dialog.books')}
                                        addLabel={t('framing.dialog.addBook')}
                                        onRemove={b => set('books', form.books.filter(x => x !== b))}
                                        onAdd={b => set('books', canonicalOrder([...form.books, b]))}
                                    />
                                    {form.books.length === 0 && <p className="text-xs text-warning-subtle-foreground">{t('framing.dialog.noBooks')}</p>}
                                    {conEsdrasNehemias && (
                                        <p className="rounded-md border border-info/30 bg-info-subtle px-3 py-2 text-xs text-info-subtle-foreground" data-testid="framing-ezra-nehemiah">
                                            {t('framing.dialog.ezraNehemiah')}
                                        </p>
                                    )}
                                </div>

                                {form.books.length > 0 && (
                                    <div className="space-y-1.5">
                                        <span id="framing-scope-label" className={etiqueta}>{t('framing.dialog.scope')}</span>
                                        {scopeAllowed(form) ? (
                                            <>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1" role="radiogroup" aria-labelledby="framing-scope-label">
                                                    {(['whole', 'range'] as const).map(m => (
                                                        <label key={m} className="inline-flex items-center gap-2 text-sm text-foreground">
                                                            <input type="radio" name="framing-scope" value={m} checked={form.scopeMode === m} onChange={() => set('scopeMode', m)} className="accent-primary" />
                                                            {t(m === 'whole' ? 'framing.dialog.scopeWhole' : 'framing.dialog.scopeRange')}
                                                        </label>
                                                    ))}
                                                </div>
                                                {form.scopeMode === 'range' && (
                                                    <label className="block space-y-1 sm:max-w-xs">
                                                        <span className="text-[11px] text-muted-foreground">{t('framing.dialog.scopeRangeLabel', { book: nombre(form.books[0]!) })}</span>
                                                        <input
                                                            className={campo}
                                                            placeholder={t('framing.dialog.scopePlaceholder')}
                                                            value={form.scopeRange}
                                                            aria-invalid={errores.includes('scope')}
                                                            onChange={e => set('scopeRange', e.target.value)}
                                                        />
                                                    </label>
                                                )}
                                                {errores.includes('scope') && <p className="text-xs text-destructive" role="alert">{t('framing.dialog.scopeError')}</p>}
                                            </>
                                        ) : (
                                            <p className={ayuda}>{t('framing.dialog.scopeOnlyOneBook')}</p>
                                        )}
                                    </div>
                                )}
                            </fieldset>

                            {/* 2. Para qué */}
                            <fieldset className="space-y-2">
                                <legend className={legend}>{t('framing.dialog.sections.purpose')}</legend>
                                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('framing.dialog.sections.purpose')}>
                                    {FRAMING_PURPOSES.map((p: FramingPurpose) => (
                                        <label
                                            key={p}
                                            className={cn(
                                                'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-primary/40',
                                                form.purpose === p ? 'border-primary/50 bg-info-subtle text-foreground' : 'border-border text-foreground hover:border-primary/30',
                                            )}
                                        >
                                            <input type="radio" name="framing-purpose" value={p} checked={form.purpose === p} onChange={() => set('purpose', p)} className="accent-primary" />
                                            {t(`framing.purpose.${p}`)}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            {/* 3. La lectura del libro (Traina; Jensen) */}
                            <fieldset className="space-y-3">
                                <legend className={legend}>{t('framing.dialog.sections.reading')}</legend>
                                <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                                    <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                    {t('framing.dialog.readFirst')}
                                </p>
                                {capitulos && capitulos.chapters.length > 0 && (
                                    <div className="space-y-1.5">
                                        <span className={etiqueta}>{t('framing.dialog.chapterTitles', { book: nombre(capitulos.book) })}</span>
                                        <span className={ayuda}>{t('framing.dialog.chapterTitlesHint')}</span>
                                        <ol className="grid gap-1.5 sm:grid-cols-2" data-testid="framing-chapter-titles">
                                            {capitulos.chapters.map(c => (
                                                <li key={c} className="flex items-center gap-2">
                                                    <span className="w-7 shrink-0 text-right font-mono text-[11px] text-muted-foreground" aria-hidden>{c}</span>
                                                    <input
                                                        className={campo}
                                                        maxLength={FRAMING_TITLE_MAX}
                                                        aria-label={t('framing.dialog.chapter', { number: c })}
                                                        value={form.chapterTitles[c] ?? ''}
                                                        onChange={e => set('chapterTitles', { ...form.chapterTitles, [c]: e.target.value })}
                                                    />
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}
                                <label className="block space-y-1">
                                    <span className={etiqueta}>{t('framing.dialog.repetitions')}</span>
                                    <span className={ayuda}>{t('framing.dialog.repetitionsHint')}</span>
                                    <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.repetitions} onChange={e => set('repetitions', e.target.value)} />
                                </label>
                            </fieldset>

                            {/* 4. Tu lectura del libro, provisoria */}
                            <fieldset className="space-y-4">
                                <legend className={legend}>{t('framing.dialog.sections.yourReading')}</legend>
                                <p className={ayuda}>{t('framing.dialog.yourReadingHint')}</p>

                                <div className="space-y-1.5">
                                    <label htmlFor="framing-genre" className={etiqueta}>{t('framing.genre.label')}</label>
                                    <select id="framing-genre" className={cn(campo, 'sm:max-w-xs')} value={form.genre} onChange={e => set('genre', e.target.value as FramingGenre | '')}>
                                        <option value="">{t('framing.genre.placeholder')}</option>
                                        {FRAMING_GENRES.map(g => <option key={g} value={g}>{t(`framing.genre.names.${g}`)}</option>)}
                                    </select>
                                    {form.genre ? (
                                        <div className="rounded-md border border-border px-3 py-2" data-testid="framing-genre-questions">
                                            <p className="text-xs font-medium text-foreground">{t('framing.genre.questionsTitle')}</p>
                                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                                                {GENRE_QUESTIONS[form.genre].map(q => <li key={q}>{t(`framing.genre.questions.${form.genre}.${q}`)}</li>)}
                                            </ul>
                                        </div>
                                    ) : (
                                        <span className={ayuda}>{t('framing.genre.hint')}</span>
                                    )}
                                </div>

                                {conVersiculos('occasion', 'occasion', 'occasionEvidence')}

                                <div className="space-y-1.5">
                                    <span className={etiqueta}>{t('framing.dialog.structure')}</span>
                                    <span className={ayuda}>{t('framing.dialog.structureHint')}</span>
                                    {form.structure.length > 0 && (
                                        <ol className="space-y-1.5">
                                            {form.structure.map((m, i) => (
                                                <li key={m.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                                                    <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground" aria-hidden>{i + 1}</span>
                                                    <input
                                                        className={cn(campo, 'w-28 shrink-0')}
                                                        placeholder="1-6"
                                                        aria-label={`${t('framing.dialog.movementRange')} ${i + 1}`}
                                                        value={m.range}
                                                        onChange={e => set('structure', form.structure.map(x => (x.key === m.key ? { ...x, range: e.target.value } : x)))}
                                                    />
                                                    <input
                                                        className={cn(campo, 'min-w-[10rem] flex-1')}
                                                        maxLength={FRAMING_TITLE_MAX}
                                                        aria-label={`${t('framing.dialog.movementTitle')} ${i + 1}`}
                                                        value={m.title}
                                                        onChange={e => set('structure', form.structure.map(x => (x.key === m.key ? { ...x, title: e.target.value } : x)))}
                                                    />
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-9 shrink-0"
                                                        aria-label={t('framing.dialog.removeMovement', { number: i + 1 })}
                                                        onClick={() => set('structure', form.structure.filter(x => x.key !== m.key))}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                    {errores.includes('movementRange') && <p className="text-xs text-destructive" role="alert">{t('framing.dialog.movementError')}</p>}
                                    {form.structure.length < FRAMING_MAX_MOVEMENTS && (
                                        <Button type="button" size="sm" variant="outline" onClick={() => set('structure', [...form.structure, newMovementRow()])}>
                                            <Plus className="h-3.5 w-3.5" />{t('framing.dialog.addMovement')}
                                        </Button>
                                    )}
                                </div>

                                {conVersiculos('central-idea', 'centralIdea', 'centralIdeaEvidence')}
                                {/* Se pide también en «estudio personal»: es teológica, no pastoral (Greidanus). */}
                                {conVersiculos('christ', 'christTrajectory', 'christTrajectoryEvidence', t('framing.dialog.christTrajectoryHint'))}
                            </fieldset>

                            {!personal && (
                                <>
                                    {/* 5. El propósito pastoral (Chapell; con la pregunta de control de Stott) */}
                                    <fieldset className="space-y-3" data-testid="framing-pastoral">
                                        <legend className={legend}>{t('framing.dialog.sections.pastoral')}</legend>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="block space-y-1">
                                                <span className={etiqueta}>{t('framing.dialog.audience')}</span>
                                                <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.audience} onChange={e => set('audience', e.target.value)} />
                                            </label>
                                            <label className="block space-y-1">
                                                <span className={etiqueta}>{t('framing.dialog.need')}</span>
                                                <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.need} onChange={e => set('need', e.target.value)} />
                                            </label>
                                        </div>
                                        <label className="block space-y-1">
                                            <span className={etiqueta}>{t('framing.dialog.needEvidence')}</span>
                                            <span className={ayuda}>{t('framing.dialog.needEvidenceHint')}</span>
                                            <input className={campo} maxLength={FRAMING_TEXT_MAX} placeholder={t('framing.dialog.evidencePlaceholder')} value={form.needEvidence} onChange={e => set('needEvidence', e.target.value)} />
                                        </label>
                                        <label className="block space-y-1">
                                            <span className={etiqueta}>{t('framing.dialog.desiredChange')}</span>
                                            <textarea rows={2} maxLength={FRAMING_TEXT_MAX} className={campo} value={form.desiredChange} onChange={e => set('desiredChange', e.target.value)} />
                                        </label>
                                    </fieldset>

                                    {/* 6. El ritmo: da las fechas, no la división */}
                                    <fieldset className="space-y-2" data-testid="framing-rhythm">
                                        <legend className={legend}>{t('framing.dialog.sections.rhythm')}</legend>
                                        <p className={ayuda}>{t('framing.dialog.rhythmHint')}</p>
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <label className="block space-y-1">
                                                <span className="text-[11px] text-muted-foreground">{t('framing.dialog.sundays')}</span>
                                                <input type="number" inputMode="numeric" min={1} max={FRAMING_MAX_SUNDAYS} className={campo} value={form.sundays} onChange={e => set('sundays', e.target.value)} aria-invalid={errores.includes('sundays')} />
                                            </label>
                                            <label className="block space-y-1">
                                                <span className="text-[11px] text-muted-foreground">{t('framing.dialog.startDate')}</span>
                                                {/* `type="date"` entrega YYYY-MM-DD local, sin zona horaria. */}
                                                <input type="date" className={campo} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                                            </label>
                                            <label className="block space-y-1">
                                                <span className="text-[11px] text-muted-foreground">{t('framing.dialog.frequency')}</span>
                                                <select className={campo} value={form.frequency} onChange={e => set('frequency', e.target.value as FramingFrequency | '')}>
                                                    <option value="">{t('framing.dialog.frequencyNone')}</option>
                                                    {FRAMING_FREQUENCIES.map(f => <option key={f} value={f}>{t(`framing.frequency.${f}`)}</option>)}
                                                </select>
                                            </label>
                                        </div>
                                        {errores.includes('sundays') && <p className="text-xs text-destructive" role="alert">{t('framing.dialog.sundaysError')}</p>}
                                    </fieldset>
                                </>
                            )}
                        </div>

                        {/* «Para predicar…»: notas curadas del libro, con sus fuentes. */}
                        <aside className="space-y-2 lg:sticky lg:top-0 lg:self-start" aria-label={notas.length ? t('framing.notes.title', { book: librosTitulo }) : undefined}>
                            {notas.length > 0 && (
                                <div className="rounded-lg border border-border bg-card p-3 space-y-2" data-testid="framing-notes">
                                    <p className="text-sm font-semibold text-foreground">{t('framing.notes.title', { book: librosTitulo })}</p>
                                    <p className="text-[11px] text-muted-foreground">{t('framing.notes.hint')}</p>
                                    <PreachingNotesList notes={notas} highlighted={resaltadas} />
                                </div>
                            )}
                        </aside>
                    </div>
                </div>

                <DialogFooter className="items-center border-t border-border px-6 py-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('framing.dialog.cancel')}</Button>
                    <Button onClick={guardar} disabled={saving || errores.length > 0}>
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('framing.dialog.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
