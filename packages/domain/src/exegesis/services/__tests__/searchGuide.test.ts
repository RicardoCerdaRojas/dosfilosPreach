import { describe, it, expect } from 'vitest';
import { bookSearchName, passageForms, searchGuide, type SearchGuideInput } from '../searchGuide';
import { cleanSearchLog, type ProjectRequirement } from '../projectBibliography';

/** Etapa 2c: la guía de qué buscar y dónde, con reglas fijas a partir del proyecto. */
const p = (bookId: 'JAS' | 'NEH', chapterStart: number, verseStart: number | null, chapterEnd = chapterStart, verseEnd: number | null = verseStart) =>
    ({ bookId, chapterStart, verseStart, chapterEnd, verseEnd });
const req = (over: Partial<ProjectRequirement>): ProjectRequirement => ({ id: 'r', kind: 'other', text: 'x', origin: 'syllabus', ...over });
const base = (over: Partial<SearchGuideInput>): SearchGuideInput => ({
    passages: [], bibleBooks: [], unmetTypes: new Set(), unmetRequirements: [], presentApproaches: new Set(), projectType: 'course', language: 'es', ...over,
});

describe('las formas del pasaje', () => {
    it('la abreviatura del SBL, el nombre en inglés y, en español, el nombre en español', () => {
        // En español también con coma, como se cita en la literatura en español.
        expect(passageForms(p('JAS', 4, 1, 4, 10), 'es')).toEqual(['Jas 4:1-10', 'James 4:1-10', 'Santiago 4:1-10', 'Santiago 4,1-10']);
        expect(passageForms(p('JAS', 4, 5), 'en')).toEqual(['Jas 4:5', 'James 4:5']);
        expect(passageForms(p('NEH', 1, null, 2, null), 'es')).toEqual(['Neh 1-2', 'Nehemiah 1-2', 'Nehemías 1-2']);
        expect(passageForms(p('JAS', 4, 13, 5, 6), 'en')).toEqual(['Jas 4:13-5:6', 'James 4:13-5:6']);
    });
});

