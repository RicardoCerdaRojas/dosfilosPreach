import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exegesisService } from '@dosfilos/application';
import { parseBriefQuestions, questionsOfStep, type ExegeticalPaper } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';

/**
 * Fija (o suelta) hojas de una fuente para los pasos de unas preguntas, desde
 * la revisión por pregunta (fase «Del corpus al texto», PR 2).
 *
 * Antes la revisión fijaba en la receta de la fuente, y la hoja viajaba a todos
 * los pasos: en el TP #8 lo fijado ocupaba el 79 % de cada versículo aunque la
 * hoja fuera de otra pregunta (medido). Ahora va solo a los pasos de esa
 * pregunta (`pinnedSheets`), y no pide que la fuente tenga páginas elegidas.
 */
/** La pregunta no cae en el versículo de ningún paso: no hay dónde fijar. */
export class SinPasoError extends Error {
    constructor() { super('La pregunta no tiene paso'); }
}

export function usePinSheetsForQuestion(paper: ExegeticalPaper | null | undefined) {
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: async (input: { sourceId: string; questions: ReadonlyArray<number>; sheets: ReadonlyArray<number>; pin: boolean }) => {
            if (!user || !paper) throw new Error('Sin trabajo o sin usuario');
            const preguntas = parseBriefQuestions(paper.assignmentBrief, paper.passage);
            const pasos = paper.steps
                .filter(s => s.kind === 'verse' && questionsOfStep(s, preguntas).some(q => input.questions.includes(q.number)))
                .map(s => s.id);
            if (pasos.length === 0) throw new SinPasoError();
            // Uno por uno: cada escritura es una transacción sobre el mismo
            // documento, y aplica el cambio sobre lo guardado, no sobre esta copia.
            for (const stepId of pasos) {
                await exegesisService.setStepPinnedSheets.execute({ ownerId: user.uid, paperId: paper.id, stepId, sourceId: input.sourceId, sheets: input.sheets, pin: input.pin });
            }
        },
        // También si falló a mitad: lo que sí se escribió tiene que verse.
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] }),
    });
    const { mutateAsync } = mutation;
    const run = useCallback(
        (sourceId: string, questions: ReadonlyArray<number>, sheets: ReadonlyArray<number>, pin: boolean) =>
            mutateAsync({ sourceId, questions, sheets, pin }),
        [mutateAsync],
    );
    return { run, isPending: mutation.isPending };
}
