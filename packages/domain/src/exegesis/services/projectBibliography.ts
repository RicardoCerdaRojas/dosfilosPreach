import { getBookById, type BibleBookId } from '../../bible/canon/BibleCanon';
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

/**
 * De dónde salió la candidata. Una ficha puede tener varios orígenes.
 * `library` es la candidata que el estado del arte trae de la biblioteca;
 * `selector`, lo aprobado con el selector de fuentes del proyecto (marcar
 * libros sin pasar por el estado del arte). El escritorio los distingue:
 * lo del selector cuenta como «agregadas a mano».
 */
export type BibliographyOrigin = 'syllabus' | 'catalog' | 'library' | 'selector' | 'studies' | 'manual' | 'legacy' | 'import' | 'citation';

/**
 * Enfoque o método de la obra (etapa 2b): categorías académicas neutrales,
 * junto a la tradición confesional. «Puntos de vista opuestos» (rúbrica de
 * NT785) se mide con esto, no con la tradición.
 */
export type BibliographyApproach =
    | 'historical-grammatical'
    | 'historical-critical'
    | 'socio-rhetorical'
    | 'discourse-linguistic'
    | 'literary-narrative'
    | 'canonical-theological'
    | 'other';

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
    approach?: BibliographyApproach | null;
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
    /**
     * La reseña: la ficha de lectura de Eco, con la forma que pide NT785
     * (idea principal, contribución, nota de 1 a 10). Las páginas de una obra
     * cuentan para un requisito de cantidad cuando está leída y reseñada.
     */
    review?: { mainIdea?: string | null; contribution?: string | null; rating?: number | null } | null;
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
    /** Páginas de la obra (un artículo: 210–215 son 6). Para los requisitos de cantidad. */
    pageCount?: number | null;
    /** Identificadores para encontrarla y verificarla. */
    identifiers?: { doi?: string | null; isbn?: string | null } | null;
    /** Con `origin: 'citation'`: la obra en cuya bibliografía apareció. */
    citedBy?: string | null;
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
    /** Los requisitos medibles (etapa 2b), del sílabo, del nivel o escritos a mano. */
    requirementItems?: ProjectRequirement[];
}

/** Qué mide un requisito. */
export type RequirementKind = 'minimum-type' | 'quantity' | 'date-range' | 'perspectives' | 'variety' | 'rule' | 'other';

/**
 * Un requisito medible del estado del arte. Viene del sílabo, de la plantilla
 * del nivel (un punto de partida declarado: ningún manual fija cifras), o se
 * escribe a mano. Se mide siempre sobre las fichas APROBADAS.
 */
export interface ProjectRequirement {
    id: string;
    kind: RequirementKind;
    /** Cómo lo dice la fuente: «un mínimo de 100 páginas de artículos académicos». */
    text: string;
    origin: 'syllabus' | 'level' | 'manual';
    /** `minimum-type` y `quantity`: de qué tipo. */
    sourceType?: SourceType | null;
    /** `minimum-type`, `quantity`, `perspectives`: cuánto. */
    minimum?: number | null;
    /** `quantity`: obras o páginas. */
    unit?: 'works' | 'pages' | null;
    /** `date-range`: al menos una anterior a `before` y `recentMinimum` desde `after`. */
    before?: number | null;
    after?: number | null;
    recentMinimum?: number | null;
    /** `variety`: los tipos que tienen que estar. */
    types?: SourceType[] | null;
    /** `other`: lo marca quien estudia. */
    done?: boolean;
    /** A qué tipos de trabajo aplica; vacío o ausente, a todos. */
    workTypeIds?: string[] | null;
    /**
     * Las cifras que la fuente no fijaba y se SUPUSIERON (p. ej. «antiguas y
     * actuales» sin años). Van aparte del texto, que es el de la fuente, para
     * que la pantalla las declare en su idioma y se puedan corregir.
     */
    assumed?: RequirementAssumption[] | null;
}

export type RequirementAssumption = 'before' | 'after' | 'recentMinimum' | 'minimum';

