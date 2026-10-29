import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    Download, FileCode, FileEdit, FileText,
    Loader2, Mic2, NotebookPen, Plus, Trash2,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ProjectOutput, ProjectOutputKind } from '@dosfilos/domain';
import { exportOutputMarkdown } from '../../utils/exportMarkdown';
import { DeskSection, FOCUS_RING, TOUCH } from './desk/primitives';

/** Visual config per output kind. Brand colours sourced from `phase-*` tokens. */
const KIND_META: Record<ProjectOutputKind, {
    icon: typeof FileText;
    color: string;
    i18nKey: 'note' | 'draft' | 'outline' | 'sermon';
}> = {
    note: { icon: NotebookPen, color: 'text-phase-exegesis', i18nKey: 'note' },
    draft: { icon: FileEdit, color: 'text-phase-homiletics', i18nKey: 'draft' },
    outline: { icon: FileCode, color: 'text-phase-drafting', i18nKey: 'outline' },
    sermon: { icon: Mic2, color: 'text-phase-generic', i18nKey: 'sermon' },
};

interface SermonItem {
    id: string;
    title: string;
    updatedAt: Date;
    status: string;
}

interface OutputItem {
    id: string;
    title: string;
    updatedAt: Date;
    kind: ProjectOutputKind;
    output: ProjectOutput;
}

export type MaterialItem =
    | ({ source: 'sermon' } & SermonItem)
    | ({ source: 'output' } & OutputItem);

/** Las filas que se ven antes de «Ver todo»: el material va al final del escritorio y no debe empujarlo. */
export const MATERIAL_VISIBLE = 5;

interface ProjectMaterialListProps {
    items: MaterialItem[];
    isLoading: boolean;
    onCreateOutput: () => void;
    onEditOutput: (output: ProjectOutput) => void;
    onDeleteOutput: (output: ProjectOutput) => void;
}

/**
 * Renders the "Material producido" section: list of project outputs (notes,
 * drafts, outlines) + sermons that reference this project, sorted chronologically.
 * Los sermones de la serie no vienen aquí: ya se ven en su fila de la mesa.
 *
 * Each row:
 * - Sermon: clickable title navigating to `/dashboard/sermons/:id` + status pill
 * - Output: clickable title opening the editor + actions (download, delete),
 *   SIEMPRE visibles: antes aparecían solo al pasar el mouse y en el teléfono
 *   o con teclado no existían.
 *
 * Muestra las 5 más recientes y «Ver todo» para el resto.
 */
