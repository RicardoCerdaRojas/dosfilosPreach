import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Languages, Library, Loader2, MessageSquareQuote, RefreshCw } from 'lucide-react';
import type { DeskLanguage, ProjectOutput } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { ProjectMaterialList, type MaterialItem } from '../ProjectMaterialList';
import type { AttachedSource } from '../../../hooks/useProjectAttachedSources';
import { DeskSection, EmptyState, FOCUS_RING, TOUCH } from './primitives';

interface SessionLike {
    id: string;
    title?: string;
    passage?: string;
}

interface LanguageTool {
    sessions: ReadonlyArray<SessionLike>;
    /** Hay sesiones sueltas que se pueden vincular. */
    canLink: boolean;
    onLink: () => void;
}

export interface DeskPickerSources {
    attached: ReadonlyArray<AttachedSource>;
    isAdmin: boolean;
    reprocessing: Record<string, boolean>;
    onReprocess: (source: AttachedSource) => void;
    onOpenPicker: () => void;
    /** Investigación conserva también su estado del arte. */
    onOpenStateOfArt?: () => void;
}

interface DeskToolsProps {
    projectId: string;
    /**
     * Las lenguas según los libros del proyecto (Esdras: hebreo y arameo;
     * Santiago: griego). Vacío = el proyecto todavía no dice su libro: se
     * ofrecen las dos. `null` = el tipo no usa lenguas (Consejería).
     */
    languages: ReadonlyArray<DeskLanguage> | null;
    conversations: ReadonlyArray<SessionLike>;
    greek: LanguageTool;
    hebrew: LanguageTool;
    /** Solo los tipos que conservan el selector de la biblioteca (General y los viejos). */
    sources?: DeskPickerSources | null;
    material: {
        items: MaterialItem[];
        isLoading: boolean;
        onCreate: () => void;
        onEdit: (output: ProjectOutput) => void;
        onDelete: (output: ProjectOutput) => void;
    };
    onNavigate: (path: string) => void;
    /** En el Curso las lenguas se usan dentro de cada trabajo; en el Exegético, de cada estudio. */
    workNoun?: 'study' | 'work';
}

/**
 * El final del escritorio (§3.6): las fuentes del selector (solo donde no
 * hay estado del arte), las herramientas y el material.
 *
 * Griego y hebreo/arameo salen del cuerpo: se usan dentro del estudio, donde
 * el pasaje ya está definido. Aquí quedan en una fila compacta, según los
 * libros del proyecto, con lo ya vinculado a mano. Una sesión vinculada en
 * una lengua que no es la del libro se sigue viendo: no se esconde trabajo.
 */
export function DeskTools({ projectId, languages, conversations, greek, hebrew, sources, material, onNavigate, workNoun = 'study' }: DeskToolsProps) {
    const { t } = useTranslation('projects');
    const sinLibro = !!languages && languages.length === 0;
    const verGriego = !!languages && (sinLibro || languages.includes('greek') || greek.sessions.length > 0);
    const verHebreo = !!languages && (sinLibro || languages.includes('hebrew') || languages.includes('aramaic') || hebrew.sessions.length > 0);
    const conArameo = !!languages?.includes('aramaic');
    const pid = encodeURIComponent(projectId);

    return (
        <>
            {sources && <PickerSources sources={sources} />}

            <DeskSection
                id="herramientas"
                eyebrow={t('desk.tools.eyebrow')}
                title={t('desk.tools.title')}
                description={verGriego || verHebreo ? t(workNoun === 'work' ? 'desk.tools.descriptionCourse' : 'desk.tools.description') : undefined}
                data-testid="desk-tools"
            >
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <ToolCard
                        icon={MessageSquareQuote}
                        name={t('resources.conversations.label')}
                        count={conversations.length}
                        items={conversations.slice(0, 3).map(s => ({ id: s.id, label: s.title || '', to: `/dashboard/faculty/${encodeURIComponent(s.id)}` }))}
                        primary={{ label: t('resources.conversations.ctaStart'), onClick: () => onNavigate(`/dashboard/faculty?projectId=${pid}`) }}
                    />
                    {verGriego && (
                        <ToolCard
                            icon={BookOpen}
                            name={t('resources.greek.label')}
                            count={greek.sessions.length}
                            items={greek.sessions.slice(0, 3).map(s => ({ id: s.id, label: s.passage || s.title || '', to: `/dashboard/greek-tutor?sessionId=${encodeURIComponent(s.id)}` }))}
                            primary={{ label: t('resources.greek.ctaStudy'), onClick: () => onNavigate(`/dashboard/greek-tutor?projectId=${pid}`) }}
                            secondary={greek.canLink ? { label: t('resources.greek.ctaLink'), onClick: greek.onLink } : undefined}
                        />
                    )}
                    {verHebreo && (
                        <ToolCard
                            icon={Languages}
                            // El tutor de hebreo también lee las secciones en arameo (Esdras, Daniel).
                            name={t(conArameo ? 'desk.tools.hebrewAramaic' : 'resources.hebrew.label')}
                            count={hebrew.sessions.length}
                            // Con el id de la sesión (y el proyecto): el enlace dice cuál abrir, no solo el tutor.
                            items={hebrew.sessions.slice(0, 3).map(s => ({ id: s.id, label: s.passage || s.title || '', to: `/dashboard/hebrew-tutor?sessionId=${encodeURIComponent(s.id)}&projectId=${pid}` }))}
                            primary={{ label: t('resources.hebrew.ctaAnalyze'), onClick: () => onNavigate(`/dashboard/hebrew-tutor?projectId=${pid}`) }}
                            secondary={hebrew.canLink ? { label: t('resources.hebrew.ctaLink'), onClick: hebrew.onLink } : undefined}
                        />
                    )}
                </ul>
            </DeskSection>

            <ProjectMaterialList
                items={material.items}
                isLoading={material.isLoading}
                onCreateOutput={material.onCreate}
                onEditOutput={material.onEdit}
                onDeleteOutput={material.onDelete}
            />
        </>
    );
}

