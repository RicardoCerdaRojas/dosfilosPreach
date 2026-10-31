import { describe, expect, it } from 'vitest';
import type { ExegeticalStep } from '@dosfilos/domain';
import { composePrecheck } from '../composePrecheck';

/** B60 (TI #2): la conclusión se componía con versículos sin aceptar, sin aviso. */
const ANALISIS = { originalText: 'x' };
const verso = (id: string, estado: 'aceptado' | 'en-revision' | 'sin-analisis') => ({
    id, kind: 'verse',
    state: estado === 'en-revision' ? 'awaiting-review' : estado === 'aceptado' ? 'accepted' : 'pending',
    accepted: estado === 'aceptado' ? { canonicalAnalysis: ANALISIS } : null,
    current: estado === 'en-revision' ? { canonicalAnalysis: ANALISIS } : null,
}) as unknown as ExegeticalStep;
const conclusion = (aceptada: boolean) => ({ id: 'c', kind: 'conclusion', accepted: aceptada ? { markdown: 'La conclusión.' } : null }) as unknown as ExegeticalStep;

describe('composePrecheck', () => {
    it('todos aceptados: no hay aviso', () => {
        expect(composePrecheck([verso('4', 'aceptado'), verso('5', 'aceptado')], 'conclusion')).toBeNull();
    });

    it('REGRESIÓN B60: con versículos pendientes avisa sin bloquear y dice cuáles', () => {
        const r = composePrecheck([verso('4', 'aceptado'), verso('5', 'en-revision'), verso('6', 'sin-analisis')], 'conclusion')!;
        expect(r.blocking).toBe(false);
        expect(r.awaitingReview.map(s => s.id)).toEqual(['5']);
        expect(r.noAnalysis.map(s => s.id)).toEqual(['6']);
    });

    it('ningún versículo aceptado: bloquea (el compositor lo rechazaría)', () => {
        expect(composePrecheck([verso('4', 'en-revision')], 'conclusion')!.blocking).toBe(true);
    });

    it('la introducción sin conclusión aceptada bloquea; con ella y versículos pendientes, avisa', () => {
        expect(composePrecheck([verso('4', 'aceptado'), conclusion(false)], 'introduction')!.blocking).toBe(true);
        const r = composePrecheck([verso('4', 'aceptado'), verso('5', 'sin-analisis'), conclusion(true)], 'introduction')!;
        expect(r.blocking).toBe(false);
        expect(composePrecheck([verso('4', 'aceptado'), conclusion(true)], 'introduction')).toBeNull();
    });
});
