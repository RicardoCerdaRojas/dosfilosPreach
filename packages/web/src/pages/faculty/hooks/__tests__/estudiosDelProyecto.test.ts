import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectSlices } from '../useProjectSlices';

/** ADR-046, etapa 1: los estudios del proyecto son los de origen y los vinculados, sin archivados. */
const estudio = (id: string, over: Record<string, unknown> = {}) => ({ id, projectId: null, linkedProjectIds: [], archivedAt: null, updatedAt: new Date(), ...over });

describe('useProjectSlices — estudios', () => {
    it('de origen y vinculados; ni archivados ni de otros proyectos', () => {
        const papers = [
            estudio('origen', { projectId: 'teo2' }),
            estudio('vinculado', { projectId: 'otro', linkedProjectIds: ['teo2'] }),
            estudio('archivado', { projectId: 'teo2', archivedAt: new Date() }),
            estudio('ajeno', { projectId: 'otro' }),
            estudio('suelto'),
        ];
        const { result } = renderHook(() => useProjectSlices('teo2', { papers: papers as never }));
        expect(result.current.projectStudies.map(p => p.id)).toEqual(['origen', 'vinculado']);
    });

    it('sin proyecto, ningún estudio', () => {
        const { result } = renderHook(() => useProjectSlices(undefined, { papers: [estudio('suelto')] as never }));
        expect(result.current.projectStudies).toEqual([]);
    });
});
