/**
 * Veredicto sobre un PDF ANTES de gastar páginas en extraerlo.
 *
 * **Por qué existe.** Hoy la secuencia es: subir → nueve minutos →
 * debitar páginas → descubrir que el libro entró mudo. Las señales
 * estaban en el archivo desde el segundo cero y se leen sin modelo, sin
 * red y sin gastar una página.
 *
 * Medido sobre seis libros reales: tres aptos y tres que habrían
 * entrado sin su lengua original. Dos de esos tres son exactamente los
 * que el barrido del 2026-09-02 descubrió DESPUÉS de procesarlos.
 *
 * **Qué promete y qué no.** Predice la fidelidad del CONTENIDO, no la
 * fiabilidad del SERVICIO: no habría anticipado un fallo del extractor.
 * Y no sabe qué debería traer el libro — si un manual de homilética no
 * tiene griego, eso no es un defecto. Por eso el veredicto habla de lo
 * que hay, y la sugerencia habla de lo que conviene hacer.
 */

export type PdfVerdict =
    /** Capa de texto sana con la escritura original y sus diacríticos. */
    | 'apto'
    /** Cero fuentes: es un escaneo. Sin OCR no hay nada que indexar. */
    | 'sin-capa-de-texto'
    /** Hay texto, pero la escritura original no aparece por ninguna parte. */
    | 'escritura-ausente'
    /** La escritura está, pero sin acentos ni puntuación: no se podrá buscar. */
    | 'escritura-sin-diacriticos'
    /** Texto latino corriente y sin escritura original. Normal en muchos libros. */
    | 'sin-escritura-original';

export interface PdfEvidence {
    pages: number;
    /** Fuentes declaradas por el PDF. Cero significa escaneo. */
    fontCount: number;
    /** Rango muestreado, para que el informe diga de dónde salió el número. */
    sampleFromPage: number;
    sampleToPage: number;
    /** Caracteres extraíbles en la muestra. */
    sampleChars: number;
    greekLetters: number;
    hebrewLetters: number;
    /** Marcas combinantes sobre esas letras: acentos, espíritus, niqqud. */
    diacritics: number;
    /**
     * Proporción de palabras que no parecen lenguaje: letras mezcladas
     * con dígitos o signos, o sin una sola vocal.
     *
     * Medido sobre libros reales: un libro sano ronda 0,04 y el
     * interlineal hebreo cuyo texto salía en códigos latinos dio 0,151.
     * NO distingue «libro sin griego» de «griego mal codificado» en los
     * casos intermedios —Dibelius dio 0,045 con su griego perdido—, así
     * que sólo se usa donde decide con claridad.
     */
    garbledTokenRatio: number;
}

export interface PdfDiagnosis {
    verdict: PdfVerdict;
    /** Por qué se llegó a ese veredicto. Hechos, no opiniones. */
    reasons: string[];
    /** Qué conviene hacer. Puede estar vacío cuando no hay nada que decidir. */
    suggestions: string[];
    /** Diacríticos por letra de escritura original. `null` si no hay escritura. */
    diacriticRatio: number | null;
}

/**
 * Por encima de esto, el cuerpo no es lenguaje: es una codificación
 * rota leída como si fuera texto. Los libros sanos medidos van de 0,040
 * a 0,051; el interlineal roto, 0,151.
 */
const RATIO_DE_BASURA_DECISIVO = 0.10;

/**
 * Debajo de esto, el cuerpo del libro no tiene texto que valga.
 *
 * Una portada suelta puede dar unos cientos de caracteres aunque el
 * resto sea imagen; treinta páginas de cuerpo con menos de esto no son
 * un libro con capa de texto.
 */
const MIN_CARACTERES_DE_CUERPO = 500;

