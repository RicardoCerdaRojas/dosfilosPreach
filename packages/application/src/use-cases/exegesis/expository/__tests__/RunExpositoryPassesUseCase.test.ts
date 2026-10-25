import { describe, it, expect, vi } from 'vitest';
import type { IExpositoryAssistant } from '@dosfilos/domain';
import { RunExpositoryPassesUseCase } from '../RunExpositoryPassesUseCase';

/**
 * «Refinar» del Pase 5 (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, §1): la
 * observación del revisor tiene que llegar al Pase 4. Antes se perdía aquí.
 */
const base = {
    book: 'Esdras',
    displayLanguage: 'es' as const,
    verses: [{ chapter: 1, verse: 1, text: 'En el primer año de Ciro' }],
    panorama: { genre: 'narrative', purpose: 'p', pastoralProblem: 'pp', centralTheme: 'c', movements: [], keyTerms: [] } as never,
    macroSections: [],
    exegeticalUnits: [],
};

const asistente = () => {
    const runPreachableConversion = vi.fn().mockResolvedValue({ payload: [], modelId: 'm' });
    return { assistant: { runPreachableConversion } as unknown as IExpositoryAssistant, runPreachableConversion };
};

describe('runPreachableConversion', () => {
    it('pasa la observación de «Refinar» al asistente', async () => {
        const { assistant, runPreachableConversion } = asistente();
        await new RunExpositoryPassesUseCase(assistant).runPreachableConversion({ ...base, regenerationHint: '1. [crítico] Separa exhortación y fundamento.' });
        expect(runPreachableConversion.mock.calls[0]![0].regenerationHint).toBe('1. [crítico] Separa exhortación y fundamento.');
    });

    it('sin observación (o en blanco) no agrega la clave: la primera corrida queda igual', async () => {
        const { assistant, runPreachableConversion } = asistente();
        const uc = new RunExpositoryPassesUseCase(assistant);
        await uc.runPreachableConversion(base);
        await uc.runPreachableConversion({ ...base, regenerationHint: '   ' });
        expect(runPreachableConversion.mock.calls[0]![0]).toEqual(base);
        expect('regenerationHint' in runPreachableConversion.mock.calls[1]![0]).toBe(false);
    });
});
