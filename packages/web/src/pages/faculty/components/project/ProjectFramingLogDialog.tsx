import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FRAMING_TEXT_MAX, HYPOTHESIS_VERDICTS, type HypothesisEntry, type HypothesisVerdict, type NewHypothesisEntry } from '@dosfilos/domain';
import { studyLabel, type FramingStudy } from './ProjectFramingForm';

export type { FramingStudy };
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

interface ProjectFramingLogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studies: ReadonlyArray<FramingStudy>;
    /** Agrega la anotación al registro GUARDADO (`hypothesisEntry`); lanza si falla. */
    onSave: (entry: NewHypothesisEntry) => Promise<void>;
    saving: boolean;
    /** El estudio ya elegido (la fila de la mesa desde la que se anota). */
    initialStudyId?: string | null;
}

/**
 * «Anotar lo que dice un estudio» (§2 paso 10): después de cada estudio, el
 * pastor dice si confirma, matiza o contradice su lectura del libro. La
 * hipótesis se revisa durante el trabajo, no al final.
 */
export function ProjectFramingLogDialog({ open, onOpenChange, studies, onSave, saving, initialStudyId }: ProjectFramingLogDialogProps) {
    const { t, i18n } = useTranslation('projects');
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const [studyId, setStudyId] = useState('');
    const [verdict, setVerdict] = useState<HypothesisVerdict | ''>('');
    const [note, setNote] = useState('');
    useEffect(() => {
        if (open) {
            const elegido = initialStudyId && studies.some(s => s.id === initialStudyId) ? initialStudyId : null;
            setStudyId(elegido ?? (studies.length === 1 ? studies[0]!.id : ''));
            setVerdict('');
            setNote('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const listo = !!studyId && !!verdict;
    const guardar = async () => {
        if (!listo) return;
        try {
            await onSave({ source: 'study', studyId, verdict, note: note.trim() });
        } catch {
            // Quien guarda avisa; el diálogo queda abierto.
        }
    };

    return (
        <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('framing.annotate.title')}</DialogTitle>
                    <DialogDescription>{t('framing.annotate.description')}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <label className="block space-y-1">
                        <span className="text-sm font-medium text-foreground">{t('framing.annotate.study')}</span>
                        <select className={campo} value={studyId} onChange={e => setStudyId(e.target.value)}>
                            <option value="">{t('framing.annotate.studyPlaceholder')}</option>
                            {studies.map(s => <option key={s.id} value={s.id}>{studyLabel(s, lang)}</option>)}
                        </select>
                    </label>
                    <VerdictPicker
                        name="framing-hypothesis-verdict"
                        label={t('framing.annotate.verdict')}
                        options={HYPOTHESIS_VERDICTS}
                        value={verdict}
                        onChange={setVerdict}
                        labelOf={v => t(`framing.hypothesisVerdict.${v}`)}
                    />
                    <label className="block space-y-1">
                        <span className="text-sm font-medium text-foreground">{t('framing.annotate.note')}</span>
                        <textarea rows={4} maxLength={FRAMING_TEXT_MAX} className={campo} placeholder={t('framing.annotate.notePlaceholder')} value={note} onChange={e => setNote(e.target.value)} />
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={() => onOpenChange(false)} disabled={saving}>{t('framing.dialog.cancel')}</Button>
                    <Button className="min-h-11 sm:min-h-0" onClick={guardar} disabled={saving || !listo}>
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {t('framing.annotate.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Tres opciones como botones de radio grandes, tocables en el teléfono. */
export function VerdictPicker<V extends string>({ name, label, options, value, onChange, labelOf }: {
    name: string;
    label: string;
    options: ReadonlyArray<V>;
    value: V | '';
    onChange: (v: V) => void;
    labelOf: (v: V) => string;
}) {
    return (
        <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-foreground">{label}</legend>
            <div className="flex flex-wrap gap-2">
                {options.map(v => (
                    <label
                        key={v}
                        className={cn(
                            'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-foreground transition-colors focus-within:ring-2 focus-within:ring-primary/40 sm:min-h-9',
                            value === v ? 'border-primary/50 bg-info-subtle' : 'border-border hover:border-primary/30',
                        )}
                    >
                        <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="accent-primary" />
                        {labelOf(v)}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

const CHIP: Record<HypothesisVerdict, string> = {
    confirms: 'border-success/30 bg-success-subtle text-success-subtle-foreground',
    nuances: 'border-info/30 bg-info-subtle text-info-subtle-foreground',
    contradicts: 'border-warning/30 bg-warning-subtle text-warning-subtle-foreground',
};

/** El registro de la hipótesis, lo más reciente primero: fecha, fuente y veredicto. */
export function HypothesisLogList({ entries, studies }: { entries: ReadonlyArray<HypothesisEntry>; studies: ReadonlyArray<FramingStudy> }) {
    const { t, i18n } = useTranslation('projects');
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const fuente = (e: HypothesisEntry) => {
        // Lo del panorama lo propuso el asistente, no el texto: se rotula así.
        if (e.source === 'panorama') return t('framing.card.logPanorama');
        const s = studies.find(x => x.id === e.studyId);
        return t('framing.card.logStudy', { title: s ? studyLabel(s, lang) : t('framing.card.logStudyMissing') });
    };
    return (
        <ol className="divide-y divide-border/60 rounded-lg border border-border/60" data-testid="framing-log">
            {[...entries].reverse().map(e => (
                <li key={e.id} className="space-y-0.5 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span className="tabular-nums text-muted-foreground">{new Date(e.at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="text-foreground">{fuente(e)}</span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-xs', CHIP[e.verdict])}>{t(`framing.hypothesisVerdict.${e.verdict}`)}</span>
                    </div>
                    {e.note && <p className="text-xs leading-relaxed text-foreground/90">{e.note}</p>}
                </li>
            ))}
        </ol>
    );
}
