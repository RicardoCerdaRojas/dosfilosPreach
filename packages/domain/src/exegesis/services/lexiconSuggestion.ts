import type { PassageLemma, SheetHitCount } from './lemmaPages';
import type { SectionProposal } from './grammarSearchKeys';

/**
 * «Selección sugerida» de hojas para un léxico.
 *
 * El fundador no sabía qué hojas elegir del léxico de Ortiz para Jonás 4:5-11
 * («es difícil sin conocimiento») y preguntó por qué el sistema no podía hacer
 * lo que hizo el asistente a mano: quedarse con la entrada de cada palabra que
 * el pasaje discute, y dejar afuera los verbos de todos los días.
 *
 * Es determinista a propósito —curar material, no decidir la exégesis— y cada
 * hoja dice por qué entra:
 *
 *   1. Por lema, sólo la hoja de ENTRADA: la que más veces lo nombra.
 *   2. Primero los raros en la Biblia (un hápax como חֲרִישִׁי antes que אָמַר),
 *      después los que el pasaje repite; los muy frecuentes, al final.
 *   3. Hasta llenar el presupuesto de caracteres.
 */
export type SuggestionReason =
    | { kind: 'rare'; bibleCount: number }
    | { kind: 'repeated'; passageCount: number }
    | { kind: 'common'; bibleCount: number }
    /** Gramática: la sección del índice que trata una categoría del pasaje. */
    | { kind: 'section'; title: string; matched: string[] };

export interface LexiconSuggestionEntry {
    sheet: number;
    /** Los lemas cuya entrada está en esta hoja. */
    lemmas: string[];
    reasons: SuggestionReason[];
}

export interface LexiconSuggestion {
    picked: LexiconSuggestionEntry[];
    /** Lemas con entrada que no entraron por presupuesto. */
    leftOut: string[];
    /** Lemas sin ninguna hoja en este libro. */
    notFound: string[];
    /**
     * De qué testamento sale la frecuencia: las tablas cuentan uno solo, y
     * «veces en la Biblia» era falso (revisión adversarial de B3).
     */
    frequencyCorpus?: 'OT' | 'NT';
}

/** Por debajo de esto, un lema es raro: su entrada suele ser la discusión del pasaje. */
export const RARE_LEMMA_MAX = 50;

export function suggestLexiconSelection(input: {
    lemmas: ReadonlyArray<PassageLemma>;
    /** Hojas candidatas de cada lema, la más probable primero (`useLemmaPages`). */
    sheetsOf: (lemma: string) => ReadonlyArray<SheetHitCount>;
    /** Veces en toda la Biblia (AT o NT); `undefined` si no se sabe. */
    bibleCount: (lemma: PassageLemma) => number | undefined;
    /** Desde cuántas apariciones un lema es «común» y va al final. */
    commonFrom: number;
    sheetChars: (sheet: number) => number;
    budgetChars: number;
}): LexiconSuggestion {
    const notFound: string[] = [];
    const candidatos = input.lemmas.flatMap((l, orden) => {
        const entrada = input.sheetsOf(l.lemma)[0];
        if (!entrada) { notFound.push(l.lemma); return []; }
        const n = input.bibleCount(l);
        return [{ l, orden, sheet: entrada.sheet, n, comun: n !== undefined && n >= input.commonFrom }];
    });

    // Por frecuencia ascendente: los comunes quedan solos al final. Sin
    // frecuencia conocida, justo antes de los comunes.
    candidatos.sort((a, b) =>
        (a.n ?? input.commonFrom - 1) - (b.n ?? input.commonFrom - 1)
        || b.l.occurrences - a.l.occurrences
        || a.orden - b.orden);

    const porHoja = new Map<number, LexiconSuggestionEntry>();
    const leftOut: string[] = [];
    let usados = 0;
    for (const c of candidatos) {
        const motivos: SuggestionReason[] = [];
        if (c.n !== undefined && c.n <= RARE_LEMMA_MAX) motivos.push({ kind: 'rare', bibleCount: c.n });
        if (c.l.occurrences > 1) motivos.push({ kind: 'repeated', passageCount: c.l.occurrences });
        if (c.comun) motivos.push({ kind: 'common', bibleCount: c.n! });

        const ya = porHoja.get(c.sheet);
        if (ya) {
            ya.lemmas.push(c.l.lemma);
            ya.reasons.push(...motivos);
            continue;
        }
        const chars = input.sheetChars(c.sheet);
        if (usados + chars > input.budgetChars) { leftOut.push(c.l.lemma); continue; }
        usados += chars;
        porHoja.set(c.sheet, { sheet: c.sheet, lemmas: [c.l.lemma], reasons: motivos });
    }
    return { picked: [...porHoja.values()], leftOut, notFound };
}

/**
 * «Selección sugerida» para una gramática: las secciones del índice que tratan
 * las categorías del pasaje (`grammarKeysFromMorphology` + encuadre), las
 * corroboradas primero, hasta llenar el presupuesto. Una hoja por sección.
 */
export function suggestGrammarSelection(input: {
    sections: ReadonlyArray<SectionProposal>;
    sheetChars: (sheet: number) => number;
    budgetChars: number;
}): LexiconSuggestion {
    const porHoja = new Map<number, LexiconSuggestionEntry>();
    const leftOut: string[] = [];
    let usados = 0;
    for (const s of input.sections) {
        const motivo: SuggestionReason = { kind: 'section', title: s.section, matched: [...s.matched] };
        const ya = porHoja.get(s.sheet);
        if (ya) { ya.reasons.push(motivo); continue; }
        const chars = input.sheetChars(s.sheet);
        if (usados + chars > input.budgetChars) { leftOut.push(s.section); continue; }
        usados += chars;
        porHoja.set(s.sheet, { sheet: s.sheet, lemmas: [], reasons: [motivo] });
    }
    return { picked: [...porHoja.values()], leftOut, notFound: [] };
}
