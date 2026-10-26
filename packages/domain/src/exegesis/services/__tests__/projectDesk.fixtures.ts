import type { BibleBookId } from '../../../bible/canon/BibleCanon';
import type { PassageReference } from '../../../bible/canon/passage-reference';
import type { CourseScheduleEntry, FeedbackPattern } from '../courseSchedule';
import type { ProjectBibliographyEntry, ProjectRequirement } from '../projectBibliography';
import type { HypothesisEntry } from '../projectFraming';
import type { SerieLike } from '../projectSeriesLink';
import type { DeskProject, DeskSermonInput, DeskStudyInput, ProjectDeskInput } from '../projectDesk';

/**
 * Escenarios armados del escritorio (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md`):
 * Esdras en tres momentos, un Exegético para enseñar, Jonás de antes y
 * NT785 con su calendario. Las fechas son locales (constructor de `Date`),
 * así las pruebas no dependen de la zona horaria.
 */

/** Lunes 26 de octubre de 2026, 10:00 hora local. */
export const NOW = new Date(2026, 9, 26, 10, 0, 0);
/** Lunes 26 de octubre de 2026, 23:00: el TP #9 (miércoles 28) vence en 48 h. */
export const NOW_CURSO = new Date(2026, 9, 26, 23, 0, 0);

export const passage = (bookId: BibleBookId, cs: number, ce = cs, vs: number | null = null, ve: number | null = null): PassageReference =>
    ({ bookId, chapterStart: cs, chapterEnd: ce, verseStart: vs, verseEnd: ve });

export const study = (id: string, over: Partial<DeskStudyInput> = {}): DeskStudyInput => ({
    id,
    title: `Estudio ${id}`,
    passage: passage('EZR', 1),
    phase: 'configuring',
    stepCount: 8,
    acceptedStepCount: 0,
    archivedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    citedSourceKeys: [],
    seriesId: null,
    ...over,
});

export const ensamblado = (id: string, over: Partial<DeskStudyInput> = {}) =>
    study(id, { phase: 'assembled', acceptedStepCount: 8, updatedAt: '2026-10-10T10:00:00.000Z', ...over });

export const ficha = (id: string, over: Partial<ProjectBibliographyEntry> = {}): ProjectBibliographyEntry => ({
    id, title: `Obra ${id}`, author: null, resourceId: `r_${id}`, weight: 'recommended', decision: 'approved',
    origins: ['catalog'], sourceType: 'commentary-critical', ...over,
});

export const anotacion = (id: string, studyId: string | null, verdict: HypothesisEntry['verdict'], at: string): HypothesisEntry => ({
    id, at, source: studyId ? 'study' : 'panorama', ...(studyId ? { studyId } : {}), verdict, note: `nota ${id}`,
});

export const proyecto = (over: Partial<DeskProject> = {}): DeskProject => ({
    id: 'p1',
    type: 'exegetical',
    bibliographyCriteria: { bibleBooks: ['EZR'] },
    ...over,
});

/** Una serie del proyecto con `n` perícopas: Esd 1-…, estudio `s<i>` y domingos desde el 1 de noviembre. */
export function serieEsdras(n: number, over: Partial<SerieLike> = {}): SerieLike {
    return {
        id: 'serie1',
        title: 'Esdras: la palabra que reconstruye',
        projectId: 'p1',
        createdAt: '2026-10-05T10:00:00.000Z',
        metadata: {
            plannedSermons: Array.from({ length: n }, (_, i) => ({
                id: `pl${i + 1}`,
                week: i + 1,
                title: `Perícopa ${i + 1}`,
                passage: `Esd ${i + 1}:1-13`,
                scheduledDate: new Date(2026, 10, 1 + 7 * i),
                paperId: `s${i + 1}`,
            })),
        },
        ...over,
    };
}

/** Las fuentes de Esdras: tres comentarios aprobados, uno por conseguir. */
export const fuentesEsdras: ProjectBibliographyEntry[] = [
    ficha('b1'), ficha('b2'), ficha('b3', { resourceId: null }),
    ficha('b4', { decision: 'candidate', sourceType: 'journal-article' }),
];

export const requisitosEsdras: ProjectRequirement[] = [
    { id: 'q1', kind: 'minimum-type', text: 'Dos comentarios críticos', origin: 'level', sourceType: 'commentary-critical', minimum: 2 },
    { id: 'q2', kind: 'quantity', text: 'Dos artículos', origin: 'level', sourceType: 'journal-article', unit: 'works', minimum: 2 },
];

/** Esdras recién creado: libro elegido, nota vieja, nada más. */
export function esdrasRecienCreado(): ProjectDeskInput {
    return {
        project: proyecto({ contextNote: 'Serie sobre Esdras para la iglesia, 12 domingos.' }),
        studies: [],
        series: [],
        sermons: [],
        outputs: [],
        sessionCount: 0,
    };
}

/**
 * Esdras con la serie a medias: 12 perícopas, 4 ensambladas (2 anotadas),
 * la 5 en análisis, el resto sin empezar. Requisitos 1 de 2.
 */
