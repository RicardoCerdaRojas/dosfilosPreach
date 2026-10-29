import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExegeticalPaper } from '@dosfilos/domain';

/**
 * TP #8 (Santiago 4:1-10, 2026-10-21, fase 8a, A4): «¿Qué responde cada
 * pregunta?». La nota de Mayor sobre 4:3 (h. 411 = p. 133) y la mitad de la
 * entrada de μέλος en Tuggy (584) faltaban en el corpus y se supo recién al
 * verificar las citas. La tarjeta lo dice antes de generar, con el arreglo.
 */
const hits: Record<string, Array<{ sheet: number; count: number; snippet: string; section: null; verses: number[] }>> = {};
const sinIndice = new Set<string>();
const searchDocumentByReference = vi.fn(async (id: string) => ({ hits: hits[id] ?? [], truncated: false, scannedChunks: sinIndice.has(id) ? 0 : 1 }));
const searchLemmasAndEntriesInDocument = vi.fn(async () => ({
    byTerm: { 'μέλος': [{ sheet: 585, count: 2, snippet: '', section: null }] },
    entries: { 'μέλος': { startSheet: 584, endSheet: 585 } },
}));
vi.mock('@dosfilos/infrastructure', () => ({
    searchDocumentByReference,
    searchLemmasAndEntriesInDocument,
    fetchDocumentPageIndex: vi.fn(async () => ({ pages: [], sections: [], printedPageOffset: null })),
}));
const tok = (text: string, lemma: string, pos: string) => ({ text, lemma, pos, tag: {}, transliteration: '' });
vi.mock('@/hooks/exegesis/usePassageLemmas', () => ({
    usePassageLemmas: () => ({
        isLoading: false,
        data: { hebrew: false, lemmas: [], entries: [{ chapter: 4, verse: 1, morphology: { reference: { chapter: 4, verse: 1 }, text: '', tokens: [tok('μέλεσιν', 'μέλος', 'N')] } }] },
    }),
}));
const mayorNumbering = { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 999, offset: -278 }] };
vi.mock('@/hooks/library', () => ({
    useLibrary: () => ({
        resources: [
            { id: 'r-mayor', pageNumbering: mayorNumbering },
            { id: 'r-tuggy', pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 999, offset: 0 }] } },
            { id: 'r-runge', pageNumbering: null },
            { id: 'r-wallace', pageNumbering: { origin: 'confirmed', segments: [{ fromSheet: 1, toSheet: 999, offset: 0 }] } },
        ],
    }),
}));
const removeSource = vi.fn().mockResolvedValue(undefined);
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => ({ removeSource: { mutateAsync: removeSource, isPending: false } }),
}));
const selectPages = vi.fn().mockResolvedValue({ excerptCount: 1, emptySheets: 0, expectedChunks: 1, incomplete: false });
vi.mock('@/hooks/exegesis/useSelectSourcePages', () => ({
    useSelectSourcePages: () => ({ mutateAsync: selectPages, isPending: false }),
}));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}));
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { CorpusQuestionReviewCard } = await import('../CorpusQuestionReviewCard');

const fuente = (id: string, sourceType: string, sheetRanges: Array<{ start: number; end: number }>, extra: Record<string, unknown> = {}) => ({
    id,
    corpusId: `r-${id}`,
    sourceLibraryResourceId: `r-${id}`,
    sourceType,
    displayLabel: id,
    citationKey: id[0]!.toUpperCase() + id.slice(1),
    mode: 'extracted-excerpts',
    excerpts: [],
    excerptRecipe: { sheetRanges, proposedRanges: [], pinnedRanges: [], passageFingerprint: 'x' },
    ...extra,
});

const BRIEF = '1. ¿Qué significa el sustantivo μέλεσιν (Stg. 4:1)?\n2. ¿Por qué αἰτεῖτε en voz activa (Stg. 4:3)?';

const trabajo = (sources: unknown[], assignmentBrief: string | null = BRIEF) => ({
    id: 'tp8',
    passage: { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 },
    assignmentBrief,
    displayLanguage: 'es',
    steps: [],
    sources,
}) as unknown as ExegeticalPaper;

const montar = (paper: ExegeticalPaper) => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CorpusQuestionReviewCard paper={paper} />
    </QueryClientProvider>,
);

beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    for (const k of Object.keys(hits)) delete hits[k];
    sinIndice.clear();
    hits['r-mayor'] = [
        { sheet: 407, count: 4, snippet: '', section: null, verses: [1, 2] },
        { sheet: 411, count: 3, snippet: '', section: null, verses: [2, 3] },
    ];
    hits['r-tuggy'] = [{ sheet: 585, count: 1, snippet: '', section: null, verses: [1] }];
});

