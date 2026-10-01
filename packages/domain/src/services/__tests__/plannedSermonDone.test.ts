import { describe, it, expect } from 'vitest';
import { isPlannedSermonDone } from '../plannedSermonDone';

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
