import { describe, it, expect } from 'vitest';
import {
    bookIdOfUnit,
    inheritableProjectEntries,
    isEmptySermonPlaceholder,
    nextScheduledDate,
    overlappingProjectStudies,
    plannerBookForProject,
    projectSeriesOf,
    projectSermonsOf,
    projectSourcesForBook,
    resolveSermonProjectId,
    seriesBookId,
    seriesPaperInheritance,
    seriesPericopeRows,
    seriesProgress,
    type ProjectSourceResource,
    type SerieLike,
} from '../projectSeriesLink';
import { paperDefaultsFromSeries } from '../seriesPaperDefaults';
import type { ProjectBibliographyEntry } from '../projectBibliography';
import type { SeriesExegesisDefaults } from '../../../entities/SermonSeries';
import type { PassageReference } from '../../../bible/canon/passage-reference';

/** Etapa 3 de ADR-046: el proyecto planifica y muestra su serie. */
const ficha = (over: Partial<ProjectBibliographyEntry> = {}): ProjectBibliographyEntry => ({
    id: 'f1', title: '', author: null, weight: 'recommended', decision: 'approved', origins: ['manual'], ...over,
});

const biblioteca: Record<string, ProjectSourceResource> = {
    williamson: { title: 'Ezra, Nehemiah', author: 'H. G. M. Williamson', exegeticalType: 'commentary-critical', coversBibleBooks: ['EZR', 'NEH'] },
    moo: { title: 'The Epistle to the Romans', author: 'Douglas J. Moo', exegeticalType: 'commentary-critical', coversBibleBooks: ['ROM'] },
    halot: { title: 'HALOT', author: 'Koehler y Baumgartner', exegeticalType: 'lexicon-technical', scope: 'whole-bible' },
};
const resourceOf = (id: string) => biblioteca[id];

const proyectoNehemias = {
    bibliography: [
        ficha({ id: 'neh', title: 'Ezra, Nehemiah (WBC)', resourceId: 'williamson', sourceType: 'commentary-critical' }),
        ficha({ id: 'rom', title: 'Romans', resourceId: 'moo', sourceType: 'commentary-critical' }),
        ficha({ id: 'lex', title: 'HALOT', resourceId: 'halot', sourceType: 'lexicon-technical' }),
        ficha({ id: 'falta', title: 'Nehemiah (NICOT)', resourceId: null, sourceType: 'commentary-critical' }),
    ],
};

/** Que ningún valor sea undefined, en ningún nivel: Firestore lo rechaza. */
const sinUndefined = (v: unknown): boolean => {
    if (v === undefined) return false;
    if (Array.isArray(v)) return v.every(sinUndefined);
    if (v && typeof v === 'object' && !(v instanceof Date)) return Object.values(v).every(sinUndefined);
    return true;
};

