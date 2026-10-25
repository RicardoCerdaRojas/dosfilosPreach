import { useEffect, useId, useState, type ReactNode } from 'react';
import { CheckCircle2, Loader2, Scale } from 'lucide-react';
import {
    formatPassageForReader,
    HYPOTHESIS_VERDICTS,
    type BibleBookId,
    type BookPanorama,
    type HypothesisEntry,
    type HypothesisVerdict,
    type MacroSection,
    type NewHypothesisEntry,
    type ProjectFraming,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface FramingContrastCardProps {
    framing: Pick<ProjectFraming, 'centralIdea' | 'structure' | 'hypothesisLog'>;
    panorama: Pick<BookPanorama, 'purpose' | 'movements'>;
    /** La macroestructura (Pase 2), cuando ya llegó. Antes, los movimientos del panorama. */
    macroSections: ReadonlyArray<MacroSection> | null;
    bookId: BibleBookId;
    /** El análisis fue de un pasaje: el rótulo dice «del pasaje», no «del libro». */
    isPassage: boolean;
    lang: 'es' | 'en';
    /** Anota en el registro de la hipótesis. El caso de uso lo agrega al registro GUARDADO. */
    onRecord: (entry: NewHypothesisEntry) => Promise<unknown>;
    t: (key: string, opts?: Record<string, unknown>) => string;
}

/**
 * «Tu lectura y lo que propone el panorama» (`docs/FASE_ENCUADRE_SERIE_2026-10.md`,
 * §2 paso 7). Lado a lado, la idea central y los movimientos que el pastor
 * escribió ANTES de ver el panorama, y lo que el panorama propone.
 *
 * Rótulo deliberado: «lo que propone el panorama», nunca «lo que dice el
 * texto»: la lectura del asistente tampoco reemplaza la del pastor
 * (principio 1, la espiral hermenéutica de Osborne). Nada de esto entra a
 * los pases: solo se muestra. Responder es una invitación, no un requisito.
 *
 * La página la monta con `key` por corrida del panorama: un panorama nuevo
 * vuelve a invitar. Si el registro ya tiene una anotación tras el panorama
 * (de esta corrida o de otra), la muestra en vez de pedirla otra vez.
 */
export function FramingContrastCard({
    framing, panorama, macroSections, bookId, isPassage, lang, onRecord, t,
}: FramingContrastCardProps) {
    const ids = useId();
    const [verdict, setVerdict] = useState<HypothesisVerdict | ''>('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [failed, setFailed] = useState(false);
    const [again, setAgain] = useState(false);
    const previous = latestPanoramaEntry(framing.hypothesisLog);
    // «Anotar otra vez» desaparece al pulsarlo: el foco pasa a la primera
    // opción para que el teclado no quede en el vacío.
    useEffect(() => {
        if (again) document.getElementById(`${ids}-${HYPOTHESIS_VERDICTS[0]}`)?.focus();
    }, [again, ids]);

    const idea = framing.centralIdea?.trim() ?? '';
    const movements = framing.structure ?? [];
    const proposed: Array<{ key: string; range: string | null; title: string }> = macroSections?.length
        ? macroSections.map((m) => ({
            key: m.id,
            range: formatPassageForReader(
                { bookId, chapterStart: m.chapterStart, verseStart: m.verseStart, chapterEnd: m.chapterEnd, verseEnd: m.verseEnd },
                lang,
            ),
            title: m.title,
        }))
        : panorama.movements.map((m, i) => ({ key: `pm-${i}`, range: null, title: m }));
    const panoramaHeading = t(isPassage ? 'expository.framing.contrast.panoramaPassage' : 'expository.framing.contrast.panoramaBook');

    const handleSave = async () => {
        if (!verdict || saving) return;
        setSaving(true);
        setFailed(false);
        try {
            await onRecord({ source: 'panorama', verdict, note: note.trim() });
            setSaved(true);
        } catch (err) {
            console.error('[expository] hypothesis entry failed:', err);
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    return (
        <section
            aria-labelledby={`${ids}-title`}
            className="rounded-2xl border border-border bg-card p-5 text-card-foreground"
        >
            <header className="flex items-start gap-2">
                <Scale className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                    <h2 id={`${ids}-title`} className="text-sm font-semibold text-foreground">
                        {t('expository.framing.contrast.title')}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('expository.framing.contrast.intro')}</p>
                </div>
            </header>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <h3 className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:block">
                    {t('expository.framing.contrast.yours')}
                </h3>
                <h3 className="hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:block">
                    {panoramaHeading}
                </h3>

                <Column label={t('expository.framing.contrast.yours')} row={t('expository.framing.contrast.ideaRow')}>
                    {idea
                        ? <p className="whitespace-pre-line text-sm text-foreground">{idea}</p>
                        : <p className="text-sm italic text-muted-foreground">{t('expository.framing.contrast.noIdea')}</p>}
                </Column>
                <Column label={panoramaHeading} row={t('expository.framing.contrast.ideaRow')} proposal>
                    <p className="whitespace-pre-line text-sm text-foreground">{panorama.purpose}</p>
                </Column>

                <Column label={t('expository.framing.contrast.yours')} row={t('expository.framing.contrast.movementsRow')}>
                    {movements.length
                        ? (
                            <ol className="space-y-1 text-sm text-foreground">
                                {movements.map((m, i) => (
                                    <li key={i}>
                                        <span className="font-medium">{formatPassageForReader(m.passage, lang)}</span>
                                        {' · '}
                                        {m.title || <span className="italic text-muted-foreground">{t('expository.framing.contrast.untitled')}</span>}
                                    </li>
                                ))}
                            </ol>
                        )
                        : <p className="text-sm italic text-muted-foreground">{t('expository.framing.contrast.noMovements')}</p>}
                </Column>
                <Column label={panoramaHeading} row={t('expository.framing.contrast.movementsRow')} proposal>
                    {proposed.length
                        ? (
                            <ol className="space-y-1 text-sm text-foreground">
                                {proposed.map((m) => (
                                    <li key={m.key}>
                                        {m.range && <><span className="font-medium">{m.range}</span>{' · '}</>}
                                        {m.title}
                                    </li>
                                ))}
                            </ol>
                        )
                        : <p className="text-sm italic text-muted-foreground">{t('expository.framing.contrast.noPanoramaMovements')}</p>}
                </Column>
            </div>

            <div className="mt-5 border-t border-border pt-4">
                {saved && (
                    <p role="status" className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success-subtle-foreground" aria-hidden="true" />
                        {t('expository.framing.contrast.saved')}
                    </p>
                )}
                {!saved && previous && !again && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 text-sm text-foreground">
                            <p className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-success-subtle-foreground" aria-hidden="true" />
                                {t('expository.framing.contrast.already', {
                                    verdict: t(`expository.framing.contrast.verdict.${previous.verdict}`),
                                    date: formatDate(previous.at, lang),
                                })}
                            </p>
                            {previous.note && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{previous.note}</p>}
                        </div>
                        <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setAgain(true)}>
                            {t('expository.framing.contrast.again')}
                        </Button>
                    </div>
                )}
                {!saved && (!previous || again) && (
                    <fieldset className="space-y-3" aria-describedby={`${ids}-hint`}>
                        <legend className="text-sm font-semibold text-foreground">
                            {t('expository.framing.contrast.question')}
                        </legend>
                        <p id={`${ids}-hint`} className="text-xs text-muted-foreground">
                            {t('expository.framing.contrast.questionHint')}
                        </p>
                        <RadioGroup
                            value={verdict}
                            onValueChange={(v) => setVerdict(v as HypothesisVerdict)}
                            className="flex flex-wrap gap-4"
                        >
                            {HYPOTHESIS_VERDICTS.map((v) => (
                                <div key={v} className="flex min-h-11 items-center gap-2 sm:min-h-0">
                                    <RadioGroupItem value={v} id={`${ids}-${v}`} />
                                    <Label htmlFor={`${ids}-${v}`} className="text-sm font-normal">
                                        {t(`expository.framing.contrast.verdict.${v}`)}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                        <div className="space-y-1.5">
                            <Label htmlFor={`${ids}-note`} className="text-xs">
                                {t('expository.framing.contrast.noteLabel')}
                            </Label>
                            <Textarea
                                id={`${ids}-note`}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder={t('expository.framing.contrast.notePlaceholder')}
                                rows={2}
                                maxLength={2000}
                                className="resize-y"
                            />
                        </div>
                        {failed && (
                            <p role="alert" className="rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-1.5 text-xs text-warning-subtle-foreground">
                                {t('expository.framing.contrast.saveFailed')}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={handleSave} disabled={!verdict || saving}>
                                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                {t('expository.framing.contrast.save')}
                            </Button>
                        </div>
                    </fieldset>
                )}
            </div>
        </section>
    );
}

/**
 * Una celda del contraste. En pantallas angostas las columnas se apilan,
 * así que cada celda repite de quién es («Tu lectura» / «Lo que propone…»).
 */
function Column({ label, row, proposal = false, children }: {
    label: string;
    row: string;
    proposal?: boolean;
    children: ReactNode;
}) {
    return (
        <div className={`rounded-xl border p-3 ${proposal ? 'border-dashed border-border bg-muted/40' : 'border-border bg-background'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="md:sr-only">{label} · </span>{row}
            </p>
            <div className="mt-1.5">{children}</div>
        </div>
    );
}

/** La última anotación tras el panorama, de esta corrida o de otra. */
function latestPanoramaEntry(log: ReadonlyArray<HypothesisEntry> | null | undefined): HypothesisEntry | null {
    return (log ?? [])
        .filter((e) => e.source === 'panorama')
        .reduce<HypothesisEntry | null>((last, e) => (!last || e.at > last.at ? e : last), null);
}

function formatDate(iso: string, lang: 'es' | 'en'): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es', { day: 'numeric', month: 'short', year: 'numeric' });
}
