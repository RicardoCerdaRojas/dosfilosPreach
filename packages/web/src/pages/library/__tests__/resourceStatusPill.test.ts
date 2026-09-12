import { describe, it, expect } from 'vitest';
import {
    resolveResourceStatusPill,
    resolveResourceStatusTooltip,
} from '../resourceStatusPill';

type Recurso = Parameters<typeof resolveResourceStatusTooltip>[0];
const recurso = (parcial: Partial<Recurso>): Recurso => ({
    textExtractionStatus: 'ready',
    ...parcial,
} as Recurso);

describe('resolveResourceStatusPill', () => {
    it('un índice parcial no se ve igual que uno completo', () => {
        const parcial = resolveResourceStatusPill(
            recurso({ indexingWarning: 'El índice llega hasta la página 433 de 711 (61%).' }),
            'indexed',
        )!;
        const completo = resolveResourceStatusPill(recurso({}), 'indexed')!;
        expect(parcial.textKey).toBe('status.readyPartial');
        expect(completo.textKey).toBe('status.ready');
        expect(parcial.tone).not.toBe(completo.tone);
    });

    it('la extracción manda sobre el índice', () => {
        expect(resolveResourceStatusPill(recurso({ textExtractionStatus: 'failed' }), 'indexed')!.textKey)
            .toBe('status.failed');
        expect(resolveResourceStatusPill(recurso({ textExtractionStatus: 'processing' }), 'indexed')!.textKey)
            .toBe('status.processing');
    });

    it('sin estado de índice conocido no inventa píldora', () => {
        expect(resolveResourceStatusPill(recurso({}), 'unknown')).toBeNull();
    });
});

describe('resolveResourceStatusTooltip', () => {
    it('explica el fallo de extracción con el motivo escrito por el servidor', () => {
        expect(resolveResourceStatusTooltip(
            recurso({ textExtractionStatus: 'failed', extractionError: 'Se superó el tiempo máximo.' }),
            'unknown',
        )).toBe('Se superó el tiempo máximo.');
    });

    it('explica la cobertura corta cuando el índice quedó a medias', () => {
        const aviso = 'El índice llega hasta la página 433 de 711 (61%).';
        expect(resolveResourceStatusTooltip(recurso({ indexingWarning: aviso }), 'indexed')).toBe(aviso);
    });

    it('calla cuando no hay nada que explicar', () => {
        expect(resolveResourceStatusTooltip(recurso({}), 'indexed')).toBeUndefined();
    });
});

/**
 * Un libro largo ya no se extrae en una invocación: es una cadena de tareas que
 * puede durar más de una hora —un diccionario de 1 006 páginas son ~25 rangos—.
 * Con «Procesando…» a secas, esa espera es indistinguible de estar colgado, y
 * el usuario cancela un trabajo que iba bien.
 */
describe('avance de la extracción en cola', () => {
    // La píldora mira un campo más que el tooltip, así que el argumento se tipa
    // desde SU firma y no desde la del tooltip: reusar el otro `Recurso` haría
    // que el avance no existiera para el compilador.
    type RecursoParaPildora = Parameters<typeof resolveResourceStatusPill>[0];
    const enCurso = (extractionProgress: RecursoParaPildora['extractionProgress']) =>
        resolveResourceStatusPill(
            { textExtractionStatus: 'processing', extractionProgress } as RecursoParaPildora,
            'unknown',
        );

    it('muestra el avance real cuando la cola lo reporta', () => {
        const pill = enCurso({
            paginasHechas: 83, totalPaginas: 170, porcentaje: 49,
            ultimoRango: '41-83', rangosEstimados: 5,
        });
        expect(pill?.textKey).toBe('status.processingProgress');
        expect(pill?.textValues).toEqual({ porcentaje: 49, hechas: 83, total: 170 });
    });

    it('sin avance dice lo de siempre, en vez de inventar un 0%', () => {
        // Es el instante entre encolar y el primer rango, y también la ruta que
        // extrae de una sola pasada. Un progreso clavado en 0 asusta más que
        // ninguno.
        expect(enCurso(undefined)?.textKey).toBe('status.processing');
        expect(enCurso({
            paginasHechas: 0, totalPaginas: 0, porcentaje: 0,
            ultimoRango: null, rangosEstimados: 0,
        })?.textKey).toBe('status.processing');
    });

    it('el avance no cambia el estado: sigue siendo «procesando»', () => {
        const pill = enCurso({
            paginasHechas: 169, totalPaginas: 170, porcentaje: 99,
            ultimoRango: '161-170', rangosEstimados: 5,
        });
        expect(pill?.iconClass).toBe('animate-spin');
    });
});