describe('la bibliografía que hereda un estudio del proyecto', () => {
    it('da el comentario de Nehemías y el léxico, no el de Romanos ni la ficha por conseguir', () => {
        const fuentes = projectSourcesForBook(proyectoNehemias, 'NEH', resourceOf);
        expect(fuentes.map(f => f.sourceLibraryResourceId)).toEqual(['williamson', 'halot']);
        expect(fuentes[0]).toMatchObject({ corpusId: 'williamson', sourceType: 'commentary-critical', displayLabel: 'Ezra, Nehemiah (WBC)', mode: 'full-document' });
    });

    it('un proyecto de antes, con solo sourceIds, da fuentes con título y tipo de la biblioteca', () => {
        const fuentes = projectSourcesForBook({ sourceIds: ['halot', 'williamson'] }, 'NEH', resourceOf);
        expect(fuentes).toEqual([
            { corpusId: 'halot', sourceLibraryResourceId: 'halot', sourceType: 'lexicon-technical', displayLabel: 'HALOT', mode: 'full-document' },
            { corpusId: 'williamson', sourceLibraryResourceId: 'williamson', sourceType: 'commentary-critical', displayLabel: 'Ezra, Nehemiah', mode: 'full-document' },
        ]);
    });

    it('un comentario de Romanos de un proyecto viejo tampoco entra: el tipo viene de la biblioteca', () => {
        expect(projectSourcesForBook({ sourceIds: ['moo'] }, 'NEH', resourceOf)).toEqual([]);
    });

    it('las obras desmarcadas no entran', () => {
        const fuentes = projectSourcesForBook(proyectoNehemias, 'NEH', resourceOf, ['williamson']);
        expect(fuentes.map(f => f.corpusId)).toEqual(['halot']);
    });

    it('sin proyecto o sin libro no hereda nada', () => {
        expect(inheritableProjectEntries(null, 'NEH', resourceOf)).toEqual([]);
        expect(inheritableProjectEntries(proyectoNehemias, null, resourceOf)).toEqual([]);
        expect(projectSourcesForBook(proyectoNehemias, null, resourceOf)).toEqual([]);
    });

    it('las fichas heredables conservan el orden del estado del arte', () => {
        expect(inheritableProjectEntries(proyectoNehemias, 'NEH', resourceOf).map(e => e.id)).toEqual(['neh', 'lex']);
    });

    it('las fichas de un proyecto viejo traen título, autor y tipo de la biblioteca', () => {
        expect(inheritableProjectEntries({ sourceIds: ['williamson'] }, 'NEH', resourceOf)[0]).toMatchObject({
            title: 'Ezra, Nehemiah', author: 'H. G. M. Williamson', sourceType: 'commentary-critical',
        });
    });
});

describe('lo que toma un estudio de la serie al nacer', () => {
    const defaults: SeriesExegesisDefaults = {
        styleGuideId: 'guia',
        sourceRefs: [
            { libraryResourceId: 'williamson', corpusId: 'williamson', displayLabel: 'Williamson', sourceType: 'commentary-pastoral', mode: 'full-document' },
            { libraryResourceId: 'bhs', corpusId: 'bhs', displayLabel: 'BHS', sourceType: 'biblical-text-edition', mode: 'full-document' },
        ],
    };
    const delProyecto = projectSourcesForBook(proyectoNehemias, 'NEH', resourceOf);

    it('sin proyecto es exactamente lo de la serie', () => {
        expect(seriesPaperInheritance({ exegesisDefaults: defaults })).toEqual(paperDefaultsFromSeries(defaults));
        expect(seriesPaperInheritance({ exegesisDefaults: undefined, projectId: null, projectSources: [] })).toEqual(paperDefaultsFromSeries(undefined));
        expect(seriesPaperInheritance({ exegesisDefaults: defaults, projectId: '', projectSources: null })).toEqual(paperDefaultsFromSeries(defaults));
    });

    it('una obra repetida en la serie: gana la del proyecto y va primero', () => {
        const out = seriesPaperInheritance({ exegesisDefaults: defaults, projectId: 'neh', projectSources: delProyecto });
        expect(out.initialSources!.map(s => s.corpusId)).toEqual(['williamson', 'halot', 'bhs']);
        expect(out.initialSources![0]!.sourceType).toBe('commentary-critical');
        expect(out.projectId).toBe('neh');
        expect(out.styleGuideId).toBe('guia');
    });

    it('nunca agrega una rúbrica que la serie no tenga: el caso de uso pone la de predicación', () => {
        const out = seriesPaperInheritance({ exegesisDefaults: defaults, projectId: 'neh', projectSources: delProyecto });
        expect('rubricTemplateId' in out).toBe(false);
        expect('projectWorkTypeId' in out).toBe(false);
        const conRubrica = seriesPaperInheritance({ exegesisDefaults: { ...defaults, rubricTemplateId: 'r1' }, projectId: 'neh', projectSources: delProyecto });
        expect(conRubrica.rubricTemplateId).toBe('r1');
    });

    it('ningún undefined, y sin fuentes no hay initialSources', () => {
        const out = seriesPaperInheritance({ exegesisDefaults: undefined, projectId: 'neh', projectSources: [] });
        expect(out).toEqual({ styleGuideId: null, projectId: 'neh' });
        // Un projectId vacío no se escribe, aunque haya fuentes.
        expect('projectId' in seriesPaperInheritance({ exegesisDefaults: undefined, projectId: '  ', projectSources: delProyecto })).toBe(false);
        expect(sinUndefined(out)).toBe(true);
        expect(sinUndefined(seriesPaperInheritance({ exegesisDefaults: defaults, projectId: 'neh', projectSources: delProyecto }))).toBe(true);
    });
});