export function esdrasAMedias(): ProjectDeskInput {
    const studies: DeskStudyInput[] = [
        ensamblado('s1'), ensamblado('s2'), ensamblado('s3'), ensamblado('s4'),
        study('s5', { phase: 'in-progress', acceptedStepCount: 3, updatedAt: '2026-10-25T18:00:00.000Z' }),
        ...Array.from({ length: 7 }, (_, i) => study(`s${i + 6}`)),
    ];
    const sermons: DeskSermonInput[] = [
        { id: 'd1', status: 'draft', updatedAt: '2026-10-11T10:00:00.000Z', content: 'cuerpo' },
        { id: 'd1pub', status: 'published', sourceSermonId: 'd1', updatedAt: '2026-10-12T10:00:00.000Z' },
        // El marcador vacío que la serie crea: no cuenta como sermón.
        { id: 'd2', status: 'draft', updatedAt: '2026-10-05T10:00:00.000Z', wizardProgress: { currentStep: 0 } },
        // Nacido del estudio sin pasar por el plan.
        { id: 'x3', status: 'draft', sourcePaperId: 's3', updatedAt: '2026-10-13T10:00:00.000Z', content: 'borrador' },
    ];
    const serie = serieEsdras(12);
    serie.metadata!.plannedSermons![0]!.draftId = 'd1';
    serie.metadata!.plannedSermons![1]!.draftId = 'd2';
    return {
        project: proyecto({
            framing: {
                purpose: 'preach',
                centralIdea: 'Dios reconstruye a su pueblo por su palabra.',
                structure: [{ passage: passage('EZR', 1, 6), title: 'El templo' }, { passage: passage('EZR', 7, 10), title: 'La ley' }],
                hypothesisLog: [
                    anotacion('h1', 's1', 'confirms', '2026-10-11T10:00:00.000Z'),
                    anotacion('h2', 's2', 'nuances', '2026-10-12T10:00:00.000Z'),
                ],
            },
            bibliography: fuentesEsdras,
            bibliographyCriteria: { bibleBooks: ['EZR'], requirementItems: requisitosEsdras },
        }),
        studies,
        series: [serie],
        sermons,
        outputs: [],
        sessionCount: 1,
    };
}

/** Esdras en síntesis: los 12 ensamblados, anotaciones y la idea revisada vigente. */
export function esdrasEnSintesis(): ProjectDeskInput {
    const idea = 'Dios reconstruye a su pueblo por su palabra.';
    return {
        project: proyecto({
            framing: {
                purpose: 'preach',
                centralIdea: idea,
                hypothesisLog: [
                    anotacion('h1', 's1', 'confirms', '2026-10-11T10:00:00.000Z'),
                    anotacion('h2', 's2', 'nuances', '2026-10-12T10:00:00.000Z'),
                    anotacion('h3', 's3', 'confirms', '2026-10-13T10:00:00.000Z'),
                    anotacion('h4', 's4', 'contradicts', '2026-10-14T10:00:00.000Z'),
                ],
                revision: { centralIdea: 'Dios reconstruye a su pueblo cuando vuelve a su palabra.', verdict: 'nuanced', why: 'Esd 9-10', ofIdea: idea, revisedAt: '2026-10-20T10:00:00.000Z' },
            },
            bibliography: [ficha('b1'), ficha('b2'), ficha('b5', { sourceType: 'journal-article' }), ficha('b6', { sourceType: 'journal-article' })],
            bibliographyCriteria: { bibleBooks: ['EZR'], requirementItems: requisitosEsdras },
        }),
        studies: Array.from({ length: 12 }, (_, i) => ensamblado(`s${i + 1}`)),
        series: [serieEsdras(12)],
        sermons: [],
        outputs: [],
        sessionCount: 0,
    };
}

/** Un Exegético para enseñar, sin serie, con «di por hecha la división». */
export function paraEnsenar(): ProjectDeskInput {
    return {
        project: proyecto({
            framing: { purpose: 'teach', centralIdea: 'La fe obra.', divisionWithoutSeries: true },
            bibliographyCriteria: { bibleBooks: ['JAS'] },
            bibliography: [ficha('b1')],
        }),
        studies: [
            ensamblado('t1', { passage: passage('JAS', 2, 2, 14, 26) }),
            study('t2', { passage: passage('JAS', 3, 3, 1, 12) }),
        ],
        series: [],
        sermons: [],
        outputs: [],
    };
}

