/**
 * Escala de entrega del púlpito (documento de diseño "Manuscrito de púlpito").
 *
 * La restricción que manda es el REGRESO DE LA MIRADA: el predicador lee una
 * frase, levanta la vista hacia la congregación y vuelve al texto, y tiene que
 * reencontrar su lugar sin buscarlo. De ahí salen la medida corta, la
 * interlínea alta y que todo se exprese como múltiplo del cuerpo — así el
 * control de tamaño escala la página entera sin romper la jerarquía.
 */

/**
 * Medida en CARACTERES, no en píxeles.
 *
 * Las 45-75 columnas de la tipografía editorial suponen lectura silenciosa y
 * continua. La voz alta paga un costo que esa cifra no contempla: el ojo
 * abandona el renglón varias veces por párrafo. Por eso los soportes de voz
 * alta trabajan más corto — el teleprónter en torno a 32, el leccionario entre
 * 40 y 55. 48 es donde la línea todavía contiene una cláusula entera y el
 * regreso sigue siendo gratis.
 */
export const DELIVERY_MEASURE_CH = 48;

/** Lectura sentada y en silencio (detalle del sermón): medida editorial. */
export const STUDY_MEASURE_CH = 62;

/**
 * Cuerpo de entrega, calibrado para tablet de 11-13″ a 60-70 cm, DE PIE.
 *
 * Es una escala aparte de la del lector de Biblia a propósito: predicar y
 * estudiar sentado no piden el mismo cuerpo, y compartir un solo ajuste hacía
 * que tocar uno cambiara el otro por la espalda.
 */
export const DELIVERY_SIZE = { min: 22, max: 40, default: 28 } as const;

/** Múltiplos del cuerpo. El cuerpo es 1.0 y no aparece en la tabla. */
export const TYPE_SCALE = {
    /** Título del movimiento: ubica, no compite. */
    movementTitle: 0.6,
    /** Referencia bíblica: se lee en voz alta, así que es cuerpo. */
    bibleReference: 1.0,
    /** Marcador de cita [N]: ancla, no contenido. */
    citationMarker: 0.55,
    /** Aparato de estudio fuera del flujo de entrega. */
    apparatus: 0.6,
    /** Timer: el dato más consultado de la pantalla (D5). */
    timer: 1.4,
} as const;

/**
 * Guía de mirada al 66 % de la MEDIDA (técnica clásica de atril).
 *
 * El predicador lee de corrido hasta la línea, levanta la vista y termina la
 * frase de memoria mirando a la gente. En papel funciona porque la medida es
 * fija; acá recién es fiel a la técnica ahora que la medida está clavada en
 * caracteres (D1) — con un ancho variable la vertical cortaría unos renglones
 * a mitad de palabra y a otros les pasaría de largo.
 *
 * EXCLUYENTE CON LA COLOMETRÍA: son dos respuestas al mismo problema —dónde
 * levantar la vista— y se estorban. La línea corta por geometría; la
 * colometría por gramática, y como deja renglones cortos la vertical queda
 * pasada de largo en casi todos. Es preferencia del predicador, no dos
 * niveles de una misma escala.
 */
export const GAZE_LINE_RATIO = 0.66;

/** Interlínea del cuerpo de entrega. */
export const DELIVERY_LINE_HEIGHT = 1.55;

/**
 * Sangría francesa de la colometría, en em: la oración abre en el margen y
 * sus continuaciones entran. Es lo que distingue "empieza una frase" de
 * "sigue la anterior" sin leerla.
 */
export const HANGING_INDENT_EM = 1.2;

/**
 * Espacio entre párrafos, en em. Una línea entera desarma el movimiento en
 * fragmentos sueltos; menos que esto lo apelmaza.
 */
export const PARAGRAPH_GAP_EM = 0.9;

/**
 * Tamaño de referencia para medir el ancho medio de carácter de la fuente.
 * Las métricas escalan lineal, así que se mide una vez y se regla.
 *
 * Chico a propósito: la sonda se mide en una línea, y a tamaños grandes la
 * muestra excede el ancho de pantalla y RN la trunca — el resultado sería una
 * medida menor que la real y la caja saldría angosta.
 */
export const MEASURE_REFERENCE_SIZE = 20;

