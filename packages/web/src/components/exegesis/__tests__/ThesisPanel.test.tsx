import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExegeticalPaper } from '@dosfilos/domain';

/** Etapa 3.2 (B63): la tesis se escribe, se aprueba y la leen los compositores. */
const execute = vi.fn().mockResolvedValue({});
vi.mock('@dosfilos/application', () => ({ exegesisService: { setPaperThesis: { execute } } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : k) }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
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
