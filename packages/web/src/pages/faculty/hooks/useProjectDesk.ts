import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    buildProjectDesk,
    type AIProject,
    type DeskResourceOf,
    type DeskRubricCatalog,
    type ProjectDeskModel,
} from '@dosfilos/domain';
import { seriesService } from '@dosfilos/application';
import { useFirebase } from '@/context/firebase-context';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useFacultySessions } from '@/hooks/faculty/useFacultySessions';
import { useProjectWorkspace } from '@/hooks/faculty/useProjectWorkspace';
import { useSermons } from '@/hooks/use-sermons';
import { useGreekSessions } from '@/hooks/useGreekSessions';
import { useHebrewSessions } from '@/hooks/useHebrewSessions';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { libraryQueryKey, useLibrary } from '@/hooks/library';
import { loadExpositoryDraft } from '@/hooks/series/expositoryDraftStorage';
import { computeRoadmapState, getProjectTypeMeta, type ProjectTypeMeta, type RoadmapState } from '@/pages/projects/projectRoadmaps';
import { useProjectSlices } from './useProjectSlices';
import { useDeskClock } from './useDeskClock';
import { useProjectAttachedSources } from './useProjectAttachedSources';

/** El estado de un bloque del escritorio: mientras carga, su vacío sería falso. */
export type DeskBlockStatus = 'loading' | 'error' | 'ready';

/**
 * Si el planificador tiene un análisis a medias de ESTE proyecto (su clave
 * propia en localStorage, `expositoryDraftStorage`): la fase 3 del
 * Exegético queda «en curso». `loadExpositoryDraft` ya descarta los vencidos
 * y nunca lanza.
 */
export function hasPlannerDraft(projectId: string | undefined): boolean {
    if (!projectId) return false;
    const draft = loadExpositoryDraft(projectId);
    return !!draft && (draft.projectId ?? projectId) === projectId;
}

/**
 * El escritorio del proyecto (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`
 * §5.5 y §8): un SELECTOR en el cliente sobre las listas del usuario que ya
 * están en caché (proyectos, estudios, series, sermones, material,
 * biblioteca, rúbricas), sin consultas nuevas por proyecto. Devuelve el
 * modelo puro del dominio (`buildProjectDesk`) y el estado de cada bloque,
 * para que nada afirme un vacío mientras carga.
 *
 * Los sermones van TODOS (no solo los del proyecto): el modelo los busca por
 * id, por copia y por estudio de origen, y así reconoce los marcadores
 * vacíos que la serie crea.
 *
 * Las fuentes del selector (`useProjectAttachedSources`) solo se piden en
 * los tipos que lo conservan: en Exegético y Curso las fuentes van por el
 * estado del arte y el modelo las lee de la bibliografía del proyecto.
 */
