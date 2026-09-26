import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { proposeSheetRanges, type ProposalKind } from '@dosfilos/infrastructure';
import { lemmasOfAnalyses, normalizeSheetRanges, type SheetRange } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/context/firebase-context';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import { useDocumentPageIndex } from '@/hooks/exegesis/useDocumentPageIndex';
import { PaperCorpusTooLargeError } from '@dosfilos/application';
import { useSelectSourcePages } from '@/hooks/exegesis/useSelectSourcePages';
import { SourcePagesWorkspace } from '@/components/exegesis/setup/page-picker/SourcePagesWorkspace';
import { useLemmaPages } from '@/hooks/exegesis/useLemmaPages';
import { usePassagePages } from '@/hooks/exegesis/usePassagePages';
import { usePageNumbering } from '@/hooks/library/usePageNumbering';

/**
 * Elegir qué hojas de una fuente entran al trabajo.
 *
 * Es una página y no un diálogo por lo que la tarea es: recorrer un libro de
 * cuatrocientas páginas para decidir qué parte sirve. Eso pide el viewport
 * entero, no un recuadro centrado con ancho tope; pide botón atrás y recarga
 * sin perder el lugar; y pide una URL, porque el usuario se va a ir a consultar
 * otra cosa y va a querer volver.
 *
 * La primera versión fue un modal y se notó enseguida: tres paneles y un visor
 * de PDF no entran en un diálogo sin pelearse por cada píxel.
 */
/**
 * Tipos de obra que tienen una ENTRADA por lema: buscar «שׁוּב» en ellas
 * lleva a un sitio concreto. En un comentario, el mismo lema aparece
 * repartido por el pasaje que comenta, así que proponer páginas por lema
 * sería ruido.
 */
const TIPOS_CON_ENTRADA_POR_LEMA: ReadonlySet<string> = new Set([
    'lexicon-technical',
    'theological-dictionary',
]);

