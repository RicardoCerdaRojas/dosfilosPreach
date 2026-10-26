import { describe, it, expect } from 'vitest';
import {
    bibliographyCoverage,
    classificationHistory,
    initialSourcesFromBibliography,
    noRepeatApplies,
    applyLibrarySelection,
    evaluationFromLibrary,
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

describe('el selector de fuentes y la evaluación desde la biblioteca', () => {
    it('marcar aprueba (y crea la ficha si falta); desmarcar vuelve a candidata', () => {
        const ahora = new Date('2026-10-23T12:00:00Z');
        const out = applyLibrarySelection([
            ficha({ id: 'a', resourceId: 'r1', decision: 'approved' }),
            ficha({ id: 'b', resourceId: 'r2', decision: 'candidate' }),
            ficha({ id: 'c', resourceId: null, decision: 'approved' }),
        ], ['r2', 'r3'], id => (id === 'r3' ? { title: 'BDAG', exegeticalType: 'lexicon-technical' } : null), () => 'nueva', ahora);
        expect(out.map(e => [e.id, e.decision])).toEqual([['a', 'candidate'], ['b', 'approved'], ['c', 'approved'], ['nueva', 'approved']]);
        expect(out[3]).toMatchObject({ resourceId: 'r3', title: 'BDAG', sourceType: 'lexicon-technical', origins: ['selector'] });
        expect(out[1]!.decidedAt).toBe(ahora.toISOString());
        // Lo que el selector aprueba lleva su origen; desmarcar no lo quita ni lo duplica.
        expect(out[1]!.origins).toEqual(['manual', 'selector']);
        expect(out[0]!.origins).toEqual(['manual']);
        const otraVez = applyLibrarySelection(applyLibrarySelection(out, [], () => null, () => 'x', ahora), ['r2'], () => null, () => 'x', ahora);
        expect(otraVez.find(e => e.id === 'b')!.origins).toEqual(['manual', 'selector']);
    });

    it('el selector liga una obra por conseguir a su libro y la marca como suya', () => {
        const ahora = new Date('2026-10-23T12:00:00Z');
        const out = applyLibrarySelection(
            [ficha({ id: 's', title: 'The Epistle of James', author: 'Douglas J. Moo', resourceId: null, decision: 'candidate', origins: ['syllabus'] })],
            ['moo'], id => (id === 'moo' ? { title: 'The Epistle of James', author: 'Moo' } : null), () => 'nueva', ahora,
        );
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ resourceId: 'moo', decision: 'approved', origins: ['syllabus', 'selector'] });
    });

    it('precompleta cobertura y páginas impresas sin pisar lo respondido', () => {
        const stgo = { coversBibleBooks: ['JAS'], pageNumbering: { origin: 'detected' } } as never;
        const rom = { coversBibleBooks: ['ROM'] } as never;
        expect(evaluationFromLibrary({ sourceType: 'commentary-critical' }, stgo, ['JAS'])).toEqual({ coversBook: true, printedPages: true });
        expect(evaluationFromLibrary({ sourceType: 'commentary-critical' }, rom, ['JAS'])).toEqual({ coversBook: false });
        expect(evaluationFromLibrary({ sourceType: 'commentary-critical', evaluation: { coversBook: false, printedPages: false } }, stgo, ['JAS'])).toEqual({ coversBook: false, printedPages: false });
        // Una gramática no «comenta» un libro: no se pregunta por cobertura.
        expect(evaluationFromLibrary({ sourceType: 'grammar-syntax' }, { coversBibleBooks: ['ROM'] } as never, ['JAS'])).toEqual({});
    });
});

