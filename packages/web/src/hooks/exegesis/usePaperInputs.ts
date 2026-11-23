import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService, type UpdatePaperInputsInput } from '@dosfilos/application';
import {
    corpusReviewQuestions,
    requirementPlacementControls,
    courseInputsOf,
    paperInputStatuses,
    previousDelivery,
    projectBibliography,
    projectWorkTypes,
    readPaperProfileKind,
    requirementsOfPaper,
    resolveStyleGuide,
    summariesForDeliveryMemory,
    summariesOfSameWorkType,
    type ExegeticalPaper,
} from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useFacultyProjects } from '@/hooks/faculty/useFacultyProjects';
import { useExegesisPapers } from './useExegesisPapers';
import { useUserStyleGuides } from './useUserStyleGuides';
import { useLibrary } from '@/hooks/library/useLibrary';

/**
 * «Entradas y requisitos» (A5): el estado de cada entrada, leído de lo que ya
 * vive en la app, y los requisitos con dónde se cumple cada uno. No llama al
 * asistente ni gasta saldo.
 */
export function usePaperInputs(paper: ExegeticalPaper) {
    const { projects } = useFacultyProjects();
    const { papers } = useExegesisPapers();
    const { guides } = useUserStyleGuides();
    const { resources } = useLibrary();
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
        const { units, requirements, warnings } = requirementsOfPaper(paper, id => resources.find(r => r.id === id));
        return {
            profileKind, statuses, units, requirements,
            placement: requirementPlacementControls(profileKind),
            warnings,
            guideRules: guia.manifest?.additionalRules ?? [],
            projectId: proyecto?.id ?? null,
            previousTitle: anterior?.title ?? null,
            /** Sin preguntas, la tarjeta del corpus revisa por versículo; aquí solo informa. */
            reviewUnit: corpusReviewQuestions(paper).unitKind,
        };
    }, [paper, proyecto, papers, guides, resources]);
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
        // El trabajo devuelto se siembra ANTES de soltar el botón: con solo
        // invalidar, la marca siguiente se escribía sobre el trabajo viejo y
        // borraba la anterior (revisión final de la fase A; la relectura
        // tarda 40–90 s en local).
        onSuccess: (paper) => {
            queryClient.setQueryData(['exegesis', 'papers', user?.uid, paper.id], paper);
            queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] });
        },
    });
}
