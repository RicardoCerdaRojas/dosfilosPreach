/**
 * Dónde cae una cita dentro del texto de una hoja del PDF.
 *
 * Es lo que permite abrir un documento en la página de una cita y señalar
 * la frase, en vez de dejar al lector barriendo la hoja con la vista. La
 * comparación tiene que sobrevivir a lo que un PDF le hace al texto —
 * palabras partidas con guion al final del renglón, comillas curvas,
 * espacios donde no los hay— sin dejar pasar una frase reescrita, que es
 * justo lo que la verificación existe para detectar.
 *
 * Por qué no basta con normalizar y buscar: normalizar destruye las
 * posiciones, y el resaltado las necesita. Así que se normaliza llevando
 * un mapa de vuelta — cada carácter del texto normalizado recuerda de qué
 * posición del original salió.
 *
 * Devuelve `null` cuando no la encuentra, y ESO ES UNA RESPUESTA, no un
 * fallo: media biblioteca son comentarios escaneados cuyo OCR llega
 * ilegible («τ πνμ μν υ › s ωσ»), y contra eso no hay coincidencia
 * posible. La interfaz debe abrir la página y decir que no localizó la
 * frase. Aproximar —resaltar el párrafo más parecido— convierte una
 * herramienta de verificación en una que confirma lo que sea.
 */
export interface QuoteMatch {
    /** Índice del primer carácter de la cita en el texto original. */
    start: number;
    /** Índice siguiente al último carácter, para `slice(start, end)`. */
    end: number;
}

export interface OpcionesDeBusqueda {
    /**
     * Ignorar vocales, acentos y espíritus (niqud, cantilación, tildes). Para
     * lo que el lector ESCRIBE en «Buscar en el libro» («גיא», «προ παντων»).
     * Una cita textual no: resaltar «דִּבֶּר» donde dice «דָּבָר» daría por
     * hallada una cita con otra vocalización, y el verificador de citas no la
     * acepta (revisión adversarial de la fase «biblioteca consultable»).
     */
    ignorarMarcas?: boolean;
}

export function findQuoteInPageText(quote: string, pageText: string, opciones: OpcionesDeBusqueda = {}): QuoteMatch | null {
    if (!quote.trim() || !pageText) return null;

    const plegar = opciones.ignorarMarcas === true;
    const needle = normalizeForSearch(quote, plegar).text;
    if (!needle) return null;

    const haystack = normalizeForSearch(pageText, plegar);
    const at = haystack.text.indexOf(needle);
    if (at === -1) return null;

    // `sourceIndex` guarda, por cada carácter conservado, de dónde salió.
    // El final se toma del último carácter incluido y se avanza uno, para
    // que `slice(start, end)` cubra la frase entera.
    const start = haystack.sourceIndex[at]!;
    const end = haystack.sourceIndex[at + needle.length - 1]! + 1;
    return { start, end };
}

interface NormalizedText {
    text: string;
    /** Por cada carácter de `text`, su posición en la cadena original. */
    sourceIndex: number[];
}

/**
 * Pliega las diferencias que una copia fiel arrastra igualmente, guardando
 * de dónde vino cada carácter que sobrevive.
 *
 * Se aplica a los dos lados, así que puede ser tosca: lo que deforma, lo
 * deforma idéntico en la cita y en la página. Lo que debe sobrevivir es la
 * secuencia de letras, porque es lo que separa una cita real de una
 * reescrita.
 *
 * Espacios y guiones desaparecen. Un PDF parte palabras al final del
 * renglón —«comple-⏎tamente», «pala-⏎bra»— y quien la lee transcribe la
 * palabra entera; conservar el guion hacía fallar citas verdaderas.
 */
function normalizeForSearch(input: string, ignorarMarcas: boolean): NormalizedText {
    const normalized = input.normalize('NFC');
    const chars: string[] = [];
    const sourceIndex: number[] = [];

    for (let i = 0; i < normalized.length; i++) {
        // Un carácter puede plegar a más de una letra: cada una lleva su origen.
        for (const letra of fold(normalized[i]!, ignorarMarcas)) {
            chars.push(letra);
            sourceIndex.push(i);
        }
    }

    return { text: chars.join(''), sourceIndex };
}

/**
 * Un carácter en su forma comparable, o '' cuando no cuenta.
 *
 * Con `ignorarMarcas`, las marcas no cuentan: acentos, espíritus e iota
 * suscrita del griego, y niqud y cantilación del hebreo. Así «גיא» encuentra
 * «בְּגֵ֪יא» y «προ παντων» encuentra «πρὸ πάντων» (pedido del fundador,
 * 2026-10-15). La ñ se conserva: «año» no es «ano». Así pliega `fold` en
 * `functions/src/library/documentTextSearch.ts` (prueba de paridad allá).
 */
function fold(original: string, ignorarMarcas: boolean): string {
    // «µ» de micro es una «μ» mal codificada (léxico de Tuggy, 2026-10-20).
    const char = original === '\u00B5' ? '\u03BC' : original;
    if (/[\s -]/.test(char)) return '';
    if (/[‐-―−\u05BE]/.test(char)) return '';   // guiones y el maqaf hebreo
    if (/[‘’‛′]/.test(char)) return "'";
    if (/[“”‟″«»]/.test(char)) return '"';
    if (!ignorarMarcas) return char.toLowerCase();
    if (char === 'ñ' || char === 'Ñ') return 'ñ';
    return char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[ςϲ]/g, 'σ');
}
