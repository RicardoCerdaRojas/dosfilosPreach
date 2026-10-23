import { describe, it, expect } from 'vitest';
import {
    bibliographyAvailability,
    bibliographyEntryError,
    bibliographyWarnings,
    candidateRank,
    cleanProjectBibliography,
    inheritableBibliography,
    mergeBibliographyCandidates,
    projectBibliography,
    sourceIdsFromBibliography,
    type ProjectBibliographyEntry,
} from '../projectBibliography';

/** Etapa 2 (ADR-046): la bibliografía del proyecto, el estado del arte. */
const ficha = (over: Partial<ProjectBibliographyEntry> = {}): ProjectBibliographyEntry => ({
    id: 'f1', title: 'The Epistle of James', author: 'Douglas J. Moo', weight: 'recommended', decision: 'candidate', origins: ['manual'], ...over,
});
let n = 0;
const nuevoId = () => `n${++n}`;

describe('la bibliografía del proyecto', () => {
    it('un proyecto anterior a la etapa 2 lee sus sourceIds como fichas aprobadas', () => {
        const fichas = projectBibliography({ sourceIds: ['mayor', 'mayor', 'na28'] }, id => (id === 'mayor' ? { title: 'The Epistle of St. James', author: 'Mayor' } : null));
        expect(fichas).toHaveLength(2);
        expect(fichas[0]).toMatchObject({ resourceId: 'mayor', decision: 'approved', title: 'The Epistle of St. James', origins: ['legacy'] });
        // Guardar la bibliografía reemplaza la lectura de los sourceIds.
        expect(projectBibliography({ bibliography: [], sourceIds: ['mayor'] })).toEqual([]);
    });

    it('las conversaciones siguen acotadas: sourceIds = aprobadas en la biblioteca', () => {
        expect(sourceIdsFromBibliography([
            ficha({ id: 'a', resourceId: 'r1', decision: 'approved' }),
            ficha({ id: 'b', resourceId: 'r1', decision: 'approved' }),
            ficha({ id: 'c', resourceId: 'r2', decision: 'candidate' }),
            ficha({ id: 'd', resourceId: null, decision: 'approved' }),
        ])).toEqual(['r1']);
    });

    it('sin libro está por conseguir', () => {
        expect(bibliographyAvailability({ resourceId: null })).toBe('to-acquire');
        expect(bibliographyAvailability({ resourceId: 'r' })).toBe('in-library');
    });

    it('descartar pide una razón; una ficha necesita título o libro', () => {
        expect(bibliographyEntryError(ficha({ decision: 'discarded', reason: '  ' }))).toBe('reason');
        expect(bibliographyEntryError(ficha({ decision: 'discarded', reason: 'Devocional, sin notas' }))).toBeNull();
        expect(bibliographyEntryError(ficha({ title: ' ', resourceId: null }))).toBe('title');
    });

    describe('cruzar bibliografías (Eco III.2.2)', () => {
        it('la misma obra de dos orígenes es una sola ficha con los dos orígenes y el peso mayor', () => {
            const out = mergeBibliographyCandidates([], [
                { title: 'The Epistle of James', author: 'Douglas J. Moo', weight: 'recommended', origin: 'catalog' },
                { title: 'The Epistle of James', author: 'Moo', weight: 'required', origin: 'syllabus', note: 'Lectura obligatoria' },
            ], nuevoId);
            expect(out).toHaveLength(1);
            expect(out[0]).toMatchObject({ weight: 'required', origins: ['catalog', 'syllabus'], decision: 'candidate' });
            expect(candidateRank(out[0]!)).toBeGreaterThan(candidateRank(ficha({ weight: 'required', origins: ['syllabus'] })));
        });

        it('lo ya decidido no se pisa, y una descartada no vuelve a ser candidata', () => {
            const ya = ficha({ decision: 'discarded', reason: 'Popular', evaluation: { level: 'popular' } });
            const [f] = mergeBibliographyCandidates([ya], [{ title: 'The Epistle of James', author: 'Moo', weight: 'recommended', origin: 'library', resourceId: 'r-moo' }], nuevoId);
            expect(f).toMatchObject({ decision: 'discarded', reason: 'Popular', evaluation: { level: 'popular' }, resourceId: 'r-moo', origins: ['manual', 'library'] });
        });

        it('dos obras distintas con título parecido no se funden', () => {
            const out = mergeBibliographyCandidates([ficha({ title: 'James', author: 'Moo' })], [{ title: 'James', author: 'McKnight', weight: 'recommended', origin: 'catalog' }], nuevoId);
            expect(out).toHaveLength(2);
        });

        it('el mismo libro de la biblioteca es la misma ficha aunque el título difiera', () => {
            const out = mergeBibliographyCandidates([ficha({ resourceId: 'r1', title: 'NICNT James' })], [{ title: 'The Letter of James', resourceId: 'r1', weight: 'recommended', origin: 'studies' }], nuevoId);
            expect(out).toHaveLength(1);
        });
    });

    it('se guarda sin undefined anidado, sin ids repetidos y con textos recortados', () => {
        const out = cleanProjectBibliography([
            ficha({ evaluation: { level: undefined, notes: 'x'.repeat(2000) }, annotation: { serves: '  ' } }),
            ficha({ title: 'Repetida' }),
            ficha({ id: 'vacia', title: '  ', resourceId: null }),
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]!.evaluation).toEqual({ notes: 'x'.repeat(1000) });
        expect(out[0]!.annotation).toEqual({ serves: null });
        expect(JSON.stringify(out)).not.toContain('undefined');
    });

    describe('avisos (informan; no bloquean)', () => {
        const recursos: Record<string, { coversBibleBooks: string[] }> = { santiago: { coversBibleBooks: ['JAS'] }, romanos: { coversBibleBooks: ['ROM'] } };
        const de = (id: string) => recursos[id] as never;

        it('un tipo que pide la rúbrica sin obra aprobada', () => {
            const w = bibliographyWarnings([ficha({ decision: 'approved', sourceType: 'lexicon-technical' })], [{ sourceType: 'lexicon-technical', minimum: 1 }, { sourceType: 'grammar-syntax', minimum: 1 }], de, ['JAS']);
            expect(w).toEqual([{ kind: 'missing-type', sourceType: 'grammar-syntax', minimum: 1 }]);
        });

        it('toda la bibliografía rotulada en una tradición (con al menos tres rotuladas)', () => {
            const tres = ['a', 'b', 'c'].map(id => ficha({ id, decision: 'approved', evaluation: { tradition: 'evangelical' } }));
            expect(bibliographyWarnings(tres, [], de, [])).toEqual([{ kind: 'single-tradition', tradition: 'evangelical' }]);
            expect(bibliographyWarnings(tres.slice(0, 2), [], de, [])).toEqual([]);
        });

        it('una obligatoria por conseguir y un comentario de otro libro', () => {
            const w = bibliographyWarnings([
                ficha({ id: 'oblig', decision: 'approved', weight: 'required', resourceId: null }),
                ficha({ id: 'rom', decision: 'approved', sourceType: 'commentary-critical', resourceId: 'romanos' }),
                ficha({ id: 'stgo', decision: 'approved', sourceType: 'commentary-critical', resourceId: 'santiago' }),
            ], [], de, ['JAS']);
            expect(w).toEqual([{ kind: 'required-to-acquire', entryId: 'oblig' }, { kind: 'commentary-other-book', entryId: 'rom' }]);
        });
    });

    it('el estudio hereda las aprobadas en la biblioteca; un comentario de otro libro no', () => {
        const recursos: Record<string, { coversBibleBooks: string[] }> = { santiago: { coversBibleBooks: ['JAS'] }, romanos: { coversBibleBooks: ['ROM'] } };
        const heredadas = inheritableBibliography([
            ficha({ id: 'lex', decision: 'approved', sourceType: 'lexicon-technical', resourceId: 'bdag' }),
            ficha({ id: 'stgo', decision: 'approved', sourceType: 'commentary-critical', resourceId: 'santiago' }),
            ficha({ id: 'rom', decision: 'approved', sourceType: 'commentary-expository', resourceId: 'romanos' }),
            ficha({ id: 'falta', decision: 'approved', resourceId: null }),
            ficha({ id: 'cand', decision: 'candidate', resourceId: 'x' }),
            ficha({ id: 'marcado', decision: 'approved', sourceType: 'commentary-critical', resourceId: 'sinFicha', evaluation: { coversBook: false } }),
        ], 'JAS', id => recursos[id] as never);
        expect(heredadas.map(e => e.id)).toEqual(['lex', 'stgo']);
    });
});
