import { useEffect, useMemo, useRef, useState } from 'react';
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
    /** Aplica una corrección: se ve al instante y se guarda por detrás. */
    apply: (finding: ExportFinding) => Promise<void>;
    applyMechanical: () => Promise<void>;
    /**
     * Hay correcciones aplicadas que el trabajo todavía no trae guardadas.
     * Mientras tanto se puede seguir corrigiendo, pero no exportar: el Word
     * saldría sin ellas.
     */
    isSaving: boolean;
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
 * Cada corrección se aplica al instante sobre una copia local del texto y se
 * guarda por detrás, de a una edición por vez: si se aplican varias mientras
 * se guarda, la siguiente guarda lleva todas. Esperar la vuelta completa de
 * cada una (guardar y releer el trabajo) dejaba los botones trabados varios
 * segundos sin decir nada (fundador, 2026-10-31); aplicar sobre el texto
 * viejo, en cambio, borraba la corrección anterior (revisión adversarial).
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

    /** El texto con las correcciones aplicadas que el trabajo todavía no trae. */
    const [local, setLocal] = useState<string | null>(null);
    const localRef = useRef<string | null>(null);
    /** Lo próximo que hay que guardar, y si hay una guarda en vuelo. */
    const pendiente = useRef<string | null>(null);
    const enVuelo = useRef(false);
    const [guardando, setGuardando] = useState(false);

    // El trabajo volvió con lo guardado y no queda nada por guardar: la copia
    // local ya no hace falta.
    useEffect(() => {
        if (local !== null && !guardando && paper?.assembledMarkdown === local) {
            localRef.current = null;
            setLocal(null);
        }
    }, [local, guardando, paper?.assembledMarkdown]);

    // El texto revisado: el que baja, con lo aplicado encima. Sin ensamble,
    // el que armaría el exportador.
    const texto = useMemo(() => {
        if (local !== null) return local;
        if (!paper) return '';
        return paper.assembledMarkdown?.trim() ? paper.assembledMarkdown : exportPaperToMarkdown(paper, { omitHeader: true });
    }, [paper, local]);
    const findings = useMemo(() => reviewBeforeExport(texto, { citationKeys }), [texto, citationKeys]);
    const mechanicalCount = useMemo(
        () => (blockedBy ? 0 : applyMechanicalExportFindings(texto, { citationKeys }).applied),
        [texto, citationKeys, blockedBy],
    );

    /** Guarda lo último aplicado; si mientras tanto se aplicó más, vuelve a guardar. */
    const guardarPorDetras = async () => {
        if (enVuelo.current || !paper || !pasoDeEnsamble) return;
        enVuelo.current = true;
        setGuardando(true);
        try {
            while (pendiente.current !== null) {
                const markdown = pendiente.current;
                pendiente.current = null;
                // Se corrige el texto guardado, no el de pantalla: no hay
                // rótulos de página que restaurar.
                await saveStepEdit.mutateAsync({ paperId: paper.id, stepId: pasoDeEnsamble.id, markdown });
            }
        } catch (err) {
            // Lo no guardado se descarta: la revisión vuelve a mostrar el
            // texto que el trabajo tiene de verdad.
            pendiente.current = null;
            localRef.current = null;
            setLocal(null);
            throw err;
        } finally {
            enVuelo.current = false;
            setGuardando(false);
        }
    };

    const aplicarTexto = async (nuevo: string | null) => {
        if (!nuevo || blockedBy) return;
        localRef.current = nuevo;
        setLocal(nuevo);
        pendiente.current = nuevo;
        await guardarPorDetras();
    };

    /** El texto sobre el que se aplica: lo último aplicado, aunque React no haya vuelto a pintar. */
    const actual = () => localRef.current ?? texto;

    return {
        findings,
        mechanicalCount,
        blockedBy,
        isSaving: guardando || local !== null,
        apply: async (finding) => {
            // El aviso se calculó sobre `texto`; si en medio se aplicó otro,
            // se busca de nuevo en el texto actual (las posiciones cambiaron).
            const base = actual();
            const vigente = base === texto
                ? finding
                : reviewBeforeExport(base, { citationKeys }).find(f => f.kind === finding.kind && f.find === finding.find && f.replace === finding.replace);
            await aplicarTexto(vigente ? applyExportFinding(base, vigente) : null);
        },
        applyMechanical: async () => {
            const { markdown, applied } = applyMechanicalExportFindings(actual(), { citationKeys });
            await aplicarTexto(applied > 0 ? markdown : null);
        },
    };
}
