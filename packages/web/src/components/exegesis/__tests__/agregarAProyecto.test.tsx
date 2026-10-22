import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

/**
 * ADR-046, etapa 1: «Agregar a un proyecto». Origen o vínculo; al tener
 * origen se ofrecen las fuentes del proyecto que faltan, sin pisar las que hay.
 */
const setProject = vi.fn().mockResolvedValue({});
const attach = vi.fn().mockResolvedValue({ kind: 'section', sheetCount: 3 });
let proyectos: unknown[] = [];
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects: proyectos }) }));
vi.mock('@/hooks/exegesis/useSetPaperProject', () => ({ useSetPaperProject: () => ({ mutateAsync: setProject, isPending: false }) }));
vi.mock('@/hooks/exegesis/useAttachLibrarySource', () => ({ useAttachLibrarySource: () => ({ attach, isPending: false }) }));
vi.mock('@/hooks/library', () => ({ useLibrary: () => ({ resources: [
    { id: 'wallace', title: 'Greek Grammar Beyond the Basics', author: 'Daniel B. Wallace', exegeticalType: 'grammar-syntax' },
    { id: 'mayor', title: 'The Epistle of St. James', author: 'Joseph B. Mayor' },
] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const { AddToProjectDialog } = await import('../AddToProjectDialog');

const pasaje = { bookId: 'JAS', chapterStart: 4, chapterEnd: 4, verseStart: 1, verseEnd: 10 };
const estudio = (over: Record<string, unknown> = {}) => ({
    id: 'tp8', passage: pasaje, displayLanguage: 'es', assignmentBrief: null, projectId: null, linkedProjectIds: [],
    sources: [{ sourceLibraryResourceId: 'mayor', corpusId: 'mayor', sourceType: 'commentary-critical' }], ...over,
}) as never;
const montar = (paper: never) => render(<AddToProjectDialog open onOpenChange={vi.fn()} paper={paper} />);

beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    proyectos = [
        { id: 'teo2', title: 'Teología II', userId: 'u', sourceIds: ['mayor', 'wallace'] },
        { id: 'serie', title: 'Serie Santiago', userId: 'u' },
    ];
});

describe('AddToProjectDialog', () => {
    it('un estudio suelto se asocia como origen', async () => {
        montar(estudio());
        fireEvent.change(screen.getByLabelText('paperProjects.add'), { target: { value: 'teo2' } });
        fireEvent.click(screen.getByText('paperProjects.asOrigin'));
        await waitFor(() => expect(setProject).toHaveBeenCalledWith({ paperId: 'tp8', change: { kind: 'origin', projectId: 'teo2' } }));
    });

    it('con origen, ofrece solo las fuentes que faltan y las agrega con su tipo', async () => {
        montar(estudio({ projectId: 'teo2' }));
        expect(screen.getByText(/paperProjects\.missingSources/).textContent).toContain('"count":1');
        fireEvent.click(screen.getByText('paperProjects.addSources'));
        await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
        expect(attach.mock.calls[0]![0]).toMatchObject({ paperId: 'tp8', libraryResourceId: 'wallace', sourceType: 'grammar-syntax' });
    });

    it('con origen ya puesto solo se vincula; y un vínculo se puede quitar', async () => {
        montar(estudio({ projectId: 'teo2', linkedProjectIds: [] }));
        expect(screen.queryByText('paperProjects.asOrigin')).toBeNull();
        fireEvent.change(screen.getByLabelText('paperProjects.add'), { target: { value: 'serie' } });
        fireEvent.click(screen.getByText('paperProjects.asLinked'));
        await waitFor(() => expect(setProject).toHaveBeenCalledWith({ paperId: 'tp8', change: { kind: 'link', projectId: 'serie' } }));
        cleanup();
        montar(estudio({ projectId: 'teo2', linkedProjectIds: ['serie'] }));
        fireEvent.click(screen.getByLabelText(/paperProjects\.unlink/));
        await waitFor(() => expect(setProject).toHaveBeenLastCalledWith({ paperId: 'tp8', change: { kind: 'unlink', projectId: 'serie' } }));
    });

    it('un origen archivado se muestra como origen, no como «suelto» (revisión de la etapa 1)', () => {
        proyectos = [{ id: 'teo2', title: 'Teología II', userId: 'u', archivedAt: new Date(), sourceIds: ['wallace'] }];
        montar(estudio({ projectId: 'teo2' }));
        expect(screen.getByText('Teología II')).toBeInTheDocument();
        expect(screen.queryByText('paperProjects.noOrigin')).toBeNull();
        expect(screen.queryByText('paperProjects.asOrigin')).toBeNull();
        // Y no ofrece agregar fuentes de un proyecto archivado.
        expect(screen.queryByText(/paperProjects\.missingSources/)).toBeNull();
    });

    it('un libro del proyecto que ya no está en la biblioteca no se ofrece', () => {
        proyectos = [{ id: 'teo2', title: 'Teología II', userId: 'u', sourceIds: ['borrado'] }];
        montar(estudio({ projectId: 'teo2' }));
        expect(screen.queryByText(/paperProjects\.missingSources/)).toBeNull();
    });

    it('uno con el que colabora puede pasar a ser el origen', async () => {
        montar(estudio({ linkedProjectIds: ['serie'] }));
        fireEvent.click(screen.getByText('paperProjects.makeOrigin'));
        await waitFor(() => expect(setProject).toHaveBeenCalledWith({ paperId: 'tp8', change: { kind: 'origin', projectId: 'serie' } }));
    });
});
