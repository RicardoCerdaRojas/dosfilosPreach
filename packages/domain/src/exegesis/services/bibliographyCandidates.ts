import type { BibleBookId } from '../../bible/canon/BibleCanon';
import type { LibraryResource } from '../../entities/LibraryResource';
import type { ResumenDeFuente } from '../entities/ExegesisPaperSummary';
import type { PassageReference } from '../../bible/canon/passage-reference';
import { SOURCE_TYPE_CATALOG, type SourceType } from '../entities/SourceType';
import { getSourceRecommendations } from '../recommendations';
import { findLibraryResourceForRecommendation } from '../recommendations/libraryMatch';
import { matchCourseBibliography, type CourseBibliographyEntry } from './courseBibliography';
import type { BibliographyCandidate, ProjectBibliographyCriteria } from './projectBibliography';

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
    sourceTypeLabel: (t: SourceType) => string = t => t,
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
        const note = tipos.length > 1
            ? `Clasificado distinto en los estudios: ${tipos.map(([t, n]) => `${sourceTypeLabel(t)} (${n})`).join(', ')}.`
            : null;
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