describe('el proyecto de un sermón', () => {
    const origen: Record<string, string | null> = { pNeh: 'neh', pSuelto: null };
    const paperOriginOf = (id: string) => origen[id];
    const seriesProjectOf = (id: string) => (id === 'serieNeh' ? 'neh' : null);

    it('el proyecto explícito gana sobre el del estudio', () => {
        expect(resolveSermonProjectId({ projectId: 'material-previo', sourcePaperId: 'pNeh' }, paperOriginOf, seriesProjectOf)).toBe('material-previo');
    });

    it('sin explícito, el de origen del estudio; sin estudio, el de la serie', () => {
        expect(resolveSermonProjectId({ sourcePaperId: 'pNeh' }, paperOriginOf, seriesProjectOf)).toBe('neh');
        expect(resolveSermonProjectId({ projectId: null, seriesId: 'serieNeh' }, paperOriginOf, seriesProjectOf)).toBe('neh');
        // Un estudio sin proyecto de origen deja pasar a la serie.
        expect(resolveSermonProjectId({ sourcePaperId: 'pSuelto', seriesId: 'serieNeh' }, paperOriginOf, seriesProjectOf)).toBe('neh');
    });

    it('un sermón de Jonás, sin nada, no es de ningún proyecto', () => {
        expect(resolveSermonProjectId({ seriesId: 'serieJonas', sourcePaperId: 'pJonas' }, paperOriginOf, seriesProjectOf)).toBeNull();
    });
});

describe('los sermones del proyecto', () => {
    const paperOriginOf = (id: string) => (id === 'pNeh' ? 'neh' : null);
    const seriesProjectOf = (id: string) => (id === 'serieNeh' ? 'neh' : null);
    const sermones = [
        { id: 'viejo', seriesId: 'serieNeh', status: 'draft', updatedAt: '2026-10-01T00:00:00Z' },
        { id: 'borrador', sourcePaperId: 'pNeh', status: 'draft', updatedAt: new Date('2026-10-10T00:00:00Z') },
        { id: 'copia', sourcePaperId: 'pNeh', sourceSermonId: 'borrador', status: 'published', updatedAt: new Date('2026-10-05T00:00:00Z') },
        { id: 'suelto', status: 'draft', updatedAt: new Date('2026-10-20T00:00:00Z') },
        { id: 'otro', projectId: 'material-previo', sourcePaperId: 'pNeh', status: 'draft', updatedAt: new Date('2026-10-21T00:00:00Z') },
    ];

    it('un borrador y su copia publicada: dos en all, uno (la copia) en chains', () => {
        const { all, chains } = projectSermonsOf(sermones, 'neh', paperOriginOf, seriesProjectOf);
        expect(all.map(s => s.id)).toEqual(['borrador', 'copia', 'viejo']);
        expect(chains.map(s => s.id)).toEqual(['copia', 'viejo']);
    });

    it('sin publicada, la cadena toma la versión más reciente', () => {
        const { chains } = projectSermonsOf([
            { id: 'a', seriesId: 'serieNeh', status: 'draft', updatedAt: '2026-10-01T00:00:00Z' },
            { id: 'b', seriesId: 'serieNeh', sourceSermonId: 'a', status: 'draft', updatedAt: '2026-10-09T00:00:00Z' },
        ], 'neh', paperOriginOf, seriesProjectOf);
        expect(chains.map(s => s.id)).toEqual(['b']);
    });

    it('el marcador vacío que crea la serie no entra por ella: ni en all ni en chains', () => {
        // Lo que escribe autoCreateSermonPlaceholders, tal como llega en el resumen.
        const marcador = { id: 'm', seriesId: 'serieNeh', status: 'draft', content: '', hasContent: false, wizardProgress: { currentStep: 0 }, updatedAt: '2026-10-22T00:00:00Z' };
        const avanzado = { ...marcador, id: 'avanzado', wizardProgress: { currentStep: 2 } };
        const conCuerpo = { ...marcador, id: 'cuerpo', hasContent: true };
        const { all, chains } = projectSermonsOf([marcador, avanzado, conCuerpo], 'neh', paperOriginOf, seriesProjectOf);
        expect(all.map(s => s.id).sort()).toEqual(['avanzado', 'cuerpo']);
        expect(chains.map(s => s.id)).not.toContain('m');
    });

    it('un sermón en el paso 0 con proyecto explícito o estudio de origen se queda', () => {
        const vacio = { status: 'draft', content: '', hasContent: false, wizardProgress: { currentStep: 0 }, updatedAt: '2026-10-22T00:00:00Z' };
        const { all } = projectSermonsOf([
            { ...vacio, id: 'explicito', projectId: 'neh', seriesId: 'serieNeh' },
            { ...vacio, id: 'delEstudio', sourcePaperId: 'pNeh', seriesId: 'serieNeh' },
        ], 'neh', paperOriginOf, seriesProjectOf);
        expect(all.map(s => s.id).sort()).toEqual(['delEstudio', 'explicito']);
    });
});

