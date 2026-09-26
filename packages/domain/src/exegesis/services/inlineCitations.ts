/**
 * Reconocimiento de citas inline.
 *
 * Tres formas, porque el sistema emite tres. La forma canónica es
 * `(Autor, "Título", p. N)` —la que el prompt pide y la que escribe
 * `DeterministicStyleFormatter`—, pero un paper real de Santiago
 * 1:1-5 salió con `Adamson (p. 53)` de punta a punta y el verificador
 * no reconoció ninguna: cero citas detectadas, cero dudas reportadas,
 * verde por vacío. Y había algo que atrapar — una cita corrida por una
 * página y un ejemplo griego que no estaba en el libro citado.
 *
 * Un verificador que sólo lee su propio formato no verifica: certifica
 * su formato.
 *
 * Por eso el ancla admite «hoja N» además de «p. N». «hoja N» es lo que el
 * sistema escribe cuando la fuente no tiene numeración confirmada —no inventa
 * una página que no verificó—, y no reconocerla salía caro dos veces: la cita
 * quedaba sin verificar Y la fuente se reportaba como nombrada sin citar, o
 * sea que el formato honesto era el que producía la advertencia.
 *
 * El precio de admitir las formas sin comillas es algún falso
 * positivo —«Santiago (p. 3)» parece una cita y no lo es—. Se paga a
 * conciencia: una fila «no se encontró la fuente» es visible y el
 * usuario la descarta en un segundo; el silencio de antes no era
 * visible para nadie.
 */

/**
 * `(Autor, "Título", p. N)` — la forma canónica, con título entre comillas.
 *
 * Abre con `(` o con `;` y cierra con `;` o con `)` para admitir las citas
 * COMPUESTAS: `(Mayor, "…", 330; Adamson, "…", 75)` es una sola forma que el
 * compositor emite y que antes no se reconocía entera —el grupo de páginas no
 * admite `;`, así que el patrón moría ahí—. Resultado: dos citas reales
 * quedaban sin verificar y, peor, el detector veía «Adamson» en la prosa sin
 * cita asociada y lo reportaba como fuente nombrada sin citar.
 *
 * El terminador va en LOOKAHEAD y no se consume: en una compuesta, el `;` que
 * cierra la primera cita es el mismo que abre la segunda.
 */
const QUOTED_CITATION =
    /[(;]\s*([^,();]+?)\s*,\s*"([^"]+)"(?:\s*,\s*(?:pp?\.\s*|hojas?\s+)?([\d–\-—,\s]+))?\s*(?=[;)])/g;

