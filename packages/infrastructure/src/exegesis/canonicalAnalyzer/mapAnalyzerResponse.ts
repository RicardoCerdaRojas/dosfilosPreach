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
        createdAt: now,
        updatedAt: now,
    };
}
