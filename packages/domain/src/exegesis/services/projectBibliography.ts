import type { BibleBookId } from '../../bible/canon/BibleCanon';
import type { LibraryResource } from '../../entities/LibraryResource';
import type { SourceType } from '../entities/SourceType';
import { commentaryBookCoverage, isCommentaryType } from './commentaryCoverage';

/**
 * La bibliografía del proyecto: el estado del arte (ADR-046, etapa 2,
 * `docs/FASE_ESTADO_DEL_ARTE_2026-10.md`).
 *
 * Se prepara UNA vez y sirve a todos los estudios del proyecto. Cada
 * entrada es una ficha bibliográfica en el sentido de Eco (*Cómo se hace
 * una tesis*, III.2.2): existe aunque el libro todavía no esté en la
 * biblioteca —entonces está «por conseguir»—, y lleva la evaluación y la
 * anotación que piden Vyhmeister (cap. 15 y 13) y Booth (cap. 6).
 *
 * Tres cosas distintas que no se mezclan:
 *   - la DECISIÓN (candidata, aprobada, descartada);
 *   - la DISPONIBILIDAD (en la biblioteca o por conseguir), que se deduce de
 *     `resourceId` y no se guarda;
 *   - la LECTURA (`read`): la ficha de lectura de Eco, distinta de la ficha
 *     bibliográfica.
 */

/** Cuánto pesa la obra en el proyecto. */
export type BibliographyWeight = 'required' | 'recommended' | 'complementary';

/** Qué se decidió sobre la obra. Descartar exige una razón. */
export type BibliographyDecision = 'candidate' | 'approved' | 'discarded';

/** De dónde salió la candidata. Una ficha puede tener varios orígenes. */
export type BibliographyOrigin = 'syllabus' | 'catalog' | 'library' | 'studies' | 'manual' | 'legacy';

/** Nivel de la obra, como lo rotulan las guías de comentarios (Glynn, Longman). */
export type BibliographyLevel = 'technical' | 'semi-technical' | 'expository' | 'popular';

/**
 * Tradición, con los rótulos de Glynn (*Commentary and Reference Survey*)
 * más los que faltan en el ámbito del producto. Sirve para EQUILIBRAR: el
 * sistema solo avisa cuando todo cae en una (Fee 4.1: oír al menos tres
 * interpretaciones). Nunca filtra.
 */
export type BibliographyTradition =
    | 'evangelical'
    | 'evangelical-critical'
    | 'conservative-moderate'
    | 'liberal-critical'
    | 'catholic'
    | 'jewish'
    | 'other';

/**
 * Las preguntas de evaluación (Vyhmeister, cap. 15, más dos propias). Todo
 * opcional: `null`/ausente es «no se sabe», que no es lo mismo que «no».
 */
export interface BibliographyEvaluation {
    /** Si comenta el libro bíblico del proyecto. */
    coversBook?: boolean | null;
    /** Si la edición tiene páginas impresas citables. */
    printedPages?: boolean | null;
    /** Año de la EDICIÓN, no de la impresión (Vyhmeister). */
    editionYear?: number | null;
    level?: BibliographyLevel | null;
    tradition?: BibliographyTradition | null;
    language?: string | null;
    /** Si trae notas y bibliografía: el aparato de una obra académica. */
    hasNotes?: boolean | null;
    /** Fuente primaria (texto, fuente antigua) o secundaria. */
    primary?: boolean | null;
    notes?: string | null;
}

/** Para qué sirve la obra (Booth, cap. 6; Eco IV.2.3). */
export interface BibliographyAnnotation {
    /** A qué preguntas, tareas o temas sirve, en texto. */
    serves?: string | null;
    /** Los tipos de trabajo del proyecto a los que sirve. */
    workTypeIds?: string[];
    /** Qué páginas o capítulos interesan. */
    pages?: string | null;
    /** Qué posición sostiene. */
    position?: string | null;
}

