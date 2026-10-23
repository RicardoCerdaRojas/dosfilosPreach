import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, NotebookPen, Route } from 'lucide-react';
import { toast } from 'sonner';
import type { GuideQuery, GuideReason, GuideStep } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { campo } from './BibliographyEntryEditor';

interface SearchGuidePanelProps {
    steps: ReadonlyArray<GuideStep>;
    /** Anota la búsqueda en el registro (base, consulta, resultado). */
    onNote: (note: { database: string; label: string; query: string; found: number; added: number }) => Promise<void>;
}

/**
 * La guía de búsqueda (etapa 2c): qué buscar y dónde, según lo que le
 * falta al proyecto. Cada consulta se copia o se abre en su base; el
 * resultado vuelve exportado (RIS o BibTeX) a «Importar», y la búsqueda se
 * anota en el registro. El sistema no consulta esas bases: prepara la
 * búsqueda y la deja registrada.
 */
export function SearchGuidePanel({ steps, onNote }: SearchGuidePanelProps) {
    const { t } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    if (steps.length === 0) {
        return (
            <section className="space-y-1" aria-labelledby="search-guide-title">
                <h3 id="search-guide-title" className="text-sm font-medium text-foreground">{t('stateOfArt.guide.title')}</h3>
                <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">{t('stateOfArt.guide.empty')}</p>
            </section>
        );
    }
    const razon = (r: GuideReason) => {
        switch (r.kind) {
            case 'always': return null;
            case 'requirement': return t('stateOfArt.guide.reason.requirement', { text: r.text });
            case 'type': return t('stateOfArt.guide.reason.type', { type: tx(`sourceTypes.${r.sourceType}.label`) });
            case 'project': return t('stateOfArt.guide.reason.research');
        }
    };
    const irAImportar = () => {
        const zona = document.getElementById('bib-import-zone');
        zona?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        zona?.focus();
    };

    return (
        <section className="space-y-3" aria-labelledby="search-guide-title">
            <div>
                <h3 id="search-guide-title" className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                    <Route className="h-4 w-4 text-muted-foreground" />{t('stateOfArt.guide.title')}
                </h3>
                <p className="text-xs text-muted-foreground">{t('stateOfArt.guide.hint')}</p>
            </div>
            <ol className="space-y-2">
                {steps.map((s, i) => {
                    const porQue = s.reasons.map(razon).filter((x): x is string => !!x);
                    return (
                        <li key={s.kind} className="rounded-lg border border-border bg-card p-3 space-y-2">
                            <div>
                                <p className="text-sm font-medium text-foreground">{i + 1}. {t(`stateOfArt.guide.step.${s.kind}.title`)}</p>
                                <p className="text-xs text-muted-foreground">{t(`stateOfArt.guide.step.${s.kind}.hint`, { before: s.before ?? '', publicDomain: s.publicDomainBefore ?? '' })}</p>
                                {porQue.length > 0 && (
                                    <ul className="flex flex-wrap gap-1 pt-1" aria-label={t('stateOfArt.guide.why')}>
                                        {porQue.map(x => <li key={x} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground">{x}</li>)}
                                    </ul>
                                )}
                            </div>
                            <ul className="space-y-1.5">
                                {s.queries.map(q => <Consulta key={`${q.database}|${q.query}`} q={q} onNote={onNote} />)}
                            </ul>
                        </li>
                    );
                })}
            </ol>
            <div className="rounded-lg border border-border p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">{t('stateOfArt.guide.bring.title')}</p>
                <p className="text-xs text-foreground">{t('stateOfArt.guide.bring.text')}</p>
                <p className="text-xs text-muted-foreground">{t('stateOfArt.guide.bring.zotero')}</p>
                <Button size="sm" variant="outline" onClick={irAImportar}>{t('stateOfArt.guide.bring.goImport')}</Button>
            </div>
        </section>
    );
}

function Consulta({ q, onNote }: { q: GuideQuery; onNote: SearchGuidePanelProps['onNote'] }) {
    const { t } = useTranslation('projects');
    const [anotando, setAnotando] = useState(false);
    const [nota, setNota] = useState({ found: '', added: '' });
    const [guardando, setGuardando] = useState(false);
    const [anotada, setAnotada] = useState(false);
    const base = t(`stateOfArt.guide.db.${q.database}`);
    // El enfoque se muestra (y se anota) en el idioma de la pantalla, no como clave.
    const etiqueta = [q.label, q.approach ? t(`stateOfArt.approach.${q.approach}`) : null].filter(Boolean).join(' · ');
    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(q.query);
            toast.success(t('stateOfArt.guide.copied'));
        } catch {
            toast.error(t('stateOfArt.guide.copyFailed'));
        }
    };
    const guardar = async () => {
        setGuardando(true);
        try {
            const n = (v: string) => Math.max(0, parseInt(v, 10) || 0);
            await onNote({ database: q.database, label: etiqueta ? `${base} · ${etiqueta}` : base, query: q.query, found: n(nota.found), added: n(nota.added) });
            setAnotando(false);
            setAnotada(true);
            setNota({ found: '', added: '' });
        } catch (err) {
            console.error('[projects] search note failed:', err);
            toast.error(t('stateOfArt.saveFailed'));
        } finally {
            setGuardando(false);
        }
    };
    return (
        <li className="rounded-md border border-border/70 p-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-medium text-foreground">{base}</span>
                {etiqueta && <span className="text-[11px] text-muted-foreground">{etiqueta}</span>}
                {!q.url && <span className="text-[11px] text-muted-foreground">· {t('stateOfArt.guide.viaLibrary')}</span>}
                {anotada && <span className="inline-flex items-center gap-0.5 text-[11px] text-success-subtle-foreground"><Check className="h-3 w-3" />{t('stateOfArt.guide.noted')}</span>}
            </div>
            <code className="block break-words rounded bg-muted px-2 py-1 text-xs text-foreground">{q.query}</code>
            <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={copiar} aria-label={t('stateOfArt.guide.copyIn', { base })}>
                    <Copy className="mr-1 h-3.5 w-3.5" />{t('stateOfArt.guide.copy')}
                </Button>
                {q.url && (
                    <Button size="sm" variant="ghost" asChild>
                        <a href={q.url} target="_blank" rel="noopener noreferrer" aria-label={t('stateOfArt.guide.openIn', { base })}>
                            <ExternalLink className="mr-1 h-3.5 w-3.5" />{t('stateOfArt.guide.open')}
                        </a>
                    </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setAnotando(v => !v)} aria-expanded={anotando} aria-label={t('stateOfArt.guide.noteIn', { base })}>
                    <NotebookPen className="mr-1 h-3.5 w-3.5" />{t('stateOfArt.guide.note')}
                </Button>
            </div>
            {anotando && (
                <div className="flex flex-wrap items-end gap-2">
                    <label className="block w-28 space-y-0.5">
                        <span className="text-[11px] text-muted-foreground">{t('stateOfArt.guide.found')}</span>
                        <input className={campo} inputMode="numeric" value={nota.found} onChange={e => setNota(x => ({ ...x, found: e.target.value }))} />
                    </label>
                    <label className="block w-28 space-y-0.5">
                        <span className="text-[11px] text-muted-foreground">{t('stateOfArt.guide.added')}</span>
                        <input className={campo} inputMode="numeric" value={nota.added} onChange={e => setNota(x => ({ ...x, added: e.target.value }))} />
                    </label>
                    {/* Sin las dos cifras no se anota: un vacío no es un cero. */}
                    <Button size="sm" onClick={guardar} disabled={guardando || !/^\d+$/.test(nota.found.trim()) || !/^\d+$/.test(nota.added.trim())}>
                        {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}{t('stateOfArt.guide.saveNote')}
                    </Button>
                </div>
            )}
        </li>
    );
}