/** Muestra de medición: minúsculas más el espacio, que es el más frecuente. */
export const MEASURE_SAMPLE = 'abcdefghijklmnopqrstuvwxyz ';

/**
 * Ancho de la caja de texto para una medida dada.
 *
 * `charRatio` es el ancho medio de carácter a tamaño 1 — se obtiene midiendo
 * la fuente real en pantalla, no estimándola: una constante inventada aquí
 * reintroduce por la puerta de atrás el mismo error que la medida en píxeles.
 */
export function measureToWidth(charRatio: number, fontSize: number, ch: number): number {
    return charRatio * fontSize * ch;
}

/**
 * Las tres familias de ENTREGA, elegibles desde el púlpito.
 *
 * No son gustos: cada una resuelve un problema distinto del ojo que lee de
 * pie y vuelve del público.
 *
 *  - **Lexend** — diseñada para reducir el apiñamiento visual; hay evidencia
 *    de que mejora la fluidez de lectura. Es la que menos cansa en párrafos
 *    largos y por eso queda por defecto.
 *  - **Literata** — serif hecha por Google para lectura larga en pantalla
 *    (Google Books). Las serifas ayudan a mantener el renglón, que es
 *    exactamente lo que cuesta al volver la mirada.
 *  - **Atkinson Hyperlegible** — del Braille Institute, diseñada para máxima
 *    distinción entre letras parecidas. La que mejor aguanta poca luz, poco
 *    contraste y vista cansada.
 */
export const DELIVERY_FACES = ['lexend', 'literata', 'atkinson'] as const;
export type DeliveryFace = (typeof DELIVERY_FACES)[number];

/**
 * La familia por NOMBRE, para ponerla en `style`. NativeWind con `className`
 * junto a un `style` a veces no aplica lo de la clase (trampa registrada), y
 * donde la lectura importa —el versículo tocado en el atril— no se arriesga.
 */
export interface FaceFamilies {
    regular: string;
    semibold: string;
    /** Cursiva y negrita cursiva, para el formato del editor (`INLINE_FORMAT_RULE`). */
    italic: string;
    semiboldItalic: string;
    /**
     * La familia no tiene cursiva propia (Lexend no la diseñó): se pide
     * inclinada al sistema con `fontStyle`.
     */
    synthItalic: boolean;
}

export const FACE_FAMILY: Record<DeliveryFace, FaceFamilies> = {
    lexend: { regular: 'Lexend', semibold: 'Lexend-SemiBold', italic: 'Lexend', semiboldItalic: 'Lexend-SemiBold', synthItalic: true },
    literata: {
        regular: 'Literata',
        semibold: 'Literata-SemiBold',
        italic: 'Literata-Italic',
        semiboldItalic: 'Literata-SemiBoldItalic',
        synthItalic: false,
    },
    atkinson: {
        regular: 'Atkinson',
        semibold: 'Atkinson-Bold',
        italic: 'Atkinson-Italic',
        semiboldItalic: 'Atkinson-BoldItalic',
        synthItalic: false,
    },
};

/**
 * La familia y el estilo de una palabra con formato del editor: negrita en
 * seminegrita (la del púlpito), cursiva en la cursiva de la familia.
 */
export function formattedFont(
    families: FaceFamilies,
    format: { bold?: boolean; italic?: boolean },
): { fontFamily?: string; transform?: { skewX: string }[] } {
    if (!format.bold && !format.italic) return {};
    const fontFamily = format.bold && format.italic ? families.semiboldItalic : format.bold ? families.semibold : families.italic;
    // Sin cursiva propia, se inclina la palabra. `fontStyle: 'italic'` no
    // sirve: iOS no inclina una familia propia que no trae cursiva (revisión
    // adversarial). Va sobre el texto de UNA palabra, no sobre texto anidado.
    return format.italic && families.synthItalic ? { fontFamily, transform: [{ skewX: '-10deg' }] } : { fontFamily };
}

/** Clases de NativeWind por familia y peso. */
export const FACE_CLASS: Record<DeliveryFace, { regular: string; semibold: string }> = {
    lexend: { regular: 'font-lexend', semibold: 'font-lexend-semibold' },
    literata: { regular: 'font-literata', semibold: 'font-literata-semibold' },
    atkinson: { regular: 'font-atkinson', semibold: 'font-atkinson-bold' },
};
