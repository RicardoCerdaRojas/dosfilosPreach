import { findBooksByAlias, type BibleBookId } from '../../bible/canon/BibleCanon';
import type { PassageReference } from '../../bible/canon/passage-reference';
import type { AIProject } from '../../entities/AIProject';
import type { LibraryResource } from '../../entities/LibraryResource';
import type { SeriesExegesisDefaults } from '../../entities/SermonSeries';
import type { SourceType } from '../entities/SourceType';
import type { AddProjectSourceInput, CreateExegeticalPaperInput } from '../use-cases/dtos';
import { projectBibleBooks } from './bibliographyCandidates';
import {
    inheritableBibliography,
    initialSourcesFromBibliography,
    projectBibliography,
    type ProjectBibliographyEntry,
} from './projectBibliography';
import { paperDefaultsFromSeries } from './seriesPaperDefaults';

/**
 * El vínculo proyecto → serie (etapa 3 de ADR-046,
 * `docs/FASE_PROYECTO_SERIE_2026-10.md`).
 *
 * El vínculo vive solo en `series.projectId`. Todo lo demás se deduce aquí:
 * qué series y qué sermones son del proyecto, qué bibliografía hereda un
 * estudio de la serie y cómo va cada perícopa.
 *
 * Las series se reciben con un tipo estructural (`SerieLike`) y no con
 * `SermonSeries`: así estas reglas no dependen de cómo se guarde la serie.
 */

/** El libro de la biblioteca con lo que hace falta para heredarlo. */
export type ProjectSourceResource = Pick<LibraryResource, 'coversBibleBooks' | 'scope'> & {
    title: string;
    author?: string | null;
    exegeticalType?: SourceType | null;
};

type ResourceOf = (id: string) => ProjectSourceResource | null | undefined;

/** La perícopa planificada, con lo que leen estas reglas. */
export interface PlannedPericopeLike {
    id: string;
    week?: number;
    title?: string;
    passage?: string;
    scheduledDate?: Date | string | null;
    paperId?: string | null;
    draftId?: string | null;
    syntacticUnit?: { book: string; chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number } | null;
}

/** La serie, con lo que leen estas reglas. */
export interface SerieLike {
    id: string;
    title?: string;
    projectId?: string | null;
    createdAt: Date | string;
    metadata?: {
        plannedSermons?: PlannedPericopeLike[];
        exegesisDefaults?: SeriesExegesisDefaults;
        projectSourceExclusions?: string[];
        expository?: { book?: string | null } | null;
    } | null;
}

const tiempo = (d: Date | string | null | undefined): number => {
    if (!d) return 0;
    const t = (d instanceof Date ? d : new Date(d)).getTime();
    return Number.isNaN(t) ? 0 : t;
};

// ── Bibliografía heredable ─────────────────────────────────────────────

/**
 * Las fichas del proyecto que hereda un estudio de este libro: las
 * aprobadas que están en la biblioteca, sin comentarios de otro libro.
 * Es la composición que hacía ProjectBibliographyOffer: un solo lugar para
 * que el estudio suelto y la serie hereden lo mismo.
 */
export function inheritableProjectEntries(
    project: Pick<AIProject, 'bibliography' | 'sourceIds'> | null | undefined,
    bookId: BibleBookId | null | undefined,
    resourceOf: ResourceOf,
): ProjectBibliographyEntry[] {
    if (!project || !bookId) return [];
    // Con el libro de la biblioteca: un proyecto de antes solo tiene
    // `sourceIds`, y sin esto sus fuentes llegaban sin nombre ni tipo.
    const lookup = (id: string) => {
        const r = resourceOf(id);
        return r ? { title: r.title, author: r.author ?? null, exegeticalType: r.exegeticalType ?? null } : null;
    };
    return inheritableBibliography(projectBibliography(project, lookup), bookId, resourceOf);
}

/** Las fuentes iniciales de un estudio del proyecto, sin las obras que el pastor desmarcó. */
export function projectSourcesForBook(
    project: Pick<AIProject, 'bibliography' | 'sourceIds'> | null | undefined,
    bookId: BibleBookId | null | undefined,
    resourceOf: ResourceOf,
    excludedResourceIds: readonly string[] = [],
): AddProjectSourceInput[] {
    const fuera = new Set(excludedResourceIds);
    const entries = inheritableProjectEntries(project, bookId, resourceOf).filter(e => !fuera.has(e.resourceId!));
    return initialSourcesFromBibliography(entries, id => resourceOf(id)?.exegeticalType ?? null, id => resourceOf(id)?.title);
}

