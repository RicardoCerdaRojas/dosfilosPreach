import { describe, it, expect } from 'vitest';
import { isPlannedSermonDone, publishedForDraft, timesPreachedForDraft } from '../plannedSermonDone';

/**
 * Serie de Jonás (2026-10-01): tres sermones publicados figuraban «Borrador»
 * en el plan. La regla pedía «paso ≥ 4» y el asistente tiene los pasos 0 a 3.
 * Los borradores reales: `status: 'draft'`, `currentStep` 2-3 y la marca de
 * publicación que deja el asistente.
 */
const borrador = (wizardProgress: Record<string, unknown> | undefined, extra: Record<string, unknown> = {}) =>
    ({ status: 'draft', content: 'x'.repeat(9000), wizardProgress, ...extra }) as never;

describe('isPlannedSermonDone', () => {
    it('un borrador publicado desde el asistente está terminado (Jonás 4:1-4)', () => {
        expect(isPlannedSermonDone(borrador({ currentStep: 3, publishedCopyId: '9c87e3c2', lastPublishedAt: new Date() }))).toBe(true);
    });

    it('un borrador en el último paso pero sin publicar sigue en curso', () => {
        expect(isPlannedSermonDone(borrador({ currentStep: 3 }))).toBe(false);
    });

    it('la marca manual cuenta, la nueva y la anterior', () => {
        expect(isPlannedSermonDone(borrador({ currentStep: 3, markedCompleteAt: new Date() }))).toBe(true);
        expect(isPlannedSermonDone(borrador({ currentStep: 4 }))).toBe(true);
    });

    it('un documento publicado está terminado', () => {
        expect(isPlannedSermonDone(borrador(undefined, { status: 'published' }))).toBe(true);
    });

    it('un sermón anterior al asistente cuenta si tiene contenido', () => {
        expect(isPlannedSermonDone(borrador(undefined))).toBe(true);
        expect(isPlannedSermonDone(borrador(undefined, { content: 'corto' }))).toBe(false);
    });
});

describe('publishedForDraft — el plan encuentra la copia publicada', () => {
    const d = (iso: string) => new Date(iso);
    it('REGRESIÓN tablet: la copia publicada se encuentra por el borrador del que salió', () => {
        const copia = { id: 'copia-1', sourceSermonId: 'borrador-1', publishedAt: d('2026-10-03') };
        expect(publishedForDraft('borrador-1', [copia])).toBe(copia);
    });

    it('si se publicó varias veces, la más reciente', () => {
        const vieja = { id: 'a', sourceSermonId: 'b1', publishedAt: d('2026-09-01') };
        const nueva = { id: 'b', sourceSermonId: 'b1', publishedAt: d('2026-10-01') };
        expect(publishedForDraft('b1', [nueva, vieja])).toBe(nueva);
        expect(publishedForDraft('b1', [vieja, nueva])).toBe(nueva);
    });

    it('un sermón sin asistente es su propio documento', () => {
        const propio = { id: 'b1', publishedAt: d('2026-10-01') };
        expect(publishedForDraft('b1', [propio])).toBe(propio);
    });

    it('sin publicación, nada', () => {
        expect(publishedForDraft('b1', [{ id: 'otro', sourceSermonId: 'otro-borrador' }])).toBeUndefined();
    });
});

describe('plan ↔ publicados — versiones y republicaciones (revisión adversarial de A6)', () => {
    const d = (iso: string) => new Date(iso);

    it('la copia de una VERSIÓN (versionOf = borrador) no se toma por la del plan', () => {
        const delPlan = { id: 'c1', sourceSermonId: 'D', publishedAt: d('2026-09-01') };
        const deLaVersion = { id: 'cv', sourceSermonId: 'V', versionOf: 'D', publishedAt: d('2026-10-01') };
        expect(publishedForDraft('D', [delPlan, deLaVersion])).toBe(delPlan);
    });

    it('republicar no «despredica» la semana: cuentan todas las copias', () => {
        const predicada = { id: 'c1', sourceSermonId: 'D', publishedAt: d('2026-09-01'), timesPreached: 1 };
        const republicada = { id: 'c2', sourceSermonId: 'D', publishedAt: d('2026-10-01'), timesPreached: 0 };
        expect(publishedForDraft('D', [predicada, republicada])).toBe(republicada);
        expect(timesPreachedForDraft('D', [predicada, republicada])).toBe(1);
    });
});