export interface ProjectBibliographyEntry {
    id: string;
    /** Cómo se llama la obra. Para una ficha que viene de la biblioteca, su título. */
    title: string;
    author?: string | null;
    year?: number | null;
    publisher?: string | null;
    series?: string | null;
    edition?: string | null;
    /** El libro en la biblioteca, propia o compartida. Sin él, está por conseguir. */
    resourceId?: string | null;
    /**
     * La clasificación de la obra, UNA vez para todo el proyecto. En los TP
     * de Santiago el mismo NICNT quedó como crítico en unos y expositivo en
     * otros (medido, 2026-10-23); clasificarlo aquí lo arregla.
     */
    sourceType?: SourceType | null;
    weight: BibliographyWeight;
    decision: BibliographyDecision;
    /** Por qué se aprobó o se descartó. Obligatoria al descartar. */
    reason?: string | null;
    origins: BibliographyOrigin[];
    evaluation?: BibliographyEvaluation;
    annotation?: BibliographyAnnotation;
    /** Si ya se leyó: la ficha de lectura de Eco. */
    read?: boolean;
    /** Cuándo se decidió, en ISO: dentro de un arreglo, una fecha no vuelve como `Date`. */
    decidedAt?: string | null;
}

/**
 * Los criterios del proyecto. Vyhmeister (cap. 7): si la bibliografía es
 * selectiva, «se deben explicar los criterios empleados para incluir u
 * omitir». Los mínimos por tipo NO van aquí: los dan las rúbricas de los
 * tipos de trabajo.
 */
export interface ProjectBibliographyCriteria {
    /** Lo que exige el curso, o la pregunta y el alcance de una investigación. */
    requirements?: string | null;
    prohibitions?: string | null;
    inclusion?: string | null;
    exclusion?: string | null;
    /**
     * «No repetir fuentes entre entregas». Es una regla de un curso, no de
     * método (decisión del fundador, 2026-10-23): se activa por proyecto.
     */
    noRepeatSources?: boolean;
    /** Los libros bíblicos del proyecto, para buscar candidatas y evaluar cobertura. */
    bibleBooks?: BibleBookId[];
}

/** Tope de fichas: el proyecto vive en un solo documento. */
export const MAX_BIBLIOGRAPHY_ENTRIES = 200;
const MAX_TEXTO = 1000;

const PESO: Record<BibliographyWeight, number> = { required: 3, recommended: 2, complementary: 1 };

