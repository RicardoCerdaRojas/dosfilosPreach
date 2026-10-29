import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildEmptyCanonicalVerseAnalysis, type ExegeticalStep, type PaperFormatting } from '@dosfilos/domain';

/**
 * La tarjeta del paso tras el TP #9 (Santiago 4:11-17, 2026-10-28):
 *   - B45: editar la prosa aceptada no le quita «p.» a las citas que no se tocaron;
 *   - B22: un paso que el encargo no pide se rotula así y su botón no compite;
 *   - B25: «Analizar» guarda antes «Mi lectura», y si no puede, no genera.
 */
const orden: string[] = [];
const mutaciones = new Map<string, { mutateAsync: ReturnType<typeof vi.fn>; mutate: ReturnType<typeof vi.fn>; isPending: boolean }>();
const mutacion = (k: string) => {
    if (!mutaciones.has(k)) {
        mutaciones.set(k, {
            mutateAsync: vi.fn().mockImplementation(async () => { orden.push(k); return { assemblyUpdated: true }; }),
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
vi.mock('@/hooks/exegesis/useReviewVerseProse', () => ({ useReviewVerseProse: () => ({ mutateAsync: vi.fn(), isPending: false, data: undefined }) }));
vi.mock('@/components/exegesis/citation/SourceViewerProvider', () => ({
    useRegisterCitationSink: () => undefined,
    useSourceViewer: () => ({ open: vi.fn(), openCitation: vi.fn() }),
}));
vi.mock('@/components/exegesis/canonical/CanonicalAnalysisStudyView', () => ({ CanonicalAnalysisStudyView: () => null }));
vi.mock('@/components/exegesis/ProseReviewCard', () => ({ ProseReviewCard: () => null }));
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
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn(), warning: vi.fn() } }));

const { StepCard } = await import('../StepCard');

const REF = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 12, verseEnd: 12 };
const SIN_P = { citationForm: 'parenthetical', pageLabel: 'bare' } as PaperFormatting;
const aceptado = (markdown: string): ExegeticalStep => {
    const version = { id: 'v1', markdown, canonicalAnalysis: buildEmptyCanonicalVerseAnalysis(REF as never), createdAt: new Date() };
    return {
        id: 's12', paperId: 'tp9', kind: 'verse', verseRef: REF, order: 2, state: 'accepted',
        versions: [version], current: version, accepted: version, createdAt: new Date(), updatedAt: new Date(),
    } as unknown as ExegeticalStep;
};
const pendiente = (extra: Partial<ExegeticalStep> = {}): ExegeticalStep => ({
    ...aceptado(''), state: 'pending', current: null, accepted: null, versions: [], ...extra,
} as unknown as ExegeticalStep);
const ENCARGO = 'Preguntas:\n1. ¿Cómo funciona el participio δυνάμενος (Stg. 4:12)?';
const conQuery = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
    cleanup();
    mutaciones.clear();
    orden.length = 0;
    toastError.mockClear();
    guardarLectura.mockReset().mockImplementation(async () => { orden.push('lectura'); });
    papelDelPaso = { sources: [] };
});

describe('B45: editar la prosa aceptada conserva las citas', () => {
    it('el editor muestra la forma entregada y guarda la interna en lo que no se tocó', async () => {
        conQuery(<StepCard step={aceptado('El participio es sustantivo (Tuggy, p. 257).')} paperId="tp9" language="es" formatting={SIN_P} />);
        fireEvent.click(screen.getByRole('button', { name: /detail\.steps\.action\.expand/ }));
        // El pie tiene el botón con texto; el encabezado, el ícono.
        fireEvent.click(screen.getAllByText('detail.steps.action.editAccepted').find(e => e.closest('button'))!.closest('button')!);
        const editor = screen.getByDisplayValue(/Tuggy, 257/) as HTMLTextAreaElement;
        expect(editor.value).toBe('El participio es sustantivo (Tuggy, 257).');
        fireEvent.change(editor, { target: { value: `${editor.value} Ver también (Tuggy, 540).` } });
        fireEvent.click(screen.getByText('detail.steps.action.saveEdit'));
        await waitFor(() => expect(mutacion('saveStepEdit').mutateAsync).toHaveBeenCalledWith({
            paperId: 'tp9', stepId: 's12',
            markdown: 'El participio es sustantivo (Tuggy, p. 257). Ver también (Tuggy, 540).',
        }));
    });
});

