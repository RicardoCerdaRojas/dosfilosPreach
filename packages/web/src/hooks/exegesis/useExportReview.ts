import { useEffect, useMemo, useState } from 'react';
import {
    applyExportFinding,
    applyMechanicalExportFindings,
    assemblyDelivery,
    exportPaperToMarkdown,
    reviewBeforeExport,
    type ExegeticalPaper,
    type ExportFinding,
} from '@dosfilos/domain';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

/**
 * Por qué no se puede corregir aquí: el trabajo no tiene ensamble, o tiene
 * uno regenerado sin aceptar —corregir sobre el texto que baja pisaría la
 * versión nueva que está en pantalla—.
 */
export type ExportReviewBlock = 'sin-ensamble' | 'difiere' | null;

export interface ExportReview {
    findings: ReadonlyArray<ExportFinding>;
    /** Cuántos se corrigen solos con «Aplicar las mecánicas». */
    mechanicalCount: number;
    /** `null` si se puede corregir en la app. */
    blockedBy: ExportReviewBlock;
    apply: (finding: ExportFinding) => Promise<void>;
    applyMechanical: () => Promise<void>;
    isApplying: boolean;
}

/**
 * La revisión antes de exportar (etapa 2 de la fase «Lecciones del TI #2»).
 *
 * Revisa el texto que va al Word —`assembledMarkdown`, el mismo que lee el
 * exportador— y corrige ahí: la corrección es una edición del ensamble
 * (`saveStepEdit`), como cualquier edición a mano, y queda en la app en vez
 * de en el Word. Sin ensamble, revisa lo que el exportador armaría y solo
 * avisa.
 *
 * Tolera `paper` nulo: se llama antes del retorno temprano de la página.
 */
export function useExportReview(paper: ExegeticalPaper | null): ExportReview {
    const { saveStepEdit } = useExegesisPapers();
    const citationKeys = useMemo(
        () => (paper?.sources ?? []).map(s => s.citationKey).filter((k): k is string => !!k),
        [paper?.sources],
    );
    const pasoDeEnsamble = paper?.steps?.find(s => s.kind === 'assembly') ?? null;
    const entrega = paper ? assemblyDelivery(paper).state : 'sin-ensamble';
    const blockedBy: ExportReviewBlock = !pasoDeEnsamble || !paper?.assembledMarkdown?.trim()
        ? 'sin-ensamble'
        : entrega === 'difiere' ? 'difiere' : null;
    // El texto revisado: el que baja. Sin ensamble, el que armaría el exportador.
    const texto = useMemo(() => {
        if (!paper) return '';
        return paper.assembledMarkdown?.trim() ? paper.assembledMarkdown : exportPaperToMarkdown(paper, { omitHeader: true });
    }, [paper]);
    const findings = useMemo(() => reviewBeforeExport(texto, { citationKeys }), [texto, citationKeys]);
    const mechanicalCount = useMemo(
        () => (blockedBy ? 0 : applyMechanicalExportFindings(texto, { citationKeys }).applied),
        [texto, citationKeys, blockedBy],
    );

    /**
     * Lo último que se guardó, hasta que el trabajo vuelva con ese texto.
     *
     * `saveStepEdit` resuelve antes de que el trabajo se vuelva a leer: sin
     * esperar, una segunda corrección se aplicaba sobre el texto viejo y
     * borraba la primera, y «Exportar igual» bajaba el Word sin ella
     * (revisión adversarial).
     */
    const [enCamino, setEnCamino] = useState<string | null>(null);
    useEffect(() => {
        if (enCamino !== null && paper?.assembledMarkdown === enCamino) setEnCamino(null);
    }, [enCamino, paper?.assembledMarkdown]);
    const isApplying = saveStepEdit.isPending || enCamino !== null;

    const guardar = async (markdown: string) => {
        if (!paper || !pasoDeEnsamble || blockedBy || isApplying) return;
        // Se corrige el texto guardado, no el de pantalla: no hay rótulos de
        // página que restaurar (`restoreStoredPageLabels` no hace falta).
        setEnCamino(markdown);
        try {
            await saveStepEdit.mutateAsync({ paperId: paper.id, stepId: pasoDeEnsamble.id, markdown });
        } catch (err) {
            setEnCamino(null);
            throw err;
        }
    };

    return {
        findings,
        mechanicalCount,
        blockedBy,
        isApplying,
        apply: async (finding) => {
            const nuevo = applyExportFinding(texto, finding);
            if (nuevo) await guardar(nuevo);
        },
        applyMechanical: async () => {
            const { markdown, applied } = applyMechanicalExportFindings(texto, { citationKeys });
            if (applied > 0) await guardar(markdown);
        },
    };
}
