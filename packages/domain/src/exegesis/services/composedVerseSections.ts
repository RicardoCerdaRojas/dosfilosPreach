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
    /**
     * `exact`: el encabezado tiene que SER la clave, no contenerla. Hace falta
     * desde que las secciones se titulan con las preguntas del encuadre, que
     * nombran otros versículos: «¿Qué relación hay entre Santiago 2:17 y
     * Santiago 2:26?» contiene «Santiago 2:26» y no es su sección.
     */
    opciones: { exact?: boolean } = {},
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
        // Entre los encabezados que nombran la clave gana el MÁS PROFUNDO.
        //
        // En un trabajo de un solo verso el título y la sección se llaman
        // igual —«# Santiago 2:1» y «## Santiago 2:1»— y el título aparece
        // primero. Quedarse con el primero reclama el título, cuya sección
        // llega hasta el final del documento, y reemplazar el cuerpo del verso
        // borra el trabajo. El título de un documento nunca está más adentro
        // que sus secciones, así que la profundidad los distingue sin tener
        // que saber cuál es el título.
        let idx = -1;
        for (let i = 0; i < headings.length; i += 1) {
            const nombra = opciones.exact
                ? normalizeHeading(headings[i]!.text) === needle
                : headingNames(headings[i]!.text, needle);
            if (claimed.has(i) || !nombra) continue;
            if (idx === -1 || headings[i]!.level > headings[idx]!.level) idx = i;
        }
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
 * Caracteres que, detrás de la clave, significan que la referencia SIGUE.
 *
 * Los dígitos y los dos puntos cortan «Santiago 1:20» cuando se busca
 * «Santiago 1:2»: dos versos distintos que pueden estar en el mismo trabajo.
 *
 * Los guiones se agregaron después de que un RANGO se hiciera pasar por el
 * verso que lo abre. El título del trabajo era «# Santiago 2:1-13» y la clave
 * «Santiago 2:1»: el carácter siguiente era un guion, el guardián lo dejaba
 * pasar, y el título quedaba reclamado como si fuera la sección del primer
 * verso. Como el título es de nivel 1 y las secciones de nivel 2, esa sección
 * llegaba hasta el final del documento —no hay otro nivel 1 después— y
 * recomponer 2:1 REEMPLAZABA EL TRABAJO ENTERO. Medido sobre un trabajo real:
 * 41.416 caracteres quedaron en 39.
 *
 * Van los tres guiones porque las referencias se escriben con los tres.
 */
const SIGUE_LA_REFERENCIA = /[\d:\-–—]/;

/**
 * Si el encabezado nombra ESTA clave y no otra que la contenga.
 */
