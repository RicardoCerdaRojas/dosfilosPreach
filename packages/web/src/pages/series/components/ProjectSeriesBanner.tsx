import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FolderOpen } from 'lucide-react';
import type { AIProject, BibleBookId } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

interface ProjectSeriesBannerProps {
    project: Pick<AIProject, 'id' | 'title'>;
    /** El libro analizado (o el del selector, si todavía no se analizó). */
    bookId: BibleBookId;
    /** Los libros de los criterios del proyecto; vacío si no eligió ninguno. */
    projectBooks: readonly BibleBookId[];
}

/**
 * Arriba del planificador abierto desde un proyecto: de qué proyecto es la
 * serie, cómo volver y qué va a pasar al crearla. Si el libro no está entre
 * los del proyecto, lo avisa: los comentarios se filtran por el analizado.
 */
export function ProjectSeriesBanner({ project, bookId, projectBooks }: ProjectSeriesBannerProps) {
    const { t } = useTranslation('series');
    const fueraDelProyecto = projectBooks.length > 0 && !projectBooks.includes(bookId);
    return (
        <section
            aria-labelledby="project-series-banner-title"
            className="rounded-xl border border-info/30 bg-info-subtle p-4 space-y-2"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p id="project-series-banner-title" className="inline-flex items-center gap-2 text-sm font-semibold text-info-subtle-foreground">
                    <FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {t('expository.project.banner', { title: project.title })}
                </p>
                <Link
                    to={`/dashboard/projects/${project.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-info-subtle-foreground underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('expository.project.back')}
                </Link>
            </div>
            <p className="text-xs text-info-subtle-foreground">{t('expository.project.hint')}</p>
            {fueraDelProyecto && (
                <p
                    role="status"
                    className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-subtle px-2.5 py-1.5 text-xs text-warning-subtle-foreground"
                >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {t('expository.project.bookOutside')}
                </p>
            )}
        </section>
    );
}

/** El proyecto de la URL ya no está (archivado o en la papelera): la serie nace suelta. */
export function ProjectUnavailableNotice() {
    const { t } = useTranslation('series');
    return (
        <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-subtle p-3 text-sm text-warning-subtle-foreground"
        >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t('expository.project.unavailable')}
        </p>
    );
}
