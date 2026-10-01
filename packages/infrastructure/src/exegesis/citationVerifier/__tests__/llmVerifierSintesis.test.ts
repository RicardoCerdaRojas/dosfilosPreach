import { describe, it, expect } from 'vitest';
import { buildLlmVerifierPrompt } from '../llmVerifierPrompts';

/** Una nota de síntesis se juzga por partes (TP Santiago 2:14-26). */
describe('buildLlmVerifierPrompt — síntesis entre fuentes', () => {
    const base = {
        rawCitation: 'McCartney, p. 173', evidence: 'McCartney y Ropes ambos prefieren la pasiva',
        evidenceIsQuoted: false, citedPages: '173', matchedSourceLabel: 'McCartney', chunks: [], language: 'es' as const,
    };

    it('pide juzgar sólo la parte de esta fuente', () => {
        const { userMessage } = buildLlmVerifierPrompt({ ...base, otherSources: ['Ropes'] });
        expect(userMessage).toMatch(/Juzga SÓLO la parte que corresponde a McCartney/);
        expect(userMessage).toContain('Ropes');
    });

    it('sin otras fuentes, el prompt no cambia', () => {
        expect(buildLlmVerifierPrompt(base).userMessage).not.toMatch(/sintetiza varias fuentes/);
    });
});