function headingNames(headingText: string, normalizedKey: string): boolean {
    const heading = normalizeHeading(headingText);
    let from = 0;
    for (;;) {
        const at = heading.indexOf(normalizedKey, from);
        if (at === -1) return false;
        const after = heading[at + normalizedKey.length];
        if (after === undefined || !SIGUE_LA_REFERENCIA.test(after)) return true;
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

/**
 * Los títulos de la prosa de un versículo que responde VARIAS preguntas,
 * reescritos con el texto exacto de cada pregunta.
 *
 * El compositor recibe la orden de abrir cada respuesta con su pregunta, pero
 * un modelo parafrasea: si el título escrito no es el que el ensamble busca al
 * recomponer, la sección no se encuentra. Aquí se deja cada título idéntico al
 * de `sectionHeadings`.
 *
 * Si la prosa trae tantos títulos como preguntas, se reescriben en orden (lo
 * que haya antes del primero queda en la primera respuesta). Si trae otra
 * cantidad no se adivina cuál es cuál: se quitan todos y queda un solo título,
 * el de la primera pregunta. Se pierde un título, nunca texto.
 *
 * Con una pregunta o ninguna, la prosa queda igual: el título lo pone el
 * ensamblador.
 */
export function canonicalizeQuestionHeadings(markdown: string, questionTexts: readonly string[]): string {
    if (questionTexts.length < 2) return markdown;
    const lineas = markdown.split('\n');
    // Se cuentan los títulos de UN nivel: el que trae exactamente uno por
    // pregunta (el prompt pide `##`; un modelo a veces usa `###`). Un `###`
    // interno a una respuesta es cuerpo, no otra pregunta: contarlo mandaba
    // al plan B y se perdía el título de la segunda.
    const deNivel = (n: number) => lineas
        .map((linea, i) => (new RegExp(`^#{${n}}[ \\t]+\\S`).test(linea) ? i : -1))
        .filter(i => i >= 0);
    const titulos = [2, 3].map(deNivel).find(t => t.length === questionTexts.length) ?? deNivel(2);

    const bloque = (desde: number, hasta: number) => lineas.slice(desde, hasta).join('\n').trim();
    if (titulos.length !== questionTexts.length) {
        const sinTitulos = lineas.filter((_, i) => !titulos.includes(i)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        return `## ${questionTexts[0]}\n\n${sinTitulos}`;
    }

    const partes: string[] = [];
    titulos.forEach((linea, k) => {
        const fin = titulos[k + 1] ?? lineas.length;
        const cuerpo = k === 0
            ? [bloque(0, linea), bloque(linea + 1, fin)].filter(Boolean).join('\n\n')
            : bloque(linea + 1, fin);
        partes.push(`## ${questionTexts[k]}`, '', cuerpo, '');
    });
    return partes.join('\n').trim();
}

/**
 * Cambia la prosa de un versículo que en el documento ocupa una o más
 * secciones con título propio —las preguntas que responde—.
 *
 * Con un solo título es `replaceVerseSectionExact`: se cambia el cuerpo y
 * el título queda. Con varios, la prosa nueva trae sus títulos y reemplaza el
 * tramo entero, del primer título al final de la última sección. Si falta
 * alguno o están fuera de orden, `null`: como en `replaceVerseSection`,
 * reemplazar a ciegas deja el versículo dos veces.
 */
export function replaceSectionsByHeadings(
    assembled: string,
    headings: readonly string[],
    prose: string,
): string | null {
    if (headings.length <= 1) return headings[0] ? replaceVerseSectionExact(assembled, headings[0], prose) : null;
    const body = prose.trim();
    if (!body) return null;
    const located = locateVerseSections(assembled, headings, { exact: true });
    if (!located) return null;
    const tramos = headings.map(h => located.get(h)!);
    if (tramos.some((t, i) => i > 0 && t.bodyStart <= tramos[i - 1]!.bodyStart)) return null;

    const inicio = assembled.lastIndexOf('\n', tramos[0]!.bodyStart - 1) + 1;
    return reemplazaTramo(assembled, inicio, tramos[tramos.length - 1]!.end, body);
}

/**
 * El respaldo para un versículo SIN preguntas propias, o para un ensamble
 * anterior a los títulos por pregunta: busca la sección cuyo título es
 * EXACTAMENTE la referencia.
 *
 * `replaceVerseSection` acepta un título que CONTENGA la clave, y con los
 * títulos por pregunta eso reemplazaba la respuesta a «¿Qué relación hay
 * entre Santiago 2:17 y Santiago 2:26?» con la prosa de 2:26.
 *
 * Si la prosa trae sus propios títulos (un versículo que responde varias
 * preguntas sobre un ensamble viejo), reemplaza el tramo desde el título
 * viejo: dejarlo dejaba un «## Santiago 2:21» vacío encima de las preguntas.
 */
export function replaceVerseSectionExact(assembled: string, key: string, prose: string): string | null {
    const body = prose.trim();
    if (!body) return null;
    const located = locateVerseSections(assembled, [key], { exact: true });
    if (!located) return null;
    const tramo = located.get(key)!;
    if (!/^#{1,6}\s/.test(body)) {
        const viejo = assembled.slice(tramo.bodyStart, tramo.end);
        if (viejo.trim() === body) return assembled;
        return `${assembled.slice(0, tramo.bodyStart)}\n\n${body}\n\n${assembled.slice(tramo.end)}`;
    }
    const inicio = assembled.lastIndexOf('\n', tramo.bodyStart - 1) + 1;
    return reemplazaTramo(assembled, inicio, tramo.end, body);
}

/**
 * Reemplaza `[inicio, fin)` por `body`, conservando el `---` que el
 * ensamblador pone antes de la sección siguiente y que cae dentro del tramo.
 */
function reemplazaTramo(assembled: string, inicio: number, fin: number, body: string): string {
    const viejo = assembled.slice(inicio, fin);
    const separador = /\n-{3,}\s*$/.test(viejo) ? '---\n\n' : '';
    const nuevo = `${body}\n\n${separador}`;
    if (viejo.trim() === nuevo.trim()) return assembled;
    return `${assembled.slice(0, inicio)}${nuevo}${assembled.slice(fin)}`;
}
