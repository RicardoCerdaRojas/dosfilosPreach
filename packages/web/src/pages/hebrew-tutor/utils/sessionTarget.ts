/**
 * El versículo que abre una sesión de hebreo.
 *
 * La sesión guarda el pasaje como se mostró al analizarlo: «Rut 1:7», con el
 * nombre del libro en español, o la clave de morphhb si el libro no estaba en
 * el catálogo («Ruth 1:7»); el tipo de la entidad habla de «Genesis 1:1», así
 * que también vale el nombre en inglés. Los enlaces del escritorio del proyecto llevan
 * `?sessionId=` y el tutor no lo leía: abría vacío (TP #9).
 *
 * El nombre se compara entero (sin mayúsculas): «1 Samuel» no calza con
 * «Samuel». `null` si el pasaje no se reconoce.
 */
export interface HebrewSessionTarget {
    book: string;
    chapter: number;
    verse: number;
}

export function hebrewSessionTarget(
    passage: string | null | undefined,
    catalog: ReadonlyArray<{ morphhbKey: string; nameSpanish: string; nameEnglish?: string }>,
): HebrewSessionTarget | null {
    const m = /^(.+?)\s+(\d+):(\d+)\s*$/.exec((passage ?? '').trim());
    if (!m) return null;
    const nombre = m[1]!.trim().toLocaleLowerCase('es');
    const libro = catalog.find(b => [b.nameSpanish, b.nameEnglish, b.morphhbKey].some(n => !!n && n.toLocaleLowerCase('es') === nombre));
    const chapter = Number(m[2]);
    const verse = Number(m[3]);
    if (!libro || chapter < 1 || verse < 1) return null;
    return { book: libro.morphhbKey, chapter, verse };
}
