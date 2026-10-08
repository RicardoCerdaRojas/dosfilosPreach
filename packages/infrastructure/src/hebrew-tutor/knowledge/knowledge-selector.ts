/**
 * Knowledge Selector
 *
 * Selects the most relevant grammar knowledge chunks for a given Hebrew
 * text analysis request. It performs keyword-based matching between the
 * topics in each KnowledgeChunk and the features detected in the input.
 *
 * Design decisions:
 * - Keyword-based scoring is intentional: it is fast, predictable, and
 *   auditable without requiring a vector database.
 * - Callers can request a maximum number of chunks to control prompt size.
 * - Always includes the verb system intro and wayyiqtol chunks for verses
 *   (those are almost always relevant).
 */

import { FARFAN_CHUNKS, KnowledgeChunk } from './farfan-chunks.js';

// Chunks that are always included regardless of detected features
const ALWAYS_INCLUDE_IDS = new Set<string>([
  'farfan-verb-intro',
  'farfan-wayyiqtol',
  'farfan-verb-type-classification-rules',
  // אַל + prefijo = yusivo: la etiqueta la decide la partícula (Rut 1:16).
  'farfan-volitivos',
  // Toda cláusula se une de algún modo: disyuntiva, asíndeton (Rut 1:14, 1:16).
  'farfan-clausulas-conexion',
]);

/**
 * Returns the top-k relevant knowledge chunks for a given Hebrew text
 * and optional list of feature tags already detected in the text.
 *
 * @param hebrewText - The Hebrew verse text to analyze
 * @param featureHints - Optional list of grammatical features detected client-side
 * @param maxChunks - Maximum number of chunks to return (default: 8)
 */
export function selectRelevantChunks(
  hebrewText: string,
  featureHints: readonly string[] = [],
  maxChunks = 8,
): readonly KnowledgeChunk[] {
  const queryTerms = buildQueryTerms(hebrewText, featureHints);

  const scored = FARFAN_CHUNKS.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, queryTerms),
  }));

  // Sort descending by relevance score
  scored.sort((a, b) => b.score - a.score);

  const selected: KnowledgeChunk[] = [];
  const selectedIds = new Set<string>();

  // Phase 1: Always-include chunks
  for (const { chunk } of scored) {
    if (ALWAYS_INCLUDE_IDS.has(chunk.id)) {
      selected.push(chunk);
      selectedIds.add(chunk.id);
    }
  }

  // Phase 2: Top-scored chunks up to maxChunks
  for (const { chunk, score } of scored) {
    if (selected.length >= maxChunks) break;
    if (selectedIds.has(chunk.id)) continue;
    if (score > 0) {
      selected.push(chunk);
      selectedIds.add(chunk.id);
    }
  }

  return selected;
}

/**
 * Builds a normalized list of query terms from the Hebrew text and hints.
 */
function buildQueryTerms(text: string, hints: readonly string[]): string[] {
  const terms: string[] = [...hints.map((h) => h.toLowerCase())];

  // Detect binyanim by their characteristic morphemes in the text
  if (/נִ[קגדהוזחטי]/.test(text) || /נִ[א-ת]/.test(text)) terms.push('nifal');
  if (/הִ[את]/.test(text)) terms.push('hitpael', 'hifil');
  if (/הִקְ|הִגְ|הִכְ/.test(text)) terms.push('hifil');
  if (/מְ?[קגדה][טתל]ֵ/.test(text)) terms.push('piel');
  if (/הָ[קגדה]/.test(text)) terms.push('hofal');
  if (/וַיִּ|וַתִּ|וָאֶ/.test(text)) terms.push('wayyiqtol', 'narración');
  if (/אֲשֶׁר/.test(text)) terms.push('pronombre relativo', 'אשר');
  if (/[הָ][אֵ]׀/.test(text) || /הַ/.test(text)) terms.push('artículo');
  if (/אֶת[־]/.test(text) || /אֵת[־]/.test(text)) terms.push('acusativo', 'objeto directo');
  if (/מִ[נְ]/.test(text)) terms.push('מן', 'preposición');
  if (/אֵ[ין]/.test(text)) terms.push('negación');

  // Always add core topics for verse analysis
  terms.push('verbo', 'sustantivo', 'binyan', 'conjugación', 'oración');

  return [...new Set(terms)]; // deduplicate
}

/**
 * Scores a chunk based on how many query terms match its topics.
 */
function scoreChunk(chunk: KnowledgeChunk, queryTerms: string[]): number {
  let score = 0;
  for (const topic of chunk.topics) {
    const normalizedTopic = topic.toLowerCase();
    for (const term of queryTerms) {
      if (normalizedTopic.includes(term) || term.includes(normalizedTopic)) {
        score++;
      }
    }
  }
  return score;
}