describe('el marcador vacío de la serie', () => {
    const marcador = { status: 'draft', content: '', hasContent: false, wizardProgress: { currentStep: 0 } };

    it('es borrador del asistente en el paso 0 y sin cuerpo', () => {
        expect(isEmptySermonPlaceholder(marcador)).toBe(true);
        // Sin paso guardado cuenta como el paso 0.
        expect(isEmptySermonPlaceholder({ ...marcador, wizardProgress: {} })).toBe(true);
    });

    it('cualquier avance lo vuelve sermón', () => {
        expect(isEmptySermonPlaceholder({ ...marcador, wizardProgress: { currentStep: 1 } })).toBe(false);
        expect(isEmptySermonPlaceholder({ ...marcador, hasContent: true })).toBe(false);
        // El sermón completo trae el cuerpo y no `hasContent`.
        expect(isEmptySermonPlaceholder({ status: 'draft', content: 'Introducción', wizardProgress: { currentStep: 0 } })).toBe(false);
        expect(isEmptySermonPlaceholder({ ...marcador, status: 'published' })).toBe(false);
        expect(isEmptySermonPlaceholder({ ...marcador, sourceSermonId: 'd1' })).toBe(false);
        // Sin asistente no es un marcador: es un sermón escrito a mano.
        expect(isEmptySermonPlaceholder({ status: 'draft', content: '' })).toBe(false);
    });
});

describe('las series del proyecto', () => {
    it('filtra por proyecto y ordena de la más nueva a la más vieja', () => {
        const series: SerieLike[] = [
            { id: 'jonas', createdAt: new Date('2026-09-01') },
            { id: 'neh1', projectId: 'neh', createdAt: '2026-10-01T00:00:00Z' },
            { id: 'neh2', projectId: 'neh', createdAt: new Date('2026-10-20') },
            { id: 'otra', projectId: 'otro', createdAt: new Date('2026-10-22') },
        ];
        expect(projectSeriesOf(series, 'neh').map(s => s.id)).toEqual(['neh2', 'neh1']);
        expect(projectSeriesOf(series, '')).toEqual([]);
    });
});

