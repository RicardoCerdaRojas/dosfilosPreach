/**
 * AnalyzeVerseUseCase
 *
 * Application use case: Orchestrates fetching a Hebrew verse from the Bible
 * provider and running the morphological analysis service on it.
 *
 * Responsibilities:
 *  1. Load the book data if not already cached
 *  2. Retrieve the verse Hebrew text
 *  3. Delegate analysis to IHebrewAnalysisService (Gemini)
 *  4. Check cache before calling the API (via IHebrewSessionRepository)
 *  5. [NEW] Fetch and match lexical entries from ILexicalRepository (Level 2 RAG)
 *  6. Return a VerseAnalysis aggregate
 *
 * This use case does NOT contain grammar logic — that lives in the
 * infrastructure (GeminiHebrewService + knowledge chunks).
 */

import type {
  IHebrewBibleProvider,
  IHebrewAnalysisService,
  IHebrewSessionRepository,
  ILexicalRepository,
  VerseAnalysis,
  LexicalEntry,
  HebrewVerse,
  ILanguageStructureProvider,
  SpeechFact,
  StructureNode,
} from '@dosfilos/domain';
import { applyOshbMorphology, checkClauseConnections, hebrewSpeechFacts, markOathFormula, reconcileGlobalWords, verseStructure } from '@dosfilos/domain';

export interface AnalyzeVerseInput {
  /** Book key as used by morphhb, e.g. "Jonah" */
  readonly morphhbKey: string;
  /** 1-indexed chapter number */
  readonly chapter: number;
  /** 1-indexed verse number */
  readonly verse: number;
  /** Response language — default 'es' */
  readonly language?: string;
  /** If true, bypass cache and re-analyze */
  readonly forceRefresh?: boolean;
}

export class AnalyzeVerseUseCase {
  constructor(
    private readonly bibleProvider: IHebrewBibleProvider & {
      loadBook(key: string): Promise<void>;
    },
    private readonly analysisService: IHebrewAnalysisService,
    private readonly sessionRepository?: IHebrewSessionRepository,
    private readonly lexicalRepository?: ILexicalRepository,
    /** Los datos de «Estructura» (MACULA): el asistente lee esas cláusulas en vez de partirlas (G1 + G5). */
    private readonly structureProvider?: ILanguageStructureProvider,
  ) {}

  async execute(input: AnalyzeVerseInput): Promise<VerseAnalysis> {
    const { morphhbKey, chapter, verse, language = 'es', forceRefresh = false } = input;

    // 1. Ensure the book is loaded in the provider cache
    await this.bibleProvider.loadBook(morphhbKey);

    // 2. Retrieve the verse with Hebrew text and OSHB tokens
    const hebrewVerse = this.bibleProvider.getVerse(morphhbKey, chapter, verse);

    // 3. Check analysis cache (avoid redundant API calls)
    if (!forceRefresh) {
      const cached = await this.readCache(hebrewVerse, language);
      if (cached) return cached;
    }

    // 4. Fetch and match lexical entries for Level 2 RAG injection
    const lexicalEntries = await this.resolveMatchingLexicalEntries(
      hebrewVerse.words,
      hebrewVerse.reference,
    );

    // 5. Perform the analysis via Gemini + knowledge base + lexical context,
    // con las filas de «Estructura» para que el asistente las lea.
    const { nodes: estructura, speech } = await this.structureOf(morphhbKey, chapter, verse);
    const raw = await this.analysisService.analyzeVerse(hebrewVerse, language, lexicalEntries, estructura, speech);

    // 6. Persist to cache for future requests. Se guarda lo que dio el
    // asistente, SIN las reglas: aplicadas antes de guardar, la próxima
    // lectura ya no encontraba diferencia con OSHB y la corrección (y el
    // aviso de la traducción) desaparecía desde la segunda vez.
    if (this.sessionRepository) {
      await this.sessionRepository.cacheAnalysis(hebrewVerse.reference, raw);
    }

    // La morfología verbal la decide OSHB, la fórmula de juramento es yusivo
    // y la conexión de cada cláusula se comprueba: siempre al mostrar. Se
    // relee lo guardado para que vuelva encima la traducción que corrigió el
    // usuario (se guarda aparte); sin caché, el análisis tal cual.
    return (await this.readCache(hebrewVerse, language)) ?? this.withRules(raw, hebrewVerse, language);
  }

