import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Library, Loader2, Plus, Search } from 'lucide-react';
import { candidateRank, newBibliographyEntryId, type ProjectBibliographyEntry } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useProjectBibliography } from './stateOfArt/useProjectBibliography';
import { BibliographyEntryList } from './stateOfArt/BibliographyEntryList';
import { RequirementsTab } from './stateOfArt/RequirementsTab';
import { BibliographyCoverageTable, type CoverageFilter } from './stateOfArt/BibliographyCoverageTable';
import { BibliographyWarningsList } from './stateOfArt/BibliographyCriteriaPanel';
import { campo } from './stateOfArt/BibliographyEntryEditor';

type Paso = 'requirements' | 'candidates' | 'approved' | 'toAcquire' | 'discarded';
const PASOS: Paso[] = ['requirements', 'candidates', 'approved', 'toAcquire', 'discarded'];

/**
 * El estado del arte del proyecto (ADR-046, etapa 2): requisitos,
 * candidatas, evaluación, por conseguir y aprobada. Vale para cualquier tipo
 * de proyecto; en un curso los requisitos salen del sílabo.
 * Plan y respaldo metodológico: `docs/FASE_ESTADO_DEL_ARTE_2026-10.md`.
 */
export function ProjectStateOfArtPage() {
    const { t } = useTranslation('projects');
    const { projectId } = useParams<{ projectId: string }>();
    const { projects, isLoadingProjects: isLoading } = useFacultyProjects();
    const project = projects?.find(p => p.id === projectId);
    const bib = useProjectBibliography(project);
    const [paso, setPaso] = useState<Paso>('candidates');
    const [manual, setManual] = useState({ title: '', author: '' });
    const [guardando, setGuardando] = useState(false);
    /** El tipo de fuente elegido en la cobertura, para ver sus candidatas. */
    const [filtro, setFiltro] = useState<CoverageFilter>(null);
    // Salir con cambios sin guardar pide confirmación: en la prueba del
    // fundador las 32 fichas estuvieron solo en pantalla.
    useEffect(() => {
        if (!bib.dirty) return;
        const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', aviso);
        return () => window.removeEventListener('beforeunload', aviso);
    }, [bib.dirty]);

    const grupos = useMemo(() => {
        const ordenar = (xs: ProjectBibliographyEntry[]) => [...xs].sort((a, b) => candidateRank(b) - candidateRank(a));
        return {
            candidates: ordenar(bib.entries.filter(e => e.decision === 'candidate')),
            approved: ordenar(bib.entries.filter(e => e.decision === 'approved')),
            toAcquire: ordenar(bib.entries.filter(e => e.decision !== 'discarded' && !e.resourceId)),
            discarded: bib.entries.filter(e => e.decision === 'discarded'),
        };
    }, [bib.entries]);

    if (!project) {
        return isLoading
            ? <div className="flex-1 p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : <div className="flex-1 p-8 text-center text-muted-foreground">{t('notFound.title')}</div>;
    }

    const guardar = async () => {
        setGuardando(true);
        try {
            await bib.save();
            toast.success(t('stateOfArt.saved'));
        } catch (err) {
            console.error('[projects] save bibliography failed:', err);
            toast.error(t('stateOfArt.saveFailed'));
        } finally {
            setGuardando(false);
        }
    };

    const agregarManual = () => {
        if (!manual.title.trim()) return;
        bib.add({ id: newBibliographyEntryId(), title: manual.title.trim(), author: manual.author.trim() || null, weight: 'recommended', decision: 'candidate', origins: ['manual'] });
        setManual({ title: '', author: '' });
        setPaso('candidates');
    };

    const lista = paso === 'requirements' ? [] : grupos[paso];

    return (
        <div className="flex-1 overflow-y-auto bg-background text-foreground antialiased">
            <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-5 lg:py-6 space-y-5">
                <header className="space-y-1">
                    <Link
                        to={`/dashboard/projects/${project.id}`}
                        onClick={e => { if (bib.dirty && !window.confirm(t('stateOfArt.leaveUnsaved'))) e.preventDefault(); }}
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-3.5 w-3.5" />{project.title}
                    </Link>
                    <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                        <Library className="h-5 w-5 text-muted-foreground" />{t('stateOfArt.title')}
                    </h1>
                    <p className="max-w-3xl text-sm text-muted-foreground">{t('stateOfArt.subtitle')}</p>
                </header>

                <nav className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label={t('stateOfArt.title')}>
                    {PASOS.map((p, i) => (
                        <button
                            key={p}
                            id={`state-of-art-tab-${p}`}
                            role="tab"
                            aria-controls="state-of-art-panel"
                            aria-selected={paso === p}
                            onClick={() => setPaso(p)}
                            className={`-mb-px border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${paso === p ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            {i + 1}. {t(`stateOfArt.step.${p}`)}
                            {p !== 'requirements' && <span className="ml-1 text-muted-foreground">· {grupos[p].length}</span>}
                        </button>
                    ))}
                </nav>

                <BibliographyCoverageTable
                    coverage={bib.coverage}
                    filter={filtro}
                    requirements={bib.requirementMeasures}
                    onFilter={f => {
                        setFiltro(f);
                        // Lo que no se pudo medir son fichas aprobadas; lo demás, candidatas.
                        if (f?.kind === 'ids') setPaso('approved');
                        else if (f && (paso === 'requirements' || paso === 'discarded')) setPaso('candidates');
                    }}
                />
                {/* El tipo que falta ya está en la cobertura; aquí, el resto de los avisos. */}
                <BibliographyWarningsList warnings={bib.warnings.filter(w => w.kind !== 'missing-type')} entries={bib.entries} />

                <div id="state-of-art-panel" role="tabpanel" aria-labelledby={`state-of-art-tab-${paso}`}>

                {paso === 'requirements' ? (
                    <RequirementsTab
                        project={project}
                        bib={bib}
                        library={bib.libraryAll}
                        onShow={(f, step) => { setFiltro(f); setPaso(step); }}
                    />
                ) : (
                    <section className="space-y-3">
                        <p className="text-xs text-muted-foreground">{t(`stateOfArt.stepHint.${paso}`)}</p>
                        {paso === 'candidates' && (
                            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
                                <Button size="sm" onClick={bib.gatherCandidates}>
                                    <Search className="mr-1.5 h-3.5 w-3.5" />{t('stateOfArt.gather')}
                                </Button>
                                <label className="block min-w-[14rem] flex-1 space-y-1">
                                    <span className="text-xs text-muted-foreground">{t('stateOfArt.field.title')}</span>
                                    <input className={campo} value={manual.title} onChange={e => setManual(m => ({ ...m, title: e.target.value }))} />
                                </label>
                                <label className="block min-w-[10rem] space-y-1">
                                    <span className="text-xs text-muted-foreground">{t('stateOfArt.field.author')}</span>
                                    <input className={campo} value={manual.author} onChange={e => setManual(m => ({ ...m, author: e.target.value }))} />
                                </label>
                                <Button size="sm" variant="ghost" onClick={() => setPaso('requirements')}>
                                    {t('stateOfArt.import.goTo')}
                                </Button>
                                <Button size="sm" variant="outline" onClick={agregarManual} disabled={!manual.title.trim()}>
                                    <Plus className="mr-1.5 h-3.5 w-3.5" />{t('stateOfArt.addManual')}
                                </Button>
                            </div>
                        )}
                        <BibliographyEntryList
                            entries={lista}
                            filter={filtro}
                            grouped={paso === 'candidates' || paso === 'approved'}
                            emptyText={t(`stateOfArt.empty.${paso}`)}
                            bib={bib}
                        />
                    </section>
                )}
                </div>

                <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
                    <Button onClick={guardar} disabled={guardando || !bib.dirty || bib.errors.size > 0}>
                        {guardando && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{t('stateOfArt.save')}
                    </Button>
                    {bib.errors.size > 0
                        ? <p className="text-xs text-warning-subtle-foreground">{t('stateOfArt.fixErrors', { count: bib.errors.size })}</p>
                        : bib.dirty && !guardando && <p className="text-xs text-warning-subtle-foreground">{t('unsaved')}</p>}
                    <p className="text-xs text-muted-foreground">{t('stateOfArt.syncHint')}</p>
                </div>
            </div>
        </div>
    );
}
