import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectSlices } from '../useProjectSlices';

/**
 * Etapa 3 de ADR-046: las series del proyecto salen de `series.projectId`
 * y los sermones sin proyecto propio entran por su estudio de origen o por
 * su serie. Un proyecto explícito gana.
 */
const estudio = (id: string, over: Record<string, unknown> = {}) => ({ id, projectId: null, linkedProjectIds: [], archivedAt: null, phase: 'in-progress', updatedAt: new Date(), ...over });
const serie = (id: string, over: Record<string, unknown> = {}) => ({ id, title: id, createdAt: new Date('2026-10-01'), metadata: { plannedSermons: [] }, ...over });
const sermon = (id: string, over: Record<string, unknown> = {}) => ({ id, status: 'draft', updatedAt: new Date('2026-10-20'), ...over });

const papers = [
    estudio('neh1', { projectId: 'neh', seriesId: 'sNeh' }),
    estudio('neh2', { projectId: 'neh', seriesId: 'sNeh' }),
    estudio('vinculado', { projectId: 'otro', linkedProjectIds: ['neh'] }),
];
const series = [
    serie('sNeh', { projectId: 'neh', metadata: { plannedSermons: [{ id: 'p1', paperId: 'neh1' }, { id: 'p2', paperId: 'neh2' }, { id: 'p3' }] } }),
    serie('jonas'),
    serie('sOtro', { projectId: 'otro' }),
];
const slices = (sermons: unknown[]) =>
    renderHook(() => useProjectSlices('neh', { papers: papers as never, series: series as never, sermons: sermons as never })).result.current;

describe('useProjectSlices — series y sermones del proyecto', () => {
    it('solo las series del proyecto; Jonás, sin projectId, no entra', () => {
        const r = slices([]);
        expect(r.projectSeries.map(s => s.id)).toEqual(['sNeh']);
    });

    it('los estudios de la tarjeta de la serie quedan fuera de «Otros estudios»', () => {
        const r = slices([]);
        expect([...r.seriesStudyIds].sort()).toEqual(['neh1', 'neh2']);
        expect(r.projectStudies.map(p => p.id)).toEqual(['neh1', 'neh2', 'vinculado']);
    });

    it('un sermón sin projectId entra por su estudio de origen', () => {
        const r = slices([sermon('s1', { sourcePaperId: 'neh1' })]);
        expect(r.projectSermons.map(s => s.id)).toEqual(['s1']);
    });

    it('un sermón de una serie del proyecto, sin estudio, entra por la serie', () => {
        const r = slices([sermon('s2', { seriesId: 'sNeh' })]);
        expect(r.projectSermons.map(s => s.id)).toEqual(['s2']);
    });

    it('un estudio solo vinculado no trae sus sermones; uno de Jonás tampoco entra', () => {
        const r = slices([sermon('s3', { sourcePaperId: 'vinculado' }), sermon('s4', { seriesId: 'jonas' })]);
        expect(r.projectSermonsAll).toEqual([]);
    });

    it('borrador y copia publicada: uno en «Material producido», los dos para el recorrido', () => {
        const r = slices([
            sermon('borrador', { sourcePaperId: 'neh1', updatedAt: new Date('2026-10-20') }),
            sermon('copia', { status: 'published', sourceSermonId: 'borrador', sourcePaperId: 'neh1', updatedAt: new Date('2026-10-21') }),
        ]);
        expect(r.projectSermons.map(s => s.id)).toEqual(['copia']);
        expect(r.projectSermonsAll.map(s => s.id)).toEqual(['copia', 'borrador']);
    });

    it('un projectId explícito de otro proyecto gana aunque su estudio sea de este', () => {
        const r = slices([sermon('previo', { projectId: 'material-previo', sourcePaperId: 'neh1', seriesId: 'sNeh' })]);
        expect(r.projectSermonsAll).toEqual([]);
    });

    it('un sermón con el projectId de este proyecto entra como antes', () => {
        const r = slices([sermon('directo', { projectId: 'neh' })]);
        expect(r.projectSermons.map(s => s.id)).toEqual(['directo']);
    });

    it('sin series, nada cambia: sin series ni estudios excluidos', () => {
        const { result } = renderHook(() => useProjectSlices('neh', { papers: papers as never }));
        expect(result.current.projectSeries).toEqual([]);
        expect(result.current.seriesStudyIds.size).toBe(0);
    });
});
