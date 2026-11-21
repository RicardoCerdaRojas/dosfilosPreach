/**
 * Qué conseguir para el corpus de un trabajo (fase «Asistente del corpus»,
 * etapa 1a, A6).
 *
 * Medido en la etapa 0: el 47 % de lo citado en los trabajos de noviembre no
 * estaba en la biblioteca, y en TP #10 el corpus tenía 1 comentario
 * crítico-técnico cuando la rúbrica pide 2 (lo confirmó el fundador el
 * 2026-11-21: el profesor pide dos). Se supo después de entregar.
 *
 * Aquí las NECESIDADES salen de la rúbrica (fuentes por tipo) y del sílabo
 * (lecturas exigidas), ANTES de redactar. Cada necesidad trae sus candidatas
 * —lo que el autor ya tiene, el catálogo curado, el sílabo— con la EDICIÓN a la
 * vista: si la copia es de otro año que la citada, la paginación puede cambiar
 * (Metzger 1975 contra 1994, Robertson 1919 contra 1934). `libraryMatch`
 * reconoce la obra; esta comparación dice si es la misma edición.
 */
import type { SourceType } from '../entities/SourceType';
import type { PaperRubric } from '../entities/PaperRubric';
import type { SourceRecommendation } from '../recommendations/types';
import { findLibraryResourceForRecommendation, matchRecommendationToResource } from '../recommendations/libraryMatch';
import { getRecommendationId } from '../recommendations';

/** Un libro de la biblioteca, con lo que hace falta para proponerlo. */
export interface NeedLibraryBook {
    id: string;
    title: string;
    author?: string | null;
    sourceType: SourceType | null;
    /** Año de la ficha bibliográfica, como lo escribió una persona («1994», «1975 [1897]»). */
    year?: string | null;
    /** El libro declara que no tiene páginas impresas: se cita por sección o lema. */
    noFolios?: boolean;
    /** Un comentario de OTRO libro bíblico: no cumple el requisito de este pasaje. */
    otherBook?: boolean;
    /** Ya está en el corpus de este trabajo. */
    inCorpus?: boolean;
    /** Lo excluye la regla de no repetir: el trabajo anterior que lo usó. */
    excludedBy?: string | null;
}

export type EditionMatch = 'misma' | 'distinta' | 'sin-dato';

export type CandidateStatus =
    | 'en-corpus'
    | 'tengo'
    | 'edicion-distinta'
    | 'sugerida'
    | 'por-conseguir'
    | 'descartada'
    | 'excluida';

export interface NeedCandidate {
    /** Estable: `rec:<autor__titulo>`, `lib:<resourceId>`, `silabo:<slug>`. */
    key: string;
    origin: 'biblioteca' | 'catalogo' | 'silabo';
    title: string;
    author?: string | null;
    /** La edición citada (catálogo): año, editorial, ISBN. */
    edition?: { year: number | null; publisher: string | null; isbn: string | null; series: string | null } | null;
    /** El libro de la biblioteca que es esta obra, si lo hay. */
    resourceId: string | null;
    /** El año de la copia que tiene el autor. */
    copyYear: string | null;
    editionMatch: EditionMatch | null;
    status: CandidateStatus;
    noFolios: boolean;
    excludedBy: string | null;
    /** Con `descartada`: por qué. */
    reason: string | null;
    tier?: SourceRecommendation['tier'];
    /** Qué aporta la obra, del catálogo curado (una línea). */
    rationale?: string;
}

export interface CorpusNeed {
    /** `tipo:<sourceType>` o `lectura:<slug>`. */
    id: string;
    kind: 'tipo' | 'lectura';
    sourceType: SourceType | null;
    /** La lectura del sílabo, con su autor. */
    title: string | null;
    required: number;
    /** Cuántas hay en el corpus. */
    have: number;
    /** Cuántas más están al alcance: en la biblioteca, sin excluir. */
    withinReach: number;
    covered: boolean;
    candidates: NeedCandidate[];
}

/** Lo que el autor decide de una candidata, por su clave. */
export interface AcquisitionMark {
    status: 'por-conseguir' | 'descartada';
    reason?: string | null;
    at: string;
}

export const ACQUISITION_MARKS_MAX = 120;
export const ACQUISITION_REASON_MAX = 300;

