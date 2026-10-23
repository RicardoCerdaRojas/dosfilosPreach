import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Etapa 2, capa 3: «Mi lectura» y el aviso de comentarios en la observación. */
const execute = vi.fn().mockResolvedValue({});
vi.mock('@dosfilos/application', () => ({ exegesisService: { updateStepStudentReading: { execute } } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, string>) => (o ? `${k}:${o.source}` : k) }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const { StudentReadingPanel, ObservationCitationNotice } = await import('../StudentReadingPanel');

const conQuery = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe('StudentReadingPanel', () => {
    it('escribir y guardar manda el texto del paso', async () => {
        conQuery(<StudentReadingPanel paperId="tp9" stepId="v11" initial={null} method="mixed" />);
        expect(screen.getByText('studentReading.hintMethod')).toBeInTheDocument();
        const guardar = screen.getByText('studentReading.save').closest('button')!;
        expect(guardar).toBeDisabled();
        fireEvent.change(screen.getByLabelText('studentReading.hintMethod'), { target: { value: 'μή + presente' } });
        expect(screen.getByText('studentReading.unsaved')).toBeInTheDocument();
        fireEvent.click(guardar);
        await waitFor(() => expect(execute).toHaveBeenCalledWith({ ownerId: 'u1', paperId: 'tp9', stepId: 'v11', studentReading: 'μή + presente' }));
    });

    it('sin método, la ayuda es la general', () => {
        conQuery(<StudentReadingPanel paperId="p" stepId="s" initial="ya escrita" method={null} />);
        expect(screen.getByText('studentReading.hint')).toBeInTheDocument();
        expect((screen.getByLabelText('studentReading.hint') as HTMLTextAreaElement).value).toBe('ya escrita');
    });
});

describe('ObservationCitationNotice', () => {
    const fuentes = [{ citationKey: 'Mayor', sourceType: 'commentary-critical' as const }, { citationKey: 'BDAG', sourceType: 'lexicon-technical' as const }];
    const analisis = { lexicalAnalyses: [{ sources: [{ sourceKey: 'Mayor' }, { sourceKey: 'BDAG' }] }] } as never;

    it('avisa el comentario citado en la observación, con método mixto', () => {
        render(<ObservationCitationNotice analysis={analisis} sources={fuentes} method="mixed" />);
        expect(screen.getByText('observationCheck.item:Mayor')).toBeInTheDocument();
        expect(screen.queryByText('observationCheck.item:BDAG')).toBeNull();
    });

    it('sin método no aparece', () => {
        const { container } = render(<ObservationCitationNotice analysis={analisis} sources={fuentes} method={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});
