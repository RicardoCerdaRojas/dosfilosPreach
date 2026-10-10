import type { StructureNode } from '../../language-structure/verseStructure.js';
import type { SpeechFact } from '../../language-structure/hebrewSpeech.js';
import type { HebrewInfinitiveCandidate } from '../../language-structure/hebrewInfinitive.js';
/**
 * Domain ports (interfaces) for the Hebrew Tutor module.
 *
 * These define the contracts between the application layer and the
 * infrastructure implementations. Inner layers depend on these abstractions,
 * never on concrete classes.
 */

import type { HebrewBook, HebrewVerse, BookIndex } from '../entities/hebrew-bible.js';
import type { VerseAnalysis } from '../entities/verse-analysis.js';
import type { DetectiveSession } from '../entities/detective-session.js';
import type { LexicalEntry } from '../entities/lexical-entry.js';

// ── IHebrewBibleProvider ──────────────────────────────────────────────────────

/**
 * Port for navigating and retrieving text from the Hebrew Bible.
 * Implemented by MorphhbBibleProvider (uses the morphhb npm package).
 *
 * IMPORTANT: The morphhb data provides ONLY the Hebrew text.
 * Morphological analysis authority lies with Farfán + professor (via Gemini).
 */
export interface IHebrewBibleProvider {
  /** Returns the ordered list of all books in the Hebrew canon. */
  getBooks(): HebrewBook[];

  /** Returns navigation index (verse counts per chapter) for a book. */
  getBookIndex(morphhbKey: string): BookIndex;

  /** Returns the number of chapters in a book. */
  getChapterCount(morphhbKey: string): number;

  /** Returns the number of verses in a given chapter. */
  getVerseCount(morphhbKey: string, chapter: number): number;

  /**
   * Retrieves a verse with its Hebrew text and word tokens.
   * @param morphhbKey - book key as used by morphhb, e.g. "Jonah"
   * @param chapter - 1-indexed chapter number
   * @param verse - 1-indexed verse number
   */
  getVerse(morphhbKey: string, chapter: number, verse: number): HebrewVerse;
}

// ── IHebrewAnalysisService ────────────────────────────────────────────────────

/**
 * Port for morphological and syntactic analysis of Hebrew verses.
 * Implemented by GeminiHebrewService.
 *
 * Gemini generates analyses by applying Farfán's grammar rules and the
 * professor's pedagogical lessons to the Hebrew text provided by morphhb.
 */
export interface IHebrewAnalysisService {
  /**
   * Produces a complete morphological and syntactic analysis of a verse.
   * @param verse - The verse from the Bible provider (text from morphhb)
   * @param language - UI language for the response ("es" | "en"), defaults "es"
   * @param lexicalEntries - Optional curated lexical entries matched to this verse.
   *   When provided, they are injected into the prompt to guide idiomatic translation
   *   without altering the literal translation.
   */
  analyzeVerse(
    verse: HebrewVerse,
    language?: string,
    lexicalEntries?: readonly LexicalEntry[],
    /** Filas de «Estructura» (MACULA): el asistente las LEE en vez de partir cláusulas (G1 + G5). */
    structure?: readonly StructureNode[],
    /** Quién habla y a quién (MACULA): la 2.ª persona del discurso es el destinatario, no el hablante. */
    speech?: readonly SpeechFact[],
    /** R4: la función de cada infinitivo — decidida (una opción) o para elegir de la lista. */
    infinitives?: readonly HebrewInfinitiveCandidate[],
  ): Promise<VerseAnalysis>;
}

// ── IHebrewSessionRepository ──────────────────────────────────────────────────

/**
 * Port for caching and persisting verse analyses.
 * Prevents redundant API calls for verses already analyzed.
 */
export interface IHebrewSessionRepository {
  /**
   * Returns a previously cached analysis for a verse reference, or null.
   * @param reference - e.g. "Jonah.2.3"
   */
  getCachedAnalysis(reference: string): Promise<VerseAnalysis | null>;

  /**
   * Persists an analysis result for future retrieval.
   * @param reference - e.g. "Jonah.2.3"
   * @param analysis - the result to cache
   */
  cacheAnalysis(reference: string, analysis: VerseAnalysis): Promise<void>;

  /** Returns all saved analyses for the current user session. */
  getSavedAnalyses(): Promise<VerseAnalysis[]>;

  /**
   * Patches the literal and/or fluid translation of a cached analysis.
   * Useful for editorial corrections without discarding the full analysis.
   * @param reference - e.g. "Jonah.3.2"
   * @param updates   - partial translation fields to overwrite
   */
  updateTranslation(
    reference: string,
    updates: { literalTranslation?: string; fluidTranslation?: string },
  ): Promise<void>;
}

// ── IDetectiveSessionRepository ───────────────────────────────────────────────

/**
 * Port for persisting and querying Modo Detective investigation sessions.
 * Results are stored in Firestore for pedagogical analytics.
 */
export interface IDetectiveSessionRepository {
  /**
   * Persists a completed detective session.
   * @param session - The completed session with all 6 phase results.
   */
  saveSession(session: Omit<DetectiveSession, 'id'>): Promise<string>;

  /**
   * Returns the recent detective sessions for a specific user.
   * @param userId - Firebase Auth UID
   * @param limit - Maximum number of sessions to return (default 20)
   */
  getSessionsByUser(userId: string, limit?: number): Promise<DetectiveSession[]>;
}

// ── ILexicalRepository ────────────────────────────────────────────────────────

/**
 * Port for the administrable Hebrew lexical glossary.
 * Implemented by FirebaseLexiconRepository.
 *
 * Enabled entries are fetched at analysis time and matched against the verse
 * words. Matching entries are injected into the Gemini prompt to guide
 * idiomatic translation without altering the literal translation.
 */
export interface ILexicalRepository {
  /** Returns all enabled lexical entries ordered by `order` asc. */
  getAll(): Promise<readonly LexicalEntry[]>;
}