export interface CorpusNeedsInput {
    rubric: Pick<PaperRubric, 'sourceRequirements' | 'courseBibliography'> | null | undefined;
    /** Los tipos del corpus que cuentan para la rúbrica (`sourceTypesForRubric`). */
    corpusTypes: ReadonlyArray<SourceType>;
    library: ReadonlyArray<NeedLibraryBook>;
    /** El catálogo curado del libro bíblico, por tipo (`getSourceRecommendations`). */
    recommendationsFor: (type: SourceType) => ReadonlyArray<SourceRecommendation>;
    /** Excluye un título del catálogo por la regla de no repetir; devuelve el trabajo que lo usó. */
    excludedRecommendation?: (rec: SourceRecommendation) => string | null;
    marks?: Readonly<Record<string, AcquisitionMark>> | null;
}

/** «1975 [1897]» → 1975. La primera cifra de cuatro dígitos es el año de la edición que se tiene. */
export function editionYearOf(year: string | number | null | undefined): number | null {
    if (typeof year === 'number') return Number.isFinite(year) && year > 0 ? year : null;
    const m = (year ?? '').match(/\b(1[5-9]\d\d|20\d\d)\b/);
    return m ? Number(m[1]) : null;
}

/** La copia frente a la edición citada: misma, distinta, o no se sabe (falta un año). */
export function compareEdition(citedYear: number | null | undefined, copyYear: string | number | null | undefined): EditionMatch {
    const a = citedYear && citedYear > 0 ? citedYear : null;
    const b = editionYearOf(copyYear);
    if (!a || !b) return 'sin-dato';
    return a === b ? 'misma' : 'distinta';
}

const ORDEN: Record<CandidateStatus, number> = {
    'en-corpus': 0, tengo: 1, 'edicion-distinta': 2, 'por-conseguir': 3, sugerida: 4, excluida: 5, descartada: 6,
};

/**
 * Dentro de un mismo estado, lo esencial primero: nueve sugeridas iguales no
 * dicen cuál conseguir (prueba del fundador, TP #10, 2026-11-21). Lo que el
 * catálogo no clasifica (un libro de la biblioteca) va después. El orden del
 * catálogo (idioma del trabajo primero) desempata: el `sort` es estable.
 */
const PRIORIDAD: Record<SourceRecommendation['tier'], number> = { essential: 0, recommended: 1, standard: 2 };
const prioridadDe = (c: NeedCandidate) => (c.tier ? PRIORIDAD[c.tier] : 3);

export function corpusNeeds(input: CorpusNeedsInput): CorpusNeed[] {
    const marks = input.marks ?? {};
    const needs: CorpusNeed[] = [];
    for (const req of input.rubric?.sourceRequirements ?? []) {
        if (req.minimum <= 0) continue;
        const candidates = candidatesForType(req.sourceType, input, marks);
        const have = input.corpusTypes.filter(t => t === req.sourceType).length;
        const withinReach = candidates.filter(c => c.status === 'tengo' || c.status === 'edicion-distinta').length;
        needs.push({
            id: `tipo:${req.sourceType}`, kind: 'tipo', sourceType: req.sourceType, title: null,
            required: req.minimum, have, withinReach, covered: have >= req.minimum, candidates,
        });
    }
    for (const entry of input.rubric?.courseBibliography ?? []) {
        if (entry.requirement !== 'required') continue;
        const rec = { author: entry.author ?? '', title: entry.title, series: entry.series ?? null, publisher: '', year: 0, isbn: null, tier: 'essential' as const, languages: [] };
        const libro = entry.resourceId
            ? input.library.find(b => b.id === entry.resourceId) ?? null
            : input.library.find(b => !b.otherBook && matchRecommendationToResource(rec, { id: b.id, title: b.title, author: b.author ?? null })) ?? null;
        const key = `silabo:${slugOf(entry.title)}`;
        const candidate = buildCandidate({
            key, origin: 'silabo', title: entry.title, author: entry.author ?? null, edition: null, libro, marks, excludedBy: libro?.excludedBy ?? null,
        });
        const inCorpus = !!libro?.inCorpus;
        needs.push({
            id: `lectura:${slugOf(entry.title)}`, kind: 'lectura', sourceType: null, title: entry.title,
            required: 1, have: inCorpus ? 1 : 0, withinReach: candidate.status === 'tengo' || candidate.status === 'edicion-distinta' ? 1 : 0,
            covered: inCorpus, candidates: [candidate],
        });
    }
    return needs;
}

