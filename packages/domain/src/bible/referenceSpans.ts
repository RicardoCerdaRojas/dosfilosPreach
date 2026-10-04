/**
 * Referencias bíblicas dentro de un texto («Jonás 4:2», «1 Jn 3:16-18»).
 *
 * VIVE EN EL DOMINIO (C7 de la fase Púlpito premium): la web lo tenía en
 * `lib/bible/bibleReferencePattern.ts` y la tablet lo necesita para que las
 * referencias del manuscrito se puedan tocar y mostrar el versículo sin salir
 * de la página. Una sola copia: la web lo re-exporta.
 *
 * Cubre nombres completos, abreviaturas, con o sin espacio y `:` o `.` como
 * separador. Exige capítulo y versículo: «Juan 3» solo no se marca (es más
 * probable que sea prosa que una cita para mostrar).
 */
export const BIBLE_REF_PATTERN = /(?:^|[^\wáéíóúñ])((?:[1-3]\s?)?(?:Génesis|Genesis|Gén|Gen|Gn|Éxodo|Exodo|Éx|Ex|Levítico|Levitico|Lev|Lv|Números|Numeros|Núm|Num|Nm|Deuteronomio|Deut|Dt|Josué|Josue|Jos|Jueces|Jue|Jc|Rut|Rt|Samuel|Sam|S|Reyes|Rey|R|Crónicas|Cronicas|Cr|Esdras|Esd|Ezr|Nehemías|Nehemias|Neh|Ne|Ester|Est|Et|Job|Jb|Salmos?|Sal|Sl|Ps|Proverbios|Prov|Pr|Prv|Eclesiastés|Eclesiastes|Ecl|Ec|Cantares|Cantar|Cnt|Ct|Isaías|Isaias|Is|Isa|Jeremías|Jeremias|Jer|Jr|Lamentaciones|Lam|Lm|Ezequiel|Ezeq|Ez|Daniel|Dan|Dn|Oseas|Os|Joel|Jl|Amós|Amos|Am|Abdías|Abdias|Abd|Ab|Jonás|Jonas|Jon|Miqueas|Miq|Mi|Nahúm|Nahum|Nah|Na|Habacuc|Hab|Sofonías|Sofonias|Sof|Hageo|Hag|Zacarías|Zacarias|Zac|Zc|Malaquías|Malaquias|Mal|Mateo|Mat|Mt|Marcos|Mar|Mc|Mr|Lucas|Luc|Lc|Juan|Jn|Hechos|Hch|Hec|Romanos|Rom|Ro|Rm|Corintios|Cor|Co|Gálatas|Galatas|Gál|Gal|Ga|Efesios|Ef|Efe|Filipenses|Fil|Fp|Colosenses|Col|Tesalonicenses|Tes|Ts|Timoteo|Tim|Ti|Tito|Tit|Filemón|Filemon|Flm|Flmn|Hebreos|Heb|He|Santiago|Sant|Stg|Pedro|Ped|Pe|P|Judas|Jud|Apocalipsis|Apoc|Ap)\.?\s*\d+[:.]\d+(?:[-–]\d+(?:[:.]\d+)?)?)/gi;

export interface BibleReferenceSpan {
    /** La referencia tal como está escrita, sin espacios de más. */
    reference: string;
    /** Dónde empieza y termina dentro del texto (fin exclusivo). */
    start: number;
    end: number;
}

/**
 * Dónde caen las referencias en un texto. El patrón consume el carácter que
 * las precede (para no partir palabras): la posición se corrige a la de la
 * referencia misma.
 */
export function findBibleReferences(text: string): BibleReferenceSpan[] {
    const re = new RegExp(BIBLE_REF_PATTERN.source, BIBLE_REF_PATTERN.flags);
    const out: BibleReferenceSpan[] = [];
    for (const m of text.matchAll(re)) {
        const raw = m[1] ?? '';
        const start = (m.index ?? 0) + (m[0].length - raw.length);
        out.push({ reference: raw.trim().replace(/\s+/g, ' '), start, end: start + raw.length });
    }
    return out;
}
