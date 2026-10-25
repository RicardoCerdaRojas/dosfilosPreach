import { describe, it, expect } from 'vitest';
import { cleanSeriesPlacement, seriesPlacementFor } from '../seriesPlacement';

/**
 * El lugar de la perícopa en su serie, como DATO del estudio
 * (`docs/FASE_ENCUADRE_SERIE_2026-10.md`, §2 paso 9). Antes era una línea en
 * español dentro del encargo; ahora cada prompt lo dibuja en su idioma.
 */
const serie = {
    metadata: {
        plannedSermons: [
            { id: 'r1', title: 'El decreto de Ciro', passage: 'Esdras 1:1-11' },
            { id: 'r2', title: 'El altar y los cimientos', passage: 'Esdras 3:1-13' },
            { id: 'r3', title: 'La oposición', passage: 'Esdras 4:1-24' },
        ],
    },
};

describe('seriesPlacementFor', () => {
    it('la del medio: su lugar, la anterior y la siguiente', () => {
        expect(seriesPlacementFor(serie, 'r2')).toEqual({
            position: 2,
            total: 3,
            previous: { passage: 'Esdras 1:1-11', title: 'El decreto de Ciro' },
            next: { passage: 'Esdras 4:1-24', title: 'La oposición' },
        });
    });

    it('en los extremos no escribe la vecina que no hay (ni como undefined: Firestore lo rechaza)', () => {
        const primera = seriesPlacementFor(serie, 'r1')!;
        expect(primera).toEqual({ position: 1, total: 3, next: { passage: 'Esdras 3:1-13', title: 'El altar y los cimientos' } });
        expect('previous' in primera).toBe(false);
        const ultima = seriesPlacementFor(serie, 'r3')!;
        expect('next' in ultima).toBe(false);
        expect(ultima.previous?.title).toBe('El altar y los cimientos');
    });

    it('fuera de la serie o sin serie: null', () => {
        expect(seriesPlacementFor(serie, 'otra')).toBeNull();
        expect(seriesPlacementFor(null, 'r1')).toBeNull();
        expect(seriesPlacementFor({ metadata: null }, 'r1')).toBeNull();
    });

    it('cuenta unidades, no filas: una unidad en dos domingos cuenta una vez', () => {
        const dosDomingos = {
            metadata: {
                plannedSermons: [
                    { id: 'r1', title: 'El decreto', passage: 'Esdras 1:1-11', paperId: 'p1' },
                    { id: 'r2a', title: 'El altar (1)', passage: 'Esdras 3:1-13', paperId: 'p2' },
                    { id: 'r2b', title: 'El altar (2)', passage: 'Esdras 3:1-13' },
                    { id: 'r3', title: 'La oposición', passage: 'Esdras 4:1-24', paperId: 'p3' },
                ],
            },
        };
        expect(seriesPlacementFor(dosDomingos, 'r2b')).toMatchObject({ position: 2, total: 3 });
        expect(seriesPlacementFor(dosDomingos, 'r3')).toEqual({
            position: 3, total: 3, previous: { passage: 'Esdras 3:1-13', title: 'El altar (1)' },
        });
    });

    it('sin `passage`, traduce la unidad sintáctica (original) a la numeración del lector, en el idioma pedido', () => {
        // Jonás 2:1 del hebreo es 1:17 en la Biblia del lector.
        const s = {
            metadata: {
                plannedSermons: [
                    { id: 'a', title: 'El pez', passage: '', syntacticUnit: { book: 'Jonás', chapterStart: 2, verseStart: 1, chapterEnd: 2, verseEnd: 11 } },
                    { id: 'b', title: 'Nínive', passage: 'Jonás 3:1-10' },
                ],
            },
        };
        expect(seriesPlacementFor(s, 'b')!.previous).toEqual({ passage: 'Jonás 1:17-2:10', title: 'El pez' });
        expect(seriesPlacementFor(s, 'b', 'en')!.previous).toEqual({ passage: 'Jonah 1:17-2:10', title: 'El pez' });
    });
});

describe('cleanSeriesPlacement — lo que vuelve de Firestore', () => {
    it('conserva un lugar válido y recorta los textos', () => {
        expect(cleanSeriesPlacement({ position: 2, total: 3, previous: { passage: ' Esd 1 ', title: ' A ' } })).toEqual({
            position: 2, total: 3, previous: { passage: 'Esd 1', title: 'A' },
        });
    });

    it('descarta lo malformado en vez de tumbar la lectura', () => {
        expect(cleanSeriesPlacement(undefined)).toBeNull();
        expect(cleanSeriesPlacement('3 de 12')).toBeNull();
        expect(cleanSeriesPlacement({ position: 0, total: 3 })).toBeNull();
        expect(cleanSeriesPlacement({ position: 4, total: 3 })).toBeNull();
        expect(cleanSeriesPlacement({ position: 1.5, total: 3 })).toBeNull();
        // Una vecina vacía se cae; el lugar se queda.
        expect(cleanSeriesPlacement({ position: 1, total: 2, next: { passage: ' ', title: '' } })).toEqual({ position: 1, total: 2 });
    });
});