/** `(Autor, p. N)` y `(Autor, N)` — sin título. Mismo criterio para las compuestas. */
const UNQUOTED_CITATION =
    /[(;]\s*([^,();"]{2,60}?)\s*,\s*(?:pp?\.\s*|hojas?\s+)?(\d[\d–\-—,\s]*?)\s*(?=[;)])/g;

/**
 * `Adamson (p. 53)` — el autor queda fuera del paréntesis. Se exige
 * inicial mayúscula en el nombre para no confundir un paréntesis
 * numérico cualquiera con una cita.
 *
 * Se toma UNA sola palabra, la pegada al paréntesis. Admitir dos
 * arrastraba la mayúscula de comienzo de oración —«Primero Adamson
 * (p. 53)» daba el autor «Primero Adamson»— y las claves de cita de
 * este producto son apellidos de una palabra.
 */
const AUTHOR_BEFORE_PAGE =
    /(\p{Lu}[\p{L}.'’-]+)\s*\(\s*(?:pp?\.\s*|hojas?\s+)?(\d[\d–\-—,\s]*?)\s*\)/gu;

interface RawMatch {
    raw: string;
    author: string;
    title: string;
    pages: string | null;
    offset: number;
    end: number;
}

function collect(
    markdown: string,
    regex: RegExp,
    read: (m: RegExpExecArray) => { author: string; title: string; pages: string | null },
): RawMatch[] {
    const out: RawMatch[] = [];
    // Los patrones son de módulo y llevan `g`: sin este reset una
    // llamada seguiría donde terminó la anterior.
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(markdown)) !== null) {
        const { author, title, pages } = read(match);
        out.push({
            raw: match[0]!,
            author: author.trim(),
            title: title.trim(),
            pages: pages ? pages.trim() : null,
            offset: match.index,
            end: match.index + match[0]!.length,
        });
    }
    return out;
}

/**
 * Todas las citas inline de un texto, resueltos los solapamientos.
 *
 * Cuando dos formas caen sobre el mismo texto gana la más rica:
 * `(Adamson, "The Epistle of James", p. 53)` se lee entera, y no como un
 * `(Autor, N)` recortado adentro.
 *
 * Vive en el dominio porque tiene DOS lectores con necesidades opuestas y
 * hasta ahora sólo uno sabía leer. El verificador las quiere todas y tolera
 * algún falso positivo —una fila «no se encontró la fuente» se ve y se
 * descarta—; el exportador Word no puede tolerarlo, porque convertir una
 * ficha Turabian en nota al pie corrompe el documento. La respuesta no es un
 * patrón por lector —dos lecturas de la misma forma divergen— sino un
 * reconocedor único y un filtro distinto encima: `resolvesToCitedSource`.
 */
export interface InlineCitationMatch {
    raw: string;
    author: string;
    title: string;
    pages: string | null;
    offset: number;
    end: number;
}

export function findInlineCitations(markdown: string): InlineCitationMatch[] {
    const matches = [
        ...collect(markdown, QUOTED_CITATION, m => ({
            author: m[1] ?? '', title: m[2] ?? '', pages: m[3] ?? null,
        })),
        ...collect(markdown, UNQUOTED_CITATION, m => ({
            author: m[1] ?? '', title: '', pages: m[2] ?? null,
        })),
        ...collect(markdown, AUTHOR_BEFORE_PAGE, m => ({
            author: m[1] ?? '', title: '', pages: m[2] ?? null,
        })),
    ]
        // Más rica primero (con título), y a igualdad la más larga: así la que
        // sobrevive al solapamiento es la que más dice.
        .sort((a, b) => (b.title ? 1 : 0) - (a.title ? 1 : 0) || (b.end - b.offset) - (a.end - a.offset));

    const accepted: InlineCitationMatch[] = [];
    for (const candidate of matches) {
        const overlaps = accepted.some(a => candidate.offset < a.end && a.offset < candidate.end);
        if (!overlaps) accepted.push(candidate);
    }
    return accepted;
}

/** Acentos y mayúsculas fuera: «Wallace» y «wallace» son el mismo autor. */
function normaliza(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Si el autor de una cita es una de las fuentes que el trabajo declara.
 *
 * Éste es el discriminador que faltaba, y no es un patrón más fino: es mirar
 * el corpus. Una cita sin título —`(Mayor, 77)`, `Kistemaker (p. 259)`— es
 * indistinguible por su forma de una ficha Turabian —`(Nashville: Broadman &
 * Holman, 2003)`— o de una referencia bíblica —`(Génesis 19:25, 29)`. Por la
 * forma, no hay regla; por el corpus, sí: «Mayor» y «Kistemaker» son claves
 * de cita del trabajo y «Nashville» y «Génesis» no lo son.
 *
 * Medido sobre los 14 trabajos con prosa ensamblada en producción: de las 103
 * citas sin título, 89 resuelven a una fuente declarada y 14 no — y esas 14
 * son, una por una, pies de imprenta y referencias bíblicas. La separación es
 * limpia en los dos sentidos.
 *
 * Se admite que la clave sea una PALABRA del autor citado —«Nestle-Aland
 * (p. 709)» contra la clave «Nestle-Aland»— pero no al revés: un apellido que
 * apenas contiene a la clave convertiría «Santiago» en la fuente «Santi».
 */
export function resolvesToCitedSource(
    author: string,
    citationKeys: ReadonlyArray<string | null | undefined>,
): boolean {
    const a = normaliza(author);
    if (!a) return false;
    return citationKeys.some(raw => {
        const k = normaliza(raw ?? '');
        if (!k) return false;
        return a === k || a.startsWith(`${k} `) || a.endsWith(` ${k}`) || a.includes(` ${k} `);
    });
}
