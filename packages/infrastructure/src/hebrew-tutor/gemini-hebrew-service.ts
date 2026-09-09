/**
 * HebrewAnalysisService
 *
 * Implements IHebrewAnalysisService using Google Gemini 2.5 Flash.
 * Applies Farfán's grammar rules and the professor's pedagogical methodology
 * to produce morphological and syntactic verse analyses.
 *
 * Design decisions:
 *  - Uses responseMimeType 'application/json' to enforce structured output
 *  - Temperature 0.2 for deterministic, grammar-rule-driven analysis
 *  - Knowledge chunks are injected per-request (via the knowledge selector)
 *  - maxOutputTokens 32768 to accommodate long verse analyses with many words
 */

import type { IHebrewAnalysisService, HebrewVerse, VerseAnalysis, LexicalEntry } from '@dosfilos/domain';
import { runLlmPrompt } from '../llm/callableLlm';
import { GEMINI_CONFIG } from '../gemini/config.js';
import { selectRelevantChunks } from './knowledge/knowledge-selector.js';
import { buildVerseAnalysisPrompt } from './knowledge/hebrew-prompt-builder.js';
import { LONG_GENERATION_TIMEOUT_MS } from '../llm/llmTimeouts';

/**
 * Análisis morfológico del hebreo. Ya NO habla con Gemini desde el navegador:
 * el prompt se arma acá (necesita el selector de gramática y el glosario léxico
 * de este paquete) y la llamada al modelo sale por el proxy del servidor, que
 * autentica, limita y mide. La clave dejó de viajar en el bundle.
 */
export class HebrewAnalysisService implements IHebrewAnalysisService {