/**
 * Lo que un estudio de la serie toma al nacer: lo de la serie
 * (`paperDefaultsFromSeries`) más el proyecto de origen y sus fuentes.
 * La rúbrica sigue siendo la de la serie: sin una elegida, el caso de uso
 * aplica la de predicación. Por eso aquí nunca se agrega una.
 */
export function seriesPaperInheritance(input: {
    exegesisDefaults: SeriesExegesisDefaults | null | undefined;
    projectId?: string | null;
    projectSources?: readonly AddProjectSourceInput[] | null;
}): Pick<CreateExegeticalPaperInput, 'styleGuideId' | 'rubricTemplateId' | 'initialSources' | 'projectId'> {
    const base = paperDefaultsFromSeries(input.exegesisDefaults);
    const delProyecto = input.projectSources ?? [];
    if (delProyecto.length === 0 && !input.projectId) return base;
    const { initialSources: deLaSerie, ...resto } = base;
    // Gana la del proyecto: trae la clasificación corregida en el estado del arte.
    const vistas = new Set<string>();
    const fuentes = [...delProyecto, ...(deLaSerie ?? [])].filter(s => {
        const clave = s.sourceLibraryResourceId ?? s.corpusId;
        if (vistas.has(clave)) return false;
        vistas.add(clave);
        return true;
    });
    return {
        ...resto,
        ...(fuentes.length > 0 ? { initialSources: fuentes } : {}),
        ...(typeof input.projectId === 'string' && input.projectId.trim() ? { projectId: input.projectId } : {}),
    };
}

// ── Pertenencia de series y sermones ───────────────────────────────────

/** El sermón, con lo que hace falta para saber si el pastor ya avanzó. */
export interface SermonProgressLike {
    status?: string | undefined;
    sourceSermonId?: string | null | undefined;
    content?: string | null | undefined;
    /** Lo trae el resumen de la lista, donde `content` llega vacío. */
    hasContent?: boolean | null | undefined;
    wizardProgress?: { currentStep?: number | null | undefined } | null | undefined;
}

/**
 * El marcador vacío que la serie crea por cada perícopa sin estudio
 * (`SeriesService.autoCreateSermonPlaceholders`): borrador del asistente
 * en el paso 0, sin cuerpo. Nadie lo escribió, así que no cuenta como
 * sermón. Es el mismo criterio con que la lista de sermones lo oculta y
 * SeriesDetail lo da por «configurando».
 */
export function isEmptySermonPlaceholder(s: SermonProgressLike): boolean {
    if (!s.wizardProgress || s.sourceSermonId || s.status === 'published') return false;
    if ((s.wizardProgress.currentStep ?? 0) > 0) return false;
    // El resumen trae `hasContent`; el sermón completo, el cuerpo.
    const conCuerpo = s.hasContent === true || (typeof s.content === 'string' && s.content.trim() !== '');
    return !conCuerpo;
}

/**
 * El proyecto de un sermón. El explícito gana (un sermón de «Material
 * previo» se queda ahí); si no tiene, el de ORIGEN del estudio del que
 * nació —sus vínculos no cuentan—; si no, el de su serie.
 */
export function resolveSermonProjectId(
    sermon: { projectId?: string | null; sourcePaperId?: string | null; seriesId?: string | null },
    paperOriginOf: (paperId: string) => string | null | undefined,
    seriesProjectOf: (seriesId: string) => string | null | undefined,
): string | null {
    if (sermon.projectId) return sermon.projectId;
    const delPaper = sermon.sourcePaperId ? paperOriginOf(sermon.sourcePaperId) : null;
    if (delPaper) return delPaper;
    const deLaSerie = sermon.seriesId ? seriesProjectOf(sermon.seriesId) : null;
    return deLaSerie || null;
}

