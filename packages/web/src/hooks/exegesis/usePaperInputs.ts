import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService, type UpdatePaperInputsInput } from '@dosfilos/application';
import {
    corpusReviewQuestions,
    courseInputsOf,
    derivePaperUnits,
    paperInputStatuses,
    paperRequirements,
    previousDelivery,
    projectBibliography,
    projectWorkTypes,
    readPaperProfileKind,
    requirementWarnings,
    resolveStyleGuide,
    summariesForDeliveryMemory,
    summariesOfSameWorkType,
    type ExegeticalPaper,
} from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useExegesisPapers } from './useExegesisPapers';
import { useUserStyleGuides } from './useUserStyleGuides';

/**
 * «Entradas y requisitos» (A5): el estado de cada entrada, leído de lo que ya
 * vive en la app, y los requisitos con dónde se cumple cada uno. No llama al
 * asistente ni gasta saldo.
 */
export function usePaperInputs(paper: ExegeticalPaper) {
    const { projects } = useFacultyProjects();
    const { papers } = useExegesisPapers();
    const { guides } = useUserStyleGuides();
    const proyecto = projects.find(p => p.id === paper.projectId) ?? null;

    return useMemo(() => {
        const profileKind = readPaperProfileKind(paper).kind;
        const tipo = proyecto ? projectWorkTypes(proyecto).find(t => t.id === paper.projectWorkTypeId) ?? null : null;
        const viva = guides.find(g => g.id === paper.styleGuideId) ?? null;
        const guia = resolveStyleGuide(paper.styleGuideSnapshot, viva ? { displayName: viva.displayName, manifest: viva.manifest } : null);
        const resumenes = summariesForDeliveryMemory(papers ?? [], { projectId: paper.projectId ?? null }).filter(s => !s.archivedAt);
        const anterior = previousDelivery(summariesOfSameWorkType(resumenes, paper, proyecto, { fallbackToAll: !paper.projectWorkTypeId }), paper.id);
        const delSilabo = projectBibliography(proyecto).filter(e => e.origins.includes('syllabus')).length;
        const statuses = paperInputStatuses({
            profileKind,
            assignmentBrief: paper.assignmentBrief,
            rubric: paper.rubric,
            rubricConfirmedByCourse: tipo?.rubricConfirmed === true,
            styleGuide: { id: paper.styleGuideId, liveDiffers: guia.liveGuideDiffers },
            ...courseInputsOf(proyecto, paper.id),
            previousDeliveryFound: !!anterior,
            assignedReadings: (paper.rubric?.courseBibliography?.length ?? 0) + delSilabo,
            courseGrammar: {
                grammarSources: paper.sources.filter(s => s.sourceType === 'grammar-syntax').length,
                ignoredCategories: paper.ignoredGrammarCategories?.length ?? 0,
            },
            marks: paper.inputMarks,
        });
        const units = derivePaperUnits({
            kind: profileKind, assignmentBrief: paper.assignmentBrief, passage: paper.passage,
            steps: paper.steps, sectionTitles: paper.sectionTitles,
        });
        const requirements = paperRequirements({
            profileKind, rubric: paper.rubric, units, marks: paper.requirementMarks, manual: paper.manualRequirements,
        });
        return {
            profileKind, statuses, units, requirements,
            warnings: requirementWarnings(requirements),
            guideRules: guia.manifest?.additionalRules ?? [],
            projectId: proyecto?.id ?? null,
            previousTitle: anterior?.title ?? null,
            /** Sin preguntas, la tarjeta del corpus revisa por versículo; aquí solo informa. */
            reviewUnit: corpusReviewQuestions(paper).unitKind,
        };
    }, [paper, proyecto, papers, guides]);
}

/** Guarda una parte de «Entradas y requisitos»; lo demás no se toca. */
export function useUpdatePaperInputs(paperId: string) {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (patch: Omit<UpdatePaperInputsInput, 'ownerId' | 'paperId'>) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.updatePaperInputs.execute({ ownerId: user.uid, paperId, ...patch });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] }),
    });
}