describe('B22: lo que el encargo no pide', () => {
    it('se rotula «no se pide» y su botón no es el principal', () => {
        conQuery(<StepCard step={pendiente({ includeInDocument: false })} paperId="tp9" language="es" assignmentBrief={ENCARGO} passage={REF} />);
        expect(screen.getByText('detail.steps.state.notRequested')).toBeInTheDocument();
        expect(screen.queryByText('detail.steps.state.pending')).toBeNull();
        const analizar = screen.getByText('canonical.actions.analyze').closest('button')!;
        expect(analizar.className).not.toContain('bg-emerald-500');
    });

    it('sin preguntas en el encargo dice «fuera del documento»', () => {
        conQuery(<StepCard step={pendiente({ includeInDocument: false })} paperId="tp9" language="es" />);
        expect(screen.getByText('detail.steps.state.excluded')).toBeInTheDocument();
    });

    it('el que sí se pide sigue «pendiente», con el botón principal', () => {
        conQuery(<StepCard step={pendiente()} paperId="tp9" language="es" assignmentBrief={ENCARGO} passage={REF} />);
        expect(screen.getByText('detail.steps.state.pending')).toBeInTheDocument();
        expect(screen.getByText('canonical.actions.analyze').closest('button')!.className).toContain('bg-emerald-500');
    });
});

describe('B25: «Mi lectura» entra al análisis', () => {
    it('escrita y sin guardar, «Analizar» la guarda primero y después genera', async () => {
        conQuery(<StepCard step={pendiente()} paperId="tp9" language="es" />);
        fireEvent.change(screen.getByLabelText('studentReading.hint'), { target: { value: 'participio sustantivado' } });
        fireEvent.click(screen.getByText('canonical.actions.analyze'));
        await waitFor(() => expect(orden).toEqual(['lectura', 'analyzeVerseCanonically']));
        expect(guardarLectura).toHaveBeenCalledWith({ ownerId: 'u1', paperId: 'tp9', stepId: 's12', studentReading: 'participio sustantivado' });
    });

    it('si el guardado está en vuelo (al soltar el campo), lo espera y no guarda dos veces', async () => {
        let soltar: () => void = () => undefined;
        guardarLectura.mockImplementation(() => new Promise<void>(r => { soltar = () => { orden.push('lectura'); r(); }; }));
        conQuery(<StepCard step={pendiente()} paperId="tp9" language="es" />);
        const campo = screen.getByLabelText('studentReading.hint');
        fireEvent.change(campo, { target: { value: 'aoristo' } });
        fireEvent.blur(campo);
        fireEvent.click(screen.getByText('canonical.actions.analyze'));
        await new Promise(r => setTimeout(r, 0));
        expect(orden).toEqual([]);
        soltar();
        await waitFor(() => expect(orden).toEqual(['lectura', 'analyzeVerseCanonically']));
        expect(guardarLectura).toHaveBeenCalledTimes(1);
    });

    it('si no se puede guardar, no genera y lo dice', async () => {
        guardarLectura.mockRejectedValue(new Error('sin red'));
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        conQuery(<StepCard step={pendiente()} paperId="tp9" language="es" />);
        fireEvent.change(screen.getByLabelText('studentReading.hint'), { target: { value: 'aoristo' } });
        fireEvent.click(screen.getByText('canonical.actions.analyze'));
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('studentReading.analyzeBlocked'));
        expect(mutacion('analyzeVerseCanonically').mutateAsync).not.toHaveBeenCalled();
    });

    it('sin nada escrito, genera sin guardar', async () => {
        conQuery(<StepCard step={pendiente()} paperId="tp9" language="es" />);
        fireEvent.click(screen.getByText('canonical.actions.analyze'));
        await waitFor(() => expect(orden).toEqual(['analyzeVerseCanonically']));
        expect(guardarLectura).not.toHaveBeenCalled();
    });
});

describe('B33: volver a ensamblar sobre un ensamble editado a mano', () => {
    const ensamble = (origin: 'edited' | 'generated'): ExegeticalStep => {
        const version = { id: 'a2', markdown: 'El documento, corregido a mano por el estudiante.', origin, createdAt: new Date() };
        return {
            id: 'asm', paperId: 'tp9', kind: 'assembly', verseRef: null, order: 10, state: 'awaiting-review',
            versions: [version], current: version, accepted: null, createdAt: new Date(), updatedAt: new Date(),
        } as unknown as ExegeticalStep;
    };
    const conTrabajo = (step: ExegeticalStep) => {
        papelDelPaso = { sources: [], steps: [step], displayLanguage: 'es', assignmentBrief: null, title: 'TP #9', passage: { ...REF, verseStart: 11, verseEnd: 17 } };
    };

    it('el diálogo de regenerar avisa que se reemplazan las ediciones a mano', () => {
        const paso = ensamble('edited');
        conTrabajo(paso);
        conQuery(<StepCard step={paso} paperId="tp9" language="es" />);
        fireEvent.click(screen.getAllByText('detail.steps.action.regenerate').find(e => e.closest('button'))!.closest('button')!);
        expect(screen.getByTestId('regenerate-warning').textContent).toBe('detail.steps.regenerate.handEditWarning');
    });

    it('un ensamble generado no lleva el aviso', () => {
        const paso = ensamble('generated');
        conTrabajo(paso);
        conQuery(<StepCard step={paso} paperId="tp9" language="es" />);
        fireEvent.click(screen.getAllByText('detail.steps.action.regenerate').find(e => e.closest('button'))!.closest('button')!);
        expect(screen.queryByTestId('regenerate-warning')).toBeNull();
    });
});