/**
 * Los sermones del proyecto. `all` trae cada versión; `chains`, uno por
 * cadena borrador → copia publicada, para que un sermón publicado no se
 * cuente dos veces.
 *
 * Un marcador vacío que solo entra por su serie no es del proyecto: si no,
 * ligar una serie hecha en el planificador llenaba «Material producido» y
 * daba por hecha la fase de sermones del recorrido sin que el pastor
 * escribiera nada. El que tiene proyecto explícito o estudio de origen se
 * queda, como antes de deducir por serie.
 */
export function projectSermonsOf<S extends SermonProgressLike & {
    id: string;
    projectId?: string | null;
    sourcePaperId?: string | null;
    seriesId?: string | null;
    sourceSermonId?: string | null;
    status?: string;
    updatedAt: Date | string;
}>(
    sermons: readonly S[],
    projectId: string,
    paperOriginOf: (paperId: string) => string | null | undefined,
    seriesProjectOf: (seriesId: string) => string | null | undefined,
): { all: S[]; chains: S[] } {
    const all = sermons
        .filter(s => {
            if (resolveSermonProjectId(s, paperOriginOf, seriesProjectOf) !== projectId) return false;
            const soloPorSerie = !s.projectId && !(s.sourcePaperId && paperOriginOf(s.sourcePaperId));
            return !(soloPorSerie && isEmptySermonPlaceholder(s));
        })
        .sort((a, b) => tiempo(b.updatedAt) - tiempo(a.updatedAt));
    const porCadena = new Map<string, S>();
    // `all` ya va del más reciente al más viejo: el primero de cada cadena
    // es el más reciente, y una copia publicada lo reemplaza si no lo era.
    for (const s of all) {
        const clave = s.sourceSermonId ?? s.id;
        const actual = porCadena.get(clave);
        if (!actual || (actual.status !== 'published' && s.status === 'published')) porCadena.set(clave, s);
    }
    const chains = [...porCadena.values()].sort((a, b) => tiempo(b.updatedAt) - tiempo(a.updatedAt));
    return { all, chains };
}

/** Las series del proyecto, la más nueva primero. */
export function projectSeriesOf<T extends SerieLike>(series: readonly T[], projectId: string): T[] {
    return series.filter(s => !!projectId && s.projectId === projectId).sort((a, b) => tiempo(b.createdAt) - tiempo(a.createdAt));
}

// ── Avance de la serie ─────────────────────────────────────────────────

export type PericopeSermonState = 'none' | 'draft' | 'published';

export interface SeriesPericopeRow<P> {
    pericopeId: string;
    week: number | null;
    title: string;
    passage: string;
    scheduledDate: Date | string | null;
    paper: P | null;
    sermonId: string | null;
    sermonState: PericopeSermonState;
}

/**
 * Una fila por perícopa, en el orden del plan. El estudio se cruza por
 * `plannedSermons[].paperId`, porque el resumen del estudio no trae
 * `pericopeId`. «Publicado» quiere decir el borrador publicado o una copia
 * publicada de él: el resumen no trae si el plan lo dio por terminado.
 *
 * El marcador vacío de la perícopa (`isEmptySermonPlaceholder`) cuenta
 * como «sin sermón»; la fila conserva su id para abrirlo y empezar.
 */
export function seriesPericopeRows<P extends { id: string; title: string; phase: string }>(
    series: SerieLike,
    papersById: (id: string) => P | undefined,
    sermons: ReadonlyArray<SermonProgressLike & { id: string; status?: string; sourceSermonId?: string | null; updatedAt: Date | string }>,
): SeriesPericopeRow<P>[] {
    return (series.metadata?.plannedSermons ?? []).map(p => {
        const sermonId = p.draftId || null;
        let sermonState: PericopeSermonState = 'none';
        if (sermonId) {
            const publicado = sermons.some(s => s.status === 'published' && (s.id === sermonId || s.sourceSermonId === sermonId));
            // Un borrador que no está en la lista sigue contando: no se sabe que esté vacío.
            const borrador = sermons.find(s => s.id === sermonId);
            const vacio = !!borrador && isEmptySermonPlaceholder(borrador);
            sermonState = publicado ? 'published' : vacio ? 'none' : 'draft';
        }
        return {
            pericopeId: p.id,
            week: typeof p.week === 'number' ? p.week : null,
            title: p.title ?? '',
            passage: p.passage ?? '',
            scheduledDate: p.scheduledDate ?? null,
            paper: (p.paperId ? papersById(p.paperId) : undefined) ?? null,
            sermonId,
            sermonState,
        };
    });
}

