import { describe, it, expect } from 'vitest';
import type { AddProjectSourceInput, BibleBookId, ExegeticalUnit, PreachableUnit } from '@dosfilos/domain';
import {
    activeProjectById,
    buildSeriesPlan,
    excludedFrom,
    framingPrefill,
    hasReadingToContrast,
    initialBookFor,
    isPassageRun,
    pericopesForOverlap,
    projectEntryState,
    seriesDescriptionFor,
    shouldRestoreDraft,
    sourceChapterCount,
    unitsVsSundays,
} from '../utils/serieDesdeProyecto';

/**
 * El planificador expositivo abierto desde un proyecto (etapa 3 de ADR-046).
 * Las reglas son puras: la página solo las cablea.
 */

const LIBROS: BibleBookId[] = ['2PE', 'EZR', 'NEH', 'ROM'];

describe('initialBookFor — con qué libro arranca el selector', () => {
    it('el libro de la URL, si existe, manda', () => {
        expect(initialBookFor({ bookParam: 'NEH', projectBooks: ['EZR'], allBookIds: LIBROS, hasProject: true }))
            .toEqual({ bookId: 'NEH', mustChoose: false });
    });

    it('un libro inválido en la URL con un proyecto de un libro abre en ese libro', () => {
        expect(initialBookFor({ bookParam: 'XYZ', projectBooks: ['NEH'], allBookIds: LIBROS, hasProject: true }))
            .toEqual({ bookId: 'NEH', mustChoose: false });
    });

    it('un proyecto sin libros obliga a elegir (no abre «en silencio» en 2 Pedro)', () => {
        expect(initialBookFor({ bookParam: null, projectBooks: [], allBookIds: LIBROS, hasProject: true }))
            .toEqual({ bookId: '2PE', mustChoose: true });
    });

    it('un proyecto con varios libros propone el primero y obliga a elegir', () => {
        expect(initialBookFor({ bookParam: null, projectBooks: ['EZR', 'NEH'], allBookIds: LIBROS, hasProject: true }))
            .toEqual({ bookId: 'EZR', mustChoose: true });
    });

    it('sin proyecto ni libro, 2 Pedro como siempre', () => {
        expect(initialBookFor({ bookParam: null, projectBooks: [], allBookIds: LIBROS, hasProject: false }))
            .toEqual({ bookId: '2PE', mustChoose: false });
    });

    it('sin proyecto, un libro inválido tampoco obliga a elegir', () => {
        expect(initialBookFor({ bookParam: 'XYZ', projectBooks: [], allBookIds: LIBROS, hasProject: false }))
            .toEqual({ bookId: '2PE', mustChoose: false });
    });
});

describe('shouldRestoreDraft — si el borrador es de esta entrada', () => {
    it('un borrador suelto de 2 Pedro no se restaura al entrar desde el proyecto Nehemías', () => {
        expect(shouldRestoreDraft({ bookId: '2PE' }, { projectId: 'neh', bookParam: 'NEH' })).toBe(false);
    });

    it('el borrador del proyecto con su libro sí', () => {
        expect(shouldRestoreDraft({ bookId: 'NEH', projectId: 'neh' }, { projectId: 'neh', bookParam: 'NEH' })).toBe(true);
    });

    it('el borrador de un proyecto no se restaura en la entrada genérica', () => {
        expect(shouldRestoreDraft({ bookId: 'NEH', projectId: 'neh' }, { projectId: null, bookParam: null })).toBe(false);
    });

    it('un borrador viejo, sin projectId, sigue restaurándose en la entrada genérica', () => {
        expect(shouldRestoreDraft({ bookId: '2PE' }, {})).toBe(true);
        expect(shouldRestoreDraft({ bookId: '2PE', projectId: null }, { projectId: null })).toBe(true);
    });

    it('con el proyecto y sin libro en la URL, el borrador del proyecto se restaura', () => {
        expect(shouldRestoreDraft({ bookId: 'NEH', projectId: 'neh' }, { projectId: 'neh' })).toBe(true);
    });

    it('un borrador del mismo proyecto pero de otro libro no, si la URL trae el libro', () => {
        expect(shouldRestoreDraft({ bookId: 'EZR', projectId: 'neh' }, { projectId: 'neh', bookParam: 'NEH' })).toBe(false);
    });

    it('el de otro proyecto tampoco', () => {
        expect(shouldRestoreDraft({ bookId: 'NEH', projectId: 'otro' }, { projectId: 'neh', bookParam: 'NEH' })).toBe(false);
    });
});

const fuente = (id: string, porCorpus = false): AddProjectSourceInput => ({
    corpusId: id,
    ...(porCorpus ? {} : { sourceLibraryResourceId: id }),
    sourceType: 'commentary-critical',
    displayLabel: id,
} as AddProjectSourceInput);

