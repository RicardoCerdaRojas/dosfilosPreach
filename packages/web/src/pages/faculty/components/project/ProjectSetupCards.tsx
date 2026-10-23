import { useState } from 'react';
import type { AIProject, ProjectCourseInfo, ProjectWorkType } from '@dosfilos/domain';
import { ProjectCourseCard } from './ProjectCourseCard';
import { ProjectWorkTypesCard } from './ProjectWorkTypesCard';

export type ProjectSetupChange = { courseInfo?: ProjectCourseInfo | null; workTypes?: ProjectWorkType[] };

interface ProjectSetupCardsProps {
    project: AIProject;
    /** Guarda y avisa; no debe lanzar. */
    onSave: (change: ProjectSetupChange) => Promise<unknown>;
}

/**
 * Los datos del curso y los tipos de trabajo, lado a lado (ADR-046, etapa
 * 1b). Cada tarjeta guarda lo suyo y solo ella muestra que está guardando:
 * con la misma mutación para las dos, el spinner se encendía en ambas.
 */
export function ProjectSetupCards({ project, onSave }: ProjectSetupCardsProps) {
    const [guardando, setGuardando] = useState<'course' | 'workTypes' | null>(null);
    const guardar = async (cual: 'course' | 'workTypes', change: ProjectSetupChange) => {
        setGuardando(cual);
        try {
            await onSave(change);
        } finally {
            setGuardando(null);
        }
    };
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <ProjectCourseCard project={project} saving={guardando === 'course'} onSave={courseInfo => guardar('course', { courseInfo })} />
            <ProjectWorkTypesCard project={project} saving={guardando === 'workTypes'} onSave={workTypes => guardar('workTypes', { workTypes })} />
        </div>
    );
}
