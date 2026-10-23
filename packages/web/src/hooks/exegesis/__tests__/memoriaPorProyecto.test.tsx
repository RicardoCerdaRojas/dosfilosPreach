import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * Etapa 2: la memoria de entregas se cuenta dentro del proyecto (más los
 * trabajos sueltos), y «no repetir» rige según los criterios del proyecto.
 */
const dia = (n: number) => new Date(2026, 9, n);
const resumen = (id: string, n: number, projectId: string | null, cited: string[]) => ({
    id, projectId, createdAt: dia(n), citedSourceKeys: cited, passage: { bookId: 'JAS', chapterStart: 4, verseStart: 1 }, title: id,
    sources: cited.map(k => ({ citationKey: k, sourceType: 'commentary-critical', sourceLibraryResourceId: k, corpusId: k, displayLabel: k })),
});
let papers: unknown[] = [];
let projects: unknown[] = [];
vi.mock('@/hooks/exegesis/useExegesisPapers', () => ({ useExegesisPapers: () => ({ papers }) }));
vi.mock('@/hooks/faculty/useFacultyProjects', () => ({ useFacultyProjects: () => ({ projects }) }));
const { useProposedExclusions } = await import('../usePaperExclusions');

beforeEach(() => {
    papers = [
        resumen('tp8', 1, null, ['mayor']),
        resumen('otroCurso', 2, 'teo2', ['ropes']),
        resumen('tp9', 3, 'nt785', []),
    ];
    projects = [{ id: 'nt785', type: 'course' }, { id: 'teo2', type: 'course' }];
});

describe('useProposedExclusions por proyecto', () => {
    it('la entrega anterior de un TP del curso no es la de otro curso: salta al TP suelto', () => {
        const { result } = renderHook(() => useProposedExclusions({ id: 'tp9', displayLanguage: 'es', projectId: 'nt785' }));
        expect(result.current.previous?.paperId).toBe('tp8');
        expect(result.current.proposal.map(p => p.key)).toEqual(['mayor']);
    });

    it('con «no repetir» apagado en el proyecto no se propone excluir nada', () => {
        projects = [{ id: 'nt785', type: 'course', bibliographyCriteria: { noRepeatSources: false } }];
        const { result } = renderHook(() => useProposedExclusions({ id: 'tp9', displayLanguage: 'es', projectId: 'nt785' }));
        expect(result.current.previous?.paperId).toBe('tp8');
        expect(result.current.proposal).toEqual([]);
    });
});
