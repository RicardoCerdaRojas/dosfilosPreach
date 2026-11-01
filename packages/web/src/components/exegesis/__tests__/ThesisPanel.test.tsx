import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExegeticalPaper } from '@dosfilos/domain';

/** Etapa 3.2 (B63): la tesis se escribe, se aprueba y la leen los compositores. */
const execute = vi.fn().mockResolvedValue({});
const proponer = vi.fn();
const revisar = vi.fn();
vi.mock('@dosfilos/application', () => ({ exegesisService: { setPaperThesis: { execute }, proposeThesis: { execute: proponer }, reviewThesis: { execute: revisar } } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k) }) }));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));
const { ThesisPanel } = await import('../ThesisPanel');

const conQuery = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const verso = (id: string, aceptado: boolean) => ({ id, kind: 'verse', accepted: aceptado ? { canonicalAnalysis: {} } : null });
const paper = (over: Partial<ExegeticalPaper> = {}) => ({
    id: 'ti2', thesis: null,
    steps: [verso('v4', true), verso('v5', true), { id: 'c', kind: 'conclusion', accepted: null }],
    ...over,
}) as unknown as ExegeticalPaper;
beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ThesisPanel', () => {
    it('escribir y aprobar manda el texto con approve', async () => {
        conQuery(<ThesisPanel paper={paper()} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'El salmista pasa de la travesía al hogar.' } });
        fireEvent.click(screen.getByText('thesis.approve'));
        await waitFor(() => expect(execute).toHaveBeenCalledWith({ ownerId: 'u1', paperId: 'ti2', text: 'El salmista pasa de la travesía al hogar.', approve: true }));
    });

    it('«Guardar borrador» guarda sin aprobar', async () => {
        conQuery(<ThesisPanel paper={paper()} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Borrador.' } });
        fireEvent.click(screen.getByText('thesis.saveDraft'));
        await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ text: 'Borrador.', approve: false })));
    });

    it('aprobada se muestra como cita, con «Editar»; si la conclusión ya estaba aceptada, pide regenerarla', () => {
        const aprobada = paper({
            thesis: { text: 'La tesis aprobada.', origin: 'student', approvedAt: new Date(), updatedAt: new Date() },
            steps: [verso('v4', true), { id: 'c', kind: 'conclusion', accepted: { markdown: 'Conclusión.' } }] as never,
        });
        conQuery(<ThesisPanel paper={aprobada} />);
        expect(screen.getByText('La tesis aprobada.')).toBeInTheDocument();
        expect(screen.getByText('thesis.approvedBadge')).toBeInTheDocument();
        expect(screen.getByText('thesis.regenerateNote')).toBeInTheDocument();
        fireEvent.click(screen.getByText('thesis.edit'));
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('La tesis aprobada.');
    });

    it('con versículos sin aceptar, lo dice: la tesis se formula sobre los aceptados', () => {
        conQuery(<ThesisPanel paper={paper({ steps: [verso('v4', true), verso('v5', false), verso('v6', false)] as never })} />);
        expect(screen.getByText('thesis.pendingVerses:2')).toBeInTheDocument();
    });

    it('vacía no se puede aprobar', () => {
        conQuery(<ThesisPanel paper={paper()} />);
        expect(screen.getByText('thesis.approve').closest('button')).toBeDisabled();
    });
});

describe('ThesisPanel — proponer y revisar con el modelo (etapa 3.3)', () => {
    it('propone, se elige una, y al aprobarla queda como «proposed»', async () => {
        proponer.mockResolvedValue({ proposals: [{ thesis: 'Propuesta A.', support: [{ verse: 'Salmo 23:4', evidence: 'cláusula sin verbo' }] }, { thesis: 'Propuesta B.', support: [] }] });
        conQuery(<ThesisPanel paper={paper()} />);
        fireEvent.click(screen.getByText('thesis.propose'));
        expect(await screen.findByText('Propuesta A.')).toBeInTheDocument();
        fireEvent.click(screen.getAllByText('thesis.useProposal')[0]!);
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Propuesta A.');
        fireEvent.click(screen.getByText('thesis.approve'));
        await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ text: 'Propuesta A.', approve: true, origin: 'proposed' })));
    });

    it('una propuesta retocada se guarda como «edited»', async () => {
        proponer.mockResolvedValue({ proposals: [{ thesis: 'Propuesta A.', support: [] }] });
        conQuery(<ThesisPanel paper={paper()} />);
        fireEvent.click(screen.getByText('thesis.propose'));
        fireEvent.click(await screen.findByText('thesis.useProposal'));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Propuesta A, retocada.' } });
        fireEvent.click(screen.getByText('thesis.approve'));
        await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ origin: 'edited' })));
    });

    it('revisar muestra cada criterio y la tesis corregida, que se puede usar', async () => {
        revisar.mockResolvedValue({ criteria: [
            { criterion: 'interpretive', verdict: 'cumple', reason: 'Es interpretativa.' },
            { criterion: 'connects', verdict: 'no-cumple', reason: 'No retoma 1–3.' },
        ], suggestion: 'La corregida.' });
        conQuery(<ThesisPanel paper={paper()} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mi tesis.' } });
        fireEvent.click(screen.getByText('thesis.review'));
        expect(await screen.findByText('No retoma 1–3.')).toBeInTheDocument();
        expect(revisar).toHaveBeenCalledWith({ ownerId: 'u1', paperId: 'ti2', thesis: 'Mi tesis.' });
        fireEvent.click(screen.getByText('thesis.useSuggestion'));
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('La corregida.');
    });

    it('sin versículos aceptados no se puede proponer ni revisar', () => {
        conQuery(<ThesisPanel paper={paper({ steps: [verso('v4', false)] as never })} />);
        expect(screen.getByText('thesis.propose').closest('button')).toBeDisabled();
    });

    it('sin saldo lo dice así, no como un fallo cualquiera', async () => {
        proponer.mockRejectedValue(Object.assign(new Error('sin saldo'), { code: 'insufficient-exegesis-credits' }));
        conQuery(<ThesisPanel paper={paper()} />);
        fireEvent.click(screen.getByText('thesis.propose'));
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('thesis.noCredits'));
    });
});