describe('«¿Qué responde cada pregunta?»', () => {
    it('avisa la nota de Mayor sobre 4:3 con su página impresa, y la agrega y fija SOLA', async () => {
        montar(trabajo([fuente('mayor', 'commentary-critical', [{ start: 407, end: 410 }])]));
        const aviso = await screen.findByText(/warning\.missingSheets/);
        expect(aviso.textContent).toContain('"pages":"paperSetup.subSteps.corpus.questionReview.page {\\"page\\":\\"133\\"}"');
        expect(aviso.textContent).toContain('"verses":"4:3"');
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.questionReview.action.addAndPin'));
        await waitFor(() => expect(selectPages).toHaveBeenCalled());
        // Suma sobre lo que el trabajo declara AHORA (lo hace el caso de uso).
        expect(selectPages.mock.calls[0]![0]).toMatchObject({
            paperId: 'tp8',
            libraryResourceId: 'r-mayor',
            sheetRanges: [{ start: 411, end: 411 }],
            pinnedRanges: [{ start: 411, end: 411 }],
            selectionMode: 'manual',
            mergeWithExisting: true,
        });
    });

    it('avisa la entrada de μέλος incompleta en Tuggy: falta la 584', async () => {
        montar(trabajo([fuente('tuggy', 'lexicon-technical', [{ start: 585, end: 585 }])]));
        const aviso = await screen.findByText(/warning\.missingEntry/);
        expect(aviso.textContent).toContain('"term":"μέλεσιν"');
        expect(aviso.textContent).toContain('584');
        expect(searchLemmasAndEntriesInDocument).toHaveBeenCalledWith('r-tuggy', ['μέλος']);
    });

    it('Runge no nombra ningún versículo con pregunta: se puede quitar, y pide resolver la numeración', async () => {
        montar(trabajo([fuente('mayor', 'commentary-critical', [{ start: 407, end: 411 }]), fuente('runge', 'grammar-syntax', [{ start: 100, end: 110 }])]));
        await screen.findByText(/warning\.unrelated/);
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.questionReview.action.remove'));
        // Quitar no tiene deshacer: el primer clic sólo pide confirmación.
        expect(removeSource).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.questionReview.action.removeConfirm'));
        await waitFor(() => expect(removeSource).toHaveBeenCalledWith({ paperId: 'tp8', sourceId: 'runge' }));
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.questionReview.action.calibrate'));
        expect(navigate).toHaveBeenCalledWith(expect.stringContaining('r-runge'));
    });

    it('con todo en el corpus, lo dice', async () => {
        montar(trabajo([fuente('mayor', 'commentary-critical', [{ start: 407, end: 411 }])], '1. ¿Qué dice 4:3 (Stg. 4:3)?'));
        expect(await screen.findByText('paperSetup.subSteps.corpus.questionReview.allGood')).toBeInTheDocument();
    });

    it('no busca en una fuente que no está en la biblioteca', async () => {
        montar(trabajo([fuente('mayor', 'commentary-critical', [{ start: 407, end: 411 }]), fuente('subida', 'commentary-critical', [{ start: 1, end: 2 }])]));
        await screen.findByText('paperSetup.subSteps.corpus.questionReview.allGood');
        expect(searchDocumentByReference).not.toHaveBeenCalledWith('r-subida', expect.anything());
    });

    it('un documento completo no se toca desde la tarjeta: sus páginas no se pulsan (revisión de 8a)', async () => {
        const entero = { ...fuente('mayor', 'commentary-critical', []), mode: 'full-document', excerptRecipe: null };
        montar(trabajo([entero]));
        await screen.findByText('paperSetup.subSteps.corpus.questionReview.allGood');
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.questionReview.byQuestion'));
        expect(screen.queryAllByRole('button', { name: /chip\./ })).toEqual([]);
    });

    it('una fuente de fragmentos sin receta ofrece «Ajustar páginas», no «Agregar y fijar»', async () => {
        const vieja = { ...fuente('mayor', 'commentary-critical', []), excerptRecipe: null, excerpts: [{ text: 'x', sheet: 407 }] };
        montar(trabajo([vieja]));
        fireEvent.click(await screen.findByText('paperSetup.subSteps.corpus.questionReview.action.adjust'));
        expect(navigate).toHaveBeenCalledWith('/dashboard/exegesis/tp8/fuentes/mayor/paginas');
        expect(selectPages).not.toHaveBeenCalled();
    });

    it('un libro sin índice no se da por inútil: se dice que no se pudo revisar', async () => {
        sinIndice.add('r-runge');
        montar(trabajo([fuente('mayor', 'commentary-critical', [{ start: 407, end: 411 }]), fuente('runge', 'grammar-syntax', [{ start: 100, end: 110 }])]));
        await screen.findByText(/warning\.unindexed/);
        expect(screen.queryByText(/warning\.unrelated/)).toBeNull();
    });

    // TP #9 (Santiago 4:11-17, B21): «Ver por pregunta» ocultaba los libros
    // sin referencias; Tuggy y el léxico parecían no revisados.
    it('muestra en cada pregunta los libros revisados sin referencias y los que no tienen índice', async () => {
        sinIndice.add('r-runge');
        hits['r-wallace'] = [];
        montar(trabajo([
            fuente('mayor', 'commentary-critical', [{ start: 407, end: 411 }]),
            fuente('wallace', 'grammar-syntax', [{ start: 1, end: 5 }]),
            fuente('runge', 'grammar-syntax', [{ start: 100, end: 110 }]),
        ]));
        await screen.findByText(/warning\.unindexed/);
        fireEvent.click(screen.getByText('paperSetup.subSteps.corpus.questionReview.byQuestion'));
        const listas = screen.getAllByTestId('pregunta-sin-aporte');
        // Las dos preguntas: Wallace revisada sin referencias, Runge sin índice.
        expect(listas).toHaveLength(2);
        for (const lista of listas) {
            expect(lista.textContent).toContain('Wallace · paperSetup.subSteps.corpus.questionReview.uncovered.noReferences');
            expect(lista.textContent).toContain('Runge · paperSetup.subSteps.corpus.questionReview.uncovered.unindexed');
            expect(lista.textContent).not.toContain('Mayor');
        }
    });

    it('sin preguntas con versículos del pasaje no se muestra', () => {
        const { container } = montar(trabajo([fuente('mayor', 'commentary-critical', [{ start: 407, end: 411 }])], 'Predicar sobre la humildad.'));
        expect(container).toBeEmptyDOMElement();
        expect(searchDocumentByReference).not.toHaveBeenCalled();
    });
});
