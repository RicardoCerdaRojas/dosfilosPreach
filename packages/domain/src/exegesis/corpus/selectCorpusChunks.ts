import type { SheetRange } from '../entities/ProjectSource';

/**
 * Qué entra al prompt de un paso, entre todo lo que el corpus podría aportar.
 *
 * El corpus curado de doce fuentes son ~514.000 caracteres: dos veces y media el
 * tope del prompt. Mandarlo entero es lo que hace hoy el módulo, y es la razón
 * por la que un estudio serio no entra. Aquí se decide qué parte viaja.
 *
 * Dos clases de material, con reglas distintas a propósito:
 *
 *   - **Fijado** (`pinned`). Entra siempre, sin competir. Es el material que el
 *     usuario eligió con intención y que ningún ranking traería: la
 *     introducción al libro no menciona el versículo, así que por cercanía
 *     pierde contra cualquier párrafo que sí lo mencione. Si el usuario la
 *     marcó, es porque la quiere.
 *   - **Rankeado**. Compite por lo que sobre, de mayor a menor cercanía.
 *
 * El orden de esa competencia importa: si lo fijado se cargara al final, un
 * corpus grande lo dejaría afuera justo cuando más material hay para elegir —
 * que es cuando el usuario más se tomó el trabajo de marcarlo.
 */

/**
 * Un fragmento del corpus curado, candidato a entrar al prompt.
 *
 * Distinto del `RetrievedChunk` del verificador de citas, que describe un
 * fragmento suelto para comparar contra una cita. Este lleva PROCEDENCIA
 * —`resourceId` y `chunkIndex`— porque hace falta para deduplicar entre lo
 * fijado y lo rankeado, y para devolver todo en orden de documento.
 */
export interface CorpusChunk {
    resourceId: string;
    chunkIndex: number;
    text: string;
    /** Hoja física del PDF, para el ancla de citación y el orden. */
    sheet: number | null;
    section: string | null;
    /** Cercanía a la consulta, en [0,1]. Los fijados no la usan. */
    score: number;
}

export interface SelectForPromptInput {
    /** Candidatos del ranking, en cualquier orden. */
    ranked: ReadonlyArray<CorpusChunk>;
    /** Fragmentos de los tramos fijados. Entran completos. */
    pinned: ReadonlyArray<CorpusChunk>;
    /** Caracteres disponibles para el corpus en este paso. */
    budgetChars: number;
    /**
     * Parte del presupuesto que se reparte con piso por fuente antes de
     * abrir la competencia libre. Por defecto la mitad.
     *
     * Sin esto la selección es un ranking global, y un comentario extenso
     * se queda con todo: medido en un paso real, dos comentarios tomaron
     * el 87% del presupuesto y el léxico y el diccionario teológico
     * entraron con 743 y 0 caracteres. El alumno había configurado ocho
     * fuentes de tipos distintos a propósito —la rúbrica los exige— y el
     * paso recibía dos. Un léxico no compite en cercanía contra un
     * comentario: el comentario glosa el versículo entero y el léxico
     * habla de una palabra.
     */
    perSourceFloorFraction?: number;
}

export interface PromptSelection {
    /** Lo que va al prompt, en orden de documento. */
    chunks: CorpusChunk[];
    pinnedChars: number;
    rankedChars: number;
    /** Candidatos del ranking que no entraron por presupuesto. */
    droppedRanked: number;
    /**
     * `true` cuando lo fijado solo ya consume todo el presupuesto. La interfaz
     * lo necesita para decir POR QUÉ no entró nada del ranking, en vez de
     * mostrar un paso pobre sin explicación.
     */
    pinnedExhaustedBudget: boolean;
}

/**
 * Arma la selección de un paso.
 *
 * Devuelve los fragmentos en ORDEN DE DOCUMENTO —por fuente, por hoja, por
 * índice— y no por puntaje. Un comentario se lee corrido: entregar los párrafos
 * ordenados por cercanía descendente le da al modelo el material barajado, y
 * eso se nota en la prosa que produce.
 */