  async analyzeVerse(
    verse: HebrewVerse,
    language = 'es',
    lexicalEntries: readonly LexicalEntry[] = [],
  ): Promise<VerseAnalysis> {
    // 1. Select the most relevant grammar knowledge chunks for this verse
    const knowledgeChunks = selectRelevantChunks(verse.hebrewText, [], 10);

    // 2. Build the full pedagogical prompt (includes lexical glossary context when provided)
    const prompt = buildVerseAnalysisPrompt(verse, knowledgeChunks, lexicalEntries, language);

    // 3. Call Gemini
    let rawResponse: string;
    try {
      rawResponse = await runLlmPrompt({
        feature: 'hebrewTutor.analyzeVerse',
        prompt,
        model: GEMINI_CONFIG.MODEL_NAME,
        responseMimeType: 'application/json',
        temperature: 0.2, // Bajo: el análisis morfológico debe ser determinista.
        maxOutputTokens: 32768, // Versos largos (Job, Salmos) necesitan espacio.
      }, { timeoutMs: LONG_GENERATION_TIMEOUT_MS });
    } catch (error) {
      throw new Error(
        `HebrewAnalysisService: API call failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // 4. Parse and validate the JSON response
    const analysis = this.parseAnalysisResponse(rawResponse, verse);

    return analysis;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Parses the Gemini JSON response into a VerseAnalysis domain entity.
   * Performs minimal validation and provides safe defaults.
   */
  private parseAnalysisResponse(rawJson: string, verse: HebrewVerse): VerseAnalysis {
    let data: Record<string, unknown>;

    const cleaned = this.cleanJsonResponse(rawJson);

    // First attempt: parse as-is
    try {
      data = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      // Second attempt: strip the lexicalNotes array if it may be malformed/truncated.
      // Gemini sometimes truncates the last array when the response is near the token limit.
      const fallback = this.stripTrailingLexicalNotes(cleaned);
      try {
        data = JSON.parse(fallback) as Record<string, unknown>;
        console.warn('HebrewAnalysisService: lexicalNotes stripped to recover malformed JSON.');
      } catch (e) {
        throw new Error(
          `HebrewAnalysisService: Failed to parse JSON response. Raw: ${rawJson.slice(0, 400)}`,
        );
      }
    }

    // Validate required top-level fields
    if (!data.words || !Array.isArray(data.words)) {
      throw new Error(
        `HebrewAnalysisService: Response missing required "words" array. Data keys: ${Object.keys(data).join(', ')}`,
      );
    }

    // Restore cantillation marks (te'amim) stripped by Gemini during text generation.
    // morphhb is the authoritative source for the Masoretic Text Unicode codepoints.
    const reconciledWords = this.reconcileWordTexts(
      data.words as VerseAnalysis['words'],
      verse,
    );

    return {
      reference: (data.reference as string) || verse.displayReference,
      hebrewText: verse.hebrewText, // Always use morphhb text — preserves full te'amim
      transliteration: (data.transliteration as string) || '',
      literalTranslation: (data.literalTranslation as string) || '',
      fluidTranslation: (data.fluidTranslation as string) || '',
      words: reconciledWords,
      verbTable: Array.isArray(data.verbTable) ? (data.verbTable as VerseAnalysis['verbTable']) : [],
      exegeticalNotes: Array.isArray(data.exegeticalNotes)
        ? (data.exegeticalNotes as string[])
        : undefined,
      lexicalNotes: Array.isArray(data.lexicalNotes) && data.lexicalNotes.length > 0
        ? (data.lexicalNotes as VerseAnalysis['lexicalNotes'])
        : undefined,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Reconciles each WordAnalysis.hebrewText with its corresponding HebrewWordToken
   * from the morphhb dataset.
   *
   * Gemini normalizes Unicode when generating JSON, stripping combining characters
   * such as cantillation marks (te'amim, U+0591–U+05AF). The morphhb tokens are
   * the authoritative Masoretic text and preserve all diacritics.
   *
   * Matching strategy: positional (by index).
   *  - If counts match exactly → direct 1-to-1 replacement.
   *  - If Gemini returned fewer words (e.g. it merged a prefixed token) → replace
   *    only the words that have a corresponding morphhb token; leave the rest as-is.
   *  - If Gemini returned more words → extra words keep Gemini's text (safe fallback).
   */
  private reconcileWordTexts(
    geminiWords: VerseAnalysis['words'],
    verse: HebrewVerse,
  ): VerseAnalysis['words'] {
    const morphhbTokens = verse.words ?? [];

    if (morphhbTokens.length === 0) {
      // No morphhb data available — return as-is
      return geminiWords;
    }

    console.log('--- RECONCILE START ---');
    const mapped = reconcileGlobalWords(geminiWords, morphhbTokens);
    console.log('--- RECONCILE END ---');
    return mapped;
  }

  /**
   * Removes markdown code fences and trims to valid JSON bounds.
   */
  private cleanJsonResponse(text: string): string {
    let cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return cleaned; // Let JSON.parse throw with the original text
    }

    return cleaned.substring(firstBrace, lastBrace + 1);
  }

  /**
   * Strips the `lexicalNotes` key (and its potentially truncated array) from a
   * JSON string, then closes the object with `}`.
   *
   * This is a recovery strategy: when Gemini's output is near the token limit it
   * sometimes emits an incomplete `lexicalNotes` array. Removing it preserves
   * the rest of the analysis (words, verbTable, translations, etc.).
   */
  private stripTrailingLexicalNotes(json: string): string {
    // Match "lexicalNotes": [ ... (possibly truncated)
    const idx = json.lastIndexOf('"lexicalNotes"');
    if (idx === -1) return json;

    // Cut everything from "lexicalNotes" onwards
    let truncated = json.substring(0, idx).trimEnd();

    // Remove trailing comma if present
    if (truncated.endsWith(',')) {
      truncated = truncated.slice(0, -1).trimEnd();
    }

    // Close the JSON object
    return truncated + '}';
  }
}

/**
 * Reconciles each WordAnalysis.hebrewText with its corresponding HebrewWordToken
 * from the morphhb dataset.
 *
 * Gemini normalizes Unicode when generating JSON, stripping combining characters
 * such as cantillation marks (te'amim, U+0591–U+05AF). The morphhb tokens are
 * the authoritative Masoretic text and preserve all diacritics.
 *
 * Matching strategy: positional (by index).
 *  - If counts match exactly → direct 1-to-1 replacement.
 *  - If Gemini returned fewer words (e.g. it merged a prefixed token) → replace
 *    only the words that have a corresponding morphhb token; leave the rest as-is.
 *  - If Gemini returned more words → extra words keep Gemini's text (safe fallback).
 */
export function reconcileGlobalWords(
  geminiWords: VerseAnalysis['words'],
  morphhbTokens: readonly { text: string }[]
): VerseAnalysis['words'] {
  if (!morphhbTokens || morphhbTokens.length === 0) {
    return geminiWords;
  }

  // Verse-level punctuation that should not appear inside word morphemes.
  // - U+05C3 ׃ SOF PASUQ    — end-of-verse double dot
  // - U+05C0 ׀ PASEQ        — pause separator between clauses
  // These are attached by morphhb to the last token of a verse/clause
  // but have no morphological significance for a single word.
  const VERSE_PUNCT_RE = /[\u05C3\u05C0]/g;

  // Flatten all morphemes from the LLM output
  const allMorphemes = geminiWords.flatMap((w) => w.morphemes || []);
  if (allMorphemes.length === 0) return geminiWords;

  const isConsonant = (char: string) => char >= '\u05D0' && char <= '\u05EA';
  
  // Create a clean copy of morphemes to build up text
  const newMorphemes = allMorphemes.map((m) => ({ ...m, text: '' }));
  
  // Count how many consonants Gemini generated per morpheme
  const consCounts = allMorphemes.map((m) => Array.from(m.text).filter(isConsonant).length);

  // Reconstruct authoritative text as a single continuous string
  const authText = morphhbTokens.map((t) => t.text).join('');

  let currentMorphIdx = 0;
  let consSeen = 0;

  for (const char of authText) {
    if (isConsonant(char)) {
      // Advance past any morphemes that have 0 consonants (e.g. prefix vowels)
      while (currentMorphIdx < allMorphemes.length && consCounts[currentMorphIdx] === 0) {
        currentMorphIdx++;
      }
      consSeen++;
      if (currentMorphIdx < allMorphemes.length) {
        newMorphemes[currentMorphIdx].text += char;
        if (consSeen >= consCounts[currentMorphIdx]) {
          currentMorphIdx++;
          consSeen = 0;
        }
      } else {
        // Excess consonants go to the last morpheme
        if (newMorphemes.length > 0) newMorphemes[newMorphemes.length - 1].text += char;
      }
    } else {
      // Non-consonant (vowel, cantillation/te'amim, dagesh, maqaf)
      // Attach to the morpheme of the PREVIOUS consonant, or the current one if at the start
      let attachIdx = currentMorphIdx;
      if (consSeen === 0) {
        attachIdx = Math.max(0, currentMorphIdx - 1);
      }
      if (attachIdx >= newMorphemes.length) {
        attachIdx = newMorphemes.length - 1;
      }
      if (newMorphemes.length > 0) {
        newMorphemes[attachIdx].text += char;
      }
    }
  }

  // Restore 0-consonant morphemes if they remained completely empty
  for (let i = 0; i < newMorphemes.length; i++) {
    if (newMorphemes[i].text === '') {
      // The authoritative text already distributed its maqafs (\u05BE).
      // We must not restore hallucinated/duplicated maqafs from the LLM.
      newMorphemes[i].text = allMorphemes[i].text.replace(/\u05BE/g, '');
    }
  }

  // Distribute back to the words
  let mIdx = 0;
  return geminiWords.map((w) => {
    const wordMorphemes = w.morphemes ? newMorphemes.slice(mIdx, mIdx + w.morphemes.length) : [];
    mIdx += w.morphemes?.length || 0;

    // Strip verse-level punctuation from every morpheme text so sof pasuq
    // doesn't render as a visible repeated character inside the word display.
    const cleanMorphemes = wordMorphemes.map((m) => ({
      ...m,
      text: m.text.replace(VERSE_PUNCT_RE, ''),
    }));

    return {
      ...w,
      // wordMorphemes keeps the punctuation so it appears in the full verse display
      hebrewText: wordMorphemes.map((m) => m.text).join(''),
      // cleanMorphemes omits punctuation so it doesn't render inside the single-word view
      morphemes: cleanMorphemes,
    };
  });
}