export function ExegesisSourcePagesPage() {
    const { paperId, sourceId } = useParams<{ paperId: string; sourceId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const { paper, isLoading: paperLoading } = useExegesisPaper(paperId);
    const selectPages = useSelectSourcePages();

    const source = paper?.sources.find(s => s.id === sourceId) ?? null;
    const resourceId = source ? (source.sourceLibraryResourceId ?? source.corpusId) : null;

    const index = useDocumentPageIndex(resourceId);
    const [proposal, setProposal] = useState<{ ranges: SheetRange[]; kind: ProposalKind } | null>(null);

    useEffect(() => {
        if (!user || !paper || !resourceId || !index.data) return;
        let cancelled = false;
        proposeSheetRanges({
            resourceId,
            userId: user.uid,
            passage: paper.passage,
            assignmentBrief: paper.assignmentBrief,
            language: paper.displayLanguage,
            pageIndex: index.data.pages,
        }).then(result => {
            if (!cancelled) setProposal(result);
        });
        return () => { cancelled = true; };
    }, [user, paper, resourceId, index.data]);

    /**
     * Los lemas que este trabajo va a buscar en el léxico.
     *
     * Sólo para léxicos y diccionarios: en un comentario un lema no tiene
     * entrada propia, y proponer páginas por lema ahí sería ruido. Salen de
     * los análisis aceptados, que es donde el lema existe como dato.
     */
    const esLexico = source ? TIPOS_CON_ENTRADA_POR_LEMA.has(source.sourceType) : false;
    const lemmas = useMemo(() => {
        if (!paper || !esLexico) return [];
        const analyses = paper.steps
            .filter(step => step.kind === 'verse')
            .map(step => (step.accepted ?? step.current)?.canonicalAnalysis)
            .filter((a): a is NonNullable<typeof a> => !!a);
        return lemmasOfAnalyses(analyses);
    }, [paper, esLexico]);

    const lemmaPages = useLemmaPages(resourceId, lemmas, esLexico);

    /**
     * Dónde nombra ESTE libro al pasaje del trabajo.
     *
     * Para toda fuente, sin mirar su tipo. Un comentario no va a nombrarlo
     * —su página entera ya es el pasaje— y devuelve vacío, que es correcto y
     * el panel lo dice. Las gramáticas y los léxicos sí lo nombran, como
     * ejemplo, y ahí es donde el camino semántico devuelve cero.
     *
     * No depende del análisis canónico, que corre después de armar el corpus:
     * la llave es el pasaje, que se conoce desde el primer minuto.
     */
    const passagePages = usePassagePages(resourceId, paper?.passage ?? null, !!resourceId);

    // La numeración se pide para cualquier fuente, no sólo para los léxicos:
    // las dos propuestas rotulan sus hojas con el folio impreso del libro.
    const numbering = usePageNumbering(resourceId);

    const otherSourcesChars = useMemo(() => {
        if (!paper || !source) return 0;
        return paper.sources
            .filter(s => s.id !== source.id)
            .reduce((sum, s) => sum + s.excerpts.reduce((n, e) => n + e.text.length, 0), 0);
    }, [paper, source]);

    const back = () => navigate(`/dashboard/exegesis/${paperId}/setup?tab=corpus`);

    const handleConfirm = async (ranges: ReadonlyArray<SheetRange>, pinnedRanges: ReadonlyArray<SheetRange>) => {
        if (!paper || !source || !resourceId || !index.data) return;
        try {
            const result = await selectPages.mutateAsync({
                paperId: paper.id,
                libraryResourceId: resourceId,
                displayLabel: source.displayLabel,
                sourceType: source.sourceType,
                citationKey: source.citationKey,
                sheetRanges: ranges,
                pinnedRanges,
                proposedRanges: proposal?.ranges ?? [],
                pageIndex: index.data.pages,
                selectionMode: 'manual',
            });
            toast.success(
                t('paperSetup.subSteps.corpus.picker.toast.saved', { count: result.excerptCount }),
            );
            if (result.incomplete) {
                toast.warning(t('paperSetup.subSteps.corpus.picker.toast.incomplete', {
                    saved: result.excerptCount,
                    expected: result.expectedChunks,
                }));
            }
            if (result.emptySheets > 0) {
                toast.warning(
                    t('paperSetup.subSteps.corpus.picker.toast.emptySheets', { count: result.emptySheets }),
                );
            }
            back();
        } catch (err) {
            console.error('[ExegesisSourcePagesPage] no se pudo guardar la selección', err);
            toast.error(err instanceof PaperCorpusTooLargeError
                ? t('paperSetup.subSteps.corpus.picker.toast.tooLarge')
                : t('paperSetup.subSteps.corpus.picker.toast.saveFailed'));
        }
    };

    if (paperLoading || (!!resourceId && index.isLoading)) {
        return (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="text-sm">{t('paperSetup.subSteps.corpus.picker.loadingIndex')}</span>
            </div>
        );
    }

    if (!paper || !source) {
        return (
            <div className="px-6 py-16 text-center">
                <p className="text-sm text-muted-foreground">
                    {t('paperSetup.subSteps.corpus.picker.sourceNotFound')}
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={back}>
                    {t('paperSetup.subSteps.corpus.picker.backToCorpus')}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <header className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-3">
                <Button
                    variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0"
                    onClick={back}
                    aria-label={t('paperSetup.subSteps.corpus.picker.backToCorpus')}
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold text-foreground">
                        {source.displayLabel}
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        {t('paperSetup.subSteps.corpus.picker.subtitle')}
                    </p>
                </div>
            </header>

            <SourcePagesWorkspace
                pages={index.data?.pages ?? []}
                printedPageOffset={index.data?.printedPageOffset ?? null}
                resourceId={resourceId!}
                proposedRanges={proposal?.ranges ?? []}
                proposalKind={proposal?.kind ?? 'none'}
                proposalPending={proposal === null}
                initialRanges={normalizeSheetRanges(source.excerptRecipe?.sheetRanges ?? [])}
                initialPinned={normalizeSheetRanges(source.excerptRecipe?.pinnedRanges ?? [])}
                otherSourcesChars={otherSourcesChars}
                onConfirm={handleConfirm}
                isSaving={selectPages.isPending}
                lemmaProposals={esLexico ? lemmaPages.proposals : undefined}
                lemmaLoading={lemmaPages.isLoading}
                passageProposals={passagePages.proposals}
                passageLoading={passagePages.isLoading}
                numbering={numbering.data?.numbering ?? null}
            />
        </div>
    );
}
