// El patrón vive en el dominio desde C7 (la tablet lo usa para que las
// referencias del manuscrito se puedan tocar). Una sola copia.
import { BIBLE_REF_PATTERN } from '@dosfilos/domain';

export { BIBLE_REF_PATTERN };

/** Un versículo nombrado en un texto, con el texto real si existe. */
export interface CitedVerse {
    reference: string;
    /**
     * `found`: texto real. `missing`: el libro se reconoce y ese versículo no
     * existe. `unreadable`: la referencia no se pudo leer (una abreviatura que
     * la Biblia local no conoce): no se acusa a un versículo que puede ser real
     * (revisión adversarial de R3: «Mi 6:8» salía «no existe»).
     */
    status: 'found' | 'missing' | 'unreadable';
    text: string | null;
}

export interface VerseLookup {
    verses: (ref: string) => string | null;
    /** ¿La referencia se entiende (libro, capítulo, versículo)? */
    readable: (ref: string) => boolean;
}

/**
 * Los versículos que nombra un texto, cada uno con su texto REAL.
 *
 * Lo usa el chat de consulta del Taller (hallazgo 32 del ejercicio de Jonás):
 * el asistente puede equivocar una referencia, así que no se muestra su
 * versión del versículo sino el de la Biblia, y la que no existe se marca.
 * Un rango que cruza capítulos se comprueba por su primer versículo. Una
 * referencia repetida aparece una vez.
 */
export function citedVerses(text: string, lookup: VerseLookup): CitedVerse[] {
    const re = new RegExp(BIBLE_REF_PATTERN.source, BIBLE_REF_PATTERN.flags);
    const vistas = new Set<string>();
    const out: CitedVerse[] = [];
    for (const m of text.matchAll(re)) {
        const reference = m[1]!.trim().replace(/\s+/g, ' ');
        const clave = reference.toLowerCase().replace(/\./g, ':');
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        const limpia = reference.replace(/^([^\d]*\d?[^\d]+?)\.\s*(?=\d)/, '$1 ');
        const inicio = limpia.replace(/[-–]\d+(?:[:.]\d+)?$/, '');
        const completo = lookup.verses(limpia);
        const primero = completo ?? (inicio !== limpia ? lookup.verses(inicio) : null);
        if (primero) {
            out.push({ reference, status: 'found', text: completo ?? `${primero} …` });
        } else {
            out.push({ reference, status: lookup.readable(inicio) ? 'missing' : 'unreadable', text: null });
        }
    }
    return out;
}