describe('las filas de la serie en el proyecto', () => {
    const serie: SerieLike = {
        id: 's', createdAt: new Date(),
        metadata: {
            plannedSermons: [
                { id: 'p1', week: 1, title: 'La oración de Nehemías', passage: 'Neh 1:1-11', scheduledDate: new Date('2026-11-01T12:00:00'), paperId: 'e1', draftId: 'd1' },
                { id: 'p2', week: 2, title: 'El permiso del rey', passage: 'Neh 2:1-10', paperId: 'e2', draftId: 'd2' },
                { id: 'p3', week: 3, title: 'El muro', passage: 'Neh 3', scheduledDate: '2026-10-01T12:00:00' },
            ],
        },
    };
    const estudios: Record<string, { id: string; title: string; phase: string }> = {
        e1: { id: 'e1', title: 'Neh 1', phase: 'in-progress' },
        e2: { id: 'e2', title: 'Neh 2', phase: 'configuring' },
    };
    const sermones = [
        { id: 'd1', status: 'draft', updatedAt: new Date() },
        { id: 'c1', sourceSermonId: 'd1', status: 'published', updatedAt: new Date() },
        { id: 'd2', status: 'draft', updatedAt: new Date() },
    ];
    const filas = seriesPericopeRows(serie, id => estudios[id], sermones);

    it('conserva el orden del plan y cruza el estudio por paperId', () => {
        expect(filas.map(f => f.pericopeId)).toEqual(['p1', 'p2', 'p3']);
        expect(filas[0]).toMatchObject({ week: 1, title: 'La oración de Nehemías', passage: 'Neh 1:1-11', paper: estudios.e1, sermonId: 'd1' });
        expect(filas[2]!.paper).toBeNull();
        expect(filas[2]!.sermonId).toBeNull();
    });

    it('un borrador con copia publicada es «publicado»; uno sin ella, «borrador»; sin borrador, ninguno', () => {
        expect(filas.map(f => f.sermonState)).toEqual(['published', 'draft', 'none']);
        // El borrador mismo publicado también cuenta.
        expect(seriesPericopeRows(serie, id => estudios[id], [{ id: 'd2', status: 'published', updatedAt: new Date() }])[1]!.sermonState).toBe('published');
    });

    it('avance y próxima fecha', () => {
        expect(seriesProgress(filas)).toEqual({ total: 3, withStudy: 2, withSermon: 2 });
        // Estudio y sermón se cuentan por separado.
        expect(seriesProgress([
            { paper: { id: 'e' }, sermonState: 'none' },
            { paper: null, sermonState: 'draft' },
            { paper: null, sermonState: 'published' },
        ])).toEqual({ total: 3, withStudy: 1, withSermon: 2 });
        expect(nextScheduledDate(filas, new Date('2026-10-24T09:00:00'))).toEqual(new Date('2026-11-01T12:00:00'));
        // El domingo de hoy sigue siendo la próxima fecha durante el día.
        expect(nextScheduledDate(filas, new Date('2026-11-01T18:00:00'))).toEqual(new Date('2026-11-01T12:00:00'));
        expect(nextScheduledDate(filas, new Date('2026-12-01T00:00:00'))).toBeNull();
    });

    it('el marcador vacío de la perícopa es «sin sermón» y no suma al avance', () => {
        const conMarcador = seriesPericopeRows(serie, id => estudios[id], [
            ...sermones.filter(s => s.id !== 'd2'),
            { id: 'd2', status: 'draft', content: '', hasContent: false, wizardProgress: { currentStep: 0 }, updatedAt: new Date() },
        ]);
        expect(conMarcador.map(f => f.sermonState)).toEqual(['published', 'none', 'none']);
        // Conserva el id: la fila lo abre para empezar el sermón.
        expect(conMarcador[1]!.sermonId).toBe('d2');
        expect(seriesProgress(conMarcador)).toEqual({ total: 3, withStudy: 2, withSermon: 1 });
        // Con un paso hecho ya es un borrador.
        expect(seriesPericopeRows(serie, id => estudios[id], [
            { id: 'd2', status: 'draft', hasContent: false, wizardProgress: { currentStep: 1 }, updatedAt: new Date() },
        ])[1]!.sermonState).toBe('draft');
    });

    it('una serie sin plan no tiene filas', () => {
        expect(seriesPericopeRows({ id: 'x', createdAt: new Date() }, () => undefined, [])).toEqual([]);
    });
});

