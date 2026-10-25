import { describe, it, expect } from 'vitest';
import { SermonSeriesEntity } from '../SermonSeries';

/**
 * ADR-046 etapa 3: la serie sabe a qué proyecto pertenece. El vínculo vive
 * solo en `series.projectId`, y la fecha de creación no se reescribe.
 */
const base = {
    userId: 'u1',
    title: 'Nehemías',
    description: 'Serie expositiva',
    sermonIds: [],
    draftIds: [],
    type: 'expository' as const,
    resourceIds: [],
};

describe('la serie con proyecto', () => {
    it('una serie creada sin proyecto queda suelta (undefined)', () => {
        const serie = SermonSeriesEntity.create(base);
        expect(serie.projectId).toBeUndefined();
    });

    it('una serie creada con proyecto lo conserva', () => {
        const serie = SermonSeriesEntity.create({ ...base, projectId: 'p1' });
        expect(serie.projectId).toBe('p1');
    });

    it('actualizar otro campo no toca el proyecto', () => {
        const serie = SermonSeriesEntity.create({ ...base, projectId: 'p1' });
        expect(serie.update({ title: 'Otro título' }).projectId).toBe('p1');
    });

    it('actualizar con projectId null desliga la serie', () => {
        const serie = SermonSeriesEntity.create({ ...base, projectId: 'p1' });
        expect(serie.update({ projectId: null }).projectId).toBeNull();
    });

    it('actualizar con otro proyecto lo cambia', () => {
        const serie = SermonSeriesEntity.create({ ...base, projectId: 'p1' });
        expect(serie.update({ projectId: 'p2' }).projectId).toBe('p2');
    });

    it('actualizar conserva la fecha de creación', () => {
        const creada = new Date('2026-09-01T12:00:00Z');
        const serie = SermonSeriesEntity.create({ ...base, createdAt: creada });
        const actualizada = serie.update({ title: 'Otro título', projectId: 'p1' });
        expect(actualizada.createdAt.toISOString()).toBe(creada.toISOString());
    });

    it('create respeta la fecha de creación que recibe (lectura de Firestore)', () => {
        const creada = new Date('2026-09-01T12:00:00Z');
        const editada = new Date('2026-09-05T12:00:00Z');
        const serie = SermonSeriesEntity.create({ ...base, createdAt: creada, updatedAt: editada });
        expect(serie.createdAt.toISOString()).toBe(creada.toISOString());
        expect(serie.updatedAt.toISOString()).toBe(editada.toISOString());
    });
});
