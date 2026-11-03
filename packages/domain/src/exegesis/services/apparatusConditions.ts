import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';

/**
 * Lo que dice el aparato llega al criterio y a la prosa (P1 de la fase
 * «Revisión autónoma», etapa 4 de «Lecciones del TI #2»).
 *
 * Regla de dominio, sin modelo: si el criterio decisivo de una pregunta —o la
 * traducción decidida— menciona una forma que tiene variantes en
 * `textualCriticism.variants` (el lema o la lectura de una variante), la
 * respuesta está CONDICIONADA POR EL TEXTO. Entonces el análisis tiene que
 * decir sobre qué lectura decide y por qué, y la prosa tiene que nombrarla: el
 * compositor lo recibe en el análisis serializado.
 *
 * TP #9 (Santiago 4:11-17), leído en producción: el criterio de 4:14 decide
 * «por la presencia de τὸ», y el aparato da τὰ y la omisión; el de 4:12
 * descansa en ὁ κρίνων, que el aparato da también como κρίνων y ὃς κρίνεις.
 * Ninguna de las dos prosas lo decía.
 */
export interface ConditioningVariant {
    /** La pregunta cuyo criterio depende de la variante; `null` si es la traducción decidida. */
    questionNumber: number | null;
    lemma: string;
    adopted: string;
    /** Las otras lecturas, sin la adoptada ni la omisión. */
    rivals: string[];
    /** Si alguna lectura es la omisión («∅»). */
    omission: boolean;
    /** Testigos de las otras lecturas: «τὰ A P 33». */
    witnesses: string;
}

/** Griego o hebreo comparable: sin acentos, espíritus, vocales ni signos. */
export function plainOriginal(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ς/g, 'σ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const OMISION = /^(?:∅|om\.?|omit(?:e|s|ted)?|—|-)$/iu;

function contiene(texto: string, forma: string): boolean {
    const f = plainOriginal(forma);
    return !!f && ` ${plainOriginal(texto)} `.includes(` ${f} `);
}

export function conditioningVariants(analysis: CanonicalVerseAnalysis | null): ConditioningVariant[] {
    const variantes = analysis?.textualCriticism?.variants ?? [];
    if (variantes.length === 0) return [];
    const out: ConditioningVariant[] = [];
    for (const v of variantes) {
        const lecturas = (v.readings ?? []).map(r => r.text?.trim() ?? '').filter(t => t && !OMISION.test(t));
        const formas = [...new Set([v.lemma?.trim() ?? '', ...lecturas].filter(Boolean))];
        if (formas.length === 0) continue;
        const menciona = (texto: string | null | undefined) => !!texto && formas.some(f => contiene(texto, f));
        const base = {
            lemma: v.lemma,
            adopted: v.adoptedReading,
            rivals: lecturas.filter(t => plainOriginal(t) !== plainOriginal(v.adoptedReading ?? '')),
            omission: (v.readings ?? []).some(r => OMISION.test(r.text?.trim() ?? '')),
            witnesses: (v.readings ?? [])
                .filter(r => plainOriginal(r.text ?? '') !== plainOriginal(v.adoptedReading ?? ''))
                .map(r => `${r.text} ${(r.witnesses ?? []).join(' ')}`.trim())
                .join('; '),
        };
        let encontrada = false;
        for (const q of analysis?.questionAnswers ?? []) {
            if (menciona(q.decisiveCriterion?.text)) {
                out.push({ ...base, questionNumber: q.questionNumber });
                encontrada = true;
            }
        }
        if (!encontrada && menciona(analysis?.finalTranslation)) out.push({ ...base, questionNumber: null });
    }
    return out;
}