describe('lo que el estudio hereda del proyecto', () => {
    it('como fuentes iniciales, con la clasificación del proyecto o la del libro', () => {
        const out = initialSourcesFromBibliography([
            ficha({ id: 'a', resourceId: 'ropes', title: 'ICC James', sourceType: 'commentary-critical' }),
            ficha({ id: 'b', resourceId: 'bdag', title: 'BDAG', sourceType: null }),
            ficha({ id: 'c', resourceId: null, title: 'Por conseguir' }),
        ], id => (id === 'bdag' ? 'lexicon-technical' : null));
        expect(out).toEqual([
            { corpusId: 'ropes', sourceLibraryResourceId: 'ropes', sourceType: 'commentary-critical', displayLabel: 'ICC James', mode: 'full-document' },
            { corpusId: 'bdag', sourceLibraryResourceId: 'bdag', sourceType: 'lexicon-technical', displayLabel: 'BDAG', mode: 'full-document' },
        ]);
    });

    it('«no repetir» es regla del curso: sin proyecto rige; en un proyecto, lo dicen sus criterios', () => {
        expect(noRepeatApplies(null)).toBe(true);
        expect(noRepeatApplies({ type: 'course' })).toBe(true);
        expect(noRepeatApplies({ type: 'study' })).toBe(false);
        expect(noRepeatApplies({ type: 'course', bibliographyCriteria: { noRepeatSources: false } })).toBe(false);
        expect(noRepeatApplies({ type: 'study', bibliographyCriteria: { noRepeatSources: true } })).toBe(true);
    });
});

describe('revisión adversarial de la etapa 2', () => {
    it('un proyecto de antes hereda con la clasificación y el título del libro: no comentarios de otro libro ni filas sin nombre', () => {
        const libro: Record<string, { title: string; exegeticalType: string; coversBibleBooks: string[] }> = {
            ropes: { title: 'ICC James', exegeticalType: 'commentary-critical', coversBibleBooks: ['JAS'] },
            romanos: { title: 'Romans', exegeticalType: 'commentary-critical', coversBibleBooks: ['ROM'] },
            bdag: { title: 'BDAG', exegeticalType: 'lexicon-technical', coversBibleBooks: [] },
        };
        const fichas = projectBibliography({ sourceIds: ['ropes', 'romanos', 'bdag'] });
        const heredadas = inheritableBibliography(fichas, 'JAS', id => libro[id] as never);
        expect(heredadas.map(e => e.resourceId)).toEqual(['ropes', 'bdag']);
        const fuentes = initialSourcesFromBibliography(heredadas, id => libro[id]?.exegeticalType as never, id => libro[id]?.title);
        expect(fuentes.map(f => [f.displayLabel, f.sourceType])).toEqual([['ICC James', 'commentary-critical'], ['BDAG', 'lexicon-technical']]);
        expect(projectBibliography({ sourceIds: ['ropes'] }, id => ({ title: libro[id]!.title, exegeticalType: 'commentary-critical' }))[0]!.sourceType).toBe('commentary-critical');
    });

    it('sin autor, dos títulos de una serie no son la misma obra', () => {
        const out = mergeBibliographyCandidates(
            [ficha({ title: 'Comentario Bíblico Mundo Hispano: Santiago', author: null })],
            [{ title: 'Comentario Bíblico Mundo Hispano: Romanos', weight: 'required', origin: 'syllabus' }],
            () => 'x',
        );
        expect(out).toHaveLength(2);
        expect(out[0]!.weight).toBe('recommended');
    });

    it('un libro nunca queda en dos fichas: el mismo libro gana sobre la obra parecida', () => {
        const out = mergeBibliographyCandidates([
            ficha({ id: 'a', title: 'James', author: 'Moo', resourceId: null }),
            ficha({ id: 'b', title: 'The Letter of James', author: 'Moo', resourceId: 'x' }),
        ], [{ title: 'James', author: 'Moo', resourceId: 'x', weight: 'recommended', origin: 'library' }], () => 'n');
        expect(out.filter(e => e.resourceId === 'x').map(e => e.id)).toEqual(['b']);
        // El origen va a la ficha del mismo libro, no a la obra parecida.
        expect(out.find(e => e.id === 'b')!.origins).toContain('library');
        expect(out.find(e => e.id === 'a')!.origins).not.toContain('library');
    });

    it('marcar en el selector un libro que era una obra por conseguir la liga, no la duplica', () => {
        const out = applyLibrarySelection(
            [ficha({ id: 'a', title: 'James', author: 'Douglas J. Moo', resourceId: null, weight: 'required' })],
            ['x'], () => ({ title: 'James', author: 'Moo' }), () => 'nueva', new Date('2026-10-23T00:00:00Z'),
        );
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ id: 'a', resourceId: 'x', decision: 'approved', weight: 'required' });
    });

    it('los avisos usan la clasificación del libro cuando la ficha no la tiene', () => {
        const w = bibliographyWarnings([ficha({ decision: 'approved', resourceId: 'lex', sourceType: null })], [{ sourceType: 'lexicon-technical', minimum: 1 }], () => ({ exegeticalType: 'lexicon-technical' }) as never, []);
        expect(w).toEqual([]);
    });
});

