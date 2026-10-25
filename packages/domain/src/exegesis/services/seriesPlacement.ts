import { findBooksByAlias } from '../../bible/canon/BibleCanon';
import { formatPassageForReader } from '../../bible/versification/formatForReader';
import type { PlannedSermon } from '../../entities/SermonSeries';
import type { SeriesPlacement, SeriesPlacementNeighbor } from '../entities/ExegeticalPaper';
import { plannedUnits } from './projectFraming';

/**
 * El lugar de una perícopa en su serie (`docs/FASE_ENCUADRE_SERIE_2026-10.md`,
 * §2 paso 9): «3 de 12», con la de antes y la de después.
 *
 * Es un campo del estudio (`ExegeticalPaper.seriesPlacement`) y NO una línea
 * del encargo: el encargo alimenta la búsqueda de fuentes y el prompt lo lee
 * como guía autoritativa, así que un «Perícopa 3 de 12» ahí sesgaba qué se
 * buscaba y además quedaba fijo en español. Aquí son datos; cada prompt los
 * dibuja en su idioma.
 */

type PlannedRow = Pick<PlannedSermon, 'id' | 'title' | 'passage'> & Partial<Pick<PlannedSermon, 'paperId' | 'syntacticUnit'>>;

const TITLE_MAX = 300;
const PASSAGE_MAX = 120;

/**
 * Cuenta UNIDADES, no filas (`plannedUnits`): una unidad predicada en varios
 * domingos ocupa varias filas y sigue siendo una perícopa. Los pasajes van en
 * la numeración del lector: `passage` ya viene así del planificador; si falta,
 * se traduce la unidad sintáctica (numeración del original).
 */
export function seriesPlacementFor(
    series: { metadata?: { plannedSermons?: ReadonlyArray<PlannedRow> } | null | undefined } | null | undefined,
    pericopeId: string,
    lang: 'es' | 'en' = 'es',
): SeriesPlacement | null {
    const units = plannedUnits(series?.metadata?.plannedSermons ?? []);
    const idx = units.findIndex(u => u.some(r => r.id === pericopeId));
    if (idx < 0) return null;
    const previous = idx > 0 ? neighborOf(units[idx - 1]![0]!, lang) : null;
    const next = idx < units.length - 1 ? neighborOf(units[idx + 1]![0]!, lang) : null;
    return {
        position: idx + 1,
        total: units.length,
        ...(previous ? { previous } : {}),
        ...(next ? { next } : {}),
    };
}

/**
 * Lo que vuelve de Firestore, limpio. Un documento a medio escribir o de otra
 * versión no tumba la lectura del estudio: se descarta y el estudio queda
 * como uno suelto.
 */
export function cleanSeriesPlacement(v: unknown): SeriesPlacement | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const r = v as Record<string, unknown>;
    const position = r.position;
    const total = r.total;
    if (!Number.isInteger(position) || !Number.isInteger(total)) return null;
    if ((position as number) < 1 || (total as number) < (position as number)) return null;
    const previous = cleanNeighbor(r.previous);
    const next = cleanNeighbor(r.next);
    return {
        position: position as number,
        total: total as number,
        ...(previous ? { previous } : {}),
        ...(next ? { next } : {}),
    };
}

function neighborOf(r: PlannedRow, lang: 'es' | 'en'): SeriesPlacementNeighbor | null {
    return cleanNeighbor({ passage: r.passage?.trim() || unitForReader(r.syntacticUnit, lang) || '', title: r.title ?? '' });
}

function cleanNeighbor(v: unknown): SeriesPlacementNeighbor | null {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const r = v as Record<string, unknown>;
    const passage = typeof r.passage === 'string' ? r.passage.trim().slice(0, PASSAGE_MAX) : '';
    const title = typeof r.title === 'string' ? r.title.trim().slice(0, TITLE_MAX) : '';
    // Sin pasaje ni título no hay nada que decir de la vecina.
    return passage || title ? { passage, title } : null;
}

function unitForReader(u: PlannedRow['syntacticUnit'], lang: 'es' | 'en'): string | null {
    if (!u) return null;
    const book = findBooksByAlias(u.book.toLowerCase().trim())[0];
    if (!book) return null;
    return formatPassageForReader({
        bookId: book.id, chapterStart: u.chapterStart, chapterEnd: u.chapterEnd, verseStart: u.verseStart, verseEnd: u.verseEnd,
    }, lang);
}
