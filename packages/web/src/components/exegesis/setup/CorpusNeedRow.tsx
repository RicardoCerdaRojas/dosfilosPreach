import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { CandidateStatus, CorpusNeed, NeedCandidate } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/** Cuántas candidatas se ven antes de «ver más»: el catálogo de un tipo puede traer diez. */
const VISIBLES = 4;

const TONO: Record<CandidateStatus, string> = {
    'en-corpus': 'text-success',
    tengo: 'text-success',
    'edicion-distinta': 'text-warning-subtle-foreground',
    'por-conseguir': 'text-info-subtle-foreground',
    sugerida: 'text-muted-foreground',
    excluida: 'text-muted-foreground',
    descartada: 'text-muted-foreground',
};

export interface NeedActions {
    onAddResource: (resourceId: string) => void;
    onPickType: (type: NonNullable<CorpusNeed['sourceType']>) => void;
    onMark: (key: string, mark: { status: 'por-conseguir' | 'descartada'; reason?: string } | null) => void;
    busy: boolean;
}

/** Una necesidad del corpus («Comentario crítico-técnico · 1 de 2») con sus candidatas. */
export function CorpusNeedRow({ need, actions }: { need: CorpusNeed; actions: NeedActions }) {
    const { t } = useTranslation('exegesis');
    const [abierta, setAbierta] = useState(!need.covered);
    const [todas, setTodas] = useState(false);
    const visibles = todas ? need.candidates : need.candidates.slice(0, VISIBLES);
    const titulo = need.kind === 'tipo'
        ? t(`sourceTypes.${need.sourceType}.label`)
        : t('corpusNeeds.reading', { title: need.title });
    return (
        <li className="py-3" data-testid={`necesidad-${need.id}`}>
            <div className="flex items-start gap-2">
                {need.covered
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-subtle-foreground" aria-hidden />}
                <button
                    type="button"
                    onClick={() => setAbierta(v => !v)}
                    aria-expanded={abierta}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                    <span className="text-sm font-medium text-foreground">{titulo}</span>
                    <span className={cn('ml-2 text-xs', need.covered ? 'text-success' : 'text-warning-subtle-foreground')}>
                        {t('corpusNeeds.count', { have: need.have, required: need.required })}
                    </span>
                    {!need.covered && need.withinReach > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">{t('corpusNeeds.withinReach', { count: need.withinReach })}</span>
                    )}
                    {abierta ? <ChevronDown className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : <ChevronRight className="ml-1 inline h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                </button>
                {need.kind === 'tipo' && need.sourceType && (
                    <button
                        type="button"
                        onClick={() => actions.onPickType(need.sourceType!)}
                        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Search className="h-3.5 w-3.5" aria-hidden />
                        {t('corpusNeeds.search')}
                    </button>
                )}
            </div>
            {abierta && (
                <div className="mt-2 space-y-1.5 pl-6">
                    {need.candidates.length === 0 && <p className="text-xs text-muted-foreground">{t('corpusNeeds.noCandidates')}</p>}
                    <ul className="space-y-1.5">
                        {visibles.map(c => <CandidateItem key={c.key} candidate={c} actions={actions} />)}
                    </ul>
                    {need.candidates.length > VISIBLES && (
                        <button type="button" onClick={() => setTodas(v => !v)} className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            {todas ? t('corpusNeeds.showLess') : t('corpusNeeds.showMore', { count: need.candidates.length - VISIBLES })}
                        </button>
                    )}
                </div>
            )}
        </li>
    );
}

function CandidateItem({ candidate: c, actions }: { candidate: NeedCandidate; actions: NeedActions }) {
    const { t } = useTranslation('exegesis');
    const [razon, setRazon] = useState<string | null>(null);
    const edicion = c.edition ? [c.edition.series, c.edition.publisher, c.edition.year].filter(Boolean).join(', ') : '';
    const apagada = c.status === 'excluida' || c.status === 'descartada';
    return (
        <li className={cn('rounded-md border border-border px-3 py-2', apagada && 'opacity-75')} data-testid={`candidata-${c.key}`}>
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                        <span className="italic">{c.title}</span>
                        {c.author && <span className="text-muted-foreground"> · {c.author}</span>}
                    </p>
                    {edicion && <p className="text-xs text-muted-foreground">{t('corpusNeeds.citedEdition', { edition: edicion })}</p>}
                </div>
                <span className={cn('text-xs font-medium', TONO[c.status])}>{t(`corpusNeeds.status.${c.status}`)}</span>
            </div>
            {c.status === 'edicion-distinta' && (
                <p className="mt-1 text-xs text-warning-subtle-foreground">{t('corpusNeeds.note.edition', { copy: c.copyYear ?? '—', cited: c.edition?.year ?? '—' })}</p>
            )}
            {c.noFolios && c.resourceId && <p className="mt-1 text-xs text-muted-foreground">{t('corpusNeeds.note.noFolios')}</p>}
            {c.status === 'excluida' && <p className="mt-1 text-xs text-muted-foreground">{t('corpusNeeds.note.excluded', { previous: c.excludedBy })}</p>}
            {c.status === 'descartada' && <p className="mt-1 text-xs text-muted-foreground">{t('corpusNeeds.note.discarded', { reason: c.reason })}</p>}
            <div className="mt-1.5 flex flex-wrap gap-2">
                {(c.status === 'tengo' || c.status === 'edicion-distinta') && c.resourceId && (
                    <Accion onClick={() => actions.onAddResource(c.resourceId!)} disabled={actions.busy}>{t('corpusNeeds.action.add')}</Accion>
                )}
                {c.status === 'sugerida' && razon === null && (
                    <>
                        <Accion onClick={() => actions.onMark(c.key, { status: 'por-conseguir' })} disabled={actions.busy}>{t('corpusNeeds.action.toAcquire')}</Accion>
                        <Accion onClick={() => setRazon('')} disabled={actions.busy}>{t('corpusNeeds.action.discard')}</Accion>
                    </>
                )}
                {(c.status === 'por-conseguir' || c.status === 'descartada') && (
                    <Accion onClick={() => actions.onMark(c.key, null)} disabled={actions.busy}>{t('corpusNeeds.action.undo')}</Accion>
                )}
            </div>
            {razon !== null && (
                <form
                    className="mt-1.5 flex gap-2"
                    onSubmit={e => { e.preventDefault(); if (razon.trim()) { actions.onMark(c.key, { status: 'descartada', reason: razon.trim() }); setRazon(null); } }}
                >
                    <label htmlFor={`razon-${c.key}`} className="sr-only">{t('corpusNeeds.reasonLabel')}</label>
                    <input
                        id={`razon-${c.key}`}
                        autoFocus
                        value={razon}
                        maxLength={300}
                        onChange={e => setRazon(e.target.value)}
                        placeholder={t('corpusNeeds.reasonPlaceholder')}
                        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <Accion type="submit" disabled={actions.busy || !razon.trim()}>{t('corpusNeeds.action.confirmDiscard')}</Accion>
                    <Accion onClick={() => setRazon(null)} disabled={false}>{t('corpusNeeds.action.cancel')}</Accion>
                </form>
            )}
        </li>
    );
}

function Accion({ children, onClick, disabled, type = 'button' }: { children: React.ReactNode; onClick?: () => void; disabled: boolean; type?: 'button' | 'submit' }) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className="min-h-8 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
            {children}
        </button>
    );
}