/** Una búsqueda o importación registrada: el comienzo de la reproducibilidad. */
export interface BibliographySearchLogEntry {
    id: string;
    /** ISO. */
    at: string;
    /** `database`: una búsqueda que el usuario hizo en una base (IxTheo, ATLA…) y anotó (etapa 2c). */
    kind: 'syllabus' | 'bibliography' | 'file' | 'catalog' | 'library' | 'studies' | 'database';
    /** De dónde: el nombre del archivo, la base o la consulta. */
    label: string;
    found: number;
    added: number;
    /** `database`: en qué base y con qué consulta, para poder repetirla. */
    database?: string | null;
    query?: string | null;
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
    lookup?: (resourceId: string) => { title: string; author?: string | null; exegeticalType?: SourceType | null } | null | undefined,
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
            // La clasificación del libro: sin ella, la herencia no sabía que
            // un comentario de Romanos no sirve a un estudio de Santiago.
            sourceType: r?.exegeticalType ?? null,
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
    pageCount?: number | null;
    identifiers?: { doi?: string | null; isbn?: string | null } | null;
    /** Con `origin: 'citation'`: en qué obra apareció. */
    citedBy?: string | null;
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
    // Sin autor en alguno de los dos, el título tiene que ser el mismo: una
    // serie con nombre largo («Comentario Bíblico Mundo Hispano: Santiago» y
    // «…: Romanos») comparte casi todas sus palabras y son obras distintas.
    if (!a.author?.trim() || !b.author?.trim()) {
        return Math.min(ta.length, tb.length) >= 2 && ta.length === tb.length && ta.every(t => tb.includes(t));
    }
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
        // Primero el mismo libro de la biblioteca; si no, la misma obra.
        const igual = (c.resourceId ? out.find(e => e.resourceId === c.resourceId) : undefined) ?? out.find(e => sameWork(e, c));
        if (igual) {
            if (!igual.origins.includes(c.origin)) igual.origins.push(c.origin);
            if (PESO[c.weight] > PESO[igual.weight]) igual.weight = c.weight;
            // Nunca un libro que ya tiene otra ficha: serían dos fichas del mismo libro.
            if (!igual.resourceId && c.resourceId && !out.some(e => e.resourceId === c.resourceId)) igual.resourceId = c.resourceId;
            if (!igual.sourceType && c.sourceType) igual.sourceType = c.sourceType;
            if (!igual.author && c.author) igual.author = c.author;
            if (!igual.title.trim() && c.title.trim()) igual.title = c.title.trim();
            // Los datos que trae un RIS o un sílabo completan lo que faltaba.
            if (!igual.pageCount && c.pageCount) igual.pageCount = c.pageCount;
            if (!igual.year && c.year) igual.year = c.year;
            if (!igual.publisher && c.publisher) igual.publisher = c.publisher;
            if (c.identifiers?.doi || c.identifiers?.isbn) {
                igual.identifiers = { doi: igual.identifiers?.doi ?? c.identifiers.doi ?? null, isbn: igual.identifiers?.isbn ?? c.identifiers.isbn ?? null };
            }
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
            ...(c.pageCount ? { pageCount: c.pageCount } : {}),
            ...(c.identifiers?.doi || c.identifiers?.isbn ? { identifiers: { doi: c.identifiers.doi ?? null, isbn: c.identifiers.isbn ?? null } } : {}),
            ...(c.citedBy ? { citedBy: c.citedBy } : {}),
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
    const { requirementItems, bibleBooks, ...resto } = criteria;
    // Los libros del proyecto se eligen a mano (un proyecto sin estudios no
    // tiene de dónde sacarlos): solo libros del canon y sin repetir.
    const libros = bibleBooks ? [...new Set(bibleBooks.filter(b => !!getBookById(b)))] : undefined;
    return {
        ...limpio(resto),
        ...(libros ? { bibleBooks: libros } : {}),
        ...(requirementItems ? { requirementItems: cleanRequirementItems(requirementItems) } : {}),
    };
}

/** La clasificación de la ficha, o la del libro en la biblioteca si no la tiene. */
function tipoDe(
    e: ProjectBibliographyEntry,
    resourceOf: (id: string) => { exegeticalType?: SourceType | null } | null | undefined,
): SourceType | null {
    return e.sourceType ?? (e.resourceId ? resourceOf(e.resourceId)?.exegeticalType ?? null : null);
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
    resourceOf: (id: string) => (Pick<LibraryResource, 'coversBibleBooks' | 'scope'> & { exegeticalType?: SourceType | null }) | null | undefined,
    bibleBooks: ReadonlyArray<BibleBookId>,
): BibliographyWarning[] {
    const aprobadas = entries.filter(e => e.decision === 'approved');
    const out: BibliographyWarning[] = [];
    const minimos = new Map<SourceType, number>();
    for (const r of requirements) if (r.minimum > 0) minimos.set(r.sourceType, Math.max(minimos.get(r.sourceType) ?? 0, r.minimum));
    for (const [sourceType, minimum] of minimos) {
        // Contra el mínimo, no contra «hay al menos una»: «crítico ≥ 2» con un
        // solo crítico aprobado no estaba cubierto (prueba del fundador, NT785).
        if (aprobadas.filter(e => tipoDe(e, resourceOf) === sourceType).length < minimum) out.push({ kind: 'missing-type', sourceType, minimum });
    }
    const tradiciones = new Set(aprobadas.map(e => e.evaluation?.tradition).filter((t): t is BibliographyTradition => !!t));
    const rotuladas = aprobadas.filter(e => e.evaluation?.tradition).length;
    if (tradiciones.size === 1 && rotuladas >= 3) out.push({ kind: 'single-tradition', tradition: [...tradiciones][0]! });
    for (const e of aprobadas) {
        if (e.weight === 'required' && !e.resourceId) out.push({ kind: 'required-to-acquire', entryId: e.id });
        const tipo = tipoDe(e, resourceOf);
        if (tipo && isCommentaryType(tipo) && bibleBooks.length > 0) {
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
    resourceOf: (id: string) => (Pick<LibraryResource, 'coversBibleBooks' | 'scope'> & { exegeticalType?: SourceType | null }) | null | undefined,
): ProjectBibliographyEntry[] {
    return entries.filter(e => {
        if (e.decision !== 'approved' || !e.resourceId) return false;
        const tipo = tipoDe(e, resourceOf);
        if (!tipo || !isCommentaryType(tipo)) return true;
        if (e.evaluation?.coversBook === false) return false;
        return commentaryBookCoverage(resourceOf(e.resourceId), bookId) !== 'other-books';
    });
}

/**
 * El selector de fuentes del proyecto (marcar libros de la biblioteca),
 * aplicado a la bibliografía: lo marcado queda aprobado —si no tenía ficha,
 * nace una—, y lo que se desmarcó vuelve a candidata, con su evaluación.
 * Así el selector y el estado del arte no se contradicen.
 *
 * Lo que el selector aprueba lleva el origen `selector` (también una
 * candidata que ya estaba): así el escritorio sabe que se aprobó sin pasar
 * por el estado del arte. Desmarcar no lo quita: el origen dice de dónde
 * vino, no qué se decidió.
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
    const conSelector = (origins: ReadonlyArray<BibliographyOrigin>): BibliographyOrigin[] =>
        origins.includes('selector') ? [...origins] : [...origins, 'selector'];
    const out = entries.map(e => {
        if (!e.resourceId) return e;
        if (marcados.has(e.resourceId) && e.decision !== 'approved') return { ...e, decision: 'approved' as const, decidedAt: cuando, origins: conSelector(e.origins) };
        if (!marcados.has(e.resourceId) && e.decision === 'approved') return { ...e, decision: 'candidate' as const, decidedAt: cuando };
        return e;
    });
    for (const id of marcados) {
        if (out.some(e => e.resourceId === id)) continue;
        const r = lookup(id);
        // Una obra por conseguir que es este libro se liga, en vez de duplicarse.
        const porConseguir = r ? out.findIndex(e => !e.resourceId && e.decision !== 'discarded' && sameWork(e, { title: r.title, author: r.author ?? null, resourceId: null })) : -1;
        if (porConseguir >= 0) {
            out[porConseguir] = { ...out[porConseguir]!, resourceId: id, decision: 'approved', decidedAt: cuando, origins: conSelector(out[porConseguir]!.origins) };
            continue;
        }
        out.push({
            id: newId(), title: r?.title ?? '', author: r?.author ?? null, resourceId: id,
            sourceType: r?.exegeticalType ?? null, weight: 'recommended', decision: 'approved',
            origins: ['selector'], decidedAt: cuando,
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

/**
 * Si «no repetir fuentes entre entregas» rige para un trabajo. Es una regla
 * de un curso, no de método (decisión del fundador, 2026-10-23):
 *   - sin proyecto, rige como hasta ahora;
 *   - en un proyecto, lo dicen sus criterios; sin decidir, rige en un curso
 *     y no en los demás tipos.
 */
export function noRepeatApplies(
    project: { type?: string | null; bibliographyCriteria?: ProjectBibliographyCriteria | null } | null | undefined,
): boolean {
    if (!project) return true;
    return project.bibliographyCriteria?.noRepeatSources ?? project.type === 'course';
}

/**
 * Las fichas heredadas, como fuentes iniciales del estudio: documento
 * entero y sin fragmentos (se extraen después contra el pasaje del
 * estudio), con la clasificación del proyecto. Una ficha sin clasificar
 * toma el tipo que tiene el libro en la biblioteca.
 */
export function initialSourcesFromBibliography(
    entries: ReadonlyArray<ProjectBibliographyEntry>,
    typeOf: (resourceId: string) => SourceType | null | undefined,
    titleOf: (resourceId: string) => string | null | undefined = () => null,
): import('../use-cases/dtos').AddProjectSourceInput[] {
    return entries.filter(e => e.resourceId).map(e => ({
        corpusId: e.resourceId!,
        sourceLibraryResourceId: e.resourceId!,
        sourceType: e.sourceType ?? typeOf(e.resourceId!) ?? 'other',
        // Una ficha de las fuentes de antes no trae título: el del libro.
        displayLabel: e.title.trim() || titleOf(e.resourceId!)?.trim() || e.resourceId!,
        mode: 'full-document' as const,
    }));
}

/** Una fila de la cobertura: lo que piden las rúbricas de un tipo de fuente y lo que hay. */
export interface BibliographyCoverageRow {
    sourceType: SourceType;
    /** El mayor mínimo entre las rúbricas que lo piden. */
    minimum: number;
    /** Qué tipos de trabajo lo piden, con su mínimo. */
    requiredBy: ReadonlyArray<{ workType: string; minimum: number }>;
    approved: number;
    /** Candidatas de ese tipo (sin decidir); de ellas, las que ya están en la biblioteca. */
    candidates: number;
    candidatesInLibrary: number;
}

export interface BibliographyCoverage {
    rows: BibliographyCoverageRow[];
    /** Aprobadas sin clasificar: no cuentan para ningún tipo hasta que se clasifiquen. */
    unclassifiedApproved: number;
    unclassifiedCandidates: number;
}

/**
 * La cobertura de la bibliografía contra las rúbricas de los tipos de
 * trabajo (prueba del fundador en NT785): una fila por tipo que alguna pide,
 * con qué tipo de trabajo lo pide, cuántas obras hay aprobadas y cuántas
 * candidatas lo podrían cubrir. Las filas sin cubrir van primero.
 */
export function bibliographyCoverage(
    entries: ReadonlyArray<ProjectBibliographyEntry>,
    requirements: ReadonlyArray<{ sourceType: SourceType; minimum: number; workType: string }>,
    resourceOf: (id: string) => { exegeticalType?: SourceType | null } | null | undefined,
): BibliographyCoverage {
    const porTipo = new Map<SourceType, { minimum: number; requiredBy: Array<{ workType: string; minimum: number }> }>();
    for (const r of requirements) {
        if (r.minimum <= 0) continue;
        const x = porTipo.get(r.sourceType) ?? { minimum: 0, requiredBy: [] };
        x.minimum = Math.max(x.minimum, r.minimum);
        if (!x.requiredBy.some(w => w.workType === r.workType)) x.requiredBy.push({ workType: r.workType, minimum: r.minimum });
        porTipo.set(r.sourceType, x);
    }
    const vivas = entries.filter(e => e.decision !== 'discarded');
    const rows: BibliographyCoverageRow[] = [...porTipo].map(([sourceType, x]) => {
        const delTipo = vivas.filter(e => tipoDe(e, resourceOf) === sourceType);
        const candidatas = delTipo.filter(e => e.decision === 'candidate');
        return {
            sourceType, minimum: x.minimum, requiredBy: x.requiredBy,
            approved: delTipo.filter(e => e.decision === 'approved').length,
            candidates: candidatas.length,
            candidatesInLibrary: candidatas.filter(e => e.resourceId).length,
        };
    });
    rows.sort((a, b) => Number(a.approved >= a.minimum) - Number(b.approved >= b.minimum));
    return {
        rows,
        unclassifiedApproved: vivas.filter(e => e.decision === 'approved' && !tipoDe(e, resourceOf)).length,
        unclassifiedCandidates: vivas.filter(e => e.decision === 'candidate' && !tipoDe(e, resourceOf)).length,
    };
}

/** La clasificación efectiva de una ficha: la suya, o la del libro en la biblioteca. */
export function bibliographyEntryType(
    entry: ProjectBibliographyEntry,
    resourceOf: (id: string) => { exegeticalType?: SourceType | null } | null | undefined,
): SourceType | null {
    return tipoDe(entry, resourceOf);
}

/**
 * Cómo clasificaste un libro en tus trabajos, de más a menos usada. Sirve
 * para proponer la clasificación de una ficha que no la tiene: en los TP
 * de Santiago el tipo lo ponía cada trabajo, y la biblioteca quedó sin él.
 */
export function classificationHistory(
    papers: ReadonlyArray<{ sources?: ReadonlyArray<{ sourceLibraryResourceId?: string | null; corpusId?: string | null; sourceType: SourceType }> | null }>,
    resourceId: string,
): Array<readonly [SourceType, number]> {
    const cuenta = new Map<SourceType, number>();
    for (const p of papers) {
        const tipos = new Set<SourceType>();
        for (const f of p.sources ?? []) {
            if ((f.sourceLibraryResourceId ?? f.corpusId) === resourceId && f.sourceType !== 'other' && f.sourceType !== 'style-template-paper') tipos.add(f.sourceType);
        }
        for (const t of tipos) cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
    }
    return [...cuenta].sort((a, b) => b[1] - a[1]);
}

/** El resultado de medir un requisito. */
export interface RequirementMeasure {
    /** `incomplete`: al requisito le falta la cifra que lo hace medible; no se da por cumplido. */
    status: 'met' | 'unmet' | 'manual' | 'incomplete';
    /** Lo que hay y lo que se pide, en la unidad del requisito. */
    value: number;
    target: number;
    /** Fichas que no se pueden medir por falta de un dato (año, páginas, enfoque, reseña). */
    unmeasurable: string[];
}

/**
 * Mide un requisito sobre las fichas aprobadas. Lo que no se puede medir se
 * dice (`unmeasurable`): una obra sin año no cuenta ni como antigua ni como
 * actual, y la pantalla lo muestra en vez de suponerlo.
 */
export function measureRequirement(
    req: ProjectRequirement,
    entries: ReadonlyArray<ProjectBibliographyEntry>,
    resourceOf: (id: string) => { exegeticalType?: SourceType | null } | null | undefined,
): RequirementMeasure {
    const aprobadas = entries.filter(e => e.decision === 'approved');
    const delTipo = (t: SourceType | null | undefined) => aprobadas.filter(e => !t || tipoDe(e, resourceOf) === t);
    const año = (e: ProjectBibliographyEntry) => e.evaluation?.editionYear ?? e.year ?? null;
    const minimo = Math.max(0, req.minimum ?? 0);
    const r = (value: number, target: number, unmeasurable: string[] = []): RequirementMeasure =>
        ({ status: value >= target ? 'met' : 'unmet', value, target, unmeasurable });
    // Sin la cifra, «0 de 0» saldría cumplido: un requisito sin medida no se da por bueno.
    const incompleto = (value: number): RequirementMeasure => ({ status: 'incomplete', value, target: 0, unmeasurable: [] });
    switch (req.kind) {
        case 'minimum-type':
            if (minimo <= 0) return incompleto(delTipo(req.sourceType).length);
            return r(delTipo(req.sourceType).length, minimo);
        case 'quantity': {
            const xs = delTipo(req.sourceType);
            if (minimo <= 0) return incompleto(xs.length);
            if (req.unit !== 'pages') return r(xs.length, minimo);
            // Una página cuenta cuando la obra está reseñada (así lo pide el
            // curso): escribir la idea principal es haberla leído.
            const reseñada = (e: ProjectBibliographyEntry) => !!(e.annotation?.review?.mainIdea?.trim());
            const sinDato = xs.filter(e => !e.pageCount || !reseñada(e)).map(e => e.id);
            return r(xs.filter(e => reseñada(e)).reduce((n, e) => n + (e.pageCount ?? 0), 0), minimo, sinDato);
        }
        case 'date-range': {
            if (!req.before && !req.after) return incompleto(0);
            const sinAño = aprobadas.filter(e => !año(e)).map(e => e.id);
            // Cada corte pide lo suyo; un corte que no está no pide nada (ni suma).
            const antiguasPedidas = req.before ? 1 : 0;
            const pedidas = req.after ? Math.max(0, req.recentMinimum ?? 1) : 0;
            const antiguas = req.before ? aprobadas.filter(e => (año(e) ?? Infinity) < req.before!).length : 0;
            const actuales = req.after ? aprobadas.filter(e => (año(e) ?? -Infinity) >= req.after!).length : 0;
            const cumple = antiguas >= antiguasPedidas && actuales >= pedidas;
            return { status: cumple ? 'met' : 'unmet', value: Math.min(antiguas, antiguasPedidas) + Math.min(actuales, pedidas), target: antiguasPedidas + pedidas, unmeasurable: sinAño };
        }
        case 'perspectives': {
            const enfoques = new Set(aprobadas.map(e => e.evaluation?.approach).filter((x): x is BibliographyApproach => !!x && x !== 'other'));
            const sinEnfoque = aprobadas.filter(e => !e.evaluation?.approach).map(e => e.id);
            // Sin cifra no se mide: la importación la completa (y la declara supuesta).
            if (minimo <= 0) return incompleto(enfoques.size);
            return r(enfoques.size, minimo, sinEnfoque);
        }
        case 'variety': {
            const pedidos = req.types ?? [];
            if (pedidos.length === 0) return incompleto(0);
            const presentes = pedidos.filter(t => aprobadas.some(e => tipoDe(e, resourceOf) === t)).length;
            return r(presentes, pedidos.length);
        }
        case 'rule':
        case 'other':
            return { status: req.done ? 'met' : 'manual', value: req.done ? 1 : 0, target: 1, unmeasurable: [] };
    }
}

/** El nivel de un proyecto sin sílabo: de qué plantilla parte. */
export type RequirementLevel = 'seminary' | 'research' | 'publishable';

/**
 * Requisitos de partida para un proyecto sin sílabo (una investigación). Son
 * un PUNTO DE PARTIDA declarado, no una norma: ningún manual fija cifras
 * (Vyhmeister: «tantos como sean necesarios»). Recogen lo que los manuales
 * piden de forma cualitativa: fuentes primarias, comentarios críticos,
 * artículos recientes, posturas opuestas (Fee 4.1) y obras de varias épocas.
 */
export type RequirementTemplateKey = 'criticalText' | 'criticalCommentaries' | 'articles' | 'lexicon' | 'grammar' | 'perspectives' | 'dateRange' | 'monographs';

const TEXTO_PLANTILLA: Record<RequirementTemplateKey, (v: Record<string, number>) => string> = {
    criticalText: () => 'El texto en lengua original, en edición crítica.',
    criticalCommentaries: () => 'Comentarios críticos sobre el libro.',
    articles: () => 'Artículos académicos de revista.',
    lexicon: () => 'Un léxico técnico.',
    grammar: () => 'Una gramática de referencia.',
    perspectives: () => 'Puntos de vista opuestos: al menos tantos enfoques distintos (Fee 4.1).',
    dateRange: v => `Fuentes antiguas y actuales: una anterior a ${v.before} y ${v.recent} desde ${v.after}.`,
    monographs: () => 'Monografías sobre el tema.',
};

export function requirementTemplate(
    level: RequirementLevel,
    newId: () => string,
    now: Date,
    /** El texto en el idioma de la pantalla; por omisión, en español. */
    textOf: (key: RequirementTemplateKey, values: Record<string, number>) => string = (k, v) => TEXTO_PLANTILLA[k](v),
): ProjectRequirement[] {
    const escala = { seminary: 1, research: 2, publishable: 3 }[level];
    const año = now.getFullYear();
    const base: Array<[RequirementTemplateKey, Omit<ProjectRequirement, 'id' | 'origin' | 'text'>]> = [
        ['criticalText', { kind: 'minimum-type', sourceType: 'biblical-text-edition', minimum: 1 }],
        ['criticalCommentaries', { kind: 'minimum-type', sourceType: 'commentary-critical', minimum: 2 * escala }],
        ['articles', { kind: 'quantity', sourceType: 'journal-article', unit: 'works', minimum: 2 * escala }],
        ['lexicon', { kind: 'minimum-type', sourceType: 'lexicon-technical', minimum: 1 }],
        ['grammar', { kind: 'minimum-type', sourceType: 'grammar-syntax', minimum: 1 }],
        ['perspectives', { kind: 'perspectives', minimum: level === 'seminary' ? 2 : 3 }],
        ['dateRange', { kind: 'date-range', before: 1950, after: año - 15, recentMinimum: escala }],
    ];
    if (level !== 'seminary') base.push(['monographs', { kind: 'minimum-type', sourceType: 'theological-monograph', minimum: escala }]);
    return base.map(([k, r]) => ({
        ...r, id: newId(), origin: 'level' as const,
        text: textOf(k, { minimum: r.minimum ?? 0, before: r.before ?? 0, after: r.after ?? 0, recent: r.recentMinimum ?? 0 }),
    }));
}

/** Los requisitos y el registro, listos para guardar: sin `undefined`, ids únicos. */
export function cleanRequirementItems(items: ReadonlyArray<ProjectRequirement>): ProjectRequirement[] {
    const vistos = new Set<string>();
    const SUPUESTOS: ReadonlyArray<RequirementAssumption> = ['before', 'after', 'recentMinimum', 'minimum'];
    return items.filter(r => r.id && r.text?.trim() && !vistos.has(r.id) && (vistos.add(r.id), true)).map(r => {
        const { assumed: crudo, ...resto } = r;
        const assumed = (crudo ?? []).filter(a => SUPUESTOS.includes(a));
        return limpio(assumed.length ? { ...resto, assumed } : resto);
    });
}

export function cleanSearchLog(log: ReadonlyArray<BibliographySearchLogEntry>): BibliographySearchLogEntry[] {
    // Una búsqueda anotada la escribe el usuario: números enteros no negativos y textos acotados.
    const n = (x: unknown) => (Number.isFinite(Number(x)) ? Math.max(0, Math.floor(Number(x))) : 0);
    return log.filter(l => l.id && l.at).slice(-200).map(l => limpio({
        ...l, label: String(l.label ?? '').slice(0, 300), found: n(l.found), added: n(l.added),
        ...(l.query != null ? { query: String(l.query).slice(0, 1000) } : {}),
        ...(l.database != null ? { database: String(l.database).slice(0, 60) } : {}),
    }));
}

/**
 * Los requisitos que leyó el lector, listos para el proyecto. Lo que el
 * sílabo no fija se completa con un valor DECLARADO en `assumed` (el texto
 * queda como lo dice el sílabo): «antiguas y actuales» sin años toma 1950 y
 * los últimos quince años; «opuestos» sin cifra, dos enfoques. Solo se
 * declara lo que se supuso. Un requisito igual a otro que ya está (misma
 * clase, tipo y texto) no se repite.
 */
export function requirementsFromExtraction(
    items: ReadonlyArray<Omit<ProjectRequirement, 'id' | 'origin'>>,
    existing: ReadonlyArray<ProjectRequirement>,
    newId: () => string,
    now: Date,
): ProjectRequirement[] {
    const año = now.getFullYear();
    const clave = (r: { kind: RequirementKind; sourceType?: SourceType | null; text: string }) => `${r.kind}|${r.sourceType ?? ''}|${r.text.trim().toLowerCase()}`;
    const out: ProjectRequirement[] = [];
    for (const it of items) {
        if ([...existing, ...out].some(r => clave(r) === clave(it))) continue;
        const r: ProjectRequirement = { ...it, text: it.text.trim(), id: newId(), origin: 'syllabus' };
        const supuesto: RequirementAssumption[] = [];
        if (r.kind === 'date-range') {
            if (!r.before) { r.before = 1950; supuesto.push('before'); }
            if (!r.after) { r.after = año - 15; supuesto.push('after'); }
            if (!r.recentMinimum) { r.recentMinimum = 1; supuesto.push('recentMinimum'); }
        }
        if (r.kind === 'perspectives' && !r.minimum) { r.minimum = 2; supuesto.push('minimum'); }
        if (supuesto.length) r.assumed = supuesto;
        out.push(r);
    }
    return out;
}

/** Si una regla del sílabo es la de no repetir fuentes (enciende el criterio del curso). */
export function isNoRepeatRule(text: string): boolean {
    // «Se puede repetir una fuente» no es la regla: es su contrario.
    if (/(se\s+)?puede[n]?\s+(re)?(usar|repetir)|se\s+permite\s+repetir|may\s+(be\s+)?(repeat|reuse)|can\s+(be\s+)?(repeat|reuse)|allowed\s+to\s+(repeat|reuse)/i.test(text)) return false;
    return /repet|consecutiv|misma\s+fuente|repeat|same\s+source|reuse/i.test(text);
}