describe('excludedFrom — las obras desmarcadas', () => {
    it('devuelve las de la lista completa que no se eligieron', () => {
        expect(excludedFrom([fuente('williamson'), fuente('halot'), fuente('fensham')], [fuente('williamson')]))
            .toEqual(['halot', 'fensham']);
    });

    it('todas elegidas: nada excluido', () => {
        expect(excludedFrom([fuente('a'), fuente('b')], [fuente('b'), fuente('a')])).toEqual([]);
    });

    it('usa el corpus cuando la fuente no trae recurso de biblioteca, sin repetir', () => {
        expect(excludedFrom([fuente('viejo', true), fuente('viejo', true), fuente('a')], [fuente('a')])).toEqual(['viejo']);
    });
});

describe('activeProjectById y projectEntryState', () => {
    const proyectos = [
        { id: 'neh', title: 'Nehemías' },
        { id: 'arch', title: 'Archivado', archivedAt: new Date() },
        { id: 'papelera', title: 'Borrado', deletedAt: new Date() },
    ];

    it('solo devuelve el proyecto activo', () => {
        expect(activeProjectById(proyectos, 'neh')?.title).toBe('Nehemías');
        expect(activeProjectById(proyectos, 'arch')).toBeNull();
        expect(activeProjectById(proyectos, 'papelera')).toBeNull();
        expect(activeProjectById(proyectos, null)).toBeNull();
        expect(activeProjectById(undefined, 'neh')).toBeNull();
    });

    it('sin parámetro, none; cargando, loading; después ok o unavailable', () => {
        expect(projectEntryState({ projectIdParam: null, loading: true, project: null })).toBe('none');
        expect(projectEntryState({ projectIdParam: 'neh', loading: true, project: null })).toBe('loading');
        expect(projectEntryState({ projectIdParam: 'neh', loading: false, project: {} })).toBe('ok');
        expect(projectEntryState({ projectIdParam: 'arch', loading: false, project: null })).toBe('unavailable');
    });
});

const unidadExegetica = (id: string, book: string, justification?: string): ExegeticalUnit => ({
    id,
    macroSectionId: 'm1',
    syntacticUnit: {
        book,
        chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 3,
        originalLanguage: 'hebrew',
        ...(justification ? { justification } : {}),
    },
} as unknown as ExegeticalUnit);

const predicable = (id: string, sourced: string[], extra: Partial<PreachableUnit> = {}): PreachableUnit => ({
    id,
    title: `Título ${id}`,
    passage: `Nehemías 1:1-11`,
    chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11,
    sourcedExegeticalUnitIds: sourced,
    exegeticalProposition: 'Prop. exegética',
    homileticalProposition: 'Prop. homilética',
    pastoralObjective: 'Objetivo',
    order: 0,
    ...extra,
} as PreachableUnit);

describe('pericopesForOverlap', () => {
    it('toma el libro de la unidad sintáctica y, sin ella, el analizado', () => {
        const out = pericopesForOverlap(
            [predicable('p1', ['u1']), predicable('p2', ['falta'])],
            [unidadExegetica('u1', 'Nehemías')],
            'EZR',
        );
        expect(out.map((p) => [p.id, p.bookId])).toEqual([['p1', 'NEH'], ['p2', 'EZR']]);
        expect(out[0]).toMatchObject({ chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11, passage: 'Nehemías 1:1-11' });
    });
});