/** «N de M perícopas con estudio · K con sermón». */
export function seriesProgress(rows: ReadonlyArray<Pick<SeriesPericopeRow<unknown>, 'paper' | 'sermonState'>>): { total: number; withStudy: number; withSermon: number } {
    return {
        total: rows.length,
        withStudy: rows.filter(r => r.paper !== null).length,
        withSermon: rows.filter(r => r.sermonState !== 'none').length,
    };
}

/**
 * La próxima fecha de la serie: la más cercana desde hoy. Se compara por
 * día, para que el domingo de hoy siga siendo «la próxima» hasta que
 * termine.
 */
export function nextScheduledDate(rows: ReadonlyArray<Pick<SeriesPericopeRow<unknown>, 'scheduledDate'>>, now: Date): Date | null {
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let mejor: Date | null = null;
    for (const r of rows) {
        if (!r.scheduledDate) continue;
        const d = r.scheduledDate instanceof Date ? r.scheduledDate : new Date(r.scheduledDate);
        if (Number.isNaN(d.getTime()) || d.getTime() < hoy) continue;
        if (!mejor || d.getTime() < mejor.getTime()) mejor = d;
    }
    return mejor;
}

// ── El libro de la serie ───────────────────────────────────────────────

/**
 * El libro con que el proyecto abre el planificador: solo si tiene
 * exactamente uno. Con cero o con varios, el pastor lo elige.
 */
export function plannerBookForProject(
    project: Pick<AIProject, 'bibliographyCriteria'> | null | undefined,
    studies: ReadonlyArray<{ passage: Pick<PassageReference, 'bookId'> }>,
): BibleBookId | null {
    if (!project) return null;
    const libros = projectBibleBooks(project.bibliographyCriteria, studies);
    return libros.length === 1 ? libros[0]! : null;
}

/** El libro de una unidad del planificador («Nehemías» → NEH), como SeriesService. */
export function bookIdOfUnit(unit: { book: string } | null | undefined): BibleBookId | null {
    if (!unit?.book?.trim()) return null;
    return findBooksByAlias(unit.book.trim())[0]?.id ?? null;
}

/** El libro de la serie: el de su primera perícopa con unidad, o el del plan expositivo. */
export function seriesBookId(series: SerieLike): BibleBookId | null {
    for (const p of series.metadata?.plannedSermons ?? []) {
        const id = bookIdOfUnit(p.syntacticUnit);
        if (id) return id;
    }
    const libro = series.metadata?.expository?.book;
    return libro?.trim() ? findBooksByAlias(libro.trim())[0]?.id ?? null : null;
}

/**
 * Los estudios del proyecto que ya tratan una perícopa de la serie nueva,
 * para avisar antes de crear otro. Solo los sueltos (sin serie) y del
 * mismo libro. Un capítulo sin versículos va del 0 al 999.
 */
export function overlappingProjectStudies(
    pericopes: ReadonlyArray<{ id: string; bookId: BibleBookId; chapterStart: number; verseStart: number; chapterEnd: number; verseEnd: number }>,
    studies: ReadonlyArray<{ id: string; title: string; passage: PassageReference; seriesId?: string | null }>,
): Map<string, Array<{ id: string; title: string }>> {
    const out = new Map<string, Array<{ id: string; title: string }>>();
    const sueltos = studies.filter(s => !s.seriesId);
    for (const p of pericopes) {
        const desde = p.chapterStart * 1000 + p.verseStart;
        const hasta = p.chapterEnd * 1000 + p.verseEnd;
        const hallados = sueltos
            .filter(s => s.passage.bookId === p.bookId)
            .filter(s => {
                const sDesde = s.passage.chapterStart * 1000 + (s.passage.verseStart ?? 0);
                const sHasta = s.passage.chapterEnd * 1000 + (s.passage.verseEnd ?? 999);
                return sDesde <= hasta && desde <= sHasta;
            })
            .map(s => ({ id: s.id, title: s.title }));
        if (hallados.length > 0) out.set(p.id, hallados);
    }
    return out;
}