export function useProjectDesk(projectId: string | undefined) {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const ahora = useDeskClock();
    const { projects, isLoadingProjects, updateProject } = useFacultyProjects();
    const { sessions } = useFacultySessions();
    const { sermons, loading: cargandoSermones, error: errorSermones, refetch: releerSermones } = useSermons();
    const { sessions: greekSessions } = useGreekSessions();
    const { sessions: hebrewSessions } = useHebrewSessions();
    const { papers, isLoading: cargandoEstudios, error: errorEstudios } = useExegesisPapers();
    const { rubrics, isLoading: cargandoRubricas, error: errorRubricas } = useUserRubrics();
    const { resources, isLoading: cargandoBiblioteca, isError: errorBiblioteca } = useLibrary();
    // La misma clave que ExegesisPage: comparten caché, y la invalidación
    // ['series'] de useExegesisPapers también la refresca.
    const seriesQuery = useQuery({
        queryKey: ['series', 'forExegesisPapers', user?.uid],
        queryFn: async () => (user?.uid ? seriesService.getUserSeries(user.uid) : []),
        enabled: !!user?.uid,
    });
    const series = seriesQuery.data;
    const { outputs, isLoadingOutputs, createOutput, updateOutput, deleteOutput } = useProjectWorkspace(projectId);

    const project = useMemo(() => projects?.find(p => p.id === projectId), [projects, projectId]);
    const typeMeta: ProjectTypeMeta = getProjectTypeMeta(project?.type);
    const caps = typeMeta.capabilities;

    const slices = useProjectSlices(projectId, { sessions, sermons, greekSessions, hebrewSessions, papers, series });

    const attached = useProjectAttachedSources({
        userId: user?.uid,
        // Exegético y Curso no usan el selector: no se pide nada.
        sourceIds: project && caps.sources !== 'stateOfArt' ? project.sourceIds : undefined,
    });

    // La biblioteca en caché: título y clasificación de cada libro (fuentes de
    // antes y requisitos por tipo de obra).
    const porId = useMemo(() => new Map(resources.map(r => [r.id, r])), [resources]);
    const resourceOf = useMemo<DeskResourceOf>(() => (id: string) => {
        const r = porId.get(id);
        return r ? { title: r.title, author: r.author ?? null, exegeticalType: r.exegeticalType ?? null } : null;
    }, [porId]);

    // Sin catálogo (todavía cargando), el modelo no da una rúbrica por faltante.
    const rubricCatalog = useMemo<DeskRubricCatalog | null>(
        () => (cargandoRubricas ? null : { ids: rubrics.map(r => r.id), defaultId: rubrics.find(r => r.isDefault)?.id ?? null }),
        [rubrics, cargandoRubricas],
    );
    // Lo que piden las rúbricas de cada tipo de trabajo (como el estado del arte).
    const coverageRequirements = useMemo(() => {
        const tipos = project?.workTypes ?? [];
        return tipos.flatMap(w => {
            const rubrica = rubrics.find(r => r.id === w.rubricTemplateId);
            return (rubrica?.rubric.sourceRequirements ?? []).map(q => ({ sourceType: q.sourceType, minimum: q.minimum, workType: w.label }));
        });
    }, [project?.workTypes, rubrics]);

    const plannerDraft = useMemo(() => hasPlannerDraft(project?.id), [project?.id, series]);

    const estado = (cargando: boolean, fallo: boolean): DeskBlockStatus => (cargando ? 'loading' : fallo ? 'error' : 'ready');
    const seriesStatus: DeskBlockStatus = estado(seriesQuery.isLoading, seriesQuery.isError && !series);
    // Un error con datos en caché (una relectura que falló) no borra lo que hay.
    const estudiosStatus = estado(cargandoEstudios, !!errorEstudios && (papers ?? []).length === 0);
    const blocks = {
        /** Estudios y series: la mesa y las fases 3 y 4. Si fallaron, la mesa no dice «sin estudios». */
        work: (estudiosStatus === 'loading' || seriesStatus === 'loading' ? 'loading'
            : estudiosStatus === 'error' || seriesStatus === 'error' ? 'error' : 'ready') as DeskBlockStatus,
        studies: estudiosStatus,
        series: seriesStatus,
        /** La biblioteca da la clasificación de las obras: sin ella, los requisitos por tipo saldrían sin cumplir. */
        sources: estado(cargandoBiblioteca || attached.isLoading, !!errorBiblioteca && resources.length === 0),
        /** Sin sermones, la columna «Sermón» diría «sin sermón» de todo. */
        sermons: estado(cargandoSermones, !!errorSermones && (sermons ?? []).length === 0),
        /** Sin catálogo, la fase 1 del Curso no se puede decidir. */
        rubrics: estado(cargandoRubricas, !!errorRubricas && rubrics.length === 0),
        material: estado(isLoadingOutputs, false),
    };
    const conRubricas = caps.desk === 'course';
    /**
     * El recorrido y «Ahora» esperan a todo lo que cambia una fase o una
     * fila: estudios, series, biblioteca, sermones, material y, en el Curso,
     * las rúbricas. Si algo de eso falló, dice que falló (no un vacío falso).
     * Los sermones que fallan no tumban el escritorio: su columna dice «—».
     */
    const journey: DeskBlockStatus =
        blocks.work === 'error' || blocks.sources === 'error' || (conRubricas && blocks.rubrics === 'error') ? 'error'
            : blocks.work === 'loading' || blocks.sources === 'loading' || blocks.material === 'loading'
                // Los sermones solo cuentan en el Exegético (la columna Sermón de la mesa); el Curso no los usa.
                || (caps.desk === 'exegetical' && blocks.sermons === 'loading') || (conRubricas && blocks.rubrics === 'loading') ? 'loading'
                : 'ready';
    /** Vuelve a pedir lo que falló (y solo eso). */
    const retry = () => {
        if (seriesStatus === 'error') void seriesQuery.refetch();
        if (estudiosStatus === 'error') void queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        if (blocks.sources === 'error') void queryClient.invalidateQueries({ queryKey: libraryQueryKey(user?.uid) });
        if (blocks.rubrics === 'error') void queryClient.invalidateQueries({ queryKey: ['exegesis', 'userRubrics', user?.uid] });
        if (blocks.sermons === 'error') void releerSermones?.();
    };

    const desk = useMemo<ProjectDeskModel | null>(() => {
        if (!project) return null;
        return buildProjectDesk({
            project,
            studies: slices.projectStudies,
            series: series ?? [],
            sermons: sermons ?? [],
            outputs: outputs ?? [],
            sessionCount: slices.projectSessions.length,
            resourceOf,
            rubricCatalog,
            coverageRequirements,
            plannerDraft,
        }, ahora);
    }, [project, slices.projectStudies, series, sermons, outputs, slices.projectSessions.length, resourceOf, rubricCatalog, coverageRequirements, plannerDraft, ahora]);

    // Los tipos sin escritorio propio conservan su recorrido de hoy.
    const legacyRoadmap = useMemo<RoadmapState | null>(() => {
        if (!project || caps.desk !== 'legacy') return null;
        // Si la lectura de las fuentes falló, cuenta las anotadas en el proyecto
        // en vez de afirmar que no hay ninguna.
        const fuentes = attached.error && attached.sources.length === 0 ? (project.sourceIds ?? []).length : attached.sources.length;
        return computeRoadmapState(typeMeta, {
            project: project as AIProject,
            studyCount: slices.projectStudies.length,
            sourceCount: fuentes,
            greekCount: slices.projectGreekSessions.length,
            hebrewCount: slices.projectHebrewSessions.length,
            sessionCount: slices.projectSessions.length,
            outputs: outputs ?? [],
            sermons: slices.projectSermonsAll,
        });
    }, [project, caps.desk, typeMeta, attached.error, attached.sources.length, slices, outputs]);

    return {
        project,
        projects,
        isLoadingProject: !project && isLoadingProjects,
        updateProject,
        typeMeta,
        desk,
        legacyRoadmap,
        blocks,
        journey,
        retrySeries: () => { void seriesQuery.refetch(); },
        /** Reintenta los bloques que fallaron (estudios, series, biblioteca, rúbricas, sermones). */
        retry,
        papers: papers ?? [],
        series: series ?? [],
        sermons: sermons ?? [],
        slices,
        attached,
        workspace: { outputs: outputs ?? [], isLoadingOutputs, createOutput, updateOutput, deleteOutput },
    };
}

export type ProjectDeskView = ReturnType<typeof useProjectDesk>;