function candidatesForType(type: SourceType, input: CorpusNeedsInput, marks: Readonly<Record<string, AcquisitionMark>>): NeedCandidate[] {
    const delTipo = input.library.filter(b => b.sourceType === type && !b.otherBook);
    const usados = new Set<string>();
    const out: NeedCandidate[] = [];
    // El catálogo primero: trae la edición. Si el autor tiene la obra, la copia se le pega.
    for (const rec of input.recommendationsFor(type)) {
        const libro = findLibraryResourceForRecommendation(rec, delTipo.map(b => ({ ...b, author: b.author ?? null })));
        if (libro) usados.add(libro.id);
        const excluido = libro?.excludedBy ?? input.excludedRecommendation?.(rec) ?? null;
        out.push(buildCandidate({
            key: `rec:${getRecommendationId(rec)}`, origin: 'catalogo', title: rec.title, author: rec.author,
            edition: { year: rec.year || null, publisher: rec.publisher || null, isbn: rec.isbn, series: rec.series },
            libro: libro ? delTipo.find(b => b.id === libro.id)! : null, marks, excludedBy: excluido, tier: rec.tier,
            rationale: rec.rationale,
        }));
    }
    // Lo demás de la biblioteca del tipo, que el catálogo no nombra.
    for (const b of delTipo) {
        if (usados.has(b.id)) continue;
        out.push(buildCandidate({ key: `lib:${b.id}`, origin: 'biblioteca', title: b.title, author: b.author ?? null, edition: null, libro: b, marks, excludedBy: b.excludedBy ?? null }));
    }
    return out.sort((a, b) => ORDEN[a.status] - ORDEN[b.status] || prioridadDe(a) - prioridadDe(b));
}

function buildCandidate(c: {
    key: string; origin: NeedCandidate['origin']; title: string; author: string | null;
    edition: NeedCandidate['edition']; libro: NeedLibraryBook | null; marks: Readonly<Record<string, AcquisitionMark>>;
    excludedBy: string | null; tier?: SourceRecommendation['tier']; rationale?: string;
}): NeedCandidate {
    const mark = c.marks[c.key];
    const libro = c.libro;
    const editionMatch = libro && c.edition ? compareEdition(c.edition.year, libro.year) : null;
    let status: CandidateStatus;
    if (libro?.inCorpus) status = 'en-corpus';
    else if (mark?.status === 'descartada') status = 'descartada';
    else if (c.excludedBy) status = 'excluida';
    else if (libro) status = editionMatch === 'distinta' ? 'edicion-distinta' : 'tengo';
    else if (mark?.status === 'por-conseguir') status = 'por-conseguir';
    else status = 'sugerida';
    return {
        key: c.key, origin: c.origin, title: c.title, author: c.author, edition: c.edition,
        resourceId: libro?.id ?? null, copyYear: libro?.year?.trim() || null, editionMatch,
        status, noFolios: !!libro?.noFolios, excludedBy: c.excludedBy,
        reason: status === 'descartada' ? mark?.reason ?? null : null,
        ...(c.tier ? { tier: c.tier } : {}),
        ...(c.rationale?.trim() ? { rationale: c.rationale.trim() } : {}),
    };
}

/**
 * La medida de salida de la fase A (diseño §11): cuántas necesidades están
 * cubiertas ANTES de redactar. `reachable` cuenta también las que se cubren
 * con lo que el autor ya tiene en su biblioteca.
 */
export function corpusNeedsCoverage(needs: ReadonlyArray<CorpusNeed>): { total: number; covered: number; reachable: number } {
    return {
        total: needs.length,
        covered: needs.filter(n => n.covered).length,
        reachable: needs.filter(n => n.covered || n.have + n.withinReach >= n.required).length,
    };
}

/** Las marcas listas para guardar: estado válido, razón obligatoria al descartar, con tope. */
export function cleanAcquisitionMarks(value: unknown): Record<string, AcquisitionMark> {
    if (!value || typeof value !== 'object') return {};
    const out: Record<string, AcquisitionMark> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
        if (Object.keys(out).length >= ACQUISITION_MARKS_MAX) break;
        const m = raw as Partial<AcquisitionMark> | null;
        if (!key || !m || (m.status !== 'por-conseguir' && m.status !== 'descartada')) continue;
        const reason = typeof m.reason === 'string' ? m.reason.trim().slice(0, ACQUISITION_REASON_MAX) : '';
        // Descartar sin razón no se puede: un descarte mudo esconde por qué falta.
        if (m.status === 'descartada' && !reason) continue;
        out[key] = { status: m.status, ...(reason ? { reason } : {}), at: typeof m.at === 'string' ? m.at : new Date(0).toISOString() };
    }
    return out;
}

function slugOf(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