interface ToolAction {
    label: string;
    onClick: () => void;
}

function ToolCard({ icon: Icon, name, count, items, primary, secondary }: {
    icon: ComponentType<{ className?: string }>;
    name: string;
    count: number;
    items: Array<{ id: string; label: string; to: string }>;
    primary: ToolAction;
    secondary?: ToolAction;
}) {
    const { t } = useTranslation('projects');
    return (
        <li className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3" data-testid="desk-tool">
            <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <Icon className="h-3.5 w-3.5 text-primary-text" aria-hidden />
                <span className="truncate">{name}</span>
                <span className="font-mono text-[12px] font-normal text-muted-foreground">· {count}</span>
            </p>
            {items.length > 0 && (
                <ul className="space-y-0.5">
                    {items.map(it => {
                        // Una sesión sin título ni pasaje igual se nombra: un enlace vacío no se puede leer.
                        const rotulo = it.label.trim() || t('desk.tools.untitledSession');
                        return (
                            <li key={it.id}>
                                <Link
                                    to={it.to}
                                    aria-label={t('desk.tools.openSession', { tool: name, label: rotulo })}
                                    className={cn('flex items-center truncate rounded-sm py-1 text-[12.5px] text-foreground hover:text-primary-text', TOUCH, FOCUS_RING)}
                                >
                                    <span className={cn('truncate', !it.label.trim() && 'italic text-muted-foreground')}>{rotulo}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={primary.onClick}>{primary.label}</Button>
                {secondary && (
                    <button
                        type="button"
                        onClick={secondary.onClick}
                        className={cn('rounded-sm text-[12.5px] text-primary-text underline-offset-2 hover:underline', TOUCH, FOCUS_RING)}
                    >
                        {secondary.label}
                    </button>
                )}
            </div>
        </li>
    );
}

/** Las fuentes de los tipos sin estado del arte obligatorio: el selector de la biblioteca, como antes. */
function PickerSources({ sources }: { sources: DeskPickerSources }) {
    const { t } = useTranslation('projects');
    const { attached, isAdmin, reprocessing, onReprocess, onOpenPicker, onOpenStateOfArt } = sources;
    return (
        <DeskSection
            id="fuentes"
            eyebrow={t('desk.tools.sourcesEyebrow')}
            title={t('resources.sources.label')}
            data-testid="desk-picker-sources"
            actions={(
                <>
                    <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={onOpenPicker}>
                        {attached.length > 0 ? t('resources.sources.ctaEdit') : t('resources.sources.ctaAttach')}
                    </Button>
                    {onOpenStateOfArt && (
                        <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={onOpenStateOfArt}>
                            {t('resources.sources.stateOfArt')}
                        </Button>
                    )}
                </>
            )}
            isEmpty={attached.length === 0}
            empty={<EmptyState icon={Library}>{t('resources.sources.empty')}</EmptyState>}
        >
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {attached.map(s => {
                    const indexada = s.indexingStatus === 'ready';
                    const procesando = !!reprocessing[s.id];
                    return (
                        <li key={s.id} className="min-w-0 text-[13px] leading-snug">
                            <p className="truncate font-medium text-foreground">{s.title}</p>
                            <p className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="truncate">{s.author}</span>
                                {!indexada && <span className="shrink-0 text-warning-subtle-foreground">{t('resources.sources.byProcess')}</span>}
                                {!indexada && isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => onReprocess(s)}
                                        disabled={procesando}
                                        title={t('resources.sources.processTitle')}
                                        className={cn('inline-flex shrink-0 items-center gap-1 rounded-sm text-primary-text hover:underline disabled:cursor-not-allowed disabled:opacity-50', TOUCH, FOCUS_RING)}
                                    >
                                        {procesando ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <RefreshCw className="h-3 w-3" aria-hidden />}
                                        <span className="text-[11px]">{procesando ? t('resources.sources.processing') : t('resources.sources.process')}</span>
                                    </button>
                                )}
                            </p>
                        </li>
                    );
                })}
            </ul>
        </DeskSection>
    );
}
