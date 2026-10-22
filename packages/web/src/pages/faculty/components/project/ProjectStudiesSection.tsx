import { Link } from 'react-router-dom';
import { Plus, ScrollText } from 'lucide-react';
import { formatPassageReference, paperRoleInProject, type ExegesisPaperSummary, type SupportedLanguage } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface ProjectStudiesSectionProps {
    projectId: string;
    studies: ReadonlyArray<ExegesisPaperSummary>;
    onNewStudy: () => void;
}

/**
 * Los estudios del proyecto (ADR-046, etapa 1): los que nacieron en él y los
 * que colaboran con él, rotulados, con su fase. Cada uno abre su trabajo.
 */
export function ProjectStudiesSection({ projectId, studies, onNewStudy }: ProjectStudiesSectionProps) {
    const { t, i18n } = useTranslation('projects');
    const { t: tx } = useTranslation('exegesis');
    const lang: SupportedLanguage = i18n.language?.startsWith('en') ? 'en' : 'es';
    const ordenados = [...studies].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby="project-studies-title">
            <header className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-muted-foreground" />
                <h2 id="project-studies-title" className="text-sm font-semibold text-foreground">
                    {t('studies.title')} <span className="text-muted-foreground font-normal">· {studies.length}</span>
                </h2>
                <Button size="sm" variant="outline" className="ml-auto" onClick={onNewStudy}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('studies.new')}
                </Button>
            </header>

            {ordenados.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('studies.empty')}</p>
            ) : (
                <ul className="divide-y divide-border">
                    {ordenados.map(p => {
                        const vinculado = paperRoleInProject(p, projectId) === 'linked';
                        return (
                            <li key={p.id}>
                                <Link to={`/dashboard/exegesis/${p.id}`} className="flex items-center gap-3 py-2 hover:bg-accent/50 rounded-md px-2 -mx-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-foreground">{p.title?.trim() || formatPassageReference(p.passage, lang)}</p>
                                        <p className="truncate text-[11px] text-muted-foreground">{formatPassageReference(p.passage, lang)}</p>
                                    </div>
                                    {vinculado && (
                                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{t('studies.linked')}</span>
                                    )}
                                    <span className="shrink-0 text-[11px] text-muted-foreground">{tx(`list.phase.${p.phase}`)}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
