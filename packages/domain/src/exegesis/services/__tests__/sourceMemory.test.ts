import { describe, expect, it } from 'vitest';
import { previousDeliveries, previousDelivery, repeatedFromPreviousDelivery } from '../sourceMemory';
import type { ExegesisPaperSummary } from '../../entities/ExegesisPaperSummary';

/**
 * El caso real. El encuadre de Santiago 2:1-13 dice «Prohibido citar
 * McCartney, Ropes, Varner: el plan de estudios no permite repetir una fuente
 * en semanas consecutivas», y esos tres son exactamente los que el autor había
 * citado la semana anterior. La regla la hizo cumplir él, a mano.
 */
const resumen = (
    id: string, dias: number, citedSourceKeys: string[],
): ExegesisPaperSummary => ({
    id,
    title: id,
    passage: { bookId: 'JAS', chapterStart: 1, chapterEnd: 1, verseStart: 1, verseEnd: 1 },
    createdAt: new Date(2026, 8, dias),
    citedSourceKeys,
} as unknown as ExegesisPaperSummary);

const SANTIAGO_1 = resumen('jas1', 16, ['McCartney', 'Ropes', 'Varner', 'Wallace y Steffen']);
const SANTIAGO_2 = resumen('jas2', 23, []);

describe('previousDelivery', () => {
    it('encuentra la entrega inmediatamente anterior del mismo autor', () => {
        const previa = previousDelivery([SANTIAGO_2, SANTIAGO_1], 'jas2');
        expect(previa?.paperId).toBe('jas1');
        expect(previa?.citedSourceKeys).toContain('Ropes');
    });

    it('un borrador que no citó nada NO es la entrega anterior', () => {
        // Si no, el aviso dependería de en qué orden se crearon dos borradores
        // abiertos en paralelo.
        const borrador = resumen('borrador', 20, []);
        expect(previousDelivery([SANTIAGO_2, borrador, SANTIAGO_1], 'jas2')?.paperId).toBe('jas1');
    });

    it('manda el orden y no una ventana de días', () => {
        // El sílabo dice «semanas consecutivas»: consecutiva es la de antes.
        const vieja = resumen('vieja', 1, ['Metzger']);
        const reciente = resumen('reciente', 20, ['Mayor']);
        expect(previousDelivery([SANTIAGO_2, vieja, reciente], 'jas2')?.paperId).toBe('reciente');
    });

    it('un trabajo posterior no cuenta como anterior', () => {
        const futuro = resumen('futuro', 30, ['Mayor']);
        expect(previousDelivery([SANTIAGO_2, futuro], 'jas2')).toBeNull();
    });

    it('el primer trabajo del autor no tiene anterior', () => {
        expect(previousDelivery([SANTIAGO_1], 'jas1')).toBeNull();
    });

    it('un trabajo que no está en la lista no inventa una anterior', () => {
        expect(previousDelivery([SANTIAGO_1], 'otro')).toBeNull();
    });
});

describe('repeatedFromPreviousDelivery', () => {
    const previa = previousDelivery([SANTIAGO_2, SANTIAGO_1], 'jas2');

    it('señala las del corpus actual que ya se citaron la vez pasada', () => {
        const repetidas = repeatedFromPreviousDelivery(
            ['Mayor', 'Ropes', 'Wallace', 'McCartney'], previa,
        );
        expect([...repetidas].sort()).toEqual(['McCartney', 'Ropes']);
    });

    it('una fuente sin clave de cita no se puede comparar', () => {
        expect(repeatedFromPreviousDelivery([null], previa).size).toBe(0);
    });

    it('sin entrega anterior no señala nada', () => {
        expect(repeatedFromPreviousDelivery(['Ropes'], null).size).toBe(0);
    });
});

/** TP #8 (2026-10-21, fase 8a, A7): la regla de no repetir es por tipo. */
describe('previousDeliveries', () => {
    const conFuentes = (id: string, dias: number, citadas: string[], fuentes: Array<[string, string]>) => ({
        ...resumen(id, dias, citadas),
        sources: fuentes.map(([citationKey, sourceType]) => ({ citationKey, sourceType, corpusId: citationKey, sourceLibraryResourceId: null, displayLabel: citationKey })),
    }) as unknown as ExegesisPaperSummary;
    const tp6 = conFuentes('tp6', 7, ['Wallace', 'Adamson'], [['Wallace', 'grammar-syntax'], ['Adamson', 'commentary-critical']]);
    // Robertson en el corpus del TP #7 pero sin citar; Ropes citada y sin fuente que la declare.
    const tp7 = conFuentes('tp7', 14, ['Ropes', 'Tuggy'], [['Tuggy', 'lexicon-technical'], ['Robertson', 'grammar-syntax']]);
    const tp8 = conFuentes('tp8', 21, [], []);

    it('las dos últimas entregas, de la más reciente a la más vieja', () => {
        expect(previousDeliveries([tp6, tp8, tp7], 'tp8', 2).map(d => d.paperId)).toEqual(['tp7', 'tp6']);
        expect(previousDeliveries([tp6, tp8, tp7], 'tp8', 1).map(d => d.paperId)).toEqual(['tp7']);
    });

    it('el tipo de cada clave CITADA sale de las fuentes de esa entrega', () => {
        const [tp7Entregado] = previousDeliveries([tp6, tp7, tp8], 'tp8', 1);
        expect(tp7Entregado!.citedSourceTypes).toEqual({ Tuggy: ['lexicon-technical'] });
    });
});
