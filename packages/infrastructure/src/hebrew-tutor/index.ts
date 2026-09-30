/**
 * Public API for the hebrew-tutor infrastructure module.
 */

// morphhb provider
export { MorphhbBibleProvider } from './morphhb/morphhb-bible-provider.js';
export { HEBREW_BOOKS_CATALOG } from './morphhb/books-catalog.js';

// Gemini analysis service
export { HebrewAnalysisService } from './gemini-hebrew-service.js';

// Knowledge base (useful for testing and debugging)
export { selectRelevantChunks } from './knowledge/knowledge-selector.js';
export { buildVerseAnalysisPrompt } from './knowledge/hebrew-prompt-builder.js';
export { FARFAN_CHUNKS } from './knowledge/farfan-chunks.js';
export type { KnowledgeChunk } from './knowledge/farfan-chunks.js';

// Caching
export { FirebaseHebrewSessionRepository } from './repositories/FirebaseHebrewSessionRepository.js';

// Detective session persistence
export { FirestoreDetectiveSessionRepository } from './repositories/FirestoreDetectiveSessionRepository.js';

// Per-user study sessions (project-linkable)
export { FirestoreHebrewStudySessionRepository } from './repositories/FirestoreHebrewStudySessionRepository.js';
