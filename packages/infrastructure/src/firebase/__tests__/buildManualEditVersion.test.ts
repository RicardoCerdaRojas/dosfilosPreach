import { describe, it, expect } from 'vitest';
import type { CanonicalVerseAnalysis, ExegeticalStepVersion, VerifiedCitation } from '@dosfilos/domain';
import { buildManualEditVersion } from '../FirestoreExegeticalPaperRepository';

/**
 * Editar la prosa a mano BORRABA el análisis del versículo.
 *
 * Medido sobre un trabajo real: corregir una cita en la prosa de Santiago 2:1
 * dejó la versión aceptada sin análisis canónico y sin las 16 citas ya
 * verificadas. La insignia del paso pasó de «15/16» a nada, y la bibliografía
 * —que sale de las fuentes citadas en los análisis aceptados— dejó de contar
 * las de ese versículo.
 */
const analisis = { reference: { bookId: 'JAS' } } as unknown as CanonicalVerseAnalysis;
const veredicto = { raw: 'Mayor, p. 77', status: 'verified' } as unknown as VerifiedCitation;

const padre = (over: Partial<ExegeticalStepVersion> = {}): ExegeticalStepVersion => ({
    id: 'v2',
    createdAt: new Date('2026-09-23'),
    markdown: 'Prosa anterior.',
    origin: 'generated',
    parentVersionId: null,
    modelId: 'gemini-2.5-pro',
    regenerationHint: null,
    tokensUsed: 100,
    verifications: { counts: { verified: 16 } } as never,
    canonicalAnalysis: analisis,
    citationVerdicts: [veredicto],
    citationReviews: [{ path: 'commentatorEngagement[0]', note: 'miré la página', reviewedAt: new Date() }],
    ...over,
} as ExegeticalStepVersion);

describe('buildManualEditVersion', () => {
    it('el análisis del versículo sobrevive a una edición del párrafo', () => {
        const v = buildManualEditVersion(padre(), 'Prosa corregida a mano.');
        expect(v.markdown).toBe('Prosa corregida a mano.');
        expect(v.canonicalAnalysis).toBe(analisis);
    });

    it('las citas verificadas y las revisiones sobreviven', () => {
        // Se calculan contra las citas del ANÁLISIS, no contra el markdown:
        // editar el texto no las invalida.
        const v = buildManualEditVersion(padre(), 'Otra redacción.');
        expect(v.citationVerdicts).toHaveLength(1);
        expect(v.citationReviews).toHaveLength(1);
        expect(v.verifications).toEqual({ counts: { verified: 16 } });
    });

    it('sin análisis, el resumen SÍ se reinicia', () => {
        // Ahí la verificación lee el markdown, y una edición la invalida.
        // Ése era el motivo original de reiniciarlo y se conserva.
        const v = buildManualEditVersion(padre({ canonicalAnalysis: null }), 'Texto nuevo.');
        expect(v.canonicalAnalysis).toBeUndefined();
        expect(v.verifications.counts.verified).toBe(0);
    });

    it('la edición queda marcada como tal y colgada de su padre', () => {
        const v = buildManualEditVersion(padre(), 'x');
        expect(v.origin).toBe('edited');
        expect(v.parentVersionId).toBe('v2');
        expect(v.modelId).toBeNull();
        expect(v.id).not.toBe('v2');
    });

    it('sin versión previa no explota', () => {
        const v = buildManualEditVersion(null, 'primer texto');
        expect(v.parentVersionId).toBeNull();
        expect(v.canonicalAnalysis).toBeUndefined();
    });
});
