import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildEmptyCanonicalVerseAnalysis, type ExegeticalStep } from '@dosfilos/domain';

/**
 * Deshacer «Regenerar» (decisión del fundador, 2026-11-02): el botón aparece
 * cuando hay a qué volver, y dice si el Word no recibió lo restaurado.
 */
const orden: string[] = [];
const mutaciones = new Map<string, { mutateAsync: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn>; isPending: boolean }>();
const mutacion = (k: string) => {
    if (!mutaciones.has(k)) {
        mutaciones.set(k, {
            mutateAsync: vi.fn().mockImplementation(async () => { orden.push(k); return { documentBehind: false, step: { state: 'accepted' } }; }),
            mutate: vi.fn(),
            isPending: false,
        });
    }
    return mutaciones.get(k)!;
};
const guardarLectura = vi.fn();
vi.mock('@dosfilos/application', () => ({ exegesisService: { updateStepStudentReading: { execute: (i: unknown) => guardarLectura(i) } } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({
    useExegesisPapers: () => new Proxy({}, { get: (_t, k: string) => mutacion(k) }),
}));
vi.mock('@/hooks/exegesis/useReopenStep', () => ({ useReopenStep: () => mutacion('reopen') }));
let papelDelPaso: Record<string, unknown> = { sources: [] };
vi.mock('@/hooks/exegesis/useExegesisPaper', () => ({ useExegesisPaper: () => ({ paper: papelDelPaso }) }));
vi.mock('@/components/exegesis/citation/SourceViewerProvider', () => ({
    useRegisterCitationSink: () => undefined,
    useSourceViewer: () => ({ open: vi.fn(), openCitation: vi.fn() }),
}));
vi.mock('@/components/exegesis/canonical/CanonicalAnalysisStudyView', () => ({ CanonicalAnalysisStudyView: () => null }));
vi.mock('@/pages/library/components/CreditPacksDialog', () => ({ CreditPacksDialog: () => null }));
vi.mock('@/components/exegesis/ExegesisOutOfCreditsDialog', () => ({ ExegesisOutOfCreditsDialog: () => null }));
vi.mock('@/components/exegesis/CitationVerificationDialog', () => ({ CitationVerificationDialog: () => null }));
vi.mock('@/components/exegesis/AgregarIdeaDialog', () => ({ AgregarIdeaDialog: () => null }));
vi.mock('@/components/exegesis/ExegesisPreConfirmDialog', () => ({ ExegesisPreConfirmDialog: () => null }));
vi.mock('@/i18n', () => ({
    useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}));
vi.mock('react-router-dom', () => ({
    Link: ({ children }: { children: unknown }) => children,
    useNavigate: () => vi.fn(),
}));
const toastError = vi.fn();
const toastWarning = vi.fn();
const toastInfo = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), info: (...a: unknown[]) => toastInfo(...a), warning: (...a: unknown[]) => toastWarning(...a) } }));

const { StepCard } = await import('../StepCard');

const REF = { bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: 4, verseEnd: 4 };
const analisis = buildEmptyCanonicalVerseAnalysis(REF as never);
const verso = (extra: Record<string, unknown> = {}): ExegeticalStep => {
    const v = { id: 'v1', markdown: 'Prosa.', canonicalAnalysis: analisis, parentVersionId: null, createdAt: new Date(), ...extra };
    return { id: 's', paperId: 'p', kind: 'verse', verseRef: REF, order: 1, state: 'accepted', versions: [v], current: v, accepted: v, createdAt: new Date(), updatedAt: new Date() } as unknown as ExegeticalStep;
};
const conQuery = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const expandir = () => fireEvent.click(screen.getByRole('button', { name: /detail\.steps\.action\.expand/ }));
const elPie = (clave: string) => screen.getAllByText(clave).find(e => e.closest('button'))!.closest('button')!;

beforeEach(() => {
    cleanup();
    mutaciones.clear();
    toastError.mockClear();
    toastWarning.mockClear();
    papelDelPaso = { sources: [] };
});

