/**
 * Troceo del paper compuesto por sección de verso.
 *
 * El compositor entrega un único markdown con todo el paper adentro.
 * Para poder decir «este verso salió incompleto» —y publicarlo con el
 * render determinista sin tocar los versos que sí salieron enteros—
 * hay que saber dónde empieza y dónde termina cada uno.
 *
 * El contrato es un encabezado por verso rotulado con la referencia
 * que devuelve `verseSectionKey`. La misma función la lee el prompt
 * del compositor, el render determinista y este troceador, así que el
 * rótulo que se pide, el que se emite y el que se busca no pueden
 * divergir.
 *
 * Si falta UN encabezado se devuelve `null` y el llamador cae al
 * camino entero. Reemplazar a ciegas dentro de un documento que no se
 * supo leer produciría un paper con dos versiones del mismo verso, que
 * es peor que cualquiera de las dos.
 */
export interface VerseSectionBounds {
    /** Índice del primer carácter DESPUÉS de la línea del encabezado. */
    bodyStart: number;
    /** Índice del primer carácter del siguiente encabezado de igual o mayor jerarquía. */
    end: number;
}

const HEADING_LINE = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm;

/**
 * Ubica la sección de cada clave. Devuelve `null` si alguna no
 * aparece, o si dos claves caen en el mismo encabezado.
 */
export function locateVerseSections(
    markdown: string,
    keys: readonly string[],
): Map<string, VerseSectionBounds> | null {
    if (keys.length === 0) return null;

    const headings: Array<{ level: number; text: string; start: number; lineEnd: number }> = [];
    HEADING_LINE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = HEADING_LINE.exec(markdown)) !== null) {
        headings.push({
            level: match[1]!.length,
            text: match[2]!,
            start: match.index,
            lineEnd: match.index + match[0]!.length,
        });
    }
    if (headings.length === 0) return null;

    const out = new Map<string, VerseSectionBounds>();
    const claimed = new Set<number>();
    for (const key of keys) {
        const needle = normalizeHeading(key);
        const idx = headings.findIndex((h, i) => !claimed.has(i) && headingNames(h.text, needle));
        if (idx === -1) return null;
        claimed.add(idx);

        const heading = headings[idx]!;
        // El cuerpo del verso termina donde empieza el siguiente
        // encabezado de igual o mayor jerarquía: un `###` dentro del
        // verso (una subsección que el compositor haya abierto) sigue
        // siendo parte del verso.
        const next = headings.find(h => h.start > heading.start && h.level <= heading.level);
        out.set(key, {
            bodyStart: heading.lineEnd,
            end: next ? next.start : markdown.length,
        });
    }
    return out;
}

/**
 * Reescribe el cuerpo de las secciones que `replace` decida, dejando
 * el resto del documento intacto —encabezados incluidos—. Devuelve
 * `null` cuando el documento no se pudo trocear.
 */
export function replaceVerseSectionBodies(
    markdown: string,
    keys: readonly string[],
    replace: (key: string, body: string) => string | null,
): string | null {
    const located = locateVerseSections(markdown, keys);
    if (!located) return null;

    const edits = [...located.entries()]
        .map(([key, bounds]) => {
            const body = markdown.slice(bounds.bodyStart, bounds.end);
            const next = replace(key, body);
            return next === null ? null : { bounds, next };
        })
        .filter((e): e is { bounds: VerseSectionBounds; next: string } => e !== null)
        .sort((a, b) => a.bounds.bodyStart - b.bounds.bodyStart);

    if (edits.length === 0) return markdown;

    let out = '';
    let cursor = 0;
    for (const edit of edits) {
        out += markdown.slice(cursor, edit.bounds.bodyStart);
        out += `\n\n${edit.next.trim()}\n\n`;
        cursor = edit.bounds.end;
    }
    out += markdown.slice(cursor);
    return out;
}

/**
 * Si el encabezado nombra ESTA clave y no otra que la contenga.
 *
 * «Santiago 1:2» es subcadena de «Santiago 1:20», y los dos versos
 * pueden estar en el mismo trabajo. Sin este corte, un verso al que
 * el compositor le comió el encabezado se llevaría la sección del
 * otro y publicaría su análisis en el lugar equivocado.
 */
function headingNames(headingText: string, normalizedKey: string): boolean {
    const heading = normalizeHeading(headingText);
    let from = 0;
    for (;;) {
        const at = heading.indexOf(normalizedKey, from);
        if (at === -1) return false;
        const after = heading[at + normalizedKey.length];
        if (after === undefined || !/[\d:]/.test(after)) return true;
        from = at + 1;
    }
}

/**
 * Normaliza para comparar encabezados: minúsculas, sin acentos
 * latinos, sin puntuación decorativa y con los espacios colapsados.
 * Así «### Santiago 1:2 — La prueba» encuentra la clave «Santiago 1:2».
 */
function normalizeHeading(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[*_`#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Cambia la prosa de UN verso dentro del trabajo ya ensamblado, dejando
 * todo lo demás igual.
 *
 * Es el remedio para un verso que salió corto o como ficha mecánica.
 * Antes, la única salida era recomponer el trabajo entero: una llamada
 * cara que reescribe los versos que estaban bien y descoloca lo que el
 * autor ya había revisado.
 *
 * Devuelve `null` cuando el ensamblado no trae la sección de ese verso.
 * Eso NO se arregla pegando la prosa al final: el trabajo terminaría con
 * dos versiones del mismo verso, y de las dos la vieja es la que el
 * lector encuentra primero. Quien llama debe decirlo.
 */
export function replaceVerseSection(
    assembled: string,
    key: string,
    prose: string,
): string | null {
    const body = prose.trim();
    if (!body) return null;
    return replaceVerseSectionBodies(assembled, [key], (_key, previous) => (
        previous.trim() === body ? null : body
    ));
}
