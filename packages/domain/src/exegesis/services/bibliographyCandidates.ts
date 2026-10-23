import { getBookById, type BibleBookId } from '../../bible/canon/BibleCanon';
import type { LibraryResource } from '../../entities/LibraryResource';
import type { ResumenDeFuente } from '../entities/ExegesisPaperSummary';
import type { PassageReference } from '../../bible/canon/passage-reference';
import { SOURCE_TYPE_CATALOG, type SourceType } from '../entities/SourceType';
import { getSourceRecommendations } from '../recommendations';
import { findLibraryResourceForRecommendation } from '../recommendations/libraryMatch';
import { matchCourseBibliography, type CourseBibliographyEntry } from './courseBibliography';
import { sameWork, type BibliographyCandidate, type BibliographyEvaluation, type ProjectBibliographyCriteria, type ProjectBibliographyEntry } from './projectBibliography';
import type { ExtractedBibliographyEntry } from '../ports/ICourseBibliographyExtractor';

/**
 * De dónde salen las candidatas del estado del arte (etapa 2, paso 2).
 *
 * Cuatro orígenes automáticos; el quinto («a mano») es la pantalla:
 *   1. **El sílabo:** la bibliografía del curso que traen las rúbricas de
 *      los tipos de trabajo.
 *   2. **El catálogo curado** para los libros bíblicos del proyecto.
 *   3. **La biblioteca** (con los libros compartidos): lo que comenta esos
 *      libros y las obras de referencia (léxicos, gramáticas, texto crítico).
 *   4. **Los estudios del proyecto:** lo que ya usaron. Es el cruce de
 *      bibliografías de Eco (III.2.2) en pequeño: lo que se repite sube.
 *
 * Todas pasan por `mergeBibliographyCandidates`, que junta la misma obra.
 */

/** Las obras de referencia: valen para cualquier libro bíblico. */
const REFERENCIA: ReadonlySet<SourceType> = new Set<SourceType>([
    'biblical-text-edition', 'critical-apparatus', 'textual-commentary',
    'lexicon-technical', 'theological-dictionary', 'grammar-syntax',
]);

/** Lo que no es bibliografía del trabajo: la plantilla de estilo y lo sin clasificar. */
const NO_BIBLIOGRAFIA: ReadonlySet<SourceType> = new Set<SourceType>(['style-template-paper', 'other']);

type RecursoDeBiblioteca = Pick<LibraryResource, 'id' | 'title' | 'coversBibleBooks' | 'scope' | 'exegeticalType'> & { author?: string | null };

/** Los libros bíblicos del proyecto: los elegidos, o los de sus estudios. */
export function projectBibleBooks(
    criteria: ProjectBibliographyCriteria | null | undefined,
    studies: ReadonlyArray<{ passage: Pick<PassageReference, 'bookId'> }>,
): BibleBookId[] {
    if (criteria?.bibleBooks?.length) return [...new Set(criteria.bibleBooks)];
    return [...new Set(studies.map(s => s.passage.bookId))];
}

/** La bibliografía del curso que traen las rúbricas de los tipos de trabajo, sin repetir. */
export function syllabusOfProject(
    workTypes: ReadonlyArray<{ rubricTemplateId?: string | null }>,
    rubrics: ReadonlyArray<{ id: string; rubric: { courseBibliography?: ReadonlyArray<CourseBibliographyEntry> | null } }>,
): CourseBibliographyEntry[] {
    const ids = new Set(workTypes.map(t => t.rubricTemplateId).filter((x): x is string => !!x));
    const out: CourseBibliographyEntry[] = [];
    for (const r of rubrics) {
        if (!ids.has(r.id)) continue;
        for (const e of r.rubric.courseBibliography ?? []) {
            if (!out.some(o => o.title === e.title && (o.author ?? '') === (e.author ?? ''))) out.push(e);
        }
    }
    return out;
}

export function syllabusCandidates(
    syllabus: ReadonlyArray<CourseBibliographyEntry>,
    library: ReadonlyArray<RecursoDeBiblioteca>,
): BibliographyCandidate[] {
    return matchCourseBibliography(syllabus, library as never, new Set()).map(m => ({
        title: m.entry.title,
        author: m.entry.author ?? null,
        series: m.entry.series ?? null,
        resourceId: (m.resource as RecursoDeBiblioteca | null)?.id ?? null,
        weight: m.entry.requirement === 'required' ? 'required' : 'recommended',
        origin: 'syllabus',
        note: m.entry.note ?? null,
    }));
}

