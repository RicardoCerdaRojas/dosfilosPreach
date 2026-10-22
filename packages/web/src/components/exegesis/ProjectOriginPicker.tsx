import type { AIProject, ProjectWorkType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

interface ProjectOriginPickerProps {
    projects: ReadonlyArray<AIProject>;
    projectId: string | null;
    workTypes: ReadonlyArray<ProjectWorkType>;
    workTypeId: string | null;
    /** Si lo elegido ya trae algo que heredar, para el aviso. */
    inherits: boolean;
    onProject: (project: AIProject | null) => void;
    onWorkType: (workTypeId: string | null) => void;
}

/**
 * En qué proyecto nace el estudio y como qué tipo de trabajo (ADR-046,
 * etapas 1 y 1b). Solo muestra y avisa: qué se hereda lo decide la página.
 */
export function ProjectOriginPicker({ projects, projectId, workTypes, workTypeId, inherits, onProject, onWorkType }: ProjectOriginPickerProps) {
    const { t } = useTranslation('exegesis');
    const campo = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
    const rotulo = 'text-[11px] uppercase tracking-wide font-semibold text-muted-foreground';
    return (
        <div className="rounded-xl border border-border bg-card p-3 space-y-1">
            <label htmlFor="origin-project" className={rotulo}>{t('create.project.label')}</label>
            <select
                id="origin-project"
                value={projectId ?? ''}
                onChange={e => onProject(projects.find(x => x.id === e.target.value) ?? null)}
                className={campo}
            >
                <option value="">{t('create.project.none')}</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {workTypes.length > 0 && (
                <>
                    <label htmlFor="project-work-type" className={`block pt-2 ${rotulo}`}>{t('create.project.workType')}</label>
                    <select id="project-work-type" value={workTypeId ?? ''} onChange={e => onWorkType(e.target.value || null)} className={campo}>
                        <option value="">{t('create.project.noWorkType')}</option>
                        {workTypes.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                </>
            )}
            <p className="text-[11px] text-muted-foreground">
                {workTypes.length > 1 && !workTypeId
                    ? t('create.project.pickWorkType')
                    : inherits ? t('create.project.chargeApplied') : t('create.project.hint')}
            </p>
        </div>
    );
}
