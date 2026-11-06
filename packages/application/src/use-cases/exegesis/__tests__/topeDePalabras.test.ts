import { describe, it, expect, vi } from 'vitest';
import { buildEmptyCanonicalVerseAnalysis, exceedsWordBudget, WORD_BUDGET_TOLERANCE } from '@dosfilos/domain';

vi.mock('../../../services/ExegesisCreditReservation', () => ({ ExegesisCreditReservation: { open: vi.fn() } }));
const { ComposeVerseAcademicProseUseCase } = await import('../ComposeVerseAcademicProseUseCase');

/**
 * Compuerta R (TP #10): con argumentar y la regla de vecinos, la prosa salió un
 * 12 % más larga en 2 de 3 textos. Pedir «aproximadamente N palabras» no bastó.
 */
const palabras = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(' ');
const salida = (n: number, tokensUsed: number | null = 10) => ({ markdown: palabras(n), modelId: 'm', tokensUsed, formatterStatus: 'skipped' as const });

function conCompositor(...respuestas: ReturnType<typeof salida>[]) {
    const composer = { composeVerse: vi.fn() };
    respuestas.forEach(r => composer.composeVerse.mockResolvedValueOnce(r));
    const useCase = new ComposeVerseAcademicProseUseCase({} as never, {} as never, {} as never, composer as never);
    const componer = (budget: number | null, guidance?: string) =>
        (useCase as unknown as { composeWithinBudget: (i: unknown, b: number | null) => Promise<ReturnType<typeof salida>> })
            .composeWithinBudget({
                verseAnalysis: buildEmptyCanonicalVerseAnalysis({ bookId: 'JAS', chapterStart: 5, chapterEnd: 5, verseStart: 6, verseEnd: 6 }),
                language: 'es',
                ...(guidance ? { guidance } : {}),
            }, budget);
    return { composer, componer };
}

describe('el presupuesto de palabras se hace cumplir', () => {
    it('dentro del margen, una sola pasada', async () => {
        const { composer, componer } = conCompositor(salida(Math.floor(300 * (1 + WORD_BUDGET_TOLERANCE))));
        await componer(300);
        expect(composer.composeVerse).toHaveBeenCalledTimes(1);
    });

    it('sobre el margen, una segunda pasada con el borrador y la cifra; queda la más corta', async () => {
        const { composer, componer } = conCompositor(salida(340), salida(295));
        const r = await componer(300);
        expect(composer.composeVerse).toHaveBeenCalledTimes(2);
        const guia = composer.composeVerse.mock.calls[1][0].guidance as string;
        expect(guia).toContain('salió con 340 palabras y el presupuesto de esta sección es 300');
        expect(guia).toContain('Conserva la respuesta a cada pregunta');
        expect(guia).toContain('palabra339');
        expect(exceedsWordBudget(r.markdown, 300).words).toBe(295);
        expect(r.tokensUsed).toBe(20);
    });

    it('si la segunda no acortó, se queda la primera', async () => {
        const { componer } = conCompositor(salida(340), salida(360));
        expect(exceedsWordBudget((await componer(300)).markdown, 300).words).toBe(340);
    });

    it('nunca una tercera pasada, aunque la segunda siga larga', async () => {
        const { composer, componer } = conCompositor(salida(400), salida(350));
        await componer(300);
        expect(composer.composeVerse).toHaveBeenCalledTimes(2);
    });

    it('la indicación del autor se conserva y la de acortar va después', async () => {
        const { composer, componer } = conCompositor(salida(340), salida(290));
        await componer(300, 'Corrige la cita de Mayor.');
        expect(composer.composeVerse.mock.calls[1][0].guidance).toMatch(/^Corrige la cita de Mayor\.\n\nEl borrador anterior/);
    });

    it('REGRESIÓN (revisión del PR 1): si la segunda pasada falla, queda la primera', async () => {
        const { composer, componer } = conCompositor(salida(340));
        composer.composeVerse.mockRejectedValueOnce(new Error('límite de llamadas'));
        expect(exceedsWordBudget((await componer(300)).markdown, 300).words).toBe(340);
    });

    it('REGRESIÓN (revisión del PR 1): una segunda degenerada, muy por debajo del presupuesto, no reemplaza a la primera', async () => {
        const { componer } = conCompositor(salida(340), salida(90));
        expect(exceedsWordBudget((await componer(300)).markdown, 300).words).toBe(340);
    });

    it('sin presupuesto no se mide', async () => {
        const { composer, componer } = conCompositor(salida(2000));
        await componer(null);
        expect(composer.composeVerse).toHaveBeenCalledTimes(1);
    });
});

describe('exceedsWordBudget cuenta como el documento', () => {
    it('las citas que bajan al pie no cuentan', () => {
        const conCitas = `${palabras(300)} (Mayor, "The Epistle of St. James", 155) (Wallace, "Greek Grammar", 628)`;
        expect(exceedsWordBudget(conCitas, 300)).toEqual({ words: 300, over: false });
    });
});
