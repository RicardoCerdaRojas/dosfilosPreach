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

/** Los párrafos de prosa, con su posición en el texto. Los encabezados no cuentan. */
function tramos(markdown: string): Tramo[] {
    const out: Tramo[] = [];
    const re = /[^\n](?:[^\n]|\n(?![ \t]*\n))*/g;
    for (let m = re.exec(markdown); m; m = re.exec(markdown)) {
        const text = m[0];
        if (/^\s*#/.test(text) || !text.trim()) continue;
        out.push({ start: m.index, end: m.index + text.length, text });
    }
    return out;
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
    const corte = anchored ? p.start + dentro + ancla.length : p.end;
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
    const citas = idea.match(/\([^()]*\d[^()]*\)/g) ?? [];
    const norma = (s: string) => s.replace(/\s+/g, ' ').replace(/\bpp?\.\s*/g, '').trim();
    const redactada = norma(sentence);
    return citas.filter(c => !redactada.includes(norma(c)));
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
