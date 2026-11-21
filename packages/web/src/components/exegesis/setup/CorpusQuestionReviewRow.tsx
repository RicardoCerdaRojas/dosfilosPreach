import { Loader2, Pin, Plus } from 'lucide-react';
import {
    printedLabelForSheet,
    type QuestionReviewRow,
    type QuestionSheet,
    type QuestionSourceCheck,
    type QuestionSourceCoverage,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import type { ReviewedSource } from '@/hooks/exegesis/useCorpusQuestionReview';
import { QuestionUncoveredSources } from './QuestionUncoveredSources';

/**
 * Una pregunta de «¿Qué responde cada pregunta?» con sus hojas por fuente, y la
 * ficha de cada hoja. Sale de `CorpusQuestionReviewCard` (fase «Asistente del
 * corpus», A3) para que la tarjeta no pase de su tamaño.
 */

type T = ReturnType<typeof useTranslation>['t'];

/** «p. 133» si la hoja tiene página impresa; «h. 411» si no. */
export function pageLabel(t: T, fuente: ReviewedSource | undefined, sheet: number): string {
    const impresa = fuente ? printedLabelForSheet(sheet, fuente.resource.pageNumbering, null) : null;
    return impresa
        ? t('paperSetup.subSteps.corpus.questionReview.page', { page: impresa })
        : t('paperSetup.subSteps.corpus.questionReview.sheet', { sheet });
}

/** Por qué una hoja que no nombra el versículo toca la pregunta. */
function viaLabel(t: T, via: Extract<QuestionSourceCoverage['via'], 'section' | 'passage'>): string {
    return t(`paperSetup.subSteps.corpus.questionReview.via.${via}`);
}

export function QuestionItem({
    row,
    versiculos,
    sinAporte,
    nombre,
    sources,
    ocupada,
    onPin,
}: {
    row: QuestionReviewRow;
    versiculos: string;
    /** Las fuentes que no aportan a la pregunta, con su porqué (TP #9, B21). */
    sinAporte: ReadonlyArray<QuestionSourceCheck>;
    nombre: (id: string) => string;
    sources: ReadonlyMap<string, ReviewedSource>;
    ocupada: string | null;
    onPin: (sourceId: string, sheets: ReadonlyArray<number>, questions: ReadonlyArray<number>, pin?: boolean) => void;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <li className="space-y-1.5">
            <p className="text-[12px] font-medium text-foreground">
                {t('paperSetup.subSteps.corpus.questionReview.questionHeading', { number: row.number, verses: versiculos })}
            </p>
            <p className="text-[11px] text-muted-foreground line-clamp-2">{row.text}</p>
            {row.sources.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">
                    {t('paperSetup.subSteps.corpus.questionReview.noSource')}
                </p>
            ) : (
                <ul className="space-y-1">
                    {row.sources.map(cov => (
                        <li key={`${cov.sourceId}-${cov.via}-${cov.term ?? ''}`} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-medium text-foreground">
                                {nombre(cov.sourceId)}
                                {cov.term && <span className="font-normal text-muted-foreground"> · {cov.term}</span>}
                                {(cov.via === 'section' || cov.via === 'passage') && (
                                    <span className="font-normal text-muted-foreground"> · {viaLabel(t, cov.via)}</span>
                                )}
                            </span>
                            {cov.sheets.map(h => (
                                <SheetChip
                                    key={h.sheet}
                                    sheet={h}
                                    label={pageLabel(t, sources.get(cov.sourceId), h.sheet)}
                                    busy={ocupada === `${cov.sourceId}:${h.sheet}`}
                                    disabled={ocupada !== null}
                                    onToggle={() => onPin(cov.sourceId, [h.sheet], [row.number], !h.stepPinned)}
                                />
                            ))}
                        </li>
                    ))}
                </ul>
            )}
            <QuestionUncoveredSources checks={sinAporte} nombre={nombre} />
        </li>
    );
}

/**
 * Una hoja que toca la pregunta. Fijada para todo el trabajo: no hace nada.
 * Fijada para esta pregunta: se suelta. En el corpus o afuera: se fija para
 * esta pregunta.
 */
function SheetChip({
    sheet,
    label,
    busy,
    disabled,
    onToggle,
}: {
    sheet: QuestionSheet;
    label: string;
    busy: boolean;
    disabled: boolean;
    onToggle: () => void;
}) {
    const { t } = useTranslation('exegesis');
    const base = 'paperSetup.subSteps.corpus.questionReview.chip';
    const clave = sheet.stepPinned ? 'stepPinned' : sheet.state === 'in-corpus' ? 'inCorpus' : sheet.state;
    const estado = t(`${base}.${clave}`, { page: label });
    if (sheet.stepPinned) {
        return (
            <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                title={estado}
                aria-label={estado}
                aria-pressed
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10.5px] text-foreground transition-colors hover:bg-primary/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden /> : <Pin className="h-2.5 w-2.5" aria-hidden />}
                {label}
            </button>
        );
    }
    if (sheet.state === 'pinned') {
        return (
            <span
                className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info-subtle px-1.5 py-0.5 text-[10.5px] text-info-subtle-foreground"
                title={estado}
            >
                <Pin className="h-2.5 w-2.5" aria-hidden />
                {label}
            </span>
        );
    }
    const afuera = sheet.state === 'outside';
    return (
        <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            title={estado}
            aria-label={estado}
            aria-pressed={false}
            className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                afuera
                    ? 'border-dashed border-warning/50 text-warning-subtle-foreground hover:bg-warning-subtle'
                    : 'border-border text-foreground hover:bg-accent',
            )}
        >
            {busy
                ? <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
                : afuera ? <Plus className="h-2.5 w-2.5" aria-hidden /> : <Pin className="h-2.5 w-2.5 opacity-50" aria-hidden />}
            {label}
        </button>
    );
}
