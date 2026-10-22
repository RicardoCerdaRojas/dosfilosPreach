import type { AnalyzeVerseInput, CanonicalVerseAnalysis } from '@dosfilos/domain';

// Vive aparte del analizador para poder usarlo sin arrastrar el cliente de
// Firebase del navegador: el banco de funciones (`scripts/llm-bakeoff`) valida
// con este mismo mapeador las respuestas de cada modelo candidato.

/**
 * Maps the Gemini JSON payload to the domain `CanonicalVerseAnalysis`
 * type. Stamps `reference` from the input (the schema doesn't include
 * it because it's known by the caller) and `createdAt` / `updatedAt`
 * with the current time.
 *
 * Performs a shallow shape validation so any schema drift between the
 * domain entity and the response schema surfaces as a parse error
 * with a clear field reference.
 */
export function mapToCanonicalVerseAnalysis(
    payload: unknown,
    input: AnalyzeVerseInput,
): CanonicalVerseAnalysis {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Analyzer response: payload is not an object');
    }
    const p = payload as Record<string, unknown>;

    const requireField = (name: string): unknown => {
        if (!(name in p)) {
            throw new Error(`Analyzer response: missing required field "${name}"`);
        }
        return p[name];
    };

    const now = new Date();

    return {
        reference: input.verseRef,
        originalText: String(requireField('originalText')),
        textualCriticism: requireField('textualCriticism') as CanonicalVerseAnalysis['textualCriticism'],
        syntacticAnalysis: requireField('syntacticAnalysis') as CanonicalVerseAnalysis['syntacticAnalysis'],
        lexicalAnalyses: requireField('lexicalAnalyses') as CanonicalVerseAnalysis['lexicalAnalyses'],
        argumentativeRole: String(requireField('argumentativeRole')),
        historicalContext: requireField('historicalContext') as CanonicalVerseAnalysis['historicalContext'],
        oldTestamentLinks: requireField('oldTestamentLinks') as CanonicalVerseAnalysis['oldTestamentLinks'],
        commentatorEngagement: requireField('commentatorEngagement') as CanonicalVerseAnalysis['commentatorEngagement'],
        translationCruxes: requireField('translationCruxes') as CanonicalVerseAnalysis['translationCruxes'],
        initialTranslation: String(requireField('initialTranslation')),
        finalTranslation: String(requireField('finalTranslation')),
        verseThesis: String(requireField('verseThesis')),
        theologicalHooks: requireField('theologicalHooks') as CanonicalVerseAnalysis['theologicalHooks'],
        confidenceFlags: requireField('confidenceFlags') as CanonicalVerseAnalysis['confidenceFlags'],
        footnoteExtensions: requireField('footnoteExtensions') as CanonicalVerseAnalysis['footnoteExtensions'],
        ...((input.sectionQuestions?.length ?? 0) > 0
            ? { questionAnswers: normalizeQuestionAnswers(p.questionAnswers, input) }
            : {}),
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Las respuestas, con forma garantizada: arreglos donde el modelo dejó otra
 * cosa y sólo las preguntas que se le hicieron (C1). Una respuesta a una
 * pregunta que no es de este versículo se descarta.
 */
function normalizeQuestionAnswers(raw: unknown, input: AnalyzeVerseInput): NonNullable<CanonicalVerseAnalysis['questionAnswers']> {
    if (!Array.isArray(raw)) return [];
    const numeros = new Set((input.sectionQuestions ?? []).map(q => q.number));
    const texto = (v: unknown) => (typeof v === 'string' ? v : '');
    const citas = (v: unknown) => (Array.isArray(v) ? v.filter(c => c && typeof c === 'object' && typeof (c as { sourceKey?: unknown }).sourceKey === 'string') : []) as never[];
    return raw
        .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
        .filter(q => typeof q.questionNumber === 'number' && numeros.has(q.questionNumber))
        .map(q => {
            const criterio = (q.decisiveCriterion && typeof q.decisiveCriterion === 'object' ? q.decisiveCriterion : {}) as Record<string, unknown>;
            return {
                questionNumber: q.questionNumber as number,
                directAnswer: texto(q.directAnswer),
                options: (Array.isArray(q.options) ? q.options : [])
                    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
                    .map(o => ({ reading: texto(o.reading), argument: texto(o.argument), defenders: citas(o.defenders) })),
                decisiveCriterion: {
                    text: texto(criterio.text),
                    whyThisOverThat: texto(criterio.whyThisOverThat),
                    sources: citas(criterio.sources),
                },
                decision: texto(q.decision),
            };
        });
}