describe('la cobertura contra las rúbricas (prueba del fundador, NT785)', () => {
    const req = [
        { sourceType: 'commentary-critical' as const, minimum: 2, workType: 'TP Semanal' },
        { sourceType: 'commentary-critical' as const, minimum: 1, workType: 'Investigación' },
        { sourceType: 'journal-article' as const, minimum: 1, workType: 'Investigación' },
    ];
    const fichas = [
        ficha({ id: 'mayor', decision: 'approved', sourceType: 'commentary-critical', resourceId: 'm' }),
        ficha({ id: 'nicnt', decision: 'approved', sourceType: null, resourceId: 'n' }),
        ficha({ id: 'davids', decision: 'candidate', sourceType: 'commentary-critical', resourceId: null }),
        ficha({ id: 'ropes', decision: 'candidate', sourceType: null, resourceId: 'r' }),
        ficha({ id: 'fuera', decision: 'discarded', sourceType: 'commentary-critical', reason: 'x' }),
    ];

    it('una fila por tipo con el mayor mínimo, quién lo pide, aprobadas y candidatas; lo sin cubrir primero', () => {
        const c = bibliographyCoverage(fichas, req, () => null);
        expect(c.rows[0]).toMatchObject({ sourceType: 'commentary-critical', minimum: 2, approved: 1, candidates: 1, candidatesInLibrary: 0 });
        expect(c.rows[0]!.requiredBy).toEqual([{ workType: 'TP Semanal', minimum: 2 }, { workType: 'Investigación', minimum: 1 }]);
        expect(c.rows[1]).toMatchObject({ sourceType: 'journal-article', approved: 0, candidates: 0 });
        expect(c).toMatchObject({ unclassifiedApproved: 1, unclassifiedCandidates: 1 });
    });

    it('la clasificación del libro cuenta si la ficha no tiene; con dos críticos se cubre', () => {
        const c = bibliographyCoverage(fichas, req, id => (id === 'n' ? { exegeticalType: 'commentary-critical' } : null));
        expect(c.rows.find(r => r.sourceType === 'commentary-critical')!.approved).toBe(2);
        expect(c.rows[0]!.sourceType).toBe('journal-article');
    });

    it('el aviso de tipo faltante compara contra el mínimo, no contra «hay uno»', () => {
        const w = bibliographyWarnings(fichas, [{ sourceType: 'commentary-critical', minimum: 2 }], () => null, []);
        expect(w).toContainEqual({ kind: 'missing-type', sourceType: 'commentary-critical', minimum: 2 });
    });

    it('la clasificación que usaste en tus trabajos, por trabajo y de más a menos', () => {
        const papers = [
            { sources: [{ sourceLibraryResourceId: 'n', sourceType: 'commentary-expository' as const }, { sourceLibraryResourceId: 'n', sourceType: 'commentary-expository' as const }] },
            { sources: [{ sourceLibraryResourceId: 'n', sourceType: 'commentary-expository' as const }] },
            { sources: [{ corpusId: 'n', sourceType: 'commentary-critical' as const }] },
            { sources: [{ sourceLibraryResourceId: 'otro', sourceType: 'grammar-syntax' as const }] },
        ];
        expect(classificationHistory(papers, 'n')).toEqual([['commentary-expository', 2], ['commentary-critical', 1]]);
    });
});
