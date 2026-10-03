import type { Sermon } from '../entities/Sermon';
import { parsePassageReference, type PassageReference } from '../bible/canon/passage-reference';

/**
 * Qué sermones se pueden vincular a una perícopa del plan, y en qué orden.
 *
 * El sermón de Jonás 1:1-3 se escribió ANTES de crear la serie y no había cómo
 * vincularlo desde la pantalla: se hizo a mano en Firestore (2026-10-01, #3 del
 * ejercicio de Jonás). La perícopa apunta a un BORRADOR (`draftId`); publicar
 * crea una copia aparte que guarda de qué borrador salió (`sourceSermonId`).
 * Por eso elegir una copia publicada vincula su borrador.
 */

export type PassageMatch = 'overlap' | 'same-book' | 'none';

export interface LinkableSermon {
    /** Lo que se escribe en la perícopa: el borrador, o la copia si el borrador ya no está. */
    id: string;
    title: string;
    passage: string;
    match: PassageMatch;
    updatedAt: Date;
    /** Está en otra serie: vincularlo dejaría la otra apuntando a él. No se ofrece. */
    inOtherSeries: boolean;
}

type Summary = Pick<Sermon, 'id' | 'title' | 'status' | 'updatedAt' | 'seriesId' | 'bibleReferences' | 'sourceSermonId'> & {
    wizardProgress?: { passage?: string } | undefined;
};

const MATCH_RANK: Record<PassageMatch, number> = { overlap: 2, 'same-book': 1, none: 0 };

function span(r: PassageReference): [number, number] {
    return [r.chapterStart * 1000 + (r.verseStart ?? 0), r.chapterEnd * 1000 + (r.verseEnd ?? 999)];
}

/** Cuánto se parece el pasaje de un sermón al de la perícopa. */
export function passageMatch(sermonPassage: string, pericopePassage: string): PassageMatch {
    const a = parsePassageReference(sermonPassage);
    const b = parsePassageReference(pericopePassage);
    if (!a.ok || !b.ok || a.ref.bookId !== b.ref.bookId) return 'none';
    const [a0, a1] = span(a.ref);
    const [b0, b1] = span(b.ref);
    return a0 <= b1 && b0 <= a1 ? 'overlap' : 'same-book';
}

/**
 * Los sermones vinculables, el más parecido primero y, a igual parecido, el
 * más reciente. `linkedIds` son los borradores que ya ocupan una perícopa de
 * esta serie: no se ofrecen.
 */
export function linkableSermonsFor(
    sermons: ReadonlyArray<Summary>,
    pericopePassage: string,
    seriesId: string,
    linkedIds: ReadonlySet<string>,
): LinkableSermon[] {
    // Un borrador archivado no cuenta como «el borrador sigue ahí»: su copia vale por sí misma.
    const ids = new Set(sermons.filter(s => s.status !== 'archived').map(s => s.id));
    const byTarget = new Map<string, Summary>();
    for (const s of sermons) {
        if (s.status === 'archived') continue;
        // La copia publicada vale por su borrador, si el borrador sigue ahí.
        const target = s.sourceSermonId && ids.has(s.sourceSermonId) ? s.sourceSermonId : s.id;
        const prev = byTarget.get(target);
        if (!prev || s.id === target) byTarget.set(target, s);
    }
    const out: LinkableSermon[] = [];
    for (const [id, s] of byTarget) {
        if (linkedIds.has(id)) continue;
        const passage = s.wizardProgress?.passage?.trim() || s.bibleReferences[0]?.trim() || '';
        out.push({
            id,
            title: s.title,
            passage,
            match: passage && pericopePassage ? passageMatch(passage, pericopePassage) : 'none',
            updatedAt: s.updatedAt,
            inOtherSeries: !!s.seriesId && s.seriesId !== seriesId,
        });
    }
    return out.sort(
        (x, y) => MATCH_RANK[y.match] - MATCH_RANK[x.match] || y.updatedAt.getTime() - x.updatedAt.getTime(),
    );
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** El filtro del buscador: por título o pasaje, sin tildes ni mayúsculas. */
export function filterLinkableSermons(list: ReadonlyArray<LinkableSermon>, query: string): LinkableSermon[] {
    const q = fold(query.trim());
    if (!q) return [...list];
    return list.filter(s => fold(`${s.title} ${s.passage}`).includes(q));
}
