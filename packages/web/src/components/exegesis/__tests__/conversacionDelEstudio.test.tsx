import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

/**
 * ADR-046, etapa 1: la conversación abierta desde un estudio queda también en
 * su proyecto de origen. Antes nacía sin proyecto y nunca aparecía en él.
 */
const createSession = vi.fn().mockResolvedValue({ id: 's-nueva' });
const assign = vi.fn();
let sesiones: unknown[] = [];
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }));
vi.mock('@/hooks/faculty/useFacultySessions', () => ({ useFacultySessions: () => ({ sessions: sesiones, createSession: { mutateAsync: createSession } }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ assignToProject: { mutate: assign } }) }));
vi.mock('@/hooks/faculty/useFacultyAgents', () => ({ useFacultyAgents: () => ({ data: [{ id: 'tutor', isActive: true }] }) }));
vi.mock('@/hooks/faculty/useFacultyChat', () => ({ useFacultyChat: () => ({ messages: [], sendMessage: vi.fn(), isLoading: false, isSending: false }) }));
vi.mock('@/components/faculty/FacultyChatMessages', () => ({ FacultyChatMessages: () => null }));
vi.mock('@/components/faculty/FacultyChatInput', () => ({ FacultyChatInput: () => null }));
vi.mock('@/pages/faculty/hooks/useAutoscrollChat', () => ({ useAutoscrollChat: () => ({}) }));
vi.mock('@/pages/faculty/utils/prepareAttachmentForSend', () => ({ prepareAttachmentForSend: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { PaperFacultyDrawer } = await import('../PaperFacultyDrawer');

const pasaje = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 };
const estudio = (over: Record<string, unknown> = {}) => ({ id: 'tp8', passage: pasaje, displayLanguage: 'es', steps: [], sources: [], projectId: 'teo2', ...over }) as never;
const abrir = (paper: never) => render(<PaperFacultyDrawer open onOpenChange={vi.fn()} paper={paper} />);

beforeEach(() => { cleanup(); vi.clearAllMocks(); sesiones = []; });

describe('PaperFacultyDrawer', () => {
    it('una conversación nueva nace con el estudio y en su proyecto de origen', async () => {
        abrir(estudio());
        await waitFor(() => expect(createSession).toHaveBeenCalled());
        expect(createSession.mock.calls[0]![0]).toMatchObject({ context: { paperId: 'tp8' }, projectId: 'teo2' });
    });

    it('una conversación de antes, sin proyecto, se suma al del estudio; una en otro proyecto se respeta', async () => {
        sesiones = [{ id: 'vieja', context: { paperId: 'tp8' }, updatedAt: new Date() }];
        abrir(estudio());
        await waitFor(() => expect(assign).toHaveBeenCalledWith({ sessionId: 'vieja', projectId: 'teo2' }));
        cleanup(); assign.mockClear();
        sesiones = [{ id: 'otra', context: { paperId: 'tp8' }, projectId: 'serie', updatedAt: new Date() }];
        abrir(estudio());
        await new Promise(r => setTimeout(r, 20));
        expect(assign).not.toHaveBeenCalled();
    });

    it('un estudio suelto abre la conversación sin proyecto', async () => {
        abrir(estudio({ projectId: null }));
        await waitFor(() => expect(createSession).toHaveBeenCalled());
        expect(createSession.mock.calls[0]![0]).not.toHaveProperty('projectId');
    });
});
