import { lemmaKey, type PassageLemma, type SheetHitCount } from './lemmaPages';
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
    | { kind: 'section'; title: string; matched: string[] }
    /** La consigna nombra la palabra: va primero (TP #8, fase 8a, A2). */
    | { kind: 'question'; number: number };

export interface LexiconSuggestionEntry {
    sheet: number;
    /**
     * Última hoja de la entrada, si llega más allá de `sheet`. La entrada de
     * μέλος en Tuggy es 584–585: la definición y, en la hoja siguiente, su
     * lista de citas (TP #8, fase 8a, A2).
     */
    endSheet?: number;
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
    /**
     * Dónde empieza y termina la entrada de un lema, si el libro la marca. Sin
     * entrada se usa la hoja más probable, como antes.
     */
    entryOf?: (lemma: string) => { startSheet: number; endSheet: number } | undefined;
    /**
     * Los lemas que escribe la consigna (`questionLemmas`), por `lemmaKey`, con
     * el número de su pregunta: van primero, antes del orden por frecuencia.
     */
    questionLemmas?: ReadonlyMap<string, number>;
}): LexiconSuggestion {
    const notFound: string[] = [];
    const candidatos = input.lemmas.flatMap((l, orden) => {
        const entrada = input.entryOf?.(l.lemma);
        const hoja = entrada?.startSheet ?? input.sheetsOf(l.lemma)[0]?.sheet;
        if (hoja === undefined) { notFound.push(l.lemma); return []; }
        const fin = entrada && entrada.endSheet > entrada.startSheet ? entrada.endSheet : undefined;
        const n = input.bibleCount(l);
        const pregunta = input.questionLemmas?.get(lemmaKey(l.lemma));
        return [{ l, orden, sheet: hoja, fin, n, pregunta, comun: n !== undefined && n >= input.commonFrom }];
    });

    // Primero lo que nombra la consigna, en el orden de las preguntas. Después,
    // por frecuencia ascendente: los comunes quedan solos al final. Sin
    // frecuencia conocida, justo antes de los comunes.
    candidatos.sort((a, b) =>
        (a.pregunta ?? Number.POSITIVE_INFINITY) - (b.pregunta ?? Number.POSITIVE_INFINITY)
        || (a.n ?? input.commonFrom - 1) - (b.n ?? input.commonFrom - 1)
        || b.l.occurrences - a.l.occurrences
        || a.orden - b.orden);

    const porHoja = new Map<number, LexiconSuggestionEntry>();
    const leftOut: string[] = [];
    let usados = 0;
    for (const c of candidatos) {
        const motivos: SuggestionReason[] = [];
        if (c.pregunta !== undefined) motivos.push({ kind: 'question', number: c.pregunta });
        if (c.n !== undefined && c.n <= RARE_LEMMA_MAX) motivos.push({ kind: 'rare', bibleCount: c.n });
        if (c.l.occurrences > 1) motivos.push({ kind: 'repeated', passageCount: c.l.occurrences });
        if (c.comun) motivos.push({ kind: 'common', bibleCount: c.n! });

        const ya = porHoja.get(c.sheet);
        if (ya) {
            ya.lemmas.push(c.l.lemma);
            ya.reasons.push(...motivos);
            if (c.fin !== undefined && (ya.endSheet ?? ya.sheet) < c.fin) ya.endSheet = c.fin;
            continue;
        }
        let chars = 0;
        for (let h = c.sheet; h <= (c.fin ?? c.sheet); h++) chars += input.sheetChars(h);
        if (usados + chars > input.budgetChars) { leftOut.push(c.l.lemma); continue; }
        usados += chars;
        porHoja.set(c.sheet, { sheet: c.sheet, ...(c.fin !== undefined ? { endSheet: c.fin } : {}), lemmas: [c.l.lemma], reasons: motivos });
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