describe('la guía de búsqueda', () => {
    it('sin libros no hay guía; con un pasaje siempre está IxTheo con su búsqueda por pasaje, y Google Académico con las formas', () => {
        expect(searchGuide(base({}))).toEqual([]);
        const [paso] = searchGuide(base({ passages: [p('JAS', 4, 1, 4, 10)] }));
        expect(paso!.kind).toBe('passage');
        const ix = paso!.queries.find(q => q.database === 'ixtheo')!;
        expect(ix.query).toBe('James 4:1-10');
        expect(ix.url).toBe('https://ixtheo.de/Search/Results?lookfor=James%204%3A1-10&type=BibleRangeSearch');
        const gs = paso!.queries.find(q => q.database === 'google-scholar')!;
        expect(gs.query).toBe('"Jas 4:1-10" OR "James 4:1-10" OR "Santiago 4:1-10" OR "Santiago 4,1-10"');
        expect(gs.url).toBe(`https://scholar.google.com/scholar?q=${encodeURIComponent(gs.query)}`);
    });

    it('un libro ambiguo se busca con su género literario: «Santiago» solo trae Santiago de Compostela (medido en Dialnet)', () => {
        expect(bookSearchName('JAS', 'es')).toBe('epístola de Santiago');
        expect(bookSearchName('JAS', 'en')).toBe('"Epistle of James" OR "Letter of James"');
        expect(bookSearchName('RUT', 'en')).toBe('"Book of Ruth"');
        expect(bookSearchName('NEH', 'en')).toBe('"Nehemiah"');
        expect(bookSearchName('NEH', 'es')).toBe('Nehemías');
    });

    it('lo que aparece depende de lo que falta, y cada paso dice por qué (NT785)', () => {
        const pasos = searchGuide(base({
            passages: [p('JAS', 4, 1, 4, 10), p('JAS', 3, 13, 3, 18), p('JAS', 4, 1, 4, 10)],
            unmetTypes: new Set(['journal-article', 'commentary-critical']),
            unmetRequirements: [
                req({ id: 'pag', kind: 'quantity', sourceType: 'journal-article', unit: 'pages', minimum: 100, text: '100 páginas de artículos' }),
                req({ id: 'ep', kind: 'date-range', before: 1950, after: 2011, text: 'Antiguas y actuales' }),
                req({ id: 'op', kind: 'perspectives', minimum: 2, text: 'Puntos de vista opuestos' }),
            ],
            presentApproaches: new Set(['historical-critical']),
        }));
        expect(pasos.map(x => x.kind)).toEqual(['passage', 'articles', 'spanish', 'older', 'books', 'perspectives']);
        // El mismo pasaje dos veces (dos estudios) no repite consultas.
        expect(pasos[0]!.queries.filter(q => q.database === 'ixtheo')).toHaveLength(2);
        expect(pasos[1]!.reasons).toEqual([{ kind: 'type', sourceType: 'journal-article' }, { kind: 'requirement', requirementId: 'pag', text: '100 páginas de artículos' }]);
        expect(pasos[1]!.queries.every(q => q.database === 'atla' && q.url === null)).toBe(true);
        expect(pasos[3]).toMatchObject({ before: 1950, reasons: [{ kind: 'requirement', requirementId: 'ep' }] });
        expect(pasos[3]!.queries.map(q => q.database)).toEqual(['internet-archive', 'hathitrust']);
        // Un léxico que falta no abre el paso de comentarios: los léxicos están en el catálogo.
        expect(searchGuide(base({ bibleBooks: ['JAS'], unmetTypes: new Set(['lexicon-technical']) })).map(x => x.kind)).not.toContain('books');
        // El enfoque que ya está no se busca otra vez.
        const enfoques = pasos[5]!.queries.map(q => q.approach);
        expect(enfoques).toEqual(['socio-rhetorical', 'discourse-linguistic', 'literary-narrative']);
        expect(pasos[5]!.queries[0]!.query).toBe('("Epistle of James" OR "Letter of James") AND (rhetoric OR rhetorical OR "social-scientific")');
        // Lo antiguo dice hasta qué año es de dominio público.
        expect(searchGuide(base({ bibleBooks: ['JAS'], unmetRequirements: [req({ id: 'ep', kind: 'date-range', before: 1950 })], year: 2026 })).find(x => x.kind === 'older')!.publicDomainBefore).toBe(1931);
    });

    it('un pasaje sin capítulo vale como su libro', () => {
        const [paso] = searchGuide(base({ passages: [{ bookId: 'JAS' } as never] }));
        expect(paso!.queries).toEqual([expect.objectContaining({ database: 'ixtheo', query: '"Epistle of James" OR "Letter of James"' })]);
    });

    it('una investigación (tipo study) sin sílabo pide artículos y tesis; en inglés no hay paso en español', () => {
        expect(searchGuide(base({ bibleBooks: ['NEH'], projectType: 'course', language: 'en' })).map(x => x.kind)).toEqual(['passage']);
        const pasos = searchGuide(base({ bibleBooks: ['NEH'], projectType: 'study', language: 'en' }));
        expect(pasos.map(x => x.kind)).toEqual(['passage', 'articles', 'theses']);
        expect(pasos[0]!.queries).toEqual([expect.objectContaining({ database: 'ixtheo', query: '"Nehemiah"' })]);
        expect(pasos[2]!.queries.map(q => q.database)).toEqual(['oatd', 'proquest']);
    });

    it('en español, Dialnet, la BNE y Google Libros con el nombre del libro; las tesis también en Dialnet', () => {
        const pasos = searchGuide(base({ bibleBooks: ['NEH', 'JAS'], projectType: 'study' }));
        const es = pasos.find(x => x.kind === 'spanish')!;
        expect(es.queries.map(q => [q.database, q.query])).toEqual([
            ['dialnet', 'Nehemías'], ['bne', 'Nehemías comentario'], ['google-books', 'Nehemías comentario'],
            ['dialnet', 'epístola de Santiago'], ['bne', 'epístola de Santiago comentario'], ['google-books', 'epístola de Santiago comentario'],
        ]);
        expect(es.queries[0]!.url).toBe('https://dialnet.unirioja.es/buscar/documentos?querysDismax.DOCUMENTAL_TODO=Nehem%C3%ADas');
        expect(pasos.find(x => x.kind === 'theses')!.queries.map(q => q.database)).toContain('dialnet-theses');
    });
});

it('una búsqueda anotada se guarda acotada: enteros no negativos y textos cortos', () => {
    const [l] = cleanSearchLog([{ id: 'a', at: '2026-10-23T00:00:00Z', kind: 'database', label: 'IxTheo', found: -3 as number, added: 2.7, database: 'ixtheo', query: 'x'.repeat(2000) }]);
    expect(l).toMatchObject({ found: 0, added: 2, database: 'ixtheo' });
    expect(l!.query).toHaveLength(1000);
});
