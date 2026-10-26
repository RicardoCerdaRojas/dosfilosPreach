import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, NotebookPen, Plus } from 'lucide-react';
import {
    formatPassageForReader,
    isEmptySermonPlaceholder,
    plannerBookForProject,
    type AIProject,
    type DeskPericopeRow,
    type DeskPhase,
    type DeskReadingState,
    type DeskSermonInput,
    type DeskStudy,
    type DeskStudyCell,
    type ExegeticalDesk,
    type PericopeSermonState,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { DeskSection, EmptyState, FOCUS_RING, LaterPhase, StatusChip, TOUCH, WRAP_LABEL, deskSectionId, formatDeskDay, useDeskText } from '../primitives';
import { planSeriesUrl } from '../../ProjectSeriesSection';

/** La celda de sermón de una fila: estado y adónde lleva. */
type SermonCell = { state: PericopeSermonState; id: string | null };

/** Una fila de la mesa, de la serie o fuera de ella. */
export interface TableRow {
    key: string;
    position: number | null;
    label: string;
    title: string;
    date: string | null;
    study: DeskStudyCell;
    reading: DeskReadingState;
    sermon: SermonCell | null;
}

export type TableFilter = 'all' | 'pending';

/**
 * Pendiente: falta estudiar la perícopa (no está ensamblada) o anotar en tu
 * lectura lo que dice su estudio ensamblado. El sermón no cuenta: el método
 * del escritorio llega hasta la síntesis, y quien enseña no predica.
 */
export function isPendingRow(row: Pick<TableRow, 'study' | 'reading'>): boolean {
    return row.study.state !== 'assembled' || row.reading === 'pending';
}

/** Un estudio fuera de la serie, como fila. Su sermón, por el estudio de origen. */
export function looseRow(study: DeskStudy, sermons: ReadonlyArray<DeskSermonInput> | undefined, lang: 'es' | 'en'): TableRow {
    let sermon: SermonCell | null = null;
    if (sermons) {
        const delEstudio = sermons.filter(s => s.sourcePaperId === study.id && s.status !== 'archived' && !isEmptySermonPlaceholder(s));
        const publicado = delEstudio.find(s => s.status === 'published');
        sermon = publicado ? { state: 'published', id: publicado.id } : delEstudio[0] ? { state: 'draft', id: delEstudio[0].id } : { state: 'none', id: null };
    }
    return {
        key: `suelto:${study.id}`,
        position: null,
        label: study.title || formatPassageForReader(study.passage, lang),
        title: study.title ? formatPassageForReader(study.passage, lang) : '',
        date: null,
        study: { id: study.id, state: study.state, accepted: study.accepted, total: study.total },
        reading: study.annotated ? 'annotated' : study.state === 'assembled' ? 'pending' : 'none',
        sermon,
    };
}

function seriesRow(r: DeskPericopeRow, sermonsFailed = false): TableRow {
    return {
        key: r.plannedId,
        position: r.position,
        label: r.label,
        title: r.title && r.title !== r.label ? r.title : '',
        date: r.date,
        study: r.study,
        reading: r.reading,
        // Sin los sermones, «sin sermón» sería falso: la celda dice «—».
        sermon: sermonsFailed ? null : { state: r.sermon, id: r.sermonId },
    };
}

/**
 * El filtro se recuerda POR PROYECTO: «Pendientes» en Esdras no debe
 * esconder filas al abrir Jonás.
 */
export const tableFilterKey = (projectId: string) => `desk.exegetical.tableFilter.${projectId}`;

export function readTableFilter(projectId: string): TableFilter {
    try {
        return window.localStorage.getItem(tableFilterKey(projectId)) === 'pending' ? 'pending' : 'all';
    } catch {
        return 'all';
    }
}

function guardarFiltro(projectId: string, f: TableFilter) {
    try { window.localStorage.setItem(tableFilterKey(projectId), f); } catch { /* sin almacenamiento: el filtro vale solo aquí */ }
}

interface PericopeTableProps {
    project: Pick<AIProject, 'id' | 'bibliographyCriteria'>;
    desk: ExegeticalDesk;
    division: DeskPhase | undefined;
    pericopes: DeskPhase | undefined;
    /** Todos los estudios del proyecto (el libro para el planificador). */
    studies: ReadonlyArray<DeskStudy>;
    /** Los sermones del usuario, si el panel los tiene: la copia publicada y los de los estudios sueltos. */
    sermons?: ReadonlyArray<DeskSermonInput>;
    /** Los sermones no se pudieron leer: la columna dice «—» y se avisa. */
    sermonsFailed?: boolean;
    /** La fase 3 es posterior a la activa y no hay nada en la mesa: una línea, sin acción. */
    later?: boolean;
    onAnnotate: (studyId: string) => void;
    onNavigate: (to: string) => void;
}

/**
 * Fases 3 y 4 · «La mesa de perícopas»: una fila por perícopa planificada,
 * agrupada por serie, con su estudio (su avance real), tu lectura (anotada o
 * por anotar) y su sermón; después, los estudios fuera de la serie. En el
 * teléfono cada fila es una tarjeta. Sin serie, la invitación a dividir.
 */
export function PericopeTable({ project, desk, division, pericopes, studies, sermons, sermonsFailed = false, later = false, onAnnotate, onNavigate }: PericopeTableProps) {
    const { t, i18n } = useTranslation('projectDeskExegetical');
    const deskText = useDeskText();
    const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
    const [filtro, setFiltro] = useState<TableFilter>(() => readTableFilter(project.id));
    // El mismo panel puede pasar a otro proyecto sin desmontarse.
    useEffect(() => { setFiltro(readTableFilter(project.id)); }, [project.id]);
    const elegir = (f: TableFilter) => { setFiltro(f); guardarFiltro(project.id, f); };

    const conSerie = desk.series.length > 0;
    const sueltos = desk.looseStudies.map(s => looseRow(s, sermons, lang));
    const vacia = !conSerie && sueltos.length === 0;
    const planificar = () => onNavigate(planSeriesUrl(project.id, plannerBookForProject(project, studies)));
    const nuevoEstudio = () => onNavigate(`/dashboard/exegesis/new?projectId=${encodeURIComponent(project.id)}`);
    const from = `/dashboard/projects/${project.id}`;

    // La copia publicada abre en lugar del borrador del plan.
    const publicadoDe = (id: string) => sermons?.find(s => s.status === 'published' && s.sourceSermonId === id)?.id ?? id;

    const estado = (fase: DeskPhase | undefined, nombre: string) => fase && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium text-foreground">{nombre}</span>
            <StatusChip status={fase.status} loading={fase.loading} />
            <span className="text-[13px] text-muted-foreground">{deskText(fase.evidence)}</span>
        </div>
    );

    const celdaEstudio = (r: TableRow) => {
        const texto = r.study.state === 'none'
            ? t('table.study.none')
            : r.study.state === 'notStarted'
                ? t('table.study.notStarted')
                : r.study.state === 'inProgress'
                    ? t('table.study.inProgress', { done: r.study.accepted, total: r.study.total })
                    : t('table.study.assembled');
        if (!r.study.id) return <span className="text-muted-foreground">{texto}</span>;
        return (
            // Con `?from=` (no solo en el estado): la vuelta sobrevive a otra pestaña.
            <Link
                to={`/dashboard/exegesis/${encodeURIComponent(r.study.id)}?from=${encodeURIComponent(from)}`}
                className={cn('inline-flex items-center rounded-sm text-foreground underline-offset-2 hover:text-primary-text hover:underline', TOUCH, FOCUS_RING)}
                aria-label={t('table.study.open', { label: r.label, state: texto })}
            >
                {texto}
            </Link>
        );
    };

    const celdaLectura = (r: TableRow) => {
        if (r.reading === 'annotated') {
            return (
                <span className="inline-flex items-center gap-1 text-foreground">
                    <Check className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{t('table.reading.annotated')}
                </span>
            );
        }
        if (r.reading === 'pending' && r.study.id) {
            const id = r.study.id;
            return (
                <span className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground">{t('table.reading.pending')}</span>
                    <Button size="sm" variant="outline" className={TOUCH} onClick={() => onAnnotate(id)} aria-label={t('table.reading.annotateLabel', { label: r.label })}>
                        <NotebookPen className="h-3.5 w-3.5" aria-hidden />{t('table.reading.annotate')}
                    </Button>
                </span>
            );
        }
        return <span className="text-muted-foreground">{t('table.reading.none')}</span>;
    };

    const celdaSermon = (r: TableRow) => {
        if (!r.sermon) return <span className="text-muted-foreground">—</span>;
        const texto = t(`table.sermon.${r.sermon.state}`);
        if (!r.sermon.id || r.sermon.state === 'none') return <span className="text-muted-foreground">{texto}</span>;
        const destino = r.sermon.state === 'published'
            ? `/dashboard/sermons/${publicadoDe(r.sermon.id)}`
            : `/dashboard/sermons/generate?id=${encodeURIComponent(r.sermon.id)}`;
        return (
            <Link to={destino} className={cn('inline-flex items-center rounded-sm text-foreground underline-offset-2 hover:text-primary-text hover:underline', TOUCH, FOCUS_RING)}>
                {texto}
            </Link>
        );
    };

    /** Columnas de la mesa: en pantalla ancha, una grilla; en el teléfono, una tarjeta con rótulos. */
    const COLS = 'sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] sm:items-center sm:gap-4';
    const rotulo = 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:sr-only';

    const filas = (rows: TableRow[]) => {
        const visibles = filtro === 'pending' ? rows.filter(isPendingRow) : rows;
        if (visibles.length === 0) return <p className="px-1 py-2 text-[13px] text-muted-foreground">{t('table.nothingPending')}</p>;
        return (
            <ol className="space-y-2 sm:space-y-0 sm:divide-y sm:divide-border/60">
                {visibles.map(r => (
                    <li key={r.key} data-testid="desk-table-row" className={cn('space-y-2 rounded-lg border border-border p-3 text-[13px] sm:space-y-0 sm:rounded-none sm:border-0 sm:px-1 sm:py-2', COLS)}>
                        <div className="flex min-w-0 gap-2">
                            {r.position !== null && <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>{r.position}</span>}
                            <div className="min-w-0">
                                {/* En el teléfono, dos líneas antes de cortar; en la grilla, una. */}
                                <p className="line-clamp-2 break-words font-medium text-foreground sm:line-clamp-none sm:truncate" title={r.title || undefined}>{r.label}</p>
                                {(r.title || r.date) && (
                                    <p className="line-clamp-2 break-words text-xs text-muted-foreground sm:line-clamp-none sm:truncate">
                                        {[r.title, r.date ? formatDeskDay(r.date, lang) : null].filter(Boolean).join(' · ')}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:block">
                            <span className={rotulo}>{t('table.columns.study')}</span>
                            {celdaEstudio(r)}
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:block">
                            <span className={rotulo}>{t('table.columns.reading')}</span>
                            {celdaLectura(r)}
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:block">
                            <span className={rotulo}>{t('table.columns.sermon')}</span>
                            {celdaSermon(r)}
                        </div>
                    </li>
                ))}
            </ol>
        );
    };

    const encabezado = (
        <div className={cn('hidden px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground', COLS)} aria-hidden>
            <span>{t('table.columns.pericope')}</span>
            <span>{t('table.columns.study')}</span>
            <span>{t('table.columns.reading')}</span>
            <span>{t('table.columns.sermon')}</span>
        </div>
    );

    const filtroBotones = !vacia && (
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label={t('table.filter.label')}>
            {(['pending', 'all'] as const).map(f => (
                <button
                    key={f}
                    type="button"
                    aria-pressed={filtro === f}
                    onClick={() => elegir(f)}
                    className={cn(
                        'rounded px-3 py-1 text-[13px] transition-colors',
                        TOUCH, FOCUS_RING,
                        filtro === f ? 'bg-accent font-medium text-accent-foreground' : 'text-foreground hover:bg-accent/60',
                    )}
                >
                    {t(`table.filter.${f}`)}
                </button>
            ))}
        </div>
    );

    if (vacia && later) {
        return (
            <div id={deskSectionId('division')} className="scroll-mt-4">
                <LaterPhase
                    id={deskSectionId('pericopes')}
                    eyebrow={t('table.eyebrow')}
                    title={t('table.title')}
                    reason={t('later.division')}
                    data-testid="desk-section-table"
                />
            </div>
        );
    }

    return (
        // La fase 3 salta aquí también: la mesa es su sección.
        <div id={deskSectionId('division')} className="scroll-mt-4">
            <DeskSection
                id={deskSectionId('pericopes')}
                eyebrow={t('table.eyebrow')}
                title={t('table.title')}
                description={t('table.description')}
                data-testid="desk-section-table"
                actions={(
                    <>
                        {filtroBotones}
                        {conSerie && (
                            <Button size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL)} onClick={planificar}>
                                <Plus className="h-3.5 w-3.5" aria-hidden />{t('table.planAnother')}
                            </Button>
                        )}
                        {(conSerie || sueltos.length > 0) && (
                            <Button size="sm" variant="outline" className={cn(TOUCH, WRAP_LABEL)} onClick={nuevoEstudio}>
                                <Plus className="h-3.5 w-3.5" aria-hidden />{t(conSerie ? 'table.addOutside' : 'table.newStudy')}
                            </Button>
                        )}
                    </>
                )}
                isEmpty={false}
            >
                <div className="space-y-4">
                    <div className="space-y-1.5" data-testid="desk-table-phases">
                        {estado(division, t('table.phase.division'))}
                        {estado(pericopes, t('table.phase.pericopes'))}
                    </div>

                    {sermonsFailed && (
                        <p className="text-[13px] text-muted-foreground" role="status">{t('table.sermonsError')}</p>
                    )}

                    {!conSerie && desk.framing.divisionWithoutSeries && (
                        <p className="text-[13px] text-muted-foreground">{t('table.withoutSeries')}</p>
                    )}

                    {!conSerie && !desk.framing.divisionWithoutSeries && (
                        <EmptyState
                            title={t('table.noSeriesTitle')}
                            action={(
                                <Button size="sm" variant="outline" className={TOUCH} onClick={planificar}>
                                    {t('table.planSeries')}
                                </Button>
                            )}
                        >
                            {t('table.noSeries')}
                        </EmptyState>
                    )}

                    {vacia && (
                        <p className="text-[13px] text-muted-foreground">
                            {t('table.orStudy')}{' '}
                            <button type="button" onClick={nuevoEstudio} className={cn('rounded-sm text-primary-text underline underline-offset-2', TOUCH, FOCUS_RING)}>
                                {t('table.newStudy')}
                            </button>
                        </p>
                    )}

                    {desk.series.map(g => (
                        <section key={g.seriesId} className="space-y-2" aria-labelledby={`desk-series-${g.seriesId}`} data-testid="desk-table-group">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                <h3 id={`desk-series-${g.seriesId}`} className="text-sm font-semibold text-foreground">
                                    <Link to={`/dashboard/plans/${g.seriesId}`} className={cn('rounded-sm underline-offset-2 hover:text-primary-text hover:underline', FOCUS_RING)}>
                                        {g.title || t('table.untitledSeries')}
                                    </Link>
                                </h3>
                                <span className="text-xs text-muted-foreground">
                                    {t('table.groupCounts', { done: g.counts.assembled, total: g.counts.units, annotated: g.counts.annotated })}
                                </span>
                            </div>
                            {encabezado}
                            {filas(g.rows.map(r => seriesRow(r, sermonsFailed)))}
                        </section>
                    ))}

                    {sueltos.length > 0 && (
                        <section className="space-y-2" aria-labelledby={`desk-loose-${project.id}`} data-testid="desk-table-loose">
                            <h3 id={`desk-loose-${project.id}`} className="text-sm font-semibold text-foreground">
                                {t(conSerie ? 'table.looseTitle' : 'table.studiesTitle')}
                            </h3>
                            {encabezado}
                            {filas(sueltos)}
                        </section>
                    )}
                </div>
            </DeskSection>
        </div>
    );
}