/** Un id nuevo para una ficha; único dentro del proyecto basta. */
export function newBibliographyEntryId(): string {
    return `bib_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Si la obra está en la biblioteca o hay que conseguirla. */
export function bibliographyAvailability(entry: Pick<ProjectBibliographyEntry, 'resourceId'>): 'in-library' | 'to-acquire' {
    return entry.resourceId ? 'in-library' : 'to-acquire';
}

/**
 * Las fichas del proyecto. Un proyecto anterior a la etapa 2 solo tiene
 * `sourceIds`: se leen como fichas aprobadas, para no perder lo adjuntado.
 * `lookup` da el título y el autor de cada libro; sin él, la ficha va sin
 * título y la pantalla lo completa.
 */
export function projectBibliography(
    project: { bibliography?: ProjectBibliographyEntry[] | null; sourceIds?: string[] | null } | null | undefined,
    lookup?: (resourceId: string) => { title: string; author?: string | null } | null | undefined,
): ProjectBibliographyEntry[] {
    if (!project) return [];
    if (Array.isArray(project.bibliography)) return project.bibliography.filter(e => !!e?.id);
    return [...new Set(project.sourceIds ?? [])].filter(Boolean).map(id => {
        const r = lookup?.(id);
        return {
            id: `legacy_${id}`,
            title: r?.title ?? '',
            author: r?.author ?? null,
            resourceId: id,
            weight: 'recommended',
            decision: 'approved',
            origins: ['legacy'],
        } satisfies ProjectBibliographyEntry;
    });
}

/**
 * Los `sourceIds` que acotan las conversaciones con Tutores: las fichas
 * aprobadas que están en la biblioteca. Se guardan junto con la
 * bibliografía para que las conversaciones sigan acotadas como antes.
 */
export function sourceIdsFromBibliography(entries: ReadonlyArray<ProjectBibliographyEntry>): string[] {
    return [...new Set(entries.filter(e => e.decision === 'approved' && e.resourceId).map(e => e.resourceId!))];
}

/** Lo que impide guardar una ficha, o `null`. */
export function bibliographyEntryError(entry: ProjectBibliographyEntry): 'title' | 'reason' | null {
    if (!entry.title.trim() && !entry.resourceId) return 'title';
    if (entry.decision === 'discarded' && !entry.reason?.trim()) return 'reason';
    return null;
}

/** Una candidata que llega de un origen, antes de juntarla con las fichas. */
export interface BibliographyCandidate {
    title: string;
    author?: string | null;
    series?: string | null;
    year?: number | null;
    publisher?: string | null;
    resourceId?: string | null;
    sourceType?: SourceType | null;
    weight: BibliographyWeight;
    origin: BibliographyOrigin;
    /** Lo que el origen dice de ella: la nota del sílabo, la razón del catálogo. */
    note?: string | null;
}

/**
 * Si dos fichas son la misma obra. Por el libro de la biblioteca cuando
 * las dos lo tienen. Si no, por el título (al menos el 70 % de las palabras
 * largas en común) y el apellido. Es conservador: mejor dos fichas de más
 * que fundir dos obras distintas, como «James» de Moo y «James» de McKnight.
 *
 * No reusa el emparejador de las recomendaciones porque ese exige apellidos
 * de cuatro letras o más, y «Moo» (Pillar y BECNT de Santiago) nunca
 * emparejaba.
 */
export function sameWork(
    a: Pick<ProjectBibliographyEntry, 'title' | 'author' | 'resourceId'>,
    b: Pick<ProjectBibliographyEntry, 'title' | 'author' | 'resourceId'>,
): boolean {
    if (a.resourceId && b.resourceId) return a.resourceId === b.resourceId;
    const ta = palabras(a.title, 4);
    const tb = palabras(b.title, 4);
    if (ta.length === 0 || tb.length === 0) return false;
    const comunes = ta.filter(t => tb.includes(t)).length;
    if (comunes / Math.min(ta.length, tb.length) < 0.7) return false;
    // Con un solo título corto («James») el autor es lo único que distingue.
    if (!a.author?.trim() || !b.author?.trim()) return Math.min(ta.length, tb.length) >= 2;
    const aa = palabras(a.author, 3);
    return palabras(b.author, 3).some(t => aa.includes(t));
}

function palabras(s: string, min: number): string[] {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t.length >= min);
}

/**
 * Junta las candidatas con las fichas que ya hay (Eco III.2.2: cruzar
 * bibliografías). Lo que ya está se completa y no se pisa: su decisión, su
 * evaluación y su anotación quedan; gana el peso mayor; los orígenes se
 * suman, y una obra que aparece en varios orígenes es la que «citan todos».
 * Una ficha descartada no vuelve a ser candidata por aparecer otra vez.
 */
export function mergeBibliographyCandidates(
    existing: ReadonlyArray<ProjectBibliographyEntry>,
    candidates: ReadonlyArray<BibliographyCandidate>,
    newId: () => string,
): ProjectBibliographyEntry[] {
    const out = existing.map(e => ({ ...e, origins: [...e.origins] }));
    for (const c of candidates) {
        if (!c.title.trim() && !c.resourceId) continue;
        const igual = out.find(e => sameWork(e, c));
        if (igual) {
            if (!igual.origins.includes(c.origin)) igual.origins.push(c.origin);
            if (PESO[c.weight] > PESO[igual.weight]) igual.weight = c.weight;
            if (!igual.resourceId && c.resourceId) igual.resourceId = c.resourceId;
            if (!igual.sourceType && c.sourceType) igual.sourceType = c.sourceType;
            if (!igual.author && c.author) igual.author = c.author;
            if (!igual.title.trim() && c.title.trim()) igual.title = c.title.trim();
            continue;
        }
        if (out.length >= MAX_BIBLIOGRAPHY_ENTRIES) break;
        out.push({
            id: newId(),
            title: c.title.trim(),
            author: c.author ?? null,
            series: c.series ?? null,
            year: c.year ?? null,
            publisher: c.publisher ?? null,
            resourceId: c.resourceId ?? null,
            sourceType: c.sourceType ?? null,
            weight: c.weight,
            decision: 'candidate',
            origins: [c.origin],
            ...(c.note?.trim() ? { annotation: { serves: c.note.trim().slice(0, MAX_TEXTO) } } : {}),
        });
    }
    return out;
}

/** Cuántos orígenes la traen: lo que «citan todos» sube de rango (Eco). */
export function candidateRank(entry: ProjectBibliographyEntry): number {
    return PESO[entry.weight] * 10 + entry.origins.length;
}

/** Sin `undefined` (Firestore los rechaza también anidados), con tope y textos recortados. */
function limpio<T extends object>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        if (typeof v === 'string') { out[k] = v.trim() ? v.trim().slice(0, MAX_TEXTO) : null; continue; }
        if (v && typeof v === 'object' && !Array.isArray(v)) { out[k] = limpio(v as object); continue; }
        out[k] = v;
    }
    return out as T;
}

/** Las fichas listas para guardar: ids únicos, con título o libro, sin `undefined`, con tope. */
export function cleanProjectBibliography(entries: ReadonlyArray<ProjectBibliographyEntry>): ProjectBibliographyEntry[] {
    const vistos = new Set<string>();
    const out: ProjectBibliographyEntry[] = [];
    for (const e of entries) {
        if (!e.id || vistos.has(e.id) || (!e.title?.trim() && !e.resourceId)) continue;
        vistos.add(e.id);
        out.push({ ...limpio(e), title: e.title?.trim() ?? '', origins: [...new Set(e.origins ?? [])] });
        if (out.length >= MAX_BIBLIOGRAPHY_ENTRIES) break;
    }
    return out;
}

export function cleanBibliographyCriteria(criteria: ProjectBibliographyCriteria): ProjectBibliographyCriteria {
    return limpio(criteria);
}

/** Un aviso sobre la bibliografía. Informan; no bloquean. */
export type BibliographyWarning =
    | { kind: 'missing-type'; sourceType: SourceType; minimum: number }
    | { kind: 'single-tradition'; tradition: BibliographyTradition }
    | { kind: 'required-to-acquire'; entryId: string }
    | { kind: 'commentary-other-book'; entryId: string };

/**
 * Los avisos de la bibliografía aprobada:
 *   - un tipo que piden las rúbricas sin ninguna obra aprobada;
 *   - toda la bibliografía rotulada cae en una sola tradición (Fee 4.1);
 *   - una obligatoria por conseguir;
 *   - un comentario que no comenta ninguno de los libros del proyecto.
 */
export function bibliographyWarnings(
    entries: ReadonlyArray<ProjectBibliographyEntry>,
    requirements: ReadonlyArray<{ sourceType: SourceType; minimum: number }>,
    resourceOf: (id: string) => Pick<LibraryResource, 'coversBibleBooks' | 'scope'> | null | undefined,
    bibleBooks: ReadonlyArray<BibleBookId>,
): BibliographyWarning[] {
    const aprobadas = entries.filter(e => e.decision === 'approved');
    const out: BibliographyWarning[] = [];
    const minimos = new Map<SourceType, number>();
    for (const r of requirements) if (r.minimum > 0) minimos.set(r.sourceType, Math.max(minimos.get(r.sourceType) ?? 0, r.minimum));
    for (const [sourceType, minimum] of minimos) {
        if (!aprobadas.some(e => e.sourceType === sourceType)) out.push({ kind: 'missing-type', sourceType, minimum });
    }
    const tradiciones = new Set(aprobadas.map(e => e.evaluation?.tradition).filter((t): t is BibliographyTradition => !!t));
    const rotuladas = aprobadas.filter(e => e.evaluation?.tradition).length;
    if (tradiciones.size === 1 && rotuladas >= 3) out.push({ kind: 'single-tradition', tradition: [...tradiciones][0]! });
    for (const e of aprobadas) {
        if (e.weight === 'required' && !e.resourceId) out.push({ kind: 'required-to-acquire', entryId: e.id });
        if (e.sourceType && isCommentaryType(e.sourceType) && bibleBooks.length > 0) {
            const otro = e.evaluation?.coversBook === false
                || (e.resourceId && bibleBooks.every(b => commentaryBookCoverage(resourceOf(e.resourceId!), b) === 'other-books'));
            if (otro) out.push({ kind: 'commentary-other-book', entryId: e.id });
        }
    }
    return out;
}

/**
 * Lo que un estudio nuevo del proyecto hereda: las aprobadas que están en
 * la biblioteca, con la clasificación del proyecto. Un comentario que no
 * comenta el libro del estudio no se ofrece.
 */
export function inheritableBibliography(
    entries: ReadonlyArray<ProjectBibliographyEntry>,
    bookId: BibleBookId,
    resourceOf: (id: string) => Pick<LibraryResource, 'coversBibleBooks' | 'scope'> | null | undefined,
): ProjectBibliographyEntry[] {
    return entries.filter(e => {
        if (e.decision !== 'approved' || !e.resourceId) return false;
        if (!e.sourceType || !isCommentaryType(e.sourceType)) return true;
        if (e.evaluation?.coversBook === false) return false;
        return commentaryBookCoverage(resourceOf(e.resourceId), bookId) !== 'other-books';
    });
}

/**
 * El selector de fuentes del proyecto (marcar libros de la biblioteca),
 * aplicado a la bibliografía: lo marcado queda aprobado —si no tenía ficha,
 * nace una—, y lo que se desmarcó vuelve a candidata, con su evaluación.
 * Así el selector y el estado del arte no se contradicen.
 */
export function applyLibrarySelection(
    entries: ReadonlyArray<ProjectBibliographyEntry>,
    selectedIds: ReadonlyArray<string>,
    lookup: (resourceId: string) => { title: string; author?: string | null; exegeticalType?: SourceType | null } | null | undefined,
    newId: () => string,
    now: Date,
): ProjectBibliographyEntry[] {
    const marcados = new Set(selectedIds);
    const cuando = now.toISOString();
    const out = entries.map(e => {
        if (!e.resourceId) return e;
        if (marcados.has(e.resourceId) && e.decision !== 'approved') return { ...e, decision: 'approved' as const, decidedAt: cuando };
        if (!marcados.has(e.resourceId) && e.decision === 'approved') return { ...e, decision: 'candidate' as const, decidedAt: cuando };
        return e;
    });
    for (const id of marcados) {
        if (out.some(e => e.resourceId === id)) continue;
        const r = lookup(id);
        out.push({
            id: newId(), title: r?.title ?? '', author: r?.author ?? null, resourceId: id,
            sourceType: r?.exegeticalType ?? null, weight: 'recommended', decision: 'approved',
            origins: ['library'], decidedAt: cuando,
        });
    }
    return out;
}

/**
 * Lo que la biblioteca ya sabe de la obra, para precompletar la evaluación:
 * si comenta los libros del proyecto y si tiene páginas impresas. Solo lo
 * que no se respondió: lo que el estudiante contestó no se pisa.
 */
export function evaluationFromLibrary(
    entry: Pick<ProjectBibliographyEntry, 'evaluation' | 'sourceType'>,
    resource: (Pick<LibraryResource, 'coversBibleBooks' | 'scope'> & { pageNumbering?: unknown }) | null | undefined,
    bibleBooks: ReadonlyArray<BibleBookId>,
): BibliographyEvaluation {
    const ev = { ...(entry.evaluation ?? {}) };
    if (!resource) return ev;
    if ((ev.coversBook === undefined || ev.coversBook === null) && entry.sourceType && isCommentaryType(entry.sourceType) && bibleBooks.length > 0) {
        const cobertura = bibleBooks.map(b => commentaryBookCoverage(resource, b));
        if (cobertura.includes('covers') && (resource.coversBibleBooks?.length || resource.scope)) ev.coversBook = true;
        else if (cobertura.every(c => c === 'other-books')) ev.coversBook = false;
    }
    if ((ev.printedPages === undefined || ev.printedPages === null) && resource.pageNumbering) ev.printedPages = true;
    return ev;
}