export function diagnosePdfSource(evidence: PdfEvidence): PdfDiagnosis {
    const escritura = evidence.greekLetters + evidence.hebrewLetters;
    const ratio = escritura > 0 ? evidence.diacritics / escritura : null;
    const reasons: string[] = [];
    const suggestions: string[] = [];

    const muestra = `páginas ${evidence.sampleFromPage}-${evidence.sampleToPage}`;

    // ── Escaneo: no hay ni fuentes ni texto ────────────────────────
    if (evidence.fontCount === 0) {
        reasons.push('El PDF no declara ninguna fuente: sus páginas son imágenes.');
        reasons.push(`En ${muestra} se extraen ${evidence.sampleChars} caracteres.`);
        // El consejo anterior decía que la ruta estándar caía en pdf-parse. Es
        // falso mientras el archivo entre en visión, y llevaba a elegir Premium
        // —que sobre un escaneo en escritura no latina destruye el texto—.
        // Medido sobre el mismo escaneo: Premium 0 caracteres hebreos, Estándar
        // 2.418. Por encima del tope de visión sí cae a pdf-parse, y ahí la
        // salida es partir el archivo, no cambiar de motor.
        suggestions.push('Sólo sirve leyendo la imagen. Súbelo en modo Estándar, que es el que pasa las páginas por visión; Premium reconstruye maquetación sobre texto que ya existe y sobre un escaneo devuelve basura.');
        suggestions.push('Si pesa más de 50 MB no entra en visión y caería en pdf-parse, que sobre un escaneo devuelve cero texto: pártelo antes de subirlo.');
        return { verdict: 'sin-capa-de-texto', reasons, suggestions, diacriticRatio: ratio };
    }

    if (evidence.sampleChars < MIN_CARACTERES_DE_CUERPO) {
        reasons.push(`Declara ${evidence.fontCount} fuente(s), pero en ${muestra} apenas se extraen ${evidence.sampleChars} caracteres.`);
        suggestions.push('El texto puede estar protegido o el libro ser imágenes con una capa mínima. Revísalo antes de subirlo.');
        return { verdict: 'sin-capa-de-texto', reasons, suggestions, diacriticRatio: ratio };
    }

    reasons.push(`Capa de texto presente: ${evidence.sampleChars} caracteres en ${muestra}.`);

    // ── Sin escritura original ─────────────────────────────────────
    if (escritura === 0) {
        if (evidence.garbledTokenRatio >= RATIO_DE_BASURA_DECISIVO) {
            reasons.push(`No aparece griego ni hebreo, y el ${(evidence.garbledTokenRatio * 100).toFixed(0)}% de las palabras del cuerpo no son lenguaje.`);
            suggestions.push('La escritura está mal codificada: los glifos se dibujan bien pero sus códigos apuntan a letras latinas. En el índice entraría como basura, y no se podrá buscar ni citar.');
            suggestions.push('No lo subas. Busca otra edición y pásala por este mismo diagnóstico.');
            return { verdict: 'escritura-ausente', reasons, suggestions, diacriticRatio: ratio };
        }
        reasons.push('No aparece griego ni hebreo en el cuerpo.');
        suggestions.push('Si el libro NO los usa, está bien así.');
        suggestions.push('Si el libro SÍ debería traerlos —un comentario técnico, una gramática, un texto crítico—, entonces su escritura está mal codificada y entrará mudo. Mira la muestra de abajo: si no se entiende, no lo subas.');
        return { verdict: 'sin-escritura-original', reasons, suggestions, diacriticRatio: ratio };
    }

    // ── Escritura presente ─────────────────────────────────────────
    reasons.push(`Escritura original: ${evidence.greekLetters} letra(s) griega(s), ${evidence.hebrewLetters} hebrea(s).`);

    if (evidence.diacritics === 0) {
        reasons.push('Cero marcas diacríticas sobre esa escritura.');
        suggestions.push('Trae las letras pero no los acentos ni la puntuación: buscar una forma concreta —`ὀνειδίζοντος`, `חֶסֶד`— no la va a encontrar. Sirve para leer, no para buscar.');
        return { verdict: 'escritura-sin-diacriticos', reasons, suggestions, diacriticRatio: 0 };
    }

    reasons.push(`Ratio de diacríticos ${ratio!.toFixed(3)} — un signo por palabra es lo normal en griego politónico y en hebreo puntuado.`);
    suggestions.push('Apto. Con capa de texto sana no hace falta OCR: el modo Estándar alcanza y no consume páginas premium.');
    return { verdict: 'apto', reasons, suggestions, diacriticRatio: ratio };
}

/**
 * Ventana a muestrear: treinta páginas del MEDIO del libro.
 *
 * El principio es portada, créditos e índice. Un interlineal hebreo de
 * 2.013 páginas pasó el diagnóstico mirando sus primeras 40 y traía
 * TODO el hebreo en códigos latinos.
 */
export function sampleWindow(pages: number, size = 30): { from: number; to: number } {
    if (pages <= size) return { from: 1, to: Math.max(1, pages) };
    const from = Math.max(1, Math.floor(pages / 2));
    return { from, to: Math.min(pages, from + size - 1) };
}
