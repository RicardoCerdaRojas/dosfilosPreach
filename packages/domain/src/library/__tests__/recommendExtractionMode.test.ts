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

/**
 * Libros CON capa de texto cuya escritura está mal codificada.
 *
 * Este caso no lo cubre «¿es un escaneo?»: los tres de abajo tienen capa —uno
 * sacó 827.573 caracteres— y una regla que sólo mirara el escaneo los mandaría
 * a Premium, que lee justamente esa capa envenenada.
 *
 *     «Hebreo Bíblico», manual        827.573 chars   0 hebreo
 *     Barrick & Busenitz, gramática   342.995 chars   0 hebreo
 *     Sasson, «Jonah» (Anchor Bible)  790.779 chars   0 hebreo   205 citas
 */
describe('recommendExtractionMode — la capa existe pero miente', () => {
    it('manda a visión una obra hebrea cuya capa no trae hebreo', () => {
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r).toEqual({ recommended: 'standard', reasonKey: 'layer-missing-script', strong: true });
    });

    it('un puñado de letras en diez páginas centrales tampoco alcanza', () => {
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: { hebrewLetters: 8, greekLetters: 1122 },
        });
        expect(r.reasonKey).toBe('layer-missing-script');
    });

    it('NO toca la capa sana: una capa correcta le gana a la visión', () => {
        // Visión comete errores de OCR. Leyendo el Salmo 23 transcribió
        // `בְּנֵיָא` donde el libro dice `בְּגֵיא`. Si la capa trae la escritura
        // bien, pasarla por visión la empeora.
        const r = recommendExtractionMode({
            sizeBytes: 16 * MB,
            diagnosis: dx('apto'),
            requiredScripts: ['greek'],
            evidence: { greekLetters: 4200, hebrewLetters: 0 },
        });
        expect(r.recommended).toBe('premium');
    });

    it('manda a visión cuando la escritura es basura, aunque no se exija ninguna', () => {
        // `escritura-ausente` significa que los glifos se dibujan bien y sus
        // códigos apuntan a letras latinas. Eso se sabe sin conocer el libro.
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('escritura-ausente'),
        });
        expect(r).toEqual({ recommended: 'standard', reasonKey: 'layer-garbled', strong: true });
    });

    it('no exige nada cuando el libro no declara necesitarlo', () => {
        // Un comentario en español sobre Jonás puede no traer una letra hebrea
        // y estar perfecto.
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: [],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r.recommended).toBe('premium');
    });

    it('sin evidencia no se inventa el juicio', () => {
        const r = recommendExtractionMode({
            sizeBytes: 12 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: null,
        });
        expect(r.recommended).toBe('premium');
    });

    it('capa rota y archivo que no entra en visión: ningún motor sirve', () => {
        // Premium leería esa misma capa envenenada y Estándar caería a
        // pdf-parse, que la lee también. Cambiar de motor no arregla nada:
        // la respuesta es partir el archivo.
        const r = recommendExtractionMode({
            sizeBytes: 60 * MB,
            diagnosis: dx('sin-escritura-original'),
            requiredScripts: ['hebrew'],
            evidence: { hebrewLetters: 0, greekLetters: 0 },
        });
        expect(r).toEqual({ recommended: null, reasonKey: 'layer-too-large', strong: true });
    });
});
