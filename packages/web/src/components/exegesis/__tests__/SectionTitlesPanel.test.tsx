import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ExegeticalPaper } from '@dosfilos/domain';

/** Etapa 3.4: los títulos temáticos se proponen, se editan y se guardan. */
const guardar = vi.fn().mockResolvedValue({});
const proponer = vi.fn();
vi.mock('@dosfilos/application', () => ({ exegesisService: { setSectionTitles: { execute: guardar }, proposeHeadings: { execute: proponer } } }));
vi.mock('@/context/firebase-context', () => ({ useFirebase: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const { SectionTitlesPanel } = await import('../SectionTitlesPanel');

const conQuery = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const PSA = (v: number) => ({ bookId: 'PSA', chapterStart: 23, chapterEnd: 23, verseStart: v, verseEnd: v });
const paper = (titles: Record<string, string> | null = null) => ({
    id: 'ti1', displayLanguage: 'es', sectionTitles: titles,
    steps: [{ id: 'v1', kind: 'verse', order: 1, verseRef: PSA(1), accepted: { canonicalAnalysis: {} } }, { id: 'v2', kind: 'verse', order: 2, verseRef: PSA(2), accepted: { canonicalAnalysis: {} } }],
}) as unknown as ExegeticalPaper;
beforeEach(() => { cleanup(); vi.clearAllMocks(); });

describe('SectionTitlesPanel', () => {
    it('«Proponer títulos» llena los campos; lo escrito a mano se respeta', async () => {
        proponer.mockResolvedValue({ headings: { v1: 'Propuesto 1 (v. 1)', v2: 'Propuesto 2 (v. 2)' } });
        conQuery(<SectionTitlesPanel paper={paper()} />);
        fireEvent.change(screen.getByLabelText('Salmo 23:2'), { target: { value: 'Mío (v. 2)' } });
        fireEvent.click(screen.getByText('sectionTitles.propose'));
        await waitFor(() => expect((screen.getByLabelText('Salmo 23:1') as HTMLInputElement).value).toBe('Propuesto 1 (v. 1)'));
        expect((screen.getByLabelText('Salmo 23:2') as HTMLInputElement).value).toBe('Mío (v. 2)');
    });

    it('«Guardar títulos» manda los títulos por id del paso', async () => {
        conQuery(<SectionTitlesPanel paper={paper({ v1: 'Guardado (v. 1)' })} />);
        expect(screen.getByText('sectionTitles.save').closest('button')).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Salmo 23:2'), { target: { value: 'Nuevo (v. 2)' } });
        fireEvent.click(screen.getByText('sectionTitles.save'));
        await waitFor(() => expect(guardar).toHaveBeenCalledWith({ ownerId: 'u1', paperId: 'ti1', titles: { v1: 'Guardado (v. 1)', v2: 'Nuevo (v. 2)' } }));
    });
});
