import { describe, it, expect } from 'vitest';
import { recommendExtractionMode, VISION_MAX_BYTES, PREMIUM_MAX_BYTES } from '../recommendExtractionMode';
import type { PdfDiagnosis } from '../diagnosePdfSource';

/**
 * El producto recomendaba lo contrario de lo que funciona: Premium por defecto,
 * comentado como «best quality». Medido sobre el mismo escaneo de la BHS:
 *
 *     Premium  (LlamaParse)     0 caracteres hebreos
 *     Estándar (visión Gemini)  2.418 caracteres hebreos
 *
 * Premium no es peor; resuelve otro problema. Reconstruye maquetación sobre
 * documentos que YA tienen texto. Un escaneo no tiene texto que reconstruir.
 */
const dx = (verdict: PdfDiagnosis['verdict']): PdfDiagnosis =>
    ({ verdict, reasons: [], suggestions: [], diacriticRatio: null });

const MB = 1024 * 1024;

describe('recommendExtractionMode', () => {
    it('un escaneo que cabe en visión va por Estándar, y con convicción', () => {
        const r = recommendExtractionMode({ sizeBytes: 2 * MB, diagnosis: dx('sin-capa-de-texto') });
        expect(r).toEqual({ recommended: 'standard', reasonKey: 'scan-fits-vision', strong: true });
    });

    it('un escaneo demasiado grande no tiene ruta buena: hay que partirlo', () => {
        // El PDF real de la BHS pesa 67 MB. Cabe en Premium, y Premium sobre un
        // escaneo hebreo devuelve cero hebreo; Estándar caería a pdf-parse, que
        // sobre ese archivo devolvía «0"'m1 nin~' bnnElid1».
        const r = recommendExtractionMode({ sizeBytes: 67 * MB, diagnosis: dx('sin-capa-de-texto') });
        expect(r.recommended).toBeNull();
        expect(r.reasonKey).toBe('scan-too-large');
        expect(r.strong).toBe(true);
    });

    it('justo en el tope de visión todavía entra', () => {
        expect(recommendExtractionMode({ sizeBytes: VISION_MAX_BYTES, diagnosis: dx('sin-capa-de-texto') }).recommended)
            .toBe('standard');
    });

    it('un documento con capa de texto sigue prefiriendo Premium', () => {
        // Ahí Premium hace lo que sabe: tablas, columnas, maquetación.
        const r = recommendExtractionMode({ sizeBytes: 20 * MB, diagnosis: dx('escritura-sin-diacriticos') });
        expect(r.recommended).toBe('premium');
        expect(r.strong).toBe(false);
    });

    it('por encima de todos los topes no hay motor que valga', () => {
        // Dibelius pesa 128 MB en esta biblioteca.
        const r = recommendExtractionMode({ sizeBytes: 128 * MB, diagnosis: dx('sin-capa-de-texto') });
        expect(r).toEqual({ recommended: null, reasonKey: 'over-every-cap', strong: true });
    });

    it('el tamaño manda incluso sin diagnóstico', () => {
        expect(recommendExtractionMode({ sizeBytes: PREMIUM_MAX_BYTES + 1, diagnosis: null }).reasonKey)
            .toBe('over-every-cap');
    });

    it('sin diagnóstico no inventa una recomendación', () => {
        const r = recommendExtractionMode({ sizeBytes: 5 * MB, diagnosis: null });
        expect(r.recommended).toBeNull();
        expect(r.reasonKey).toBe('unknown');
        expect(r.strong).toBe(false);
    });
});
