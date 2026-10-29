import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { FRAMING_MAX_SUNDAYS, FRAMING_PURPOSES, FRAMING_TEXT_MAX, getBookById, type AIProject, type BibleBookId, type FramingPurpose } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { BibleBooksPicker } from '@/pages/projects/stateOfArt/BibliographyCriteriaPanel';
import {
    canonicalOrder,
    formChanged,
    formErrors,
    formFromProject,
    formScope,
    formWithNote,
    highlightedNoteIds,
    notesForBooks,
    saveFromForm,
    scopeAllowed,
    type FramingForm,
    type FramingSave,
} from './ProjectFramingForm';
import { Aviso, ERROR_KEY, ayuda, campo, etiqueta, legend } from './ProjectFramingFields';
import { PreachingNotesList } from './ProjectFramingNotes';
import { ProjectFramingPastoralSection } from './ProjectFramingPastoralSection';
import { ProjectFramingReadingSection } from './ProjectFramingReadingSection';
import { ProjectFramingYourReadingSection } from './ProjectFramingYourReadingSection';

interface ProjectFramingDialogProps {
    project: Pick<AIProject, 'id' | 'framing' | 'bibliographyCriteria'>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Guarda en UNA llamada (`framingPatch` + `bibleBooks`) y avisa; lanza si falla, para no cerrar. */
    onSave: (save: FramingSave) => Promise<void>;
    saving: boolean;
    /**
     * «Pasar tu nota al encuadre»: la nota de antes, que se precarga en la
     * idea central si está vacía (`formWithNote`) y se muestra arriba. Cuenta
     * como cambio: nada se guarda hasta que el pastor confirma.
     */
    prefillNote?: string | null;
}

/** En el teléfono, los radios y las tarjetas miden al menos 44 px de alto. */
const tactil = 'min-h-11 sm:min-h-0';

/**
 * «El encuadre: pasaje y propósito» del proyecto Exegético (fase «Encuadre de
 * la serie», §2 paso 1). El pastor escribe su lectura del libro ANTES de ver
 * el panorama (Osborne, *The Hermeneutical Spiral*); nada se genera aquí y
 * ningún campo es obligatorio salvo un libro. Con cambios, cerrar pregunta.
 */
