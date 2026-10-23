import { describe, it, expect } from 'vitest';
import { isObservationTool, resolveExegeticalMethod, separatesObservation } from '../exegeticalStrategy';
import { resolveProjectCharge, workTypeFromProfile } from '../../../entities/AIProject';

/** Etapa 2, capa 3: el método del trabajo. Sin método, el análisis de siempre. */
describe('el método del trabajo', () => {
    it('se normaliza; lo desconocido o ausente es el análisis de siempre', () => {
        expect(resolveExegeticalMethod('mixed')).toBe('mixed');
        expect(resolveExegeticalMethod('research')).toBe('research');
        expect(resolveExegeticalMethod(undefined)).toBeNull();
        expect(resolveExegeticalMethod('dialectical')).toBeNull();
    });

    it('exegético y mixto separan la observación; investigación y «como siempre», no', () => {
        expect(separatesObservation('exegetical')).toBe(true);
        expect(separatesObservation('mixed')).toBe(true);
        expect(separatesObservation('research')).toBe(false);
        expect(separatesObservation(null)).toBe(false);
    });

    it('herramientas de la observación: texto, aparato, léxicos, gramáticas, fuentes antiguas y contexto; no los comentarios', () => {
        for (const t of ['biblical-text-edition', 'critical-apparatus', 'textual-commentary', 'lexicon-technical', 'theological-dictionary', 'grammar-syntax', 'primary-source-ancient', 'historical-background'] as const) {
            expect(isObservationTool(t)).toBe(true);
        }
        for (const t of ['commentary-critical', 'commentary-expository', 'theological-monograph', 'journal-article', 'other'] as const) {
            expect(isObservationTool(t)).toBe(false);
        }
        expect(isObservationTool(null)).toBe(false);
    });

    it('viaja del perfil al tipo de trabajo y del tipo al estudio', () => {
        const perfil = { id: 'tp', displayName: 'TP', rubricTemplateId: 'r', briefTemplateId: null, styleGuideId: null, exegeticalStrategy: 'dialectical' as const, exegeticalMethod: 'mixed' as const };
        const tipo = workTypeFromProfile(perfil, 'w');
        expect(tipo.exegeticalMethod).toBe('mixed');
        expect(resolveProjectCharge({ workTypes: [tipo] }, 'w')?.exegeticalMethod).toBe('mixed');
        expect(workTypeFromProfile({ ...perfil, exegeticalMethod: null }, 'w')).not.toHaveProperty('exegeticalMethod');
    });
});