describe('el libro con que se planifica', () => {
    const estudioDe = (bookId: PassageReference['bookId']) => ({ passage: { bookId } });

    it('solo si el proyecto tiene exactamente un libro', () => {
        expect(plannerBookForProject({ bibliographyCriteria: { bibleBooks: ['NEH'] } }, [])).toBe('NEH');
        expect(plannerBookForProject({ bibliographyCriteria: null }, [])).toBeNull();
        expect(plannerBookForProject({ bibliographyCriteria: { bibleBooks: ['EZR', 'NEH'] } }, [])).toBeNull();
        expect(plannerBookForProject({}, [estudioDe('NEH'), estudioDe('NEH')])).toBe('NEH');
        expect(plannerBookForProject(null, [estudioDe('NEH')])).toBeNull();
    });

    it('el libro de una unidad y de la serie', () => {
        expect(bookIdOfUnit({ book: 'Nehemías' })).toBe('NEH');
        expect(bookIdOfUnit({ book: 'Libro inexistente' })).toBeNull();
        expect(bookIdOfUnit(null)).toBeNull();
        expect(seriesBookId({
            id: 's', createdAt: new Date(),
            metadata: { plannedSermons: [{ id: 'a' }, { id: 'b', syntacticUnit: { book: 'Nehemías', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11 } }] },
        })).toBe('NEH');
        expect(seriesBookId({ id: 's', createdAt: new Date(), metadata: { expository: { book: 'Jonás' } } })).toBe('JON');
        expect(seriesBookId({ id: 's', createdAt: new Date() })).toBeNull();
    });
});

describe('estudios del proyecto que ya tratan una perícopa', () => {
    const neh1 = { id: 'p1', bookId: 'NEH' as const, chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11 };
    const estudio = (id: string, passage: Omit<PassageReference, 'bookId'> & { bookId?: PassageReference['bookId'] }, seriesId?: string | null) => ({
        id, title: id, passage: { bookId: 'NEH' as const, ...passage }, ...(seriesId !== undefined ? { seriesId } : {}),
    });

    it('Neh 1:1-11 se solapa con Neh 1:5-2:3, no con Neh 3 ni con un estudio de otra serie', () => {
        const out = overlappingProjectStudies([neh1], [
            estudio('cruza', { chapterStart: 1, verseStart: 5, chapterEnd: 2, verseEnd: 3 }),
            estudio('cap3', { chapterStart: 3, verseStart: null, chapterEnd: 3, verseEnd: null }),
            estudio('deSerie', { chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 4 }, 'otraSerie'),
            estudio('esdras', { bookId: 'EZR', chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11 }),
        ]);
        expect(out.get('p1')).toEqual([{ id: 'cruza', title: 'cruza' }]);
        expect(out.size).toBe(1);
    });

    it('un capítulo entero sin versículos cubre la perícopa; los bordes se tocan', () => {
        const out = overlappingProjectStudies([neh1, { ...neh1, id: 'p2', chapterStart: 2, verseStart: 1, chapterEnd: 2, verseEnd: 10 }], [
            estudio('cap1', { chapterStart: 1, verseStart: null, chapterEnd: 1, verseEnd: null }, null),
            estudio('borde', { chapterStart: 1, verseStart: 11, chapterEnd: 1, verseEnd: 20 }),
        ]);
        expect(out.get('p1')!.map(s => s.id)).toEqual(['cap1', 'borde']);
        expect(out.has('p2')).toBe(false);
    });
});
