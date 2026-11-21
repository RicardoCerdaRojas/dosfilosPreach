import { useState } from 'react';
import { readPaperProfileKind, resolvePaperProfileKind, type ExegeticalMethod, type PaperProfileKind } from '@dosfilos/domain';

/**
 * El tipo de trabajo en la página de creación. Lo pone quien rellena (el
 * perfil, el tipo de trabajo del proyecto) o el estudiante; mientras nadie lo
 * pone, se deduce del encuadre y del método, y se ve deducido. Al crear se
 * manda siempre: el estudiante lo vio antes de crear (diseño §2.1, «obligatorio
 * en tipos nuevos»).
 */
export function useProfileKindChoice(input: {
    assignmentBrief: string;
    exegeticalMethod: ExegeticalMethod | null;
    passage: { chapterStart: number; chapterEnd: number } | null;
}) {
    const [chosen, setChosen] = useState<PaperProfileKind | null>(null);
    const lectura = readPaperProfileKind({ profileKind: chosen, ...input });
    return {
        value: lectura.kind,
        inferredReason: lectura.inferred ? lectura.reason : null,
        /** El estudiante lo elige. */
        choose: setChosen,
        /** Lo trae un perfil o un tipo de trabajo; `null`/ausente vuelve a deducirse. */
        fromSource: (kind: unknown) => setChosen(resolvePaperProfileKind(kind)),
    };
}
