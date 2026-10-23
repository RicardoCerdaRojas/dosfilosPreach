import { describe, it, expect } from 'vitest';
import {
    extractedBibliographyCandidates,
    catalogCandidates,
    libraryCandidates,
    projectBibleBooks,
    studiesCandidates,
    syllabusCandidates,
    syllabusOfProject,
} from '../bibliographyCandidates';
import { mergeBibliographyCandidates } from '../projectBibliography';

/** Etapa 2, paso 2: de dónde salen las candidatas del estado del arte. */
const biblioteca = [
    { id: 'ropes', title: 'A Critical and Exegetical Commentary on the Epistle of St. James', author: 'James Hardy Ropes', exegeticalType: 'commentary-critical' as const, coversBibleBooks: ['JAS'] as never },
    { id: 'wallace', title: 'Greek Grammar Beyond the Basics', author: 'Daniel B. Wallace', exegeticalType: 'grammar-syntax' as const, coversBibleBooks: [] as never },
    { id: 'romanos', title: 'Romans', author: 'Moo', exegeticalType: 'commentary-critical' as const, coversBibleBooks: ['ROM'] as never },
    { id: 'plantilla', title: 'Paper de ejemplo', exegeticalType: 'style-template-paper' as const, coversBibleBooks: ['JAS'] as never },
    { id: 'lexrom', title: 'Léxico de Romanos', exegeticalType: 'lexicon-technical' as const, coversBibleBooks: ['ROM'] as never },
];

describe('candidatas del estado del arte', () => {
    it('los libros bíblicos: los elegidos, o los de los estudios', () => {
        expect(projectBibleBooks({ bibleBooks: ['JAS'] }, [{ passage: { bookId: 'ROM' } }])).toEqual(['JAS']);
        expect(projectBibleBooks(null, [{ passage: { bookId: 'JAS' } }, { passage: { bookId: 'JAS' } }])).toEqual(['JAS']);
    });

    it('el sílabo sale de las rúbricas de los tipos de trabajo, sin repetir, y encuentra el libro', () => {
        const syllabus = syllabusOfProject([{ rubricTemplateId: 'r-tp' }, { rubricTemplateId: 'r-paper' }, {}], [
            { id: 'r-tp', rubric: { courseBibliography: [{ title: 'Greek Grammar Beyond the Basics', author: 'Wallace', requirement: 'required' }] } },
            { id: 'r-paper', rubric: { courseBibliography: [{ title: 'Greek Grammar Beyond the Basics', author: 'Wallace', requirement: 'required' }, { title: 'James', author: 'McKnight', requirement: 'recommended', note: 'NICNT' }] } },
            { id: 'otra', rubric: { courseBibliography: [{ title: 'No es del proyecto', requirement: 'required' }] } },
        ]);
        expect(syllabus.map(e => e.title)).toEqual(['Greek Grammar Beyond the Basics', 'James']);
        const c = syllabusCandidates(syllabus, biblioteca as never);
        expect(c[0]).toMatchObject({ resourceId: 'wallace', weight: 'required', origin: 'syllabus' });
        expect(c[1]).toMatchObject({ resourceId: null, weight: 'recommended', note: 'NICNT' });
    });

    it('la biblioteca aporta lo que comenta el libro y las obras de referencia; no otros libros ni plantillas', () => {
        expect(libraryCandidates(['JAS'], biblioteca as never).map(c => c.resourceId)).toEqual(['ropes', 'wallace']);
    });

    it('el catálogo curado da candidatas con su tipo, y lo esencial no pasa a obligatorio', () => {
        const c = catalogCandidates(['JAS'], biblioteca as never, 'es');
        expect(c.length).toBeGreaterThan(0);
        expect(c.every(x => x.origin === 'catalog' && x.sourceType && x.weight !== 'required')).toBe(true);
    });

    it('los estudios cuentan por estudio y avisan cuando clasificaron distinto el mismo libro', () => {
        const fuente = (id: string, sourceType: string) => ({ sourceLibraryResourceId: id, corpusId: id, sourceType, displayLabel: id === 'nicnt' ? 'NICNT James' : id, citationKey: null }) as never;
        const c = studiesCandidates([
            { sources: [fuente('nicnt', 'commentary-critical'), fuente('nicnt', 'commentary-critical'), fuente('na28', 'critical-apparatus')] },
            { sources: [fuente('nicnt', 'commentary-expository')] },
            { sources: [fuente('nicnt', 'commentary-critical'), fuente('bdag', 'lexicon-technical'), fuente('bdag', 'lexicon-technical')] },
        ]);
        // Repetido dentro de un mismo estudio cuenta una vez.
        expect(c.find(x => x.resourceId === 'bdag')).toMatchObject({ weight: 'complementary' });
        const nicnt = c.find(x => x.resourceId === 'nicnt')!;
        expect(nicnt).toMatchObject({ weight: 'recommended', sourceType: 'commentary-critical', title: 'NICNT James' });
        expect(nicnt.note).toContain('commentary-expository (1)');
        // La pantalla escribe la nota en su idioma.
        const enIngles = studiesCandidates([{ sources: [fuente('nicnt', 'commentary-critical')] }, { sources: [fuente('nicnt', 'commentary-expository')] }], ts => `classified as ${ts.length} types`);
        expect(enIngles[0]!.note).toBe('classified as 2 types');
        expect(c.find(x => x.resourceId === 'na28')).toMatchObject({ weight: 'complementary', note: null });
    });

    it('el mismo libro desde la biblioteca y desde los estudios queda en una sola ficha con los dos orígenes', () => {
        let n = 0;
        const fichas = mergeBibliographyCandidates([], [
            ...libraryCandidates(['JAS'], biblioteca as never),
            ...studiesCandidates([{ sources: [{ sourceLibraryResourceId: 'ropes', corpusId: 'ropes', sourceType: 'commentary-critical', displayLabel: 'ICC James', citationKey: null }] }]),
        ], () => `f${++n}`);
        expect(fichas.find(f => f.resourceId === 'ropes')!.origins).toEqual(['library', 'studies']);
    });
});

describe('lo leído de un sílabo como candidatas (NT785)', () => {
    it('obligatoria o recomendada según el sílabo, emparejada con la biblioteca, con la clasificación del libro primero', () => {
        const c = extractedBibliographyCandidates([
            { title: 'Greek Grammar Beyond the Basics', author: 'Wallace, Daniel B.', requirement: 'recommended', sourceType: 'commentary-critical', year: 1996 },
            { title: 'Comentario de la epístola de Santiago', author: 'Moo, Douglas J.', series: 'Biblioteca teológica Vida 2', publisher: 'Vida', year: 2009, requirement: 'required', sourceType: 'commentary-expository', note: 'Lectura semanal' },
        ], biblioteca as never);
        expect(c[0]).toMatchObject({ resourceId: 'wallace', sourceType: 'grammar-syntax', weight: 'recommended', origin: 'syllabus', year: 1996 });
        expect(c[1]).toMatchObject({ resourceId: null, sourceType: 'commentary-expository', weight: 'required', publisher: 'Vida', note: 'Lectura semanal' });
    });

    it('importar dos veces la misma lista no duplica fichas', () => {
        const leido = [{ title: 'Comentario de la epístola de Santiago', author: 'Moo, Douglas J.', requirement: 'required' as const }];
        let n = 0;
        const una = mergeBibliographyCandidates([], extractedBibliographyCandidates(leido, []), () => `f${++n}`);
        const dos = mergeBibliographyCandidates(una, extractedBibliographyCandidates(leido, []), () => `f${++n}`);
        expect(dos).toHaveLength(1);
    });
});
