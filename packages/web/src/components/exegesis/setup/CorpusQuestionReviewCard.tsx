import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle, Loader2, Pin, Plus } from 'lucide-react';
import {
    printedLabelForSheet,
    uncoveredSourcesOfRow,
    type CorpusReviewWarning,
    type QuestionSourceCheck,
    type ExegeticalPaper,
    type QuestionReviewRow,
    type QuestionSheet,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { rutaCalibracion } from '@/lib/rutaCalibracion';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useCorpusQuestionReview, type ReviewedSource } from '@/hooks/exegesis/useCorpusQuestionReview';
import { SinPasoError, usePinSheetsForQuestion } from '@/hooks/exegesis/usePinSheetsForQuestion';
import { nombreCortoDeFuente } from '../corpus-plan/nombreCortoDeFuente';
import { QuestionUncoveredSources } from './QuestionUncoveredSources';

/**
 * «¿Qué responde cada pregunta?» (TP #8, fase 8a, A4).
 *
 * La pieza que previene: antes de gastar en el análisis, dice por pregunta qué
 * hojas de cada fuente la tratan y si están en el corpus, y avisa lo que falta
 * con su arreglo a un click. En el TP #8 la nota de Mayor sobre 4:3 y la mitad
 * de la entrada de μέλος en Tuggy faltaban, y se supo recién cuando el
 * verificador no encontraba las citas.
 *
 * Va en el Corpus y en el Plan de uso. No renderiza nada sin preguntas con
 * versículos del pasaje (un encuadre para predicar, o un pasaje de varios
 * capítulos): no hay contra qué revisar.
 */
