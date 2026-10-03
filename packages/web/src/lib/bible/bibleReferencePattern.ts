// Comprehensive pattern to match Bible references in Spanish
// Matches: "Juan 3:16", "Jn 3:16", "1 Juan 3:16-18", "1Jn 3.16", "Gén 1:1", etc.
// Supports: Full names, abbreviations, with/without spaces, : or . as separator
export const BIBLE_REF_PATTERN = /(?:^|[^\wáéíóúñ])((?:[1-3]\s?)?(?:Génesis|Genesis|Gén|Gen|Gn|Éxodo|Exodo|Éx|Ex|Levítico|Levitico|Lev|Lv|Números|Numeros|Núm|Num|Nm|Deuteronomio|Deut|Dt|Josué|Josue|Jos|Jueces|Jue|Jc|Rut|Rt|Samuel|Sam|S|Reyes|Rey|R|Crónicas|Cronicas|Cr|Esdras|Esd|Ezr|Nehemías|Nehemias|Neh|Ne|Ester|Est|Et|Job|Jb|Salmos?|Sal|Sl|Ps|Proverbios|Prov|Pr|Prv|Eclesiastés|Eclesiastes|Ecl|Ec|Cantares|Cantar|Cnt|Ct|Isaías|Isaias|Is|Isa|Jeremías|Jeremias|Jer|Jr|Lamentaciones|Lam|Lm|Ezequiel|Ezeq|Ez|Daniel|Dan|Dn|Oseas|Os|Joel|Jl|Amós|Amos|Am|Abdías|Abdias|Abd|Ab|Jonás|Jonas|Jon|Miqueas|Miq|Mi|Nahúm|Nahum|Nah|Na|Habacuc|Hab|Sofonías|Sofonias|Sof|Hageo|Hag|Zacarías|Zacarias|Zac|Zc|Malaquías|Malaquias|Mal|Mateo|Mat|Mt|Marcos|Mar|Mc|Mr|Lucas|Luc|Lc|Juan|Jn|Hechos|Hch|Hec|Romanos|Rom|Ro|Rm|Corintios|Cor|Co|Gálatas|Galatas|Gál|Gal|Ga|Efesios|Ef|Efe|Filipenses|Fil|Fp|Colosenses|Col|Tesalonicenses|Tes|Ts|Timoteo|Tim|Ti|Tito|Tit|Filemón|Filemon|Flm|Flmn|Hebreos|Heb|He|Santiago|Sant|Stg|Pedro|Ped|Pe|P|Judas|Jud|Apocalipsis|Apoc|Ap)\.?\s*\d+[:.]\d+(?:[-–]\d+(?:[:.]\d+)?)?)/gi;

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