export function catalogCandidates(
    bibleBooks: ReadonlyArray<BibleBookId>,
    library: ReadonlyArray<RecursoDeBiblioteca>,
    language: 'es' | 'en',
): BibliographyCandidate[] {
    const out: BibliographyCandidate[] = [];
    for (const book of bibleBooks) {
        for (const sourceType of Object.keys(SOURCE_TYPE_CATALOG) as SourceType[]) {
            if (NO_BIBLIOGRAFIA.has(sourceType)) continue;
            for (const rec of getSourceRecommendations(book, sourceType, language)) {
                const enBiblioteca = findLibraryResourceForRecommendation(rec, library.map(r => ({ ...r, author: r.author ?? null })));
                out.push({
                    title: rec.title,
                    author: rec.author || null,
                    series: rec.series ?? null,
                    year: rec.year || null,
                    publisher: rec.publisher || null,
                    resourceId: enBiblioteca?.id ?? null,
                    sourceType,
                    // Lo esencial del catálogo es recomendable; obligatorio solo lo hace el curso.
                    weight: rec.tier === 'essential' ? 'recommended' : 'complementary',
                    origin: 'catalog',
                    note: rec.rationale ?? null,
                    // Lo verificado del catálogo: el ISBN o el DOI del registro.
                    ...(rec.isbn || rec.verified?.ref.startsWith('doi:') ? { identifiers: { isbn: rec.isbn ?? null, doi: rec.verified?.ref.startsWith('doi:') ? rec.verified.ref.slice(4) : null } } : {}),
                });
            }
        }
    }
    return out;
}

export function libraryCandidates(
    bibleBooks: ReadonlyArray<BibleBookId>,
    library: ReadonlyArray<RecursoDeBiblioteca>,
): BibliographyCandidate[] {
    return library
        .filter(r => !r.exegeticalType || !NO_BIBLIOGRAFIA.has(r.exegeticalType))
        .filter(r => {
            const libros = r.coversBibleBooks ?? [];
            if (libros.some(b => bibleBooks.includes(b))) return true;
            if (libros.length > 0) return false;
            return !!r.exegeticalType && REFERENCIA.has(r.exegeticalType);
        })
        .map(r => ({
            title: r.title,
            author: r.author ?? null,
            resourceId: r.id,
            sourceType: r.exegeticalType ?? null,
            weight: 'complementary',
            origin: 'library',
        }));
}

/**
 * Lo que usaron los estudios del proyecto, contado por estudio. La
 * clasificación es la más frecuente; si los estudios no coincidieron, la
 * nota lo dice para que se decida una vez (en los TP de Santiago el mismo
 * NICNT figura como crítico y como expositivo).
 */
export function studiesCandidates(
    studies: ReadonlyArray<{ sources: ReadonlyArray<ResumenDeFuente> }>,
    /** La nota cuando los estudios no coincidieron; la pantalla la escribe en su idioma. */
    conflictNote: (types: ReadonlyArray<readonly [SourceType, number]>) => string =
        tipos => `Clasificado distinto en los estudios: ${tipos.map(([t, n]) => `${t} (${n})`).join(', ')}.`,
): BibliographyCandidate[] {
    const porLibro = new Map<string, { title: string; estudios: number; tipos: Map<SourceType, number> }>();
    for (const s of studies) {
        const vistos = new Set<string>();
        for (const f of s.sources) {
            const id = f.sourceLibraryResourceId;
            if (!id || vistos.has(id) || NO_BIBLIOGRAFIA.has(f.sourceType)) continue;
            vistos.add(id);
            const x = porLibro.get(id) ?? { title: f.displayLabel, estudios: 0, tipos: new Map() };
            x.estudios++;
            x.tipos.set(f.sourceType, (x.tipos.get(f.sourceType) ?? 0) + 1);
            porLibro.set(id, x);
        }
    }
    return [...porLibro].map(([resourceId, x]) => {
        const tipos = [...x.tipos].sort((a, b) => b[1] - a[1]);
        const note = tipos.length > 1 ? conflictNote(tipos) : null;
        return {
            title: x.title,
            resourceId,
            sourceType: tipos[0]![0],
            weight: x.estudios >= 2 ? 'recommended' : 'complementary',
            origin: 'studies',
            note,
        } satisfies BibliographyCandidate;
    });
}

/**
 * Lo que leyó el lector de bibliografías, como candidatas del sílabo,
 * emparejadas con la biblioteca. Se puede leer varias veces: la fusión con
 * las fichas que ya hay junta la misma obra y no pisa lo decidido.
 */
