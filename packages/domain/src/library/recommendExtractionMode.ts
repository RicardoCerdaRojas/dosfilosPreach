import type { PdfDiagnosis, PdfEvidence } from './diagnosePdfSource';
import type { RequiredScript } from '../entities/extractionHealth';

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
 * NO ES «TIENE HEBREO → VISIÓN». Es «DEBERÍA TENER Y NO LO TIENE → VISIÓN».
 * Una capa de texto correcta le gana a la visión siempre, porque la visión
 * comete errores de OCR: leyendo el Salmo 23 de la BHS transcribió `בְּנֵיָא`
 * donde el libro dice `בְּגֵיא` —consonante distinta, palabra inexistente—. Si
 * la capa ya trae la escritura bien codificada, pasarla por visión la empeora.
 *
 * LO QUE SÍ SEÑALA PROBLEMA ES LA AUSENCIA DONDE DEBERÍA HABER. Y ese caso no
 * es sólo el del escaneo: hay libros CON capa de texto cuya escritura está mal
 * codificada, los glifos se dibujan bien pero sus códigos apuntan a letras
 * latinas. Medidos en una biblioteca real, con capa y todo:
 *
 *     «Hebreo Bíblico», manual        827.573 chars   0 hebreo
 *     Barrick & Busenitz, gramática   342.995 chars   0 hebreo
 *     Sasson, «Jonah» (Anchor Bible)  790.779 chars   0 hebreo   205 citas
 *
 * Los tres tienen capa, así que no son escaneos, y una regla que sólo mirara
 * «¿es un escaneo?» los mandaría a Premium — que lee justamente esa capa
 * envenenada.
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
    /** La capa existe pero no trae la escritura que el libro necesita. */
    | 'layer-missing-script'
    /** La capa existe y su escritura es basura: glifos bien, códigos latinos. */
    | 'layer-garbled'
    /** La capa no sirve y el archivo no entra en visión: hay que partirlo. */
    | 'layer-too-large'
    /** No se halló escritura original y no se sabe si el libro la necesita. */
    | 'no-script-found'
    | 'text-layer-premium'
    | 'over-every-cap'
    | 'unknown';
    /** Cuando la elección importa de verdad y conviene no dejarla al azar. */
    strong: boolean;
}

/**
 * Piso por debajo del cual la muestra no trae la escritura.
 *
 * La muestra son diez páginas del MEDIO del libro, que en un comentario o una
 * gramática es cuerpo, no portada. Diez páginas centrales de una obra que
 * necesita hebreo con menos de esto no lo traen: lo tiene mal codificado.
 */
const MIN_LETRAS_EN_MUESTRA = 20;

export function recommendExtractionMode(input: {
    sizeBytes: number;
    diagnosis: PdfDiagnosis | null;
    /** Escritura que el libro necesita, deducida de su título y su tipo. */
    requiredScripts?: ReadonlyArray<RequiredScript>;
    /** Lo que la lectura previa contó en la muestra. */
    evidence?: Pick<PdfEvidence, 'greekLetters' | 'hebrewLetters'> | null;
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

    // ── Capa presente, pero envenenada ──────────────────────────────
    // Los glifos se dibujan bien y sus códigos apuntan a letras latinas. La
    // capa NO sirve, y Premium es justamente el motor que la lee.
    if (diagnosis.verdict === 'escritura-ausente') {
        return sizeBytes <= VISION_MAX_BYTES
            ? { recommended: 'standard', reasonKey: 'layer-garbled', strong: true }
            // No entra en visión, y las otras dos rutas leen justamente esa capa.
            // Cambiar de motor no arregla nada: hay que partir el archivo.
            : { recommended: null, reasonKey: 'layer-too-large', strong: true };
    }

    // ── Capa presente, sin la escritura que el libro necesita ───────
    // Sólo se juzga cuando el libro DECLARA necesitarla: un comentario en
    // español sobre Jonás legítimamente puede no traer una letra hebrea, y
    // marcarlo enseñaría a ignorar el aviso.
    const required = input.requiredScripts ?? [];
    const evidence = input.evidence;
    if (required.length > 0 && evidence) {
        const falta = required.some(script => (
            script === 'hebrew' ? evidence.hebrewLetters : evidence.greekLetters
        ) < MIN_LETRAS_EN_MUESTRA);
        if (falta) {
            return sizeBytes <= VISION_MAX_BYTES
                ? { recommended: 'standard', reasonKey: 'layer-missing-script', strong: true }
                : { recommended: null, reasonKey: 'layer-too-large', strong: true };
        }
    }

    // ── No se halló escritura, y no se sabe si el libro la necesita ─
    // Caso real: Sasson, un comentario del texto hebreo cuya capa no trae una
    // letra hebrea en 392 páginas. Si su categoría todavía es la de fábrica,
    // `requiredScriptsFor` no exige nada y esto caería en «Premium» — que es
    // el motor que lee justamente esa capa. Afirmar Premium acá contradice al
    // diagnóstico que la misma pantalla acaba de mostrar.
    //
    // No se elige por el usuario: se le devuelve la pregunta que sólo él puede
    // contestar, que es si este libro DEBERÍA traer griego o hebreo.
    if (diagnosis.verdict === 'sin-escritura-original') {
        return { recommended: null, reasonKey: 'no-script-found', strong: false };
    }

    // Con capa de texto sana, Premium es lo que era: reconstruye maquetación.
    return { recommended: 'premium', reasonKey: 'text-layer-premium', strong: false };
}