export function CorpusQuestionReviewCard({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const navigate = useNavigate();
    const { review, sources, failed, unindexed, isLoading } = useCorpusQuestionReview(paper);
    const { removeSource } = useExegesisPapers();
    const fijarParaPregunta = usePinSheetsForQuestion(paper);
    const [abierta, setAbierta] = useState(false);
    const [ocupada, setOcupada] = useState<string | null>(null);
    // Quitar pide un segundo clic: no hay deshacer, y la fuente pierde su rol,
    // su clave y lo fijado (revisión de 8a).
    const [porQuitar, setPorQuitar] = useState<string | null>(null);

    if (!review || review.rows.length === 0 || sources.size === 0) return null;

    const chapter = paper.passage.chapterStart;
    const nombre = (sourceId: string) => {
        const f = sources.get(sourceId);
        return f ? nombreCortoDeFuente(f.source) : sourceId;
    };
    const paginas = (sourceId: string, sheets: ReadonlyArray<number>) =>
        sheets.map(s => pageLabel(t, sources.get(sourceId), s)).join(', ');
    const versiculos = (verses: ReadonlyArray<number>) => verses.map(v => `${chapter}:${v}`).join(', ');
    const fila = (question: number) => review.rows.find(r => r.number === question);

    // Fija para los pasos de esas preguntas, y solo para ellos (PR 2): fijar en la
    // receta hacía viajar la hoja a todos los pasos.
    const fijar = async (sourceId: string, sheets: ReadonlyArray<number>, questions: ReadonlyArray<number>, pin = true) => {
        if (!sources.get(sourceId)) return;
        setOcupada(`${sourceId}:${sheets.join(',')}`);
        try {
            await fijarParaPregunta.run(sourceId, questions, sheets, pin);
            toast.success(t(`paperSetup.subSteps.corpus.questionReview.toast.${pin ? 'pinnedForQuestion' : 'releasedForQuestion'}`, {
                pages: paginas(sourceId, sheets),
                source: nombre(sourceId),
                count: questions.length,
                questions: questions.join(', '),
            }));
        } catch (err) {
            console.error('[CorpusQuestionReviewCard] no se pudo fijar', err);
            toast.error(t(err instanceof SinPasoError
                ? 'paperSetup.subSteps.corpus.questionReview.toast.noStep'
                : 'paperSetup.subSteps.corpus.questionReview.toast.addFailed', { count: questions.length, questions: questions.join(', ') }));
        } finally {
            setOcupada(null);
        }
    };

    const quitar = async (sourceId: string) => {
        if (porQuitar !== sourceId) { setPorQuitar(sourceId); return; }
        setPorQuitar(null);
        setOcupada(`quitar:${sourceId}`);
        try {
            await removeSource.mutateAsync({ paperId: paper.id, sourceId });
            toast.success(t('paperSetup.subSteps.corpus.toast.removed'));
        } catch (err) {
            console.error('[CorpusQuestionReviewCard] no se pudo quitar', err);
            toast.error(t('paperSetup.subSteps.corpus.toast.removeFailed'));
        } finally {
            setOcupada(null);
        }
    };

    const avisos = review.warnings;
    const noRevisadas = failed.length + unindexed.length;
    const conAvisos = avisos.length > 0 || noRevisadas > 0;

    return (
        <section
            className="rounded-lg border border-border bg-card p-4 space-y-3"
            aria-labelledby="revision-por-pregunta"
            data-testid="revision-por-pregunta"
        >
            <header className="flex items-start gap-3">
                {isLoading
                    ? <Loader2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0 animate-spin" aria-hidden />
                    : conAvisos
                        ? <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" aria-hidden />
                        : <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" aria-hidden />}
                <div className="flex-1 min-w-0">
                    <h3 id="revision-por-pregunta" className="text-sm font-semibold text-foreground">
                        {t('paperSetup.subSteps.corpus.questionReview.title')}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isLoading
                            ? t('paperSetup.subSteps.corpus.questionReview.loading', { count: review.pending.length - noRevisadas })
                            : conAvisos
                                ? t('paperSetup.subSteps.corpus.questionReview.withWarnings', { count: avisos.length + noRevisadas })
                                : t('paperSetup.subSteps.corpus.questionReview.allGood')}
                    </p>
                </div>
            </header>

            {conAvisos && (
                <ul className="space-y-1.5">
                    {avisos.map((w, i) => (
                        <WarningItem
                            key={`${w.kind}-${i}`}
                            warning={w}
                            texto={textoDelAviso(t, w, { nombre, paginas, versiculos, fila })}
                            ocupada={ocupada}
                            confirmingRemove={'sourceId' in w && porQuitar === w.sourceId}
                            onPin={fijar}
                            onRemove={quitar}
                            onCalibrate={sourceId => {
                                const f = sources.get(sourceId);
                                if (f) navigate(rutaCalibracion(f.resourceId));
                            }}
                        />
                    ))}
                    {failed.map(sourceId => (
                        <li key={`fallo-${sourceId}`} className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[11.5px] text-muted-foreground">
                            {t('paperSetup.subSteps.corpus.questionReview.warning.failed', { source: nombre(sourceId) })}
                        </li>
                    ))}
                    {unindexed.map(sourceId => (
                        <li key={`sin-indice-${sourceId}`} className="rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[11.5px] text-muted-foreground">
                            {t('paperSetup.subSteps.corpus.questionReview.warning.unindexed', { source: nombre(sourceId) })}
                        </li>
                    ))}
                </ul>
            )}

            <button
                type="button"
                onClick={() => setAbierta(v => !v)}
                aria-expanded={abierta}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {abierta ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                {t('paperSetup.subSteps.corpus.questionReview.byQuestion')}
            </button>

            {abierta && (
                <ol className="space-y-3">
                    {review.rows.map(row => (
                        <QuestionItem
                            key={row.number}
                            row={row}
                            versiculos={versiculos(row.verses)}
                            sinAporte={uncoveredSourcesOfRow(row, review, { unindexed, failed })}
                            nombre={nombre}
                            sources={sources}
                            ocupada={ocupada}
                            onPin={fijar}
                        />
                    ))}
                </ol>
            )}
        </section>
    );
}

type T = ReturnType<typeof useTranslation>['t'];

/** «p. 133» si la hoja tiene página impresa; «h. 411» si no. */
function pageLabel(t: T, fuente: ReviewedSource | undefined, sheet: number): string {
    const impresa = fuente ? printedLabelForSheet(sheet, fuente.resource.pageNumbering, null) : null;
    return impresa
        ? t('paperSetup.subSteps.corpus.questionReview.page', { page: impresa })
        : t('paperSetup.subSteps.corpus.questionReview.sheet', { sheet });
}

function textoDelAviso(
    t: T,
    w: CorpusReviewWarning,
    h: {
        nombre: (id: string) => string;
        paginas: (id: string, sheets: ReadonlyArray<number>) => string;
        versiculos: (verses: ReadonlyArray<number>) => string;
        fila: (question: number) => QuestionReviewRow | undefined;
    },
): string {
    const base = 'paperSetup.subSteps.corpus.questionReview.warning';
    switch (w.kind) {
        case 'unrelated':
            return t(`${base}.unrelated`, { source: h.nombre(w.sourceId) });
        case 'no-printed-pages':
            return t(`${base}.noPrintedPages`, { source: h.nombre(w.sourceId) });
        case 'missing-sheets':
            return t(`${base}.missingSheets`, {
                source: h.nombre(w.sourceId),
                count: w.questions.length,
                questions: w.questions.join(', '),
                verses: h.versiculos([...new Set(w.questions.flatMap(q => h.fila(q)?.verses ?? []))].sort((a, b) => a - b)),
                pages: h.paginas(w.sourceId, w.sheets),
            });
        case 'missing-entry':
            return t(w.whole ? `${base}.missingEntryWhole` : `${base}.missingEntry`, {
                source: h.nombre(w.sourceId),
                question: w.question,
                term: w.term,
                pages: h.paginas(w.sourceId, w.sheets),
            });
        case 'question-uncovered':
            return t(`${base}.questionUncovered`, {
                question: w.question,
                verses: h.versiculos(h.fila(w.question)?.verses ?? []),
            });
    }
}

function WarningItem({
    warning,
    texto,
    ocupada,
    confirmingRemove,
    onPin,
    onRemove,
    onCalibrate,
}: {
    warning: CorpusReviewWarning;
    texto: string;
    ocupada: string | null;
    confirmingRemove: boolean;
    onPin: (sourceId: string, sheets: ReadonlyArray<number>, questions: ReadonlyArray<number>) => void;
    onRemove: (sourceId: string) => void;
    onCalibrate: (sourceId: string) => void;
}) {
    const { t } = useTranslation('exegesis');
    const base = 'paperSetup.subSteps.corpus.questionReview.action';
    const informativo = warning.kind === 'question-uncovered';

    let accion: { label: string; run: () => void; clave: string } | null = null;
    if (warning.kind === 'missing-sheets' || warning.kind === 'missing-entry') {
        // Sin receta también: lo fijado para el paso se consulta igual (`effectiveScope`).
        const preguntas = warning.kind === 'missing-sheets' ? warning.questions : [warning.question];
        accion = {
            label: t(`${base}.pinForQuestion`, { count: preguntas.length }),
            run: () => onPin(warning.sourceId, warning.sheets, preguntas),
            clave: `${warning.sourceId}:${warning.sheets.join(',')}`,
        };
    } else if (warning.kind === 'unrelated') {
        accion = {
            label: t(confirmingRemove ? `${base}.removeConfirm` : `${base}.remove`),
            run: () => onRemove(warning.sourceId),
            clave: `quitar:${warning.sourceId}`,
        };
    } else if (warning.kind === 'no-printed-pages') {
        accion = { label: t(`${base}.calibrate`), run: () => onCalibrate(warning.sourceId), clave: `calibrar:${warning.sourceId}` };
    }

    return (
        <li
            className={cn(
                'rounded-md border px-2.5 py-2 flex items-start gap-2',
                informativo
                    ? 'border-border bg-muted/40'
                    : 'border-warning/30 bg-warning-subtle/40',
            )}
        >
            {informativo
                ? <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />}
            <p className={cn(
                'min-w-0 flex-1 text-[11.5px] leading-snug',
                informativo ? 'text-muted-foreground' : 'text-warning-subtle-foreground',
            )}>
                {texto}
            </p>
            {accion && (
                <button
                    type="button"
                    onClick={accion.run}
                    disabled={ocupada !== null}
                    className="shrink-0 inline-flex items-center gap-1 rounded border border-warning/40 px-2 py-1 text-[11px] font-medium text-warning-subtle-foreground hover:bg-warning-subtle disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {ocupada === accion.clave && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    {accion.label}
                </button>
            )}
        </li>
    );
}

function QuestionItem({
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
