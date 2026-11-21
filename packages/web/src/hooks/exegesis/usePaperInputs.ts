import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService, type UpdatePaperInputsInput } from '@dosfilos/application';
import {
    answeredUnitIds,
    checkLength,
    computeRubricCompliance,
    corpusReviewQuestions,
    framingInDocument,
    requirementPlacementControls,
    syllabusRequirementId,
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
        // Lo que se puede medir no se marca a mano (prueba del fundador en TP #10).
        const enCorpus = new Set(paper.sources.map(s => s.sourceLibraryResourceId ?? s.corpusId));
        const documento = paper.assembledMarkdown?.trim() ?? '';
        const measures = {
            length: documento && paper.rubric ? checkLength(documento, paper.rubric.expectedLength, paper.rubric.formatting) : null,
            sources: paper.rubric
                ? computeRubricCompliance(paper.sources.map(s => s.sourceType), paper.rubric).requirements.map(r => ({ sourceType: r.sourceType, have: r.have, required: r.required }))
                : [],
            answeredUnits: answeredUnitIds(units, paper.steps),
            framingInDocument: framingInDocument(paper.steps),
            readingsInCorpus: new Map((paper.rubric?.courseBibliography ?? [])
                .filter(b => !!b.resourceId)
                .map(b => [syllabusRequirementId(b.title), enCorpus.has(b.resourceId!)] as const)),
        };
        const requirements = paperRequirements({
            profileKind, rubric: paper.rubric, units, marks: paper.requirementMarks, manual: paper.manualRequirements, measures,
        });
        return {
            profileKind, statuses, units, requirements,
            placement: requirementPlacementControls(profileKind),
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
