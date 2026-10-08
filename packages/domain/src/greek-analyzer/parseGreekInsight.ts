import { readVerbFunction, type VerbCandidate } from '../language-structure/verbFunctions';
import { parseClauseReadings } from '../language-structure/clauseReading';
import type { StructureNode } from '../language-structure/verseStructure';
import { GREEK_INSIGHT_PROMPT_VERSION, type GreekVerseInsight, type GreekWordInsight } from './verseInsight';
import { isKnownCaseFunction } from './caseFunctionTaxonomy';
import { validateRhetoricalStructure, validateWordRelations } from './rhetoricalStructure';
import { isKnownArticleUse } from './articleUseTaxonomy';
import { isKnownDiscourseFunction } from './particleTaxonomy';
import type { GreekCase } from './morphGntToken';

/**
 * Valida la respuesta del modelo ANTES de cachearla.
 *
 * EL ALINEAMIENTO ES EL CONTRATO: la palabra i del insight explica al token i
 * del versículo. Un modelo que omite o duplica una palabra desalinearía TODAS
 * las siguientes — cada tarjeta mostraría el análisis de la palabra vecina, el
 * peor error posible en una herramienta de estudio porque parece correcto. Por
 * eso una longitud distinta descarta la respuesta entera: mejor sin análisis
 * que con el análisis corrido.
 */