describe('deshacer «Regenerar»', () => {
    it('sin nada a qué volver, no hay botón', () => {
        conQuery(<StepCard step={verso()} paperId="p" language="es" />);
        expandir();
        expect(screen.queryByText('detail.steps.action.undoChange')).toBeNull();
        expect(screen.queryByText('detail.steps.action.redoChange')).toBeNull();
    });

    it('un versículo recompuesto ofrece deshacer sobre la versión a la vista', async () => {
        mutacion('undoStepChange').mutateAsync.mockResolvedValue({ documentBehind: false, step: { state: 'accepted' } });
        conQuery(<StepCard step={verso({ previousProse: { markdown: 'Antes.' } })} paperId="p" language="es" hasAssembly />);
        expandir();
        expect(screen.queryByText('detail.steps.action.redoChange')).toBeNull();
        fireEvent.click(elPie('detail.steps.action.undoChange'));
        await waitFor(() => expect(mutacion('undoStepChange').mutateAsync).toHaveBeenCalledWith({ paperId: 'p', stepId: 's', action: 'undo', expected: { kind: 'prose', versionId: 'v1' } }));
        expect(toastWarning).not.toHaveBeenCalled();
    });

    it('lo deshecho ofrece rehacer', async () => {
        mutacion('undoStepChange').mutateAsync.mockResolvedValue({ documentBehind: false, step: { state: 'accepted' } });
        conQuery(<StepCard step={verso({ previousProse: { markdown: 'Nueva.', undone: true } })} paperId="p" language="es" />);
        expandir();
        expect(screen.queryByText('detail.steps.action.undoChange')).toBeNull();
        fireEvent.click(elPie('detail.steps.action.redoChange'));
        await waitFor(() => expect(mutacion('undoStepChange').mutateAsync).toHaveBeenCalledWith({ paperId: 'p', stepId: 's', action: 'redo', expected: { kind: 'prose', versionId: 'v1' } }));
    });

    it('si el documento no recibió lo restaurado, lo dice', async () => {
        mutacion('undoStepChange').mutateAsync.mockResolvedValue({ documentBehind: true, step: { state: 'accepted' } });
        conQuery(<StepCard step={verso({ previousProse: { markdown: 'Antes.' } })} paperId="p" language="es" hasAssembly />);
        expandir();
        fireEvent.click(elPie('detail.steps.action.undoChange'));
        await waitFor(() => expect(toastWarning).toHaveBeenCalledWith('detail.steps.toast.undoneNotInDocument'));
    });

    it('si la versión quedó en revisión, lo dice: el trabajo sigue con la aceptada', async () => {
        mutacion('undoStepChange').mutateAsync.mockResolvedValue({ documentBehind: false, step: { state: 'awaiting-review' } });
        conQuery(<StepCard step={verso({ previousProse: { markdown: 'Antes.' } })} paperId="p" language="es" />);
        expandir();
        fireEvent.click(elPie('detail.steps.action.undoChange'));
        await waitFor(() => expect(toastInfo).toHaveBeenCalledWith('detail.steps.toast.movedToReview'));
    });

    it('mientras se verifican las citas no se puede deshacer: los veredictos quedarían en otra prosa', () => {
        mutacion('verifyStepCitations').isPending = true;
        conQuery(<StepCard step={verso({ previousProse: { markdown: 'Antes.' } })} paperId="p" language="es" />);
        expandir();
        const botones = screen.getAllByRole('button', { name: /detail\.steps\.action\.undoChange/ }) as HTMLButtonElement[];
        // El del encabezado y el del pie.
        expect(botones.length).toBeGreaterThan(1);
        expect(botones.every(b => b.disabled)).toBe(true);
        mutacion('verifyStepCitations').isPending = false;
    });

    describe('la versión a la vista y la aceptada', () => {
        const pasoEnRevision = (current: 'v2' | 'v3') => {
            const v1 = { id: 'v1', markdown: 'Uno.', parentVersionId: null, createdAt: new Date() };
            const v2 = { id: 'v2', markdown: 'Dos.', parentVersionId: 'v1', createdAt: new Date() };
            const v3 = { id: 'v3', markdown: 'Tres.', parentVersionId: 'v2', createdAt: new Date() };
            return { id: 's', paperId: 'p', kind: 'conclusion', verseRef: null, order: 5, state: 'awaiting-review', versions: [v1, v2, v3], current: current === 'v2' ? v2 : v3, accepted: v1, createdAt: new Date(), updatedAt: new Date() } as unknown as ExegeticalStep;
        };

        it('dice cuál se ve y cuál es la aceptada', () => {
            conQuery(<StepCard step={pasoEnRevision('v2')} paperId="p" language="es" />);
            expect(document.body.textContent).toContain('detail.steps.versionOf {"shown":2,"total":3}');
            expect(document.body.textContent).toContain('detail.steps.acceptedVersion {"number":1}');
        });

        it('el botón va directo a la aceptada', async () => {
            mutacion('undoStepChange').mutateAsync.mockResolvedValue({ documentBehind: false, step: { state: 'accepted' } });
            conQuery(<StepCard step={pasoEnRevision('v3')} paperId="p" language="es" />);
            fireEvent.click(elPie('detail.steps.action.backToAccepted {"number":1}'));
            await waitFor(() => expect(mutacion('undoStepChange').mutateAsync).toHaveBeenCalledWith({ paperId: 'p', stepId: 's', action: 'accepted', expected: { kind: 'version', versionId: 'v3', targetVersionId: 'v1' } }));
        });

        it('viendo la aceptada no repite su número ni ofrece el botón', () => {
            conQuery(<StepCard step={verso()} paperId="p" language="es" />);
            expandir();
            expect(document.body.textContent).not.toContain('detail.steps.acceptedVersion');
            expect(screen.queryByText(/backToAccepted/)).toBeNull();
        });
    });

    describe('ninguna acción repite ícono', () => {
        const iconos = (zona: Element) => [...zona.querySelectorAll('button svg, a svg')].map(i => i.getAttribute('class'));
        const sinRepetidos = (lista: Array<string | null>) => expect(new Set(lista).size).toBe(lista.length);
        const conclusionAceptada = () => {
            const v1 = { id: 'v1', markdown: 'Uno.', parentVersionId: null, createdAt: new Date() };
            const v2 = { id: 'v2', markdown: 'Dos.', parentVersionId: 'v1', createdAt: new Date() };
            return { id: 's', paperId: 'p', kind: 'conclusion', verseRef: null, order: 5, state: 'accepted', versions: [v1, v2], current: v2, accepted: v2, createdAt: new Date(), updatedAt: new Date() } as unknown as ExegeticalStep;
        };

        it.each([
            ['una conclusión', conclusionAceptada],
            ['un versículo', () => verso({ previousProse: { markdown: 'Antes.' } })],
        ])('en %s aceptado, ni en el pie ni en el encabezado', (_n, paso) => {
            conQuery(<StepCard step={paso()} paperId="p" language="es" />);
            expandir();
            const pie = elPie('detail.steps.action.redo').closest('footer')!;
            sinRepetidos(iconos(pie));
            expect(pie.querySelector('.lucide-lock-open')).not.toBeNull();
            const delEncabezado = screen.getAllByRole('button', { name: /detail\.steps\.action\.redo$/ }).find(b => !b.closest('footer'))!;
            sinRepetidos(iconos(delEncabezado.parentElement!));
        });
    });

    it('en revisión también se ofrece, para volver de lo regenerado', () => {
        const v1 = { id: 'v1', markdown: 'Antes.', parentVersionId: null, createdAt: new Date() };
        const v2 = { id: 'v2', markdown: 'Después.', parentVersionId: 'v1', createdAt: new Date() };
        const paso = { id: 's', paperId: 'p', kind: 'conclusion', verseRef: null, order: 5, state: 'awaiting-review', versions: [v1, v2], current: v2, accepted: v1, createdAt: new Date(), updatedAt: new Date() } as unknown as ExegeticalStep;
        // Un paso en revisión ya viene abierto.
        conQuery(<StepCard step={paso} paperId="p" language="es" />);
        expect(screen.getAllByText('detail.steps.action.undoChange').length).toBeGreaterThan(0);
    });
});