export function selectForPrompt(input: SelectForPromptInput): PromptSelection {
    const budget = Math.max(0, input.budgetChars);

    const taken: CorpusChunk[] = [];
    const seen = new Set<string>();
    let used = 0;

    // 1. Lo fijado, completo y primero.
    for (const chunk of input.pinned) {
        const key = chunkKey(chunk);
        if (seen.has(key)) continue;
        seen.add(key);
        taken.push(chunk);
        used += chunk.text.length;
    }
    const pinnedChars = used;
    const pinnedExhaustedBudget = pinnedChars >= budget && input.ranked.length > 0;

    const byScore = [...input.ranked].sort((a, b) => b.score - a.score);

    // 2. El piso por fuente. Cada fuente toma sus mejores fragmentos
    //    hasta su cuota, sin competir contra las demás. Una fuente con
    //    poco material relevante toma lo poco que tenga y libera el
    //    resto; el piso es un techo de reserva, no una cuota a llenar.
    const sourceIds = new Set(byScore.map(c => c.resourceId));
    const floorFraction = clampFraction(input.perSourceFloorFraction ?? DEFAULT_FLOOR_FRACTION);
    const floorPerSource = sourceIds.size > 0
        ? Math.floor((budget - pinnedChars) * floorFraction / sourceIds.size)
        : 0;
    const usedBySource = new Map<string, number>();
    if (floorPerSource > 0) {
        for (const chunk of byScore) {
            const key = chunkKey(chunk);
            if (seen.has(key)) continue;
            const spent = usedBySource.get(chunk.resourceId) ?? 0;
            if (spent + chunk.text.length > floorPerSource) continue;
            if (used + chunk.text.length > budget) continue;
            seen.add(key);
            taken.push(chunk);
            used += chunk.text.length;
            usedBySource.set(chunk.resourceId, spent + chunk.text.length);
        }
    }

    // 3. Competencia libre por lo que sobre, de mayor a menor cercanía.
    let dropped = 0;
    for (const chunk of byScore) {
        const key = chunkKey(chunk);
        // Un fragmento fijado que además ganó el ranking no se cuenta dos veces.
        if (seen.has(key)) continue;
        if (used + chunk.text.length > budget) { dropped++; continue; }
        seen.add(key);
        taken.push(chunk);
        used += chunk.text.length;
    }

    return {
        chunks: taken.sort(documentOrder),
        pinnedChars,
        rankedChars: used - pinnedChars,
        droppedRanked: dropped,
        pinnedExhaustedBudget,
    };
}

const DEFAULT_FLOOR_FRACTION = 0.5;

function clampFraction(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_FLOOR_FRACTION;
    return Math.min(1, Math.max(0, value));
}

function chunkKey(chunk: CorpusChunk): string {
    return `${chunk.resourceId}#${chunk.chunkIndex}`;
}

/** Por fuente, después por hoja, después por índice dentro de la hoja. */
function documentOrder(a: CorpusChunk, b: CorpusChunk): number {
    if (a.resourceId !== b.resourceId) return a.resourceId < b.resourceId ? -1 : 1;
    const sheetA = a.sheet ?? Number.MAX_SAFE_INTEGER;
    const sheetB = b.sheet ?? Number.MAX_SAFE_INTEGER;
    if (sheetA !== sheetB) return sheetA - sheetB;
    return a.chunkIndex - b.chunkIndex;
}

/**
 * ¿Cae esta hoja dentro de alguno de los tramos?
 *
 * Es el filtro que hace que la curadura mande sobre el ranking: Firestore
 * devuelve lo más cercano de TODO el libro, y de ahí solo sirve lo que el
 * usuario admitió. Sin este filtro, el modelo recibiría páginas que el usuario
 * decidió dejar afuera.
 */
export function sheetWithinRanges(
    sheet: number | null,
    ranges: ReadonlyArray<SheetRange>,
): boolean {
    if (sheet === null) return false;
    return ranges.some(r => sheet >= r.start && sheet <= r.end);
}