export function parseGreekInsight(
    raw: string,
    input: {
        reference: string;
        expectedWordCount: number;
        /**
         * El caso de cada token, en orden. Sirve para VALIDAR la función que
         * devuelve el modelo contra la taxonomía cerrada de ESE caso: un
         * "genitivo de medio" no existe, y una etiqueta con aire académico
         * que ningún profesor reconoce es peor que ninguna.
         */
        cases?: readonly (GreekCase | undefined)[];
        /** Las filas de «Estructura» que se mandaron a leer (en el mismo orden). */
        structure?: readonly StructureNode[];
        /** Los verbos con sus funciones posibles (G2): valida lo que devolvió el asistente. */
        verbs?: readonly VerbCandidate[];
    },
): GreekVerseInsight | null {
    const inicio = raw.indexOf('{');
    const fin = raw.lastIndexOf('}');
    if (inicio === -1 || fin <= inicio) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw.slice(inicio, fin + 1));
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;

    const literal = typeof p.literalTranslation === 'string' ? p.literalTranslation.trim() : '';
    const fluida = typeof p.fluidTranslation === 'string' ? p.fluidTranslation.trim() : '';
    if (!literal || !fluida) return null;

    if (!Array.isArray(p.words) || p.words.length !== input.expectedWordCount) return null;

    const words: GreekWordInsight[] = [];
    for (const [i, crudo] of p.words.entries()) {
        const w = crudo as Record<string, unknown>;
        const text = typeof w.text === 'string' ? w.text.trim() : '';
        const semanticRange = typeof w.semanticRange === 'string' ? w.semanticRange.trim() : '';
        const syntacticFunction = typeof w.syntacticFunction === 'string' ? w.syntacticFunction.trim() : '';
        const translation = typeof w.translation === 'string' ? w.translation.trim() : '';
        if (!text || !semanticRange || !syntacticFunction || !translation) return null;

        const caso = input.cases?.[i];
        const fnCruda = typeof w.caseFunction === 'string' ? w.caseFunction.trim() : '';
        const caseFunction = caso && fnCruda && isKnownCaseFunction(caso, fnCruda) ? fnCruda : undefined;
        const nameNote = typeof w.nameNote === 'string' ? w.nameNote.trim() : '';

        const usoCrudo = typeof w.articleUse === 'string' ? w.articleUse.trim() : '';
        const articleUse = isKnownArticleUse(usoCrudo) ? usoCrudo : undefined;
        // EL ANTECEDENTE SÓLO EXISTE CON ANÁFORA: un "señala hacia atrás"
        // colgado de un artículo genérico sería una relación inventada.
        const antecedenteCrudo = typeof w.antecedent === 'string' ? w.antecedent.trim() : '';
        const antecedent = articleUse === 'anaphoric' && antecedenteCrudo ? antecedenteCrudo : undefined;

        const discCruda = typeof w.discourseFunction === 'string' ? w.discourseFunction.trim() : '';
        const discourseFunction = isKnownDiscourseFunction(discCruda) ? discCruda : undefined;
        const conectaCrudo = typeof w.connects === 'string' ? w.connects.trim() : '';
        // "Qué conecta" sin función discursiva sería una afirmación sobre el
        // argumento sin la categoría que la sostiene.
        const connects = discourseFunction && conectaCrudo ? conectaCrudo : undefined;

        // COMPOSICIÓN: al menos DOS partes con glosa, y el veredicto sobre la
        // falacia de la raíz es OBLIGATORIO — sin él la descomposición
        // invitaría justo al error que pretende prevenir.
        const comp = w.composition as Record<string, unknown> | undefined;
        let composition: GreekWordInsight['composition'];
        if (comp && typeof comp === 'object' && Array.isArray(comp.parts)) {
            const parts = comp.parts
                .map((c) => {
                    const x = c as Record<string, unknown>;
                    const text = typeof x.text === 'string' ? x.text.trim() : '';
                    const gloss = typeof x.gloss === 'string' ? x.gloss.trim() : '';
                    return text && gloss ? { text, gloss } : null;
                })
                .filter((c): c is { text: string; gloss: string } => c !== null);
            const nota = typeof comp.note === 'string' ? comp.note.trim() : '';
            if (parts.length >= 2 && nota && typeof comp.meaningMatchesParts === 'boolean') {
                composition = { parts, note: nota, meaningMatchesParts: comp.meaningMatchesParts };
            }
        }

        const verbo = readVerbFunction(w, input.verbs?.find(c => c.ordinal === i));
        words.push({
            ...verbo,
            text,
            semanticRange,
            syntacticFunction,
            translation,
            ...(caseFunction ? { caseFunction } : {}),
            ...(nameNote ? { nameNote } : {}),
            ...(articleUse ? { articleUse } : {}),
            ...(antecedent ? { antecedent } : {}),
            ...(discourseFunction ? { discourseFunction } : {}),
            ...(connects ? { connects } : {}),
            ...(composition ? { composition } : {}),
        });
    }

    // Las claves exegéticas son OPCIONALES y se validan suave: una entrada
    // malformada se descarta sola, sin tumbar el análisis entero — a
    // diferencia de `words`, donde el desalineamiento corrompe todo.
    const keyInsights = Array.isArray(p.keyInsights)
        ? p.keyInsights
              .map((crudo) => {
                  const k = crudo as Record<string, unknown>;
                  const text = typeof k.text === 'string' ? k.text.trim() : '';
                  const significance = typeof k.significance === 'string' ? k.significance.trim() : '';
                  // La posición vale sólo si en ella está ESA palabra (sin puntuación).
                  const sin = (x: string) => x.replace(/[.,·;··’]+$/u, '');
                  // «n» es el número de la lista del prompt (desde 1); se guarda la posición (desde 0).
                  const pos = typeof k.n === 'number' && Number.isInteger(k.n) ? k.n - 1 : -1;
                  const index = pos >= 0 && words[pos] && sin(words[pos]!.text) === sin(text) ? pos : undefined;
                  return text && significance ? { ...(index !== undefined ? { index } : {}), text, significance } : null;
              })
              .filter((k): k is { index?: number; text: string; significance: string } => k !== null)
              .slice(0, 3)
        : [];

    const wordOrderNote = typeof p.wordOrderNote === 'string' ? p.wordOrderNote.trim() : '';
    // Ambas se validan contra el dato determinista y se caen solas si no se
    // sostienen — sin tumbar el resto del análisis.
    const relations = validateWordRelations(p.relations, input.cases ?? []);
    const rhetoric = validateRhetoricalStructure(p.rhetoric, input.expectedWordCount);
    const clauseReadings = input.structure ? parseClauseReadings(p.clauseReadings, input.structure) : [];

    return {
        reference: input.reference,
        literalTranslation: literal,
        fluidTranslation: fluida,
        words,
        ...(keyInsights.length > 0 ? { keyInsights } : {}),
        ...(wordOrderNote ? { wordOrderNote } : {}),
        ...(relations.length > 0 ? { relations } : {}),
        ...(rhetoric ? { rhetoric } : {}),
        ...(clauseReadings.length > 0 ? { clauseReadings } : {}),
        promptVersion: GREEK_INSIGHT_PROMPT_VERSION,
    };
}