  /**
   * El análisis guardado de un versículo, sin llamar al modelo. `null` si no
   * hay. Es lo que usa la navegación (◀/▶): antes leía el caché CRUDO y
   * mostraba las letras tal como se guardaron, corridas incluidas.
   */
  async cachedOnly(input: Pick<AnalyzeVerseInput, 'morphhbKey' | 'chapter' | 'verse' | 'language'>): Promise<VerseAnalysis | null> {
    await this.bibleProvider.loadBook(input.morphhbKey);
    return this.readCache(this.bibleProvider.getVerse(input.morphhbKey, input.chapter, input.verse), input.language);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Las filas de «Estructura» del versículo. Sin datos (o si no se pudieron
   * leer) el análisis sigue sin lectura de cláusulas: nunca se bloquea por esto.
   */
  private async structureOf(morphhbKey: string, chapter: number, verse: number): Promise<{ nodes: StructureNode[]; speech: SpeechFact[] }> {
    const nada = { nodes: [], speech: [] };
    if (!this.structureProvider) return nada;
    try {
      const ch = await this.structureProvider.getChapter('he', morphhbKey, chapter);
      // Quién habla y a quién: la 2.ª persona del discurso es el destinatario (Rut 1:16).
      return ch ? { nodes: verseStructure(ch, verse), speech: hebrewSpeechFacts(ch, verse) } : nada;
    } catch {
      return nada;
    }
  }

  /**
   * Lee el caché y vuelve a poner el texto de morphhb en cada palabra.
   *
   * Reconciliar al leer sana lo guardado con el reparto viejo: de cada
   * palabra sólo se usa CUÁNTAS consonantes tiene cada morfema, y las letras
   * salen del token. Una palabra que el modelo contó mal queda entera, sin
   * color; las siguientes vuelven a su sitio. Por eso no se sube la versión de
   * la clave: se perderían las traducciones que los usuarios corrigieron.
   */
  private async readCache(hebrewVerse: HebrewVerse, language = 'es'): Promise<VerseAnalysis | null> {
    if (!this.sessionRepository) return null;
    const cached = await this.sessionRepository.getCachedAnalysis(hebrewVerse.reference);
    if (!cached) return null;
    // Primero las letras, después la morfología de OSHB: así lo guardado
    // antes de que OSHB decidiera también sale corregido.
    return this.withRules({
      ...cached,
      hebrewText: hebrewVerse.hebrewText,
      words: reconcileGlobalWords(cached.words, hebrewVerse.words),
    }, hebrewVerse, language);
  }

  /**
   * Lo que se decide en el código y no se le deja al asistente, en orden:
   * la morfología verbal de OSHB, la fórmula de juramento (yusivo, aunque
   * OSHB de Rut 1:17 diga imperfecto) y la conexión de las cláusulas.
   */
  private withRules(analysis: VerseAnalysis, hebrewVerse: HebrewVerse, language = 'es'): VerseAnalysis {
    return checkClauseConnections(markOathFormula(applyOshbMorphology(analysis, hebrewVerse.words), hebrewVerse.words, language));
  }

  /**
   * Fetches all enabled lexical entries and returns those that apply to the
   * current verse. Three strategies are evaluated in order:
   *
   * 1. **Verse-ref matching** (exact, preferred): the entry's `verseRefs` list
   *    contains the OSIS ID of the current verse (e.g. "Gen.3.8").
   *
   * 2. **Lemma matching** (broad, fallback): any of the entry's `matchLemmas`
   *    appears in the normalized lemma set derived from the verse words.
   *
   * 3. **Chain expansion** (discourse coherence): if ANY directly-matched entry
   *    has a `chainId`, ALL other entries sharing that chainId are included.
   *    This implements Leitwort awareness — the LLM receives the full semantic
   *    thread so it can maintain translation coherence across verses.
   *
   * @param verseWords - Tokenized words of the verse from morphhb
   * @param osisRef    - OSIS verse reference, e.g. "Gen.3.8"
   * @returns The filtered, deduplicated list of matching LexicalEntry objects
   */
  private async resolveMatchingLexicalEntries(
    verseWords: readonly { lemma?: string }[],
    osisRef: string,
  ): Promise<readonly LexicalEntry[]> {
    if (!this.lexicalRepository) return [];

    let allEntries: readonly LexicalEntry[];
    try {
      allEntries = await this.lexicalRepository.getAll();
    } catch {
      // Lexical repository failure should not block verse analysis
      console.warn('AnalyzeVerseUseCase: lexicalRepository.getAll() failed — continuing without lexical context.');
      return [];
    }

    if (allEntries.length === 0) return [];

    // Build normalized lemma set from the verse words
    const verseLemmas = new Set<string>();
    for (const word of verseWords) {
      if (!word.lemma) continue;
      const raw = word.lemma.trim().toLowerCase();
      verseLemmas.add(raw);
      // Use `arr[arr.length - 1]` instead of `.at(-1)` — the
      // application tsconfig targets ES2020 lib which doesn't know
      // about Array.prototype.at (ES2022). Functionally identical.
      const parts = raw.split('/');
      const base = raw.includes('/') ? parts[parts.length - 1]!.trim() : raw;
      verseLemmas.add(base);
    }

    const normalizedOsisRef = osisRef.trim();

    // Phase 1: direct matching (verse-ref + lemma)
    const directMatches = new Set<string>(); // entry IDs
    for (const entry of allEntries) {
      const matchesByRef =
        entry.verseRefs != null &&
        entry.verseRefs.length > 0 &&
        entry.verseRefs.some((ref) => ref.trim() === normalizedOsisRef);

      const matchesByLemma = entry.matchLemmas.some((lemma) =>
        verseLemmas.has(lemma.trim().toLowerCase()),
      );

      if (matchesByRef || matchesByLemma) {
        directMatches.add(entry.id);
      }
    }

    // Phase 2: chain expansion — collect chainIds from direct matches
    const activeChainIds = new Set<string>();
    for (const entry of allEntries) {
      if (directMatches.has(entry.id) && entry.chainId) {
        activeChainIds.add(entry.chainId);
      }
    }

    // Phase 3: include all entries from active chains + direct matches
    const resultIds = new Set(directMatches);
    if (activeChainIds.size > 0) {
      for (const entry of allEntries) {
        if (entry.chainId && activeChainIds.has(entry.chainId)) {
          resultIds.add(entry.id);
        }
      }
    }

    return allEntries.filter((entry) => resultIds.has(entry.id));
  }
}
