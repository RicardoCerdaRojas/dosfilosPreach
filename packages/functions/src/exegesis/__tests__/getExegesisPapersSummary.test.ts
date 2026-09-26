import { describe, it, expect } from 'vitest';
import { clavesCitadas } from '../getExegesisPapersSummary';

describe('clavesCitadas — la memoria de fuentes entre entregas', () => {
    const paso = (accepted: unknown) => ({ accepted });

    it('saca las claves de los pasos ACEPTADOS', () => {
        const steps = [paso({ canonicalAnalysis: {
            commentatorEngagement: [{ sourceKey: 'Ropes' }, { sourceKey: 'Varner' }],
        } })];
        expect(clavesCitadas(steps)).toEqual(['Ropes', 'Varner']);
    });

    it('lo descartado al regenerar NO cuenta como citado', () => {
        // No dejó cita en el documento entregado; decir que se citó sería
        // mentir sobre la entrega.
        const steps = [{ accepted: null, current: { canonicalAnalysis: {
            commentatorEngagement: [{ sourceKey: 'Mayor' }],
        } } }];
        expect(clavesCitadas(steps)).toEqual([]);
    });

    it('resuelve la aceptada por referencia cuando el paso la guarda así', () => {
        const steps = [{
            acceptedId: 'v2',
            versions: [
                { id: 'v1', canonicalAnalysis: { commentatorEngagement: [{ sourceKey: 'Viejo' }] } },
                { id: 'v2', canonicalAnalysis: { commentatorEngagement: [{ sourceKey: 'Nuevo' }] } },
            ],
        }];
        expect(clavesCitadas(steps)).toEqual(['Nuevo']);
    });

    it('encuentra la clave esté donde esté dentro del análisis', () => {
        // Se recorre en vez de conocer la forma del análisis: replicarla acá
        // sería una copia que se desincroniza al agregarle un campo.
        const steps = [paso({ canonicalAnalysis: {
            lexicalAnalyses: [{ generalSemanticRange: { sources: [{ sourceKey: 'Tuggy' }] } }],
        } })];
        expect(clavesCitadas(steps)).toEqual(['Tuggy']);
    });

    it('no repite ni deja entrar vacías, y ordena', () => {
        const steps = [paso({ canonicalAnalysis: { a: [{ sourceKey: 'Wallace' }, { sourceKey: '  ' }, { sourceKey: 'Wallace' }, { sourceKey: 'Mayor' }] } })];
        expect(clavesCitadas(steps)).toEqual(['Mayor', 'Wallace']);
    });

    it('un paso sin análisis no aporta nada', () => {
        expect(clavesCitadas([paso({ markdown: 'prosa suelta' }), paso(null)])).toEqual([]);
        expect(clavesCitadas([])).toEqual([]);
    });
});
