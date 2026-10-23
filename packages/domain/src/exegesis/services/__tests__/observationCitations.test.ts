import { describe, it, expect } from 'vitest';
import { observationCitationAlerts } from '../observationCitations';

/** Etapa 2, capa 3: el control fijo de citas a comentarios en la observación. */
const fuentes = [
    { citationKey: 'Wallace', sourceType: 'grammar-syntax' as const },
    { citationKey: 'BDAG', sourceType: 'lexicon-technical' as const },
    { citationKey: 'Mayor', sourceType: 'commentary-critical' as const },
    { citationKey: 'Robertson', sourceType: 'grammar-syntax' as const },
    { citationKey: 'Robertson', sourceType: 'commentary-expository' as const },
];
const analisis = {
    textualCriticism: { variants: [{ sources: [{ sourceKey: 'Mayor', page: 3 }] }] },
    syntacticAnalysis: { notes: [{ sources: [{ sourceKey: 'Wallace', page: 1 }, { sourceKey: 'Robertson', page: 2 }] }] },
    lexicalAnalyses: [{ term: 'ἡδονή', sources: [{ sourceKey: 'BDAG', page: 4 }, { sourceKey: 'Mayor', page: 5 }, { sourceKey: 'Mayor', page: 6 }] }],
    historicalContext: [],
    oldTestamentLinks: [{ sources: [{ sourceKey: 'Inventada', page: 1 }] }],
} as never;

describe('observationCitationAlerts', () => {
    it('marca cada comentario citado en una pieza de la observación, una vez por pieza', () => {
        expect(observationCitationAlerts(analisis, fuentes, 'mixed')).toEqual([
            { field: 'textualCriticism', sourceKey: 'Mayor' },
            { field: 'lexicalAnalyses', sourceKey: 'Mayor' },
        ]);
    });

    it('una clave que comparte una herramienta no se marca, ni una que nadie declara', () => {
        const alertas = observationCitationAlerts(analisis, fuentes, 'exegetical');
        expect(alertas.map(a => a.sourceKey)).not.toContain('Robertson');
        expect(alertas.map(a => a.sourceKey)).not.toContain('Inventada');
    });

    it('con investigación o sin método no hay control: la literatura va desde el principio', () => {
        expect(observationCitationAlerts(analisis, fuentes, 'research')).toEqual([]);
        expect(observationCitationAlerts(analisis, fuentes, null)).toEqual([]);
    });
});
