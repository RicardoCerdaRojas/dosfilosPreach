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

import type { IHebrewAnalysisService, HebrewVerse, VerseAnalysis, LexicalEntry, SpeechFact, StructureNode } from '@dosfilos/domain';
import { HEBREW_ANALYSIS_PROMPT_VERSION, parseClauseReadings, reconcileGlobalWords } from '@dosfilos/domain';
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
    structure: readonly StructureNode[] = [],
    speech: readonly SpeechFact[] = [],
  ): Promise<VerseAnalysis> {
    // 1. Select the most relevant grammar knowledge chunks for this verse
    const knowledgeChunks = selectRelevantChunks(verse.hebrewText, [], 10);

    // 2. Build the full pedagogical prompt (includes lexical glossary context when provided)
    const prompt = buildVerseAnalysisPrompt(verse, knowledgeChunks, lexicalEntries, language, structure, speech);

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
    const analysis = this.parseAnalysisResponse(rawResponse, verse, structure);

    return analysis;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Parses the Gemini JSON response into a VerseAnalysis domain entity.
   * Performs minimal validation and provides safe defaults.
   */
  private parseAnalysisResponse(rawJson: string, verse: HebrewVerse, structure: readonly StructureNode[] = []): VerseAnalysis {
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
      // Se validan después, contra las palabras (`checkClauseConnections`).
      clauses: Array.isArray(data.clauses) ? (data.clauses as VerseAnalysis['clauses']) : [],
      // Con estructura, el asistente LEE las filas: se validan contra ellas.
      ...(structure.length ? { clauseReadings: parseClauseReadings(data.clauseReadings, structure) } : {}),
      exegeticalNotes: Array.isArray(data.exegeticalNotes)
        ? (data.exegeticalNotes as string[])
        : undefined,
      lexicalNotes: Array.isArray(data.lexicalNotes) && data.lexicalNotes.length > 0
        ? (data.lexicalNotes as VerseAnalysis['lexicalNotes'])
        : undefined,
      analyzedAt: new Date().toISOString(),
      // v3 = el asistente LEYÓ las filas de «Estructura». Sin filas (datos que
      // no se pudieron leer) el prompt fue el de v2 —partir cláusulas— y así se
      // marca: la interfaz ofrecerá re-analizar en vez de decir «sin lectura».
      promptVersion: structure.length ? HEBREW_ANALYSIS_PROMPT_VERSION : 2,
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
   * Palabra por palabra: ver `reconcileGlobalWords`.
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

    return reconcileGlobalWords(geminiWords, morphhbTokens);
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
