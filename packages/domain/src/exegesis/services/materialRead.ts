/**
 * Lo que una fuente puso de verdad en el prompt del analizador.
 *
 * La selección elige hojas y después el reparto del presupuesto puede cortar
 * el texto, incluso lo fijado (§5 de `docs/FASE_DEL_CORPUS_AL_TEXTO_2026-11.md`:
 * lo elegido pesa 3–4 veces el presupuesto y llega un 24–32 %). Sin registrarlo
 * no se distingue «el sistema no halló la hoja» de «la halló y no llegó».
 */
export interface SourceMaterialRead {
    readonly sourceKey: string | null;
    readonly label: string;
    /** Las anclas que quedaron, compactas: «p. 155–157, 160; hoja 12». `null` si no llegó ninguna. */
    readonly read: string | null;
    /** El reparto cortó el texto de esta fuente. */
    readonly truncated: boolean;
    /** Lo fijado por el estudiante no cupo entero. */
    readonly pinnedCut: boolean;
}

const ANCLA = /^--- (.+?) ---$/gm;

/**
 * Las anclas de un texto, agrupadas por tipo y con los tramos consecutivos
 * juntos: «p. 155–157, 160; hoja 12; § 2.3».
 *
 * Solo cuentan las anclas enteras: un recorte que cae en medio de «--- p. 1»
 * no llevó esa página.
 */
export function summarizeReadAnchors(text: string): string | null {
    const porTipo = new Map<string, number[]>();
    const secciones: string[] = [];
    for (const m of text.matchAll(ANCLA)) {
        // «p. 580, § 2. Semantics»: la sección acompaña a la página y no se repite aquí.
        const ancla = m[1]!.trim();
        const num = ancla.match(/^(p\.|hoja)\s+(\d+)(?:\s*,\s*§.*)?$/);
        if (num) {
            const lista = porTipo.get(num[1]!) ?? [];
            lista.push(Number(num[2]));
            porTipo.set(num[1]!, lista);
        } else {
            // Una página romana con su sección queda en la página.
            const sinSeccion = ancla.replace(/^((?:p\.|hoja)\s+\S+?)\s*,\s*§.*$/, '$1');
            if (!secciones.includes(sinSeccion)) secciones.push(sinSeccion);
        }
    }
    const partes = [...porTipo.entries()].map(([tipo, nums]) => `${tipo} ${tramos(nums)}`);
    const todo = [...partes, ...secciones];
    return todo.length > 0 ? todo.join('; ') : null;
}

/** [155, 156, 157, 160] → «155–157, 160». */
function tramos(nums: number[]): string {
    const orden = [...new Set(nums)].sort((a, b) => a - b);
    const salida: string[] = [];
    let desde = orden[0]!;
    let hasta = desde;
    for (const n of orden.slice(1)) {
        if (n === hasta + 1) { hasta = n; continue; }
        salida.push(desde === hasta ? `${desde}` : `${desde}–${hasta}`);
        desde = hasta = n;
    }
    salida.push(desde === hasta ? `${desde}` : `${desde}–${hasta}`);
    return salida.join(', ');
}