export function extractedBibliographyCandidates(
    entries: ReadonlyArray<ExtractedBibliographyEntry>,
    library: ReadonlyArray<RecursoDeBiblioteca>,
    /** De dónde vino la lista: el sílabo, la bibliografía de una obra, o un archivo RIS o BibTeX. */
    origin: { kind: 'syllabus' | 'import' } | { kind: 'citation'; citedBy: string } = { kind: 'syllabus' },
): BibliographyCandidate[] {
    const comoSilabo = entries.map(e => ({
        title: e.title, author: e.author ?? undefined, series: e.series ?? undefined,
        requirement: e.requirement, note: e.note ?? undefined,
    }));
    return syllabusCandidates(comoSilabo, library).map((c, i) => ({
        ...c,
        year: entries[i]!.year ?? null,
        publisher: entries[i]!.publisher ?? null,
        // La del libro en la biblioteca manda; si no, la que propone el lector.
        sourceType: (c.resourceId ? library.find(r => r.id === c.resourceId)?.exegeticalType : null) ?? entries[i]!.sourceType ?? null,
        pageCount: entries[i]!.pageCount ?? null,
        identifiers: entries[i]!.doi || entries[i]!.isbn ? { doi: entries[i]!.doi ?? null, isbn: entries[i]!.isbn ?? null } : null,
        origin: origin.kind,
        // Solo lo que el ENCARGO exige es obligatorio: en la bibliografía de un libro nada lo es.
        weight: origin.kind === 'syllabus' ? c.weight : 'complementary',
        ...(origin.kind === 'citation' ? { citedBy: origin.citedBy } : {}),
    }));
}

const ROMANOS: Record<string, number> = { i: 1, v: 5, x: 10, l: 50 };
function capitulo(token: string): number | null {
    if (/^\d+$/.test(token)) return Number(token);
    const t = token.toLowerCase();
    if (!/^[ivxl]+$/.test(t)) return null;
    let n = 0;
    for (let i = 0; i < t.length; i++) {
        const v = ROMANOS[t[i]!]!, sig = ROMANOS[t[i + 1] ?? ''] ?? 0;
        n += v < sig ? -v : v;
    }
    return n;
}

/**
 * Si el título de una obra NOMBRA un capítulo de los estudios del proyecto
 * («A Reconsideration of James IV. 5», «Santiago 4:1-10»). Es un indicio, no
 * un juicio de relevancia: por eso se rotula «menciona Santiago 4». Devuelve
 * los capítulos nombrados.
 */
export function chaptersMentioned(
    title: string,
    bookId: BibleBookId,
    chapters: ReadonlyArray<number>,
): number[] {
    const libro = getBookById(bookId);
    if (!libro) return [];
    const nombres = [...new Set([libro.nameEs, libro.nameEn, ...libro.aliases])]
        .map(n => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
        .filter(n => n.length >= 3)
        .sort((a, b) => b.length - a.length)
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const original = title.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const t = original.toLowerCase();
    const re = new RegExp(`\\b(?:${nombres.join('|')})\\.?\\s+([ivxl]+|\\d{1,3})\\b`, 'g');
    const out = new Set<number>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
        // «James I. Packer», «James V. Brownson»: una letra con punto y un
        // nombre después es la inicial de una persona, no un capítulo.
        if (/^[ivx]$/.test(m[1]!) && /^\.\s*\p{Lu}/u.test(original.slice(m.index + m[0].length))) continue;
        const c = capitulo(m[1]!);
        if (c && chapters.includes(c)) out.add(c);
    }
    return [...out].sort((a, b) => a - b);
}

/**
 * Lo que el catálogo curado propone para evaluar una ficha (etapa 2c): el
 * enfoque de la obra. Es una SUGERENCIA, como lo que sabe la biblioteca: se
 * ve en la ficha y cuenta solo cuando el estudiante la confirma.
 */
export function catalogEvaluationFor(
    entry: Pick<ProjectBibliographyEntry, 'title' | 'author' | 'sourceType'>,
    bibleBooks: ReadonlyArray<BibleBookId>,
): Partial<BibliographyEvaluation> {
    if (!entry.author) return {};
    const tipos = entry.sourceType ? [entry.sourceType] : (Object.keys(SOURCE_TYPE_CATALOG) as SourceType[]);
    for (const book of bibleBooks) {
        for (const t of tipos) {
            const rec = getSourceRecommendations(book, t, 'es').find(r => r.approach && sameWork({ title: r.title, author: r.author, resourceId: null }, { title: entry.title, author: entry.author ?? null, resourceId: null }));
            if (rec?.approach) return { approach: rec.approach };
        }
    }
    return {};
}