/** Jonás de antes: `sourceIds`, nota de contexto, serie de 4 ensamblados, sermón vinculado por el estudio. */
export function jonasLegacy(): ProjectDeskInput {
    const serie: SerieLike = {
        id: 'sj', title: 'Jonás', projectId: 'pj', createdAt: '2026-08-01T10:00:00.000Z',
        metadata: {
            plannedSermons: Array.from({ length: 4 }, (_, i) => ({
                id: `pj${i + 1}`, title: `Jonás ${i + 1}`, passage: `Jon ${i + 1}`, paperId: `j${i + 1}`,
                ...(i === 1 ? { draftId: 'jd2' } : {}),
            })),
        },
    };
    return {
        project: { id: 'pj', type: 'exegetical', contextNote: 'Serie de Jonás, agosto.', sourceIds: ['r1', 'r2'], bibliographyCriteria: { bibleBooks: ['JON'] } },
        studies: Array.from({ length: 4 }, (_, i) => ensamblado(`j${i + 1}`, { passage: passage('JON', i + 1) })),
        series: [serie],
        sermons: [
            // El sermón 1, vinculado a mano: nació del estudio, no del plan.
            { id: 'js1', status: 'draft', sourcePaperId: 'j1', updatedAt: '2026-08-10T10:00:00.000Z', content: 'cuerpo' },
            { id: 'js1pub', status: 'published', sourcePaperId: 'j1', sourceSermonId: 'js1', updatedAt: '2026-08-11T10:00:00.000Z', content: 'cuerpo' },
            { id: 'jd2', status: 'published', updatedAt: '2026-08-18T10:00:00.000Z', content: 'cuerpo' },
        ],
        outputs: [],
        resourceOf: id => ({ title: `Libro ${id}`, exegeticalType: 'commentary-critical' }),
    };
}

const entrada = (id: string, over: Partial<CourseScheduleEntry> = {}): CourseScheduleEntry => ({
    id, workTypeId: 'tp', label: id.replace('e', 'TP #'), ...over,
});

export const patronesNT785: FeedbackPattern[] = [
    { id: 'cat', name: 'Categoría ≠ traducción', decision: 'guide', guideId: 'g1', ruleText: 'La categoría no es la traducción.' },
    { id: 'cd', name: 'Cierre doble', decision: 'pending' },
];

/**
 * NT785 con calendario: TP #7 devuelto, TP #8 entregado sin devolución,
 * TP #9 en curso y vence el miércoles 28 (48 h desde `NOW_CURSO`), TP #10
 * sin estudio. Moo es obligatoria y está por conseguir; «cierre doble» se
 * repite y no está decidido.
 */
export function nt785(): ProjectDeskInput {
    return {
        project: {
            id: 'nt785',
            type: 'course',
            courseInfo: { course: 'NT785', styleGuideId: 'gcurso' },
            workTypes: [{ id: 'tp', label: 'TP Semanal', rubricTemplateId: 'rub1', exegeticalMethod: 'mixed', styleGuideId: 'g1' }],
            courseScheduleMode: 'calendar',
            courseSchedule: [
                entrada('e10', { dueDate: '2026-11-06', passage: passage('JAS', 4, 5, 13, 6) }),
                entrada('e9', { dueDate: '2026-10-28', paperId: 's9', passage: passage('JAS', 4, 4, 11, 17) }),
                entrada('e8', { dueDate: '2026-10-21', paperId: 's8', deliveredAt: '2026-10-21T20:00:00.000Z' }),
                entrada('e7', {
                    dueDate: '2026-10-14', paperId: 's7', deliveredAt: '2026-10-14T20:00:00.000Z',
                    feedback: {
                        receivedAt: '2026-10-19T10:00:00.000Z', text: 'Buen trabajo; cuidado con los cierres.', grade: '6,5',
                        corrections: [{ id: 'c1', patternId: 'cd' }, { id: 'c2', patternId: 'cd', note: 'v. 10' }, { id: 'c3', patternId: 'cat' }],
                    },
                }),
            ],
            feedbackPatterns: patronesNT785,
            bibliography: [
                ficha('moo', { title: 'James (PNTC)', author: 'Moo', resourceId: null, weight: 'required' }),
                ficha('mck', { title: 'The Letter of James', author: 'McKnight' }),
                ficha('art1', { sourceType: 'journal-article', pageCount: 64, annotation: { review: { mainIdea: 'La sabiduría de lo alto.' } } }),
                ficha('art2', { sourceType: 'journal-article', pageCount: 30 }),
            ],
            bibliographyCriteria: {
                bibleBooks: ['JAS'],
                requirementItems: [
                    { id: 'pag', kind: 'quantity', text: 'Cien páginas de artículos', origin: 'syllabus', sourceType: 'journal-article', unit: 'pages', minimum: 100, done: true },
                ],
            },
        },
        studies: [
            ensamblado('s7', { passage: passage('JAS', 3, 3, 13, 18), citedSourceKeys: ['moo', 'davids'], projectWorkTypeId: 'tp' }),
            ensamblado('s8', { passage: passage('JAS', 4, 4, 1, 10), citedSourceKeys: ['Moo', 'mcknight'], projectWorkTypeId: 'tp' }),
            study('s9', { phase: 'in-progress', acceptedStepCount: 5, passage: passage('JAS', 4, 4, 11, 17), citedSourceKeys: ['allison'], updatedAt: '2026-10-26T12:00:00.000Z', projectWorkTypeId: 'tp' }),
            // Un TP anterior, suelto: «Traer los trabajos anteriores».
            ensamblado('s1', { passage: passage('JAS', 1, 1, 1, 8), title: 'TP #1' }),
        ],
        series: [],
        sermons: [],
        outputs: [],
        rubricCatalog: { ids: ['rub1'], defaultId: null },
    };
}
