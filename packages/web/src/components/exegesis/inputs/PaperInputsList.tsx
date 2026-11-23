import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, CircleDashed, MinusCircle } from 'lucide-react';
import type { PaperInputKind, PaperInputMarks, PaperInputState, PaperInputStatus } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

const ICONO: Record<PaperInputState, typeof CheckCircle2> = {
    listo: CheckCircle2, revisar: AlertCircle, falta: CircleDashed, 'no-aplica': MinusCircle,
};
const TONO: Record<PaperInputState, string> = {
    listo: 'text-success',
    revisar: 'text-warning-subtle-foreground',
    falta: 'text-warning-subtle-foreground',
    'no-aplica': 'text-muted-foreground',
};

/**
 * Las entradas del trabajo, en el orden del procedimiento: el plazo primero.
 * Cada fila dice su estado con ícono Y texto (no solo color), por qué, y qué
 * puede hacer el autor: marcarla «no aplica», darla por leída o escribir la
 * nota de clase.
 */
export function PaperInputsList({ statuses, marks, saving, onSaveMarks }: {
    statuses: ReadonlyArray<PaperInputStatus>;
    marks: PaperInputMarks;
    saving: boolean;
    onSaveMarks: (marks: PaperInputMarks) => Promise<unknown>;
}) {
    const { t } = useTranslation('exegesis');
    const marcar = async (kind: PaperInputKind, mark: 'no-aplica' | 'leida' | null, note?: string) => {
        const next: PaperInputMarks = { ...marks };
        if (mark) next[kind] = { mark, ...(note ? { note } : {}), at: new Date().toISOString() };
        else delete next[kind];
        try {
            await onSaveMarks(next);
        } catch (err) {
            console.error('[inputs] no se pudo guardar la marca', err);
            toast.error(t('inputs.saveFailed'));
        }
    };
    return (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="entradas">
            {statuses.map(s => (
                <InputRow key={s.kind} status={s} saving={saving} onMark={marcar} />
            ))}
        </ol>
    );
}

function InputRow({ status, saving, onMark }: {
    status: PaperInputStatus;
    saving: boolean;
    onMark: (kind: PaperInputKind, mark: 'no-aplica' | 'leida' | null, note?: string) => void;
}) {
    const { t, i18n } = useTranslation('exegesis');
    const Icono = ICONO[status.state];
    const detalle = status.kind === 'plazo' && status.detail ? fechaLegible(status.detail, i18n.language) : status.detail ?? '';
    const [nota, setNota] = useState(status.mark?.note ?? '');
    const esClase = status.kind === 'clase';
    const marcada = status.mark?.mark;
    return (
        <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start" data-testid={`entrada-${status.kind}`}>
            <Icono className={cn('mt-0.5 h-4 w-4 shrink-0', TONO[status.state])} aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">
                    {t(`inputs.kind.${status.kind}`)}
                    <span className={cn('ml-2 text-xs font-normal', TONO[status.state])}>
                        {t(`inputs.state.${status.state}`)}
                    </span>
                    {!status.required && <span className="ml-2 text-xs font-normal text-muted-foreground">{t('inputs.optional')}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                    {t(reasonKey(status), { count: status.count ?? 0, detail: detalle })}
                </p>
                {esClase && (
                    <div className="space-y-1.5 pt-1">
                        <label htmlFor="nota-de-clase" className="sr-only">{t('inputs.classNote.label')}</label>
                        <textarea
                            id="nota-de-clase"
                            value={nota}
                            onChange={e => setNota(e.target.value)}
                            rows={3}
                            maxLength={4000}
                            placeholder={t('inputs.classNote.placeholder')}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <button
                            type="button"
                            disabled={saving || nota.trim() === (status.mark?.note ?? '').trim()}
                            onClick={() => onMark('clase', nota.trim() ? 'leida' : null, nota.trim())}
                            className="min-h-9 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                            {t('inputs.classNote.save')}
                        </button>
                    </div>
                )}
            </div>
            {!esClase && (
                <div className="flex shrink-0 gap-2 sm:pt-0.5">
                    {status.state === 'revisar' && (
                        <MarkButton disabled={saving} onClick={() => onMark(status.kind, 'leida')}>{t('inputs.action.read')}</MarkButton>
                    )}
                    {status.state === 'falta' && (
                        <MarkButton disabled={saving} onClick={() => onMark(status.kind, 'no-aplica')}>{t('inputs.action.notApplicable')}</MarkButton>
                    )}
                    {marcada && (
                        <MarkButton disabled={saving} onClick={() => onMark(status.kind, null)}>{t('inputs.action.undo')}</MarkButton>
                    )}
                </div>
            )}
        </li>
    );
}

/** `2026-11-25` → «25 de noviembre de 2026». Al mediodía: la fecha local no salta de día. */
function fechaLegible(iso: string, lang: string | undefined): string {
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang?.startsWith('en') ? 'en' : 'es', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** «Marcada» y «leída» valen para toda entrada; lo demás es propio de cada una. */
function reasonKey(s: PaperInputStatus): string {
    if (s.reason === 'marked') return 'inputs.reason.marked';
    if (s.reason === 'marked-read') return 'inputs.reason.markedRead';
    return `inputs.reason.${s.kind}.${s.reason}`;
}

function MarkButton({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="min-h-9 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
            {children}
        </button>
    );
}
