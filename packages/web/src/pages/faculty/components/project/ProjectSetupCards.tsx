import { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { projectCourseInfo, projectWorkTypes, type AIProject, type ProjectCourseInfo, type ProjectWorkType } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { canonico } from '@/utils/canonico';
import { ProjectCourseCard } from './ProjectCourseCard';
import { ProjectWorkTypesCard } from './ProjectWorkTypesCard';

export type ProjectSetupChange = { courseInfo?: ProjectCourseInfo | null; workTypes?: ProjectWorkType[] };

interface ProjectSetupCardsProps {
    project: AIProject;
    /** Guarda y avisa; no debe lanzar. */
    onSave: (change: ProjectSetupChange) => Promise<unknown>;
    /**
     * Plegadas mientras no tengan datos guardados: un Exegético no las usa
     * (fase «Encuadre de la serie»). Un enlace discreto las despliega.
     */
    collapsible?: boolean;
}

/** Si el proyecto ya guardó datos del curso o tipos de trabajo. */
function hasCourseSetup(project: AIProject): boolean {
    return canonico(projectCourseInfo(project)) !== canonico(null) || projectWorkTypes(project).length > 0;
}

/**
 * Los datos del curso y los tipos de trabajo, lado a lado (ADR-046, etapa
 * 1b). Cada tarjeta guarda lo suyo y solo ella muestra que está guardando:
 * con la misma mutación para las dos, el spinner se encendía en ambas.
 */
export function ProjectSetupCards({ project, onSave, collapsible = false }: ProjectSetupCardsProps) {
    const { t } = useTranslation('projects');
    const [desplegadas, setDesplegadas] = useState(false);
    const [guardando, setGuardando] = useState<'course' | 'workTypes' | null>(null);
    const guardar = async (cual: 'course' | 'workTypes', change: ProjectSetupChange) => {
        setGuardando(cual);
        try {
            await onSave(change);
        } finally {
            setGuardando(null);
        }
    };
    const idTarjetas = useId();
    const plegable = collapsible && !hasCourseSetup(project);
    const tarjetas = (
        <div id={idTarjetas} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <ProjectCourseCard project={project} saving={guardando === 'course'} onSave={courseInfo => guardar('course', { courseInfo })} />
            <ProjectWorkTypesCard project={project} saving={guardando === 'workTypes'} onSave={workTypes => guardar('workTypes', { workTypes })} />
        </div>
    );
    if (!plegable) return tarjetas;
    // Un solo botón que se mantiene en su lugar: el foco no se pierde al
    // desplegar, y `aria-expanded`/`aria-controls` dicen qué abre.
    const Icono = desplegadas ? ChevronUp : ChevronDown;
    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => setDesplegadas(v => !v)}
                aria-expanded={desplegadas}
                aria-controls={idTarjetas}
                className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-0"
            >
                <Icono className="h-3.5 w-3.5" aria-hidden />{t(desplegadas ? 'course.hideOptions' : 'course.options')}
            </button>
            {desplegadas && tarjetas}
        </div>
    );
}