describe('buildSeriesPlan — el argumento de createSeriesFromPlan', () => {
    const base = () => ({
        title: '  Nehemías: reconstruir  ',
        description: 'Serie expositiva de Nehemías en 2 sermones',
        startDate: new Date(2026, 10, 1),
        frequency: 'weekly' as const,
        bookDisplay: 'Nehemías',
        preachableUnits: [
            predicable('p1', ['u1', 'u2'], { caseTreatment: 'long-prayer' }),
            predicable('p2', [], { passage: 'Nehemías 2:1-8', chapterStart: 2, verseStart: 1, chapterEnd: 2, verseEnd: 8 }),
        ],
        exegeticalUnits: [unidadExegetica('u1', 'Nehemías', 'Cambio de escena.'), unidadExegetica('u2', 'Nehemías', 'Oración.')],
        panorama: { genre: 'narrative' } as never,
        displayLanguage: 'es' as const,
    });

    it('SIN PROYECTO: el mismo argumento que armaba la página antes de esta fase', () => {
        // Fijado a mano con la forma exacta del código anterior: si cambia,
        // cambia lo que reciben el servicio y todos los planes sueltos.
        expect(buildSeriesPlan(base())).toEqual({
            series: {
                title: 'Nehemías: reconstruir',
                description: 'Serie expositiva de Nehemías en 2 sermones',
                type: 'expository',
                startDate: new Date(2026, 10, 1),
                metadata: { expository: { book: 'Nehemías' } },
                resourceIds: [],
            },
            sermons: [
                {
                    title: 'Título p1',
                    description: 'Prop. exegética',
                    passage: 'Nehemías 1:1-11',
                    week: 1,
                    status: 'planned',
                    expositoryEnrichment: {
                        exegeticalProposition: 'Prop. exegética',
                        homileticalProposition: 'Prop. homilética',
                        pastoralObjective: 'Objetivo',
                        caseTreatment: 'long-prayer',
                        sourcedExegeticalUnitIds: ['u1', 'u2'],
                        macroSectionId: 'm1',
                    },
                    syntacticUnit: {
                        book: 'Nehemías',
                        chapterStart: 1, verseStart: 1, chapterEnd: 1, verseEnd: 11,
                        originalLanguage: 'hebrew',
                        justification: 'Cambio de escena. Oración.',
                    },
                },
                {
                    title: 'Título p2',
                    description: 'Prop. exegética',
                    passage: 'Nehemías 2:1-8',
                    week: 2,
                    status: 'planned',
                    expositoryEnrichment: {
                        exegeticalProposition: 'Prop. exegética',
                        homileticalProposition: 'Prop. homilética',
                        pastoralObjective: 'Objetivo',
                        sourcedExegeticalUnitIds: [],
                    },
                },
            ],
            frequency: 'weekly',
            expositoryAssistant: { version: 'expository-v15:narrative', status: 'reviewed' },
            displayLanguage: 'es',
        });
    });

    it('sin proyecto no aparece la clave project (ni undefined)', () => {
        expect('project' in buildSeriesPlan(base())).toBe(false);
        expect('project' in buildSeriesPlan({ ...base(), project: null })).toBe(false);
    });

    it('sin panorama, la versión sin género', () => {
        expect(buildSeriesPlan({ ...base(), panorama: null }).expositoryAssistant?.version).toBe('expository-v15');
    });

    it('CON PROYECTO: lleva el proyecto, las obras marcadas y las desmarcadas, y no toca exegesisDefaults', () => {
        const plan = buildSeriesPlan({
            ...base(),
            project: { projectId: 'neh', sources: [fuente('williamson')], excludedResourceIds: ['halot'] },
        });
        expect(plan.project).toEqual({ projectId: 'neh', sources: [fuente('williamson')], excludedResourceIds: ['halot'] });
        // La serie ligada resuelve las fuentes del proyecto en vivo.
        expect(plan.series.metadata).toEqual({ expository: { book: 'Nehemías' } });
        const { project: _p, ...resto } = plan;
        expect(resto).toEqual(buildSeriesPlan(base()));
    });
});

// ── El encuadre en el planificador (FASE_ENCUADRE_SERIE, U5) ────────────

const esd = (cs: number, ce: number) => ({ bookId: 'EZR' as BibleBookId, chapterStart: cs, chapterEnd: ce, verseStart: null, verseEnd: null });
const esdras = (framing: Record<string, unknown> | undefined, books: BibleBookId[] = ['EZR']) => ({
    framing: framing as never,
    bibliographyCriteria: { bibleBooks: books },
});

describe('framingPrefill — lo que el encuadre precarga', () => {
    const completo = {
        scope: { bookId: 'EZR', passage: esd(7, 10) },
        centralIdea: '  Dios restaura a su pueblo por su Palabra. ',
        rhythm: { sundays: 12, startDate: '2026-11-01', frequency: 'biweekly' },
    };

    it('alcance, fecha y frecuencia; la idea PROVISORIA no va a la descripción ni los domingos a nada', () => {
        const r = framingPrefill(esdras(completo));
        expect(r).toEqual({
            scope: esd(7, 10),
            startDate: '2026-11-01',
            frequency: 'biweekly',
            // Con encuadre y sin idea revisada: el campo aparece vacío.
            description: '',
        });
        expect(JSON.stringify(r)).not.toContain('12');
        expect(JSON.stringify(r)).not.toContain('Dios restaura');
    });

    it('sin proyecto o sin encuadre: nada', () => {
        const nada = { scope: null, startDate: null, frequency: null, description: null };
        expect(framingPrefill(null)).toEqual(nada);
        expect(framingPrefill(esdras(undefined))).toEqual(nada);
    });

    it('el alcance se descarta si el proyecto ya no tiene ese único libro, o si la URL trae otro', () => {
        expect(framingPrefill(esdras(completo, ['EZR', 'NEH'])).scope).toBeNull();
        expect(framingPrefill(esdras(completo, ['NEH'])).scope).toBeNull();
        expect(framingPrefill(esdras(completo), { bookParam: 'NEH' }).scope).toBeNull();
        expect(framingPrefill(esdras(completo), { bookParam: 'EZR' }).scope).toEqual(esd(7, 10));
    });

    it('solo la idea revisada y vigente precarga la descripción; desactualizada, el campo queda vacío', () => {
        const revision = { centralIdea: 'Revisada', verdict: 'nuanced', why: 'x', ofIdea: 'Original', revisedAt: '2026-10-25T00:00:00Z' };
        expect(framingPrefill(esdras({ centralIdea: 'Original', revision })).description).toBe('Revisada');
        expect(framingPrefill(esdras({ centralIdea: 'Editada', revision })).description).toBe('');
    });
});