export function ProjectMaterialList({
    items,
    isLoading,
    onCreateOutput,
    onEditOutput,
    onDeleteOutput,
}: ProjectMaterialListProps) {
    const { t, i18n } = useTranslation('projects');
    const navigate = useNavigate();
    const dateLocale = i18n.language?.startsWith('en') ? 'en' : 'es';
    const [todo, setTodo] = useState(false);
    const visibles = todo ? items : items.slice(0, MATERIAL_VISIBLE);
    const ocultas = items.length - MATERIAL_VISIBLE;

    // La misma sección que las demás del escritorio (rótulo, título, ancla).
    return (
        <DeskSection
            id="material"
            eyebrow={(
                <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    {t('desk.tools.eyebrow')}
                </span>
            )}
            title={(
                <>
                    {t('material.sectionLabel')}
                    {!isLoading && <span className="ml-1.5 font-sans text-[13px] tabular-nums text-muted-foreground">· {items.length}</span>}
                </>
            )}
            data-testid="desk-material"
            actions={(
                // De contorno: el único botón lleno del escritorio es «Ahora».
                <Button
                    onClick={onCreateOutput}
                    variant="outline"
                    size="sm"
                    className={cn('font-medium gap-1.5 text-[12.5px]', TOUCH)}
                >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {t('material.newButton')}
                </Button>
            )}
            isEmpty={false}
        >
            {isLoading ? (
                <div className="flex justify-center py-6 text-muted-foreground" role="status" aria-label={t('material.loading')}>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                </div>
            ) : items.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-muted-foreground py-2">
                    {t('material.empty')}
                </p>
            ) : (
                <>
                <ul className="divide-y divide-border/60">
                    {visibles.map(item => {
                        if (item.source === 'sermon') {
                            const sermonMeta = KIND_META.sermon;
                            const SermonIcon = sermonMeta.icon;
                            const status = item.status as 'published' | 'draft' | 'archived' | 'working';
                            const statusKey =
                                status === 'published' ? 'published' :
                                status === 'archived' ? 'archived' :
                                'draft';
                            return (
                                <li key={`sermon-${item.id}`} className="py-3 flex items-start gap-3 group">
                                    <SermonIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/70 group-hover:text-primary-text transition-colors" />
                                    <div className="flex-1 min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/dashboard/sermons/${item.id}`)}
                                            className={cn('text-left text-[14px] font-medium truncate block hover:text-primary-text w-full transition-colors rounded-sm', TOUCH, FOCUS_RING)}
                                        >
                                            {item.title}
                                        </button>
                                        <div className="text-[12px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                            <span>{t(`material.outputKind.${sermonMeta.i18nKey}`)}</span>
                                            <span className="text-border">·</span>
                                            <span>{item.updatedAt.toLocaleDateString(dateLocale)}</span>
                                        </div>
                                    </div>
                                    <span
                                        className={cn(
                                            'text-[10px] uppercase tracking-[0.12em] font-medium px-2 py-0.5 rounded-full shrink-0 self-center border',
                                            status === 'published' && 'bg-success-subtle text-success-subtle-foreground border-success/30',
                                            (status === 'draft' || status === 'working') && 'bg-muted text-muted-foreground border-border/60',
                                            status === 'archived' && 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
                                        )}
                                    >
                                        {t(`material.sermonStatus.${statusKey}`)}
                                    </span>
                                </li>
                            );
                        }

                        // Output row
                        const o = item.output;
                        const meta = KIND_META[o.kind];
                        const Icon = meta.icon;
                        return (
                            <li key={`output-${o.id}`} className="py-3 flex items-start gap-3 group">
                                <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', meta.color)} />
                                <div className="flex-1 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => onEditOutput(o)}
                                        className={cn('text-left text-[14px] font-medium truncate block hover:text-primary-text w-full transition-colors rounded-sm', TOUCH, FOCUS_RING)}
                                    >
                                        {o.title}
                                    </button>
                                    <div className="text-[12px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                        <span>{t(`material.outputKind.${meta.i18nKey}`)}</span>
                                        <span className="text-border">·</span>
                                        <span>{new Date(o.updatedAt).toLocaleDateString(dateLocale)}</span>
                                        {o.content.length > 0 && (
                                            <>
                                                <span className="text-border">·</span>
                                                <span className="font-mono">{t('material.chars', { n: o.content.length.toLocaleString(dateLocale) })}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-1 self-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground"
                                        onClick={() => exportOutputMarkdown(o)}
                                        title={t('material.actions.downloadMarkdown')}
                                        aria-label={`${t('material.actions.downloadMarkdown')}: ${o.title}`}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-11 w-11 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => onDeleteOutput(o)}
                                        title={t('material.actions.delete')}
                                        aria-label={`${t('material.actions.delete')}: ${o.title}`}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                {ocultas > 0 && (
                    <button
                        type="button"
                        onClick={() => setTodo(v => !v)}
                        aria-expanded={todo}
                        className={cn('mt-2 inline-flex items-center rounded-sm text-[13px] text-primary-text underline-offset-2 hover:underline', TOUCH, FOCUS_RING)}
                    >
                        {todo ? t('material.seeLess') : t('material.seeAll', { count: items.length })}
                    </button>
                )}
                </>
            )}
        </DeskSection>
    );
}
