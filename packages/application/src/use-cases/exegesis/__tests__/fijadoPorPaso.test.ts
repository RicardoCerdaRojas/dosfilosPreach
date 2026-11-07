import { describe, expect, it, vi } from 'vitest';
import { ProposeStepCorpusAllocationsUseCase } from '../ProposeStepCorpusAllocationsUseCase';
import { UpdateStepCorpusAllocationUseCase } from '../UpdateStepCorpusAllocationUseCase';
import { UpdateStepStudentReadingUseCase } from '../UpdateStepStudentReadingUseCase';
import { SetStepPinnedSheetsUseCase } from '../SetStepPinnedSheetsUseCase';
import { VerifierSourcesBuilder } from '../../../services/exegesis/VerifierSourcesBuilder';

/**
 * PR 2, unidad 4. Hoy se perdería lo fijado por paso: los que escriben el plan
 * reconstruyen la entrada campo por campo (leído). Esta prueba los recorre a todos.
 */
const HOJAS = { na28: [{ start: 803, end: 805 }] };
const paperCon = (extra: Record<string, unknown> = {}) => ({
    id: 'p', ownerId: 'o', displayLanguage: 'es', phase: 'configuring', excludedSources: null,
    passage: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 6, verseEnd: 7 },
    assignmentBrief: '1. En 3:6, ¿cómo se puntúa la frase?',
    sources: [
        { id: 'na28', sourceType: 'critical-apparatus', displayLabel: 'NA28', citationKey: 'NA28' },
        { id: 'guia', sourceType: 'style-guide', displayLabel: 'Guía', citationKey: null },
        { id: 'veto', sourceType: 'commentary-critical', displayLabel: 'Hiebert', citationKey: 'Hiebert' },
    ],
    steps: [{ id: 'v6', kind: 'verse', order: 6, includeInDocument: true, verseRef: { bookId: 'JAS', chapterStart: 3, chapterEnd: 3, verseStart: 6, verseEnd: 6 } }],
    stepPlan: {
        perStep: { v6: { stepId: 'v6', kind: 'verse', emphasis: { emphasizedTypes: [], deemphasizedTypes: [], citationOverrides: [] }, pinnedSources: [], suppressedSources: [], note: null, pinnedSheets: HOJAS } },
        defaults: {}, updatedAt: new Date(),
    },
    ...extra,
});
const repo = (paper: unknown) => ({
    getPaper: vi.fn().mockResolvedValue(paper),
    setStepPlan: vi.fn().mockImplementation(async (_o: string, _p: string, plan: unknown) => ({ ...(paper as object), stepPlan: plan })),
    changeStepPinnedSheets: vi.fn().mockResolvedValue({}),
});

describe('ningún escritor del plan borra lo fijado por paso', () => {
    it('proponer el plan de uso', async () => {
        const r = repo(paperCon());
        const planner = { propose: vi.fn().mockResolvedValue({ allocations: { v6: { pinnedSources: ['na28'], rationale: 'aparato' } } }) };
        await new ProposeStepCorpusAllocationsUseCase(r as never, planner as never).execute({ ownerId: 'o', paperId: 'p' });
        expect(r.setStepPlan.mock.calls[0]![2].perStep.v6.pinnedSheets).toEqual(HOJAS);
    });

    it('editar las fuentes de un paso', async () => {
        const r = repo(paperCon());
        await new UpdateStepCorpusAllocationUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', stepId: 'v6', pinnedSources: ['na28'] } as never);
        expect(r.setStepPlan.mock.calls[0]![2].perStep.v6.pinnedSheets).toEqual(HOJAS);
    });

    it('escribir «Mi lectura»', async () => {
        const r = repo(paperCon());
        await new UpdateStepStudentReadingUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', stepId: 'v6', studentReading: 'mi lectura' });
        expect(r.setStepPlan.mock.calls[0]![2].perStep.v6.pinnedSheets).toEqual(HOJAS);
    });
});

describe('fijar hojas para un paso', () => {
    const fijar = (paper: unknown, sourceId: string, sheets = [1, 2], pin = true) => {
        const r = repo(paper);
        return { r, run: () => new SetStepPinnedSheetsUseCase(r as never).execute({ ownerId: 'o', paperId: 'p', stepId: 'v6', sourceId, sheets, pin }) };
    };

    it('manda el cambio a la operación transaccional, sin hojas inválidas ni repetidas', async () => {
        const { r, run } = fijar(paperCon(), 'na28', [805, 803, 803, 0, 1.5]);
        await run();
        expect(r.changeStepPinnedSheets).toHaveBeenCalledWith('o', 'p', 'v6', 'na28', { pin: true, sheets: [805, 803] });
        expect(r.setStepPlan).not.toHaveBeenCalled();
    });

    it('lo suprimido en el paso, lo vetado y lo no citable mandan: no se fijan', async () => {
        const suprimido = paperCon();
        (suprimido.stepPlan.perStep.v6 as { suppressedSources: string[] }).suppressedSources = ['na28'];
        await expect(fijar(suprimido, 'na28').run()).rejects.toThrow(/suppressed/);
        await expect(fijar(paperCon({ excludedSources: [{ key: 'Hiebert', previousPaperTitle: null }] }), 'veto').run()).rejects.toThrow(/excluded/);
        await expect(fijar(paperCon(), 'guia').run()).rejects.toThrow(/not citable/);
        await expect(fijar(paperCon(), 'otra').run()).rejects.toThrow(/not in paper/);
    });

    it('soltar no pide validar la fuente: una vetada o que salió también se suelta', async () => {
        const { r, run } = fijar(paperCon(), 'otra', [3], false);
        await run();
        expect(r.getPaper).not.toHaveBeenCalled();
        expect(r.changeStepPinnedSheets).toHaveBeenCalledWith('o', 'p', 'v6', 'otra', { pin: false, sheets: [3] });
    });
});

describe('el verificador lee lo fijado en cualquier paso', () => {
    it('una fuente con receta suma a lo admitido las hojas de sus pasos', async () => {
        const reader = { readAdmitted: vi.fn().mockResolvedValue([{ text: 'hoja', sheet: 804 }]) };
        const builder = new VerifierSourcesBuilder({ getTextContent: vi.fn().mockResolvedValue('') } as never, reader as never);
        const paper = paperCon({
            sources: [{ id: 'na28', sourceType: 'critical-apparatus', displayLabel: 'NA28', citationKey: 'NA28', corpusId: 'res', mode: 'curated-excerpts', excerpts: [], excerptRecipe: { sheetRanges: [{ start: 700, end: 702 }], pinnedRanges: [], proposedRanges: [], passageFingerprint: '' } }],
        });
        await builder.build(paper as never);
        expect(reader.readAdmitted).toHaveBeenCalledWith({ resourceId: 'res', sheetRanges: [{ start: 700, end: 702 }, { start: 803, end: 805 }] });
    });
});