describe('hasReadingToContrast', () => {
    it('con idea central o con movimientos; vacío, no', () => {
        expect(hasReadingToContrast({ centralIdea: 'x' })).toBe(true);
        expect(hasReadingToContrast({ structure: [{ passage: esd(1, 6), title: '' }] })).toBe(true);
        expect(hasReadingToContrast({ centralIdea: '  ', structure: [] })).toBe(false);
        expect(hasReadingToContrast(null)).toBe(false);
    });
});

describe('isPassageRun — para el rótulo «del pasaje»', () => {
    const v = (chapter: number, verse: number, text = 'texto') => ({ chapter, verse, text });
    it('libro entero si empieza en 1:1 y llega al último capítulo', () => {
        expect(isPassageRun([v(1, 1), v(10, 44)], 'EZR', 10)).toBe(false);
        expect(isPassageRun([v(7, 1), v(10, 44)], 'EZR', 10)).toBe(true);
        expect(isPassageRun([v(1, 1), v(6, 22)], 'EZR', 10)).toBe(true);
        expect(isPassageRun([], 'EZR', 10)).toBe(false);
    });

    it('Malaquías en hebreo termina en 3:24 y es el libro entero, aunque el lector tenga 4 capítulos', () => {
        const hebreo = [v(1, 1, 'מַשָּׂא דְבַר־יְהוָה'), v(3, 24, 'וְהֵשִׁיב לֵב־אָבוֹת')];
        expect(isPassageRun(hebreo, 'MAL', 4)).toBe(false);
        // Malaquías 1-2 en hebreo sí es un pasaje.
        expect(isPassageRun([v(1, 1, 'מַשָּׂא'), v(2, 17, 'הוֹגַעְתֶּם')], 'MAL', 4)).toBe(true);
    });

    it('Malaquías en una traducción de respaldo se mide contra los 4 capítulos del lector', () => {
        expect(isPassageRun([v(1, 1, 'Profecía'), v(3, 18, 'Entonces')], 'MAL', 4)).toBe(true);
        expect(isPassageRun([v(1, 1, 'Profecía'), v(4, 6, 'Él hará volver')], 'MAL', 4)).toBe(false);
    });
});

describe('sourceChapterCount', () => {
    it('la cuenta del original si el texto es hebreo o griego; si no, la del lector', () => {
        expect(sourceChapterCount('MAL', [{ text: 'מַשָּׂא' }], 4)).toBe(3);
        // Joel: 3 capítulos en el lector, 4 en hebreo.
        expect(sourceChapterCount('JOL', [{ text: 'דְּבַר־יְהוָה' }], 3)).toBe(4);
        expect(sourceChapterCount('MAL', [{ text: 'Profecía' }], 4)).toBe(4);
        expect(sourceChapterCount('2PE', [{ text: 'Συμεὼν Πέτρος' }], 3)).toBe(3);
    });
});

describe('unitsVsSundays — el aviso tras el Pase 4', () => {
    it('más unidades que domingos, y menos', () => {
        expect(unitsVsSundays(14, 10)).toEqual({ direction: 'more-units', units: 14, sundays: 10 });
        expect(unitsVsSundays(8, 10)).toEqual({ direction: 'fewer-units', units: 8, sundays: 10 });
    });
    it('iguales o sin domingos: nada', () => {
        expect(unitsVsSundays(10, 10)).toBeNull();
        expect(unitsVsSundays(10, undefined)).toBeNull();
        expect(unitsVsSundays(10, 0)).toBeNull();
    });
});

describe('seriesDescriptionFor', () => {
    it('la del pastor; vacía o sin precarga, el texto de siempre', () => {
        expect(seriesDescriptionFor(' Mi idea ', 'fija')).toBe('Mi idea');
        expect(seriesDescriptionFor('   ', 'fija')).toBe('fija');
        expect(seriesDescriptionFor(null, 'fija')).toBe('fija');
    });
});
