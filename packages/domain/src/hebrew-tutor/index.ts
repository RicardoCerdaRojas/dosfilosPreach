/**
 * Public API for the hebrew-tutor domain module.
 */

// Value objects
export * from './value-objects/grammar.js';

// Entities
export * from './entities/verse-analysis.js';
export * from './entities/hebrew-bible.js';
export { DetectivePhase, createDetectiveSession, createVerbDetectiveSession, createNominalDetectiveSession, getSessionScore, getPerformanceLabel } from './entities/detective-session.js';
export type { PhaseResult as DetectivePhaseResult, VerbDetectiveSession, NominalDetectiveSession, DetectiveSession } from './entities/detective-session.js';
export * from './entities/hint.js';
export * from './entities/lexical-entry.js';
export * from './entities/hebrew-study-session.js';

// Services
export * from './services/reconcile-words.js';
export * from './services/oshb-contrast.js';

// Ports
export * from './ports/ports.js';
