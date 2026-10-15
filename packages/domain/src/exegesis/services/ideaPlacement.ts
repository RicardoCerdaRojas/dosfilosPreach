/**
 * «Agregar una idea a esta sección» (TP #6, #22; decisión del fundador
 * 2026-10-15).
 *
 * Recomponer con una indicación reescribe la sección entera, y en el TP #6
 * el fundador terminó editando a mano para sumar una sola evidencia (Mayor,
 * pp. 14 y 111). Aquí el asistente NO devuelve la sección: devuelve la
 * oración nueva y dónde va. La inserción la hace este código sobre el texto
 * original, así que el resto queda idéntico por construcción, no por
 * obediencia del modelo.
 */

/** Dónde va la idea y con qué palabras, según el asistente. */
export interface IdeaPlacement {
    /** Índice del párrafo (0 = el primero) entre los que `proseParagraphs` numera. */
    paragraphIndex: number;
    /**
     * La oración del párrafo, copiada tal cual, DESPUÉS de la cual entra la
     * idea. Vacía: al final del párrafo.
     */
    afterSentence: string;
    /** La idea redactada: una o dos oraciones, con la cita del estudiante. */
    sentence: string;
}

export interface IdeaInsertion {
    markdown: string;
    /** El párrafo donde quedó, ya con la idea. Para mostrarlo antes de guardar. */
    paragraph: string;
    paragraphIndex: number;
    /** Falso si la oración de referencia no estaba y la idea fue al final del párrafo. */
    anchored: boolean;
}

interface Tramo { start: number; end: number; text: string }

/** Encabezado, lista, tabla o cita: no son prosa donde entre una idea. */
const ENCABEZADO = /^\s*#/;
const NO_ES_PROSA = /^\s*(?:[-*+]\s|\d+[.)]\s|\||>)/;

/**
 * Los párrafos de prosa, con su posición exacta en el texto.
 *
 * Línea por línea: un encabezado corta el bloque aunque no lo separe una
 * línea en blanco («## Sub\nPárrafo…»), y los bloques de lista, tabla o cita
 * no se ofrecen (la idea quedaba dentro de un ítem). Acepta CRLF.
 */
function tramos(markdown: string): Tramo[] {
    const out: Tramo[] = [];
    let actual: { start: number; end: number } | null = null;
    const cerrar = () => {
        if (actual) {
            const text = markdown.slice(actual.start, actual.end);
            if (text.trim() && !NO_ES_PROSA.test(text)) out.push({ ...actual, text });
        }
        actual = null;
    };
    const re = /[^\r\n]*(?:\r?\n|$)/g;
    for (let m = re.exec(markdown); m && m[0].length > 0; m = re.exec(markdown)) {
        const linea = m[0].replace(/\r?\n$/, '');
        const start = m.index;
        const end = start + linea.length;
        if (!linea.trim() || ENCABEZADO.test(linea)) { cerrar(); continue; }
        if (actual) actual.end = end; else actual = { start, end };
    }
    cerrar();
    return out;
}

/** Dónde termina la oración que empieza o contiene `desde` (índice dentro del párrafo). */
function finDeOracion(texto: string, desde: number): number {
    // Si lo anterior ya cierra oración, ahí es.
    if (/[.!?…]["»”')\]]*\s*$/.test(texto.slice(0, desde))) return desde;
    const m = /[.!?…]+["»”')\]]*(?=\s|$)/.exec(texto.slice(desde));
    return m ? desde + m.index + m[0].length : texto.length;
}

/** Los párrafos que se le muestran al asistente, en el orden que `paragraphIndex` usa. */
export function proseParagraphs(markdown: string): string[] {
    return tramos(markdown).map(t => t.text);
}

/**
 * Inserta la idea en el texto sin tocar nada más.
 *
 * El índice fuera de rango se acota; una oración de referencia que no está en
 * el párrafo manda la idea al final de ese párrafo (y lo dice `anchored`).
 */
export function insertIdea(markdown: string, placement: IdeaPlacement): IdeaInsertion {
    const sentence = placement.sentence.trim();
    const ps = tramos(markdown);
    if (ps.length === 0) {
        const base = markdown.trimEnd();
        const nuevo = base ? `${base}\n\n${sentence}` : sentence;
        return { markdown: nuevo, paragraph: sentence, paragraphIndex: 0, anchored: false };
    }
    const i = Math.min(Math.max(0, Math.trunc(placement.paragraphIndex) || 0), ps.length - 1);
    const p = ps[i]!;
    const ancla = placement.afterSentence.trim();
    const dentro = ancla ? p.text.indexOf(ancla) : -1;
    const anchored = dentro >= 0;
    // Siempre en un límite de oración: si el asistente copió la oración sin
    // su punto, o sólo su comienzo, la idea caía en medio (revisión
    // adversarial).
    const corte = p.start + (anchored ? finDeOracion(p.text, dentro + ancla.length) : p.text.length);
    // Un espacio antes; y uno después sólo si lo que sigue no lo trae.
    const sigue = markdown.slice(corte, p.end);
    const insercion = ` ${sentence}${sigue && !/^\s/.test(sigue) ? ' ' : ''}`;
    const nuevo = markdown.slice(0, corte) + insercion + markdown.slice(corte);
    const paragraph = nuevo.slice(p.start, p.end + insercion.length);
    return { markdown: nuevo, paragraph, paragraphIndex: i, anchored };
}

/**
 * Las citas que el estudiante escribió en su idea y la oración redactada
 * perdió. La cita es lo que el estudiante verificó en el libro: si no está,
 * se avisa antes de insertar.
 */
export function citationsLost(idea: string, sentence: string): string[] {
    const norma = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const redactada = norma(sentence);
    const perdidas: string[] = [];
    for (const m of idea.matchAll(/\(([^()]*)\)/g)) {
        const dentro = m[1]!;
        // Una referencia bíblica no es una cita de fuente.
        if (/\d+\s*:\s*\d+/.test(dentro)) continue;
        // Cada cita del paréntesis («Mayor, 14; Moo, 170»): autor + páginas.
        for (const parte of dentro.split(';')) {
            const autor = norma(parte).replace(/^\s*(?:cf\.|vease|véase|see)\s+/, '').match(/\p{L}[\p{L}'-]+/u)?.[0];
            const texto = norma(parte);
            // Páginas: los números, y un romano sólo justo después de la coma
            // («Moo, xiv»): suelto, «mi» o «di» también lo parecen.
            const paginas = [
                ...(texto.match(/\d+/g) ?? []),
                ...[...texto.matchAll(/,\s*(?:pp?\.\s*)?([ivxlcdm]+)\b/g)].map(r => r[1]!),
            ];
            if (!autor || paginas.length === 0) continue;
            const esta = redactada.includes(autor) && paginas.every(pg => new RegExp(`\\b${pg}\\b`).test(redactada));
            if (!esta) perdidas.push(`(${parte.trim()})`);
        }
    }
    return perdidas;
}

/** Lo que el puerto recibe para ubicar la idea. */
export interface PlaceIdeaInput {
    paragraphs: ReadonlyArray<string>;
    idea: string;
    language: 'es' | 'en';
}

export interface PlaceIdeaOutput {
    placement: IdeaPlacement;
    tokensUsed: number;
    modelId: string;
}

/** El asistente que redacta la idea y elige dónde va. */
export interface IIdeaPlacer {
    placeIdea(input: PlaceIdeaInput): Promise<PlaceIdeaOutput>;
}
