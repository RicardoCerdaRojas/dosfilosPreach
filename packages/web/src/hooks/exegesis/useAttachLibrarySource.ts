import { useCallback } from 'react';
import {
    fetchDocumentPageIndex,
    proposeSheetRanges,
    type ProposalKind,
} from '@dosfilos/infrastructure';
import { questionVersesOfBrief, type PassageReference, type SheetRange, type SourceRole, type SourceType } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useExegesisPapers } from './useExegesisPapers';
import { useSelectSourcePages } from './useSelectSourcePages';

/**
 * Adjuntar un documento de la biblioteca al trabajo.
 *
 * Acá se invierte el default que originó todo esto. Antes, adjuntar desde la
 * biblioteca guardaba la fuente en `full-document`: el prompt terminaba leyendo
 * las primeras veinte páginas de un libro de cuatrocientas, sin aviso. Ahora se
 * calcula la sección que trata el pasaje y se adjunta ESA.
 *
 * Se adjunta con la propuesta aplicada en vez de abrir el selector: cuando la
 * propuesta acierta —el caso de los comentarios con índice— abrir un diálogo por
 * libro sería fricción sin ganancia. El selector queda a un click, en «Ajustar
 * páginas», que es donde el usuario corrige cuando la propuesta no convence.
 *
 * Si no hay propuesta —el documento no tiene estructura y la búsqueda tampoco
 * encontró nada— se cae al comportamiento anterior y se adjunta el documento
 * entero. Es peor, pero es lo que había, y dejar la fuente vacía sería peor
 * todavía.
 */

export interface AttachLibrarySourceInput {
    paperId: string;
    libraryResourceId: string;
    displayLabel: string;
    sourceType: SourceType;
    /** Rol dialéctico elegido por el pastor. Sin él, lo resuelve el tipo. */
    chosenRole?: SourceRole | null;
    citationKey?: string;
    passage: PassageReference;
    assignmentBrief: string | null;
    language: 'es' | 'en';
}

export interface AttachLibrarySourceResult {
    kind: ProposalKind | 'full-document';
    sheetCount: number;
}

export function useAttachLibrarySource() {
    const { user } = useFirebase();
    const { addSource } = useExegesisPapers();
    const selectPages = useSelectSourcePages();

    const attach = useCallback(
        async (input: AttachLibrarySourceInput): Promise<AttachLibrarySourceResult> => {
            if (!user) throw new Error('No authenticated user');

            const index = await fetchDocumentPageIndex(input.libraryResourceId);
            const proposal = await proposeSheetRanges({
                resourceId: input.libraryResourceId,
                userId: user.uid,
                passage: input.passage,
                assignmentBrief: input.assignmentBrief,
                language: input.language,
                pageIndex: index.pages,
                sourceType: input.sourceType,
                questionVerses: questionVersesOfBrief(input.assignmentBrief, input.passage),
            });

            if (proposal.ranges.length === 0) {
                await addSource.mutateAsync({
                    paperId: input.paperId,
                    corpusId: input.libraryResourceId,
                    sourceType: input.sourceType,
                    chosenRole: input.chosenRole ?? null,
                    displayLabel: input.displayLabel,
                    citationKey: input.citationKey,
                });
                return { kind: 'full-document', sheetCount: 0 };
            }

            await selectPages.mutateAsync({
                paperId: input.paperId,
                libraryResourceId: input.libraryResourceId,
                displayLabel: input.displayLabel,
                sourceType: input.sourceType,
                chosenRole: input.chosenRole ?? null,
                citationKey: input.citationKey ?? null,
                sheetRanges: proposal.ranges,
                proposedRanges: proposal.ranges,
                pageIndex: index.pages,
                // La propuesta se aceptó tal cual, sin pasar por ojo humano.
                // Queda registrado para que el corpus pueda decirlo.
                selectionMode: proposal.kind === 'structural' ? 'structural' : 'semantic',
            });

            return { kind: proposal.kind, sheetCount: countSheets(proposal.ranges) };
        },
        [user, addSource, selectPages],
    );

    return { attach, isPending: addSource.isPending || selectPages.isPending };
}

function countSheets(ranges: ReadonlyArray<SheetRange>): number {
    return ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
}
