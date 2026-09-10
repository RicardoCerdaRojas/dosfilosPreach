import type { PdfDiagnosis } from './diagnosePdfSource';

/**
 * Qué motor conviene para este archivo, y por qué.
 *
 * Existe porque el producto recomendaba lo contrario de lo que funciona. El
 * formulario venía con Premium por defecto, comentado como «best quality», y
 * sobre un escaneo en hebreo eso destruye el texto. Medido, mismo archivo:
 *
 *     Premium  (LlamaParse)     0 caracteres hebreos
 *     Estándar (visión Gemini)  2.418 caracteres hebreos
 *
 * No es que Premium sea peor: es que resuelve otro problema. LlamaParse
 * reconstruye maquetación —tablas, columnas— sobre documentos que YA tienen
 * texto. Un escaneo no tiene texto que reconstruir; hay que LEER la imagen, y
 * eso lo hace la visión del modelo, que vive en la ruta estándar.
 *
 * EL TAMAÑO MANDA SOBRE TODO LO DEMÁS. Por encima de 50 MB la ruta estándar
 * no puede subir el archivo al modelo y cae a `pdf-parse`, que lee la capa de
 * texto embebida. En un escaneo esa capa no existe o es basura de OCR ajeno:
 * un PDF de la BHS de 67 MB devolvía «0"'m1 nin~' bnnElid1». Entra al corpus
 * sin error y se cita.
 */

/** Tope real de la ruta estándar para subir el archivo al modelo. */
export const VISION_MAX_BYTES = 50 * 1024 * 1024;
/** Tope de la ruta premium. */
export const PREMIUM_MAX_BYTES = 100 * 1024 * 1024;

export type ExtractionModeChoice = 'standard' | 'premium';

export interface ModeRecommendation {
    /** `null` cuando ninguna ruta sirve y hay que hacer algo con el archivo. */
    recommended: ExtractionModeChoice | null;
    /** Una frase, en términos de lo que le pasa al libro. */
    reasonKey:
    | 'scan-fits-vision'
    | 'scan-too-large'
    | 'text-layer-premium'
    | 'over-every-cap'
    | 'unknown';
    /** Cuando la elección importa de verdad y conviene no dejarla al azar. */
    strong: boolean;
}

export function recommendExtractionMode(input: {
    sizeBytes: number;
    diagnosis: PdfDiagnosis | null;
}): ModeRecommendation {
    const { sizeBytes, diagnosis } = input;

    if (sizeBytes > PREMIUM_MAX_BYTES) {
        return { recommended: null, reasonKey: 'over-every-cap', strong: true };
    }

    // Sin diagnóstico no se inventa una recomendación: el archivo puede no ser
    // PDF, o la lectura previa puede haber fallado.
    if (!diagnosis) return { recommended: null, reasonKey: 'unknown', strong: false };

    const esEscaneo = diagnosis.verdict === 'sin-capa-de-texto';

    if (esEscaneo) {
        // Cabe en visión: es el único camino que LEE la imagen.
        if (sizeBytes <= VISION_MAX_BYTES) {
            return { recommended: 'standard', reasonKey: 'scan-fits-vision', strong: true };
        }
        // No cabe. Premium lo acepta pero sobre un escaneo en escritura no
        // latina destruye el texto, y estándar caería a `pdf-parse`. Ninguna
        // sirve: hay que partir el archivo.
        return { recommended: null, reasonKey: 'scan-too-large', strong: true };
    }

    // Con capa de texto, Premium es lo que era: reconstruye maquetación.
    return { recommended: 'premium', reasonKey: 'text-layer-premium', strong: false };
}
