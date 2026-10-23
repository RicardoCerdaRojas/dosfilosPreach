import { useState } from 'react';
import { BookOpen, Check, RotateCcw, Trash2, X } from 'lucide-react';
import {
    bibliographyAvailability,
    type BibliographyEvaluation,
    type ProjectBibliographyEntry,
    type ProjectWorkType,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { BibliographyEntryEditor, campo } from './BibliographyEntryEditor';

interface BibliographyEntryCardProps {
    entry: ProjectBibliographyEntry;
    suggested: BibliographyEvaluation;
    workTypes: ReadonlyArray<ProjectWorkType>;
    /** Los libros de la biblioteca, para ligar una obra por conseguir. */
    library: ReadonlyArray<{ id: string; title: string }>;
    onChange: (patch: Partial<ProjectBibliographyEntry>) => void;
    onRemove: () => void;
}

/**
 * Una ficha del estado del arte: quién es, de dónde salió, cómo está, y lo
 * que se puede hacer según su paso (aprobar, descartar con razón, volver a
 * candidata, ligar el libro cuando se consigue, marcarla leída).
 */
export function BibliographyEntryCard({ entry, suggested, workTypes, library, onChange, onRemove }: BibliographyEntryCardProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const [abierta, setAbierta] = useState(false);
    const [descartando, setDescartando] = useState(false);
    const [razon, setRazon] = useState(entry.reason ?? '');
    const [ligando, setLigando] = useState(false);
    const disponible = bibliographyAvailability(entry);
    const ahora = () => new Date().toISOString();
    // Al decidir, lo que la biblioteca sabía queda guardado como evaluación.
    const decidir = (decision: ProjectBibliographyEntry['decision'], extra: Partial<ProjectBibliographyEntry> = {}) =>
        onChange({ decision, decidedAt: ahora(), evaluation: { ...suggested, ...(entry.evaluation ?? {}) }, ...extra });

    return (
        <li className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-start gap-2 px-3 py-2">
                <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">{entry.title || t('stateOfArt.untitled')}</p>
                    <p className="text-[11px] text-muted-foreground">
                        {[entry.author, entry.sourceType ? tx(`sourceTypes.${entry.sourceType}.label`) : t('stateOfArt.unclassified')].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground">{t(`stateOfArt.weight.${entry.weight}`)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${disponible === 'in-library' ? 'border-success/40 text-success-subtle-foreground' : 'border-warning/40 text-warning-subtle-foreground'}`}>
                            {t(`stateOfArt.availability.${disponible}`)}
                        </span>
                        {entry.origins.map(o => (
                            <span key={o} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground">{t(`stateOfArt.origin.${o}`)}</span>
                        ))}
                        {entry.read && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground">{t('stateOfArt.read')}</span>}
                    </div>
                    {entry.decision === 'discarded' && entry.reason && <p className="text-xs text-muted-foreground">{t('stateOfArt.discardedBecause', { reason: entry.reason })}</p>}
                    {entry.annotation?.serves && entry.decision !== 'discarded' && <p className="text-xs text-muted-foreground">{entry.annotation.serves}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                    {entry.decision !== 'approved' && (
                        <Button size="sm" variant="outline" onClick={() => decidir('approved')}>
                            <Check className="mr-1 h-3.5 w-3.5" />{t('stateOfArt.approve')}
                        </Button>
                    )}
                    {entry.decision === 'discarded' ? (
                        <Button size="sm" variant="ghost" onClick={() => decidir('candidate')}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />{t('stateOfArt.backToCandidate')}
                        </Button>
                    ) : (
                        <Button size="sm" variant="ghost" onClick={() => setDescartando(v => !v)} aria-expanded={descartando}>
                            <X className="mr-1 h-3.5 w-3.5" />{t('stateOfArt.discard')}
                        </Button>
                    )}
                    {entry.decision === 'approved' && (
                        <Button size="sm" variant="ghost" onClick={() => onChange({ read: !entry.read })} aria-pressed={!!entry.read}>
                            <BookOpen className="mr-1 h-3.5 w-3.5" />{t(entry.read ? 'stateOfArt.markUnread' : 'stateOfArt.markRead')}
                        </Button>
                    )}
                    {disponible === 'to-acquire' && (
                        <Button size="sm" variant="ghost" onClick={() => setLigando(v => !v)} aria-expanded={ligando}>{t('stateOfArt.gotIt')}</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setAbierta(v => !v)} aria-expanded={abierta}>
                        {t(abierta ? 'stateOfArt.close' : 'stateOfArt.evaluate')}
                    </Button>
                    {entry.origins.every(o => o === 'manual') && (
                        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={t('stateOfArt.remove', { title: entry.title })}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {descartando && entry.decision !== 'discarded' && (
                <div className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-2">
                    <label className="block min-w-[16rem] flex-1 space-y-1">
                        <span className="text-xs text-muted-foreground">{t('stateOfArt.discardReason')}</span>
                        <input className={campo} value={razon} onChange={e => setRazon(e.target.value)} />
                    </label>
                    <Button size="sm" disabled={!razon.trim()} onClick={() => { decidir('discarded', { reason: razon.trim() }); setDescartando(false); }}>
                        {t('stateOfArt.confirmDiscard')}
                    </Button>
                </div>
            )}

            {ligando && disponible === 'to-acquire' && (
                <div className="border-t border-border px-3 py-2">
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">{t('stateOfArt.linkResource')}</span>
                        <select className={campo} value="" onChange={e => { if (e.target.value) { onChange({ resourceId: e.target.value }); setLigando(false); } }}>
                            <option value="">{t('stateOfArt.pickResource')}</option>
                            {library.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                        </select>
                    </label>
                </div>
            )}

            {abierta && <BibliographyEntryEditor entry={entry} suggested={suggested} workTypes={workTypes} onChange={onChange} />}
        </li>
    );
}