export function ProjectFramingDialog({ project, open, onOpenChange, onSave, saving, prefillNote }: ProjectFramingDialogProps) {
    const { t, i18n } = useTranslation('projects');
    const { t: tn } = useTranslation('projectDeskExegetical');
    const [conNota, setConNota] = useState<{ placed: boolean; truncated: boolean } | null>(null);
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const [inicial, setInicial] = useState<FramingForm>(() => formFromProject(project, lang));
    const [form, setForm] = useState<FramingForm>(inicial);
    const [confirmarSalida, setConfirmarSalida] = useState(false);
    // Cada vez que se abre, parte de lo guardado.
    useEffect(() => {
        if (!open) return;
        const desdeGuardado = formFromProject(project, lang);
        setInicial(desdeGuardado);
        // Con la nota, el formulario parte de lo guardado más la nota: cerrar pregunta.
        const nota = prefillNote?.trim() ? formWithNote(desdeGuardado, prefillNote) : null;
        setForm(nota ? nota.form : desdeGuardado);
        setConNota(nota ? { placed: nota.placed, truncated: nota.truncated } : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const set = <K extends keyof FramingForm>(k: K, v: FramingForm[K]) => setForm(f => ({ ...f, [k]: v }));
    const nombre = (b: BibleBookId) => (lang === 'en' ? getBookById(b)?.nameEn : getBookById(b)?.nameEs) ?? b;

    const errores = formErrors(form);
    const cambios = formChanged(inicial, form);
    const notas = useMemo(() => notesForBooks(form.books), [form.books]);
    const resaltadas = highlightedNoteIds(notas, formScope(form));
    const personal = form.purpose === 'personal';
    const conEsdrasNehemias = form.books.some(b => b === 'EZR' || b === 'NEH');
    const librosTitulo = canonicalOrder(form.books).map(nombre).join(lang === 'en' ? ' and ' : ' y ');
    const errorAlcance = errores.find(e => e === 'scope' || e === 'scopeVerses');
    const primerError = errores[0];

    /** Esc, clic fuera, la X y Cancelar pasan por aquí: con cambios, se pregunta. */
    const pedirCierre = () => {
        if (saving) return;
        if (cambios) setConfirmarSalida(true);
        else onOpenChange(false);
    };

    const guardar = async () => {
        if (errores.length) return;
        try {
            await onSave(saveFromForm(form));
        } catch {
            // Quien guarda avisa del error; el diálogo queda abierto para reintentar.
        }
    };

    const notasLista = <PreachingNotesList notes={notas} highlighted={resaltadas} />;

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) pedirCierre(); else onOpenChange(o); }}>
            <DialogContent
                className="sm:max-w-5xl max-h-[92dvh] flex flex-col gap-0 p-0"
                // Con cambios, un clic fuera no cierra: pregunta.
                onPointerDownOutside={e => { if (cambios) { e.preventDefault(); pedirCierre(); } }}
            >
                <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
                    <DialogTitle>{t('framing.dialog.title')}</DialogTitle>
                    <DialogDescription>{t('framing.dialog.description')}</DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                        <div className="space-y-6">
                            {conNota && prefillNote?.trim() && (
                                <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-3 py-3" role="status" data-testid="framing-old-note">
                                    <p className="text-sm font-semibold text-foreground">{tn('noteDialog.title')}</p>
                                    <p className="text-xs text-foreground">
                                        {tn(conNota.placed ? 'noteDialog.intoIdea' : 'noteDialog.ideaTaken')}
                                        {conNota.truncated && <> {tn('noteDialog.truncated', { max: FRAMING_TEXT_MAX })}</>}
                                    </p>
                                    <blockquote className="max-h-40 overflow-y-auto whitespace-pre-line border-l-2 border-border pl-3 text-sm text-foreground/90">{prefillNote.trim()}</blockquote>
                                </div>
                            )}
                            {/* En pantallas angostas, «Para predicar…» va arriba y plegado. */}
                            {notas.length > 0 && (
                                <details className="group rounded-lg border border-border bg-card px-3 py-2 lg:hidden" data-testid="framing-notes-compact">
                                    <summary className={cn('flex cursor-pointer list-none items-center gap-1 rounded-sm text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden', tactil)}>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                                        {t('framing.notes.compact', { book: librosTitulo, count: notas.length })}
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        <p className="text-xs text-muted-foreground">{t('framing.notes.hint')}</p>
                                        {notasLista}
                                    </div>
                                </details>
                            )}

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
                                    {form.books.length === 0 && <p className="text-xs text-foreground">{t('framing.dialog.noBooks')}</p>}
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
                                                        <label key={m} className={cn('inline-flex items-center gap-2 text-sm text-foreground', tactil)}>
                                                            <input type="radio" name="framing-scope" value={m} checked={form.scopeMode === m} onChange={() => set('scopeMode', m)} className="accent-primary" />
                                                            {t(m === 'whole' ? 'framing.dialog.scopeWhole' : 'framing.dialog.scopeRange')}
                                                        </label>
                                                    ))}
                                                </div>
                                                {form.scopeMode === 'range' && (
                                                    <label className="block space-y-1 sm:max-w-xs">
                                                        <span className="block text-xs text-muted-foreground">{t('framing.dialog.scopeRangeLabel', { book: nombre(form.books[0]!) })}</span>
                                                        <input
                                                            className={campo}
                                                            placeholder={t('framing.dialog.scopePlaceholder')}
                                                            value={form.scopeRange}
                                                            aria-invalid={!!errorAlcance}
                                                            onChange={e => set('scopeRange', e.target.value)}
                                                        />
                                                    </label>
                                                )}
                                                {errorAlcance && <Aviso role="alert">{t(ERROR_KEY[errorAlcance])}</Aviso>}
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
                                                tactil,
                                                form.purpose === p ? 'border-primary/50 bg-info-subtle text-foreground' : 'border-border text-foreground hover:border-primary/30',
                                            )}
                                        >
                                            <input type="radio" name="framing-purpose" value={p} checked={form.purpose === p} onChange={() => set('purpose', p)} className="accent-primary" />
                                            {t(`framing.purpose.${p}`)}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>

                            <ProjectFramingReadingSection form={form} set={set} errores={errores} />
                            <ProjectFramingYourReadingSection form={form} set={set} errores={errores} />
                            {!personal && <ProjectFramingPastoralSection form={form} set={set} errores={errores} />}
                        </div>

                        {/* «Para predicar…»: notas curadas del libro, con sus fuentes. En pantalla ancha, al costado. */}
                        <aside className="hidden space-y-2 lg:sticky lg:top-0 lg:block lg:self-start" aria-label={notas.length ? t('framing.notes.title', { book: librosTitulo }) : undefined}>
                            {notas.length > 0 && (
                                <div className="rounded-lg border border-border bg-card p-3 space-y-2" data-testid="framing-notes">
                                    <p className="text-sm font-semibold text-foreground">{t('framing.notes.title', { book: librosTitulo })}</p>
                                    <p className="text-xs text-muted-foreground">{t('framing.notes.hint')}</p>
                                    {notasLista}
                                </div>
                            )}
                        </aside>
                    </div>
                </div>

                <DialogFooter className="flex-col items-stretch gap-2 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                    {/* El primer motivo que impide guardar, junto al botón: en el teléfono el aviso de arriba queda lejos. */}
                    {primerError && (
                        <Aviso id="framing-save-blocker" className="sm:mr-auto sm:max-w-md">
                            {t(ERROR_KEY[primerError], primerError === 'sundays' ? { max: FRAMING_MAX_SUNDAYS } : undefined)}
                        </Aviso>
                    )}
                    <Button variant="outline" className={tactil} onClick={pedirCierre} disabled={saving}>{t('framing.dialog.cancel')}</Button>
                    <Button className={tactil} onClick={guardar} disabled={saving || errores.length > 0} aria-describedby={primerError ? 'framing-save-blocker' : undefined}>
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('framing.dialog.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>

            <ConfirmDialog
                open={confirmarSalida}
                onOpenChange={setConfirmarSalida}
                title={t('framing.dialog.unsavedTitle')}
                body={t('framing.dialog.unsavedBody')}
                confirmLabel={t('framing.dialog.unsavedLeave')}
                cancelLabel={t('framing.dialog.unsavedStay')}
                onConfirm={() => { setConfirmarSalida(false); onOpenChange(false); }}
            />
        </Dialog>
    );
}
