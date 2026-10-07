import type { PreviousDelivery } from './sourceMemory';

/**
 * Una fuente que este trabajo no puede usar.
 *
 * En el TP #6 (Santiago 3, 2026-10-07) el encuadre decía «no citar
 * McCartney, Varner, Ropes, Robertson» —el sílabo no permite repetir una
 * fuente en semanas consecutivas— y «Extraer de mi biblioteca» recomendó
 * justamente esos cuatro, sin aviso. La regla vivía sólo en el texto del
 * encuadre, y ese texto no lo lee el ranking de la biblioteca.
 *
 * No se ocultan: el sílabo de otro curso podría permitirlas. Van al final de
 * cada lista, marcadas, y agregarlas pide confirmación.
 */
export interface ExcludedSource {
    /** Cómo se cita: «McCartney», «Carson y Moo». */
    key: string;
    /**
     * El trabajo anterior que la citó, cuando la exclusión salió de ahí
     * («Citada en el TP #5»). `null` cuando la agregó el estudiante.
     */
    previousPaperTitle: string | null;
}

/**
 * Las exclusiones que se proponen al abrir el corpus: lo citado en la
 * entrega anterior. El estudiante las confirma o las edita; el sistema no
 * decide cuántas semanas hay que esperar.
 */
export function proposeExclusions(previous: PreviousDelivery | null): ExcludedSource[] {
    if (!previous) return [];
    return previous.citedSourceKeys.map(key => ({ key, previousPaperTitle: previous.title ?? null }));
}

/** Sin acentos, mayúsculas ni puntuación: «Martín» y «martin.» son la misma clave. */
function comparable(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^\p{L}\p{N}\s,;&'-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Partículas que forman parte del apellido: «de Silva», «van der Watt». */
const PARTICULAS = new Set(['de', 'da', 'del', 'della', 'di', 'do', 'dos', 'du', 'la', 'le', 'van', 'von', 'der', 'den', 'ter']);

/**
 * Los apellidos de un autor (o de una clave), uno por coautor, sin espacios.
 *
 *   «Dan G. McCartney»               → mccartney
 *   «Varner, William»                → varner
 *   «D. A. Carson & Douglas J. Moo»  → carson, moo
 *   «David A. de Silva» / «deSilva»  → desilva
 *
 * Sólo el apellido: comparar contra cualquier palabra del autor hacía que
 * excluir a Martin (Ralph P.) alcanzara a Martin Dibelius.
 */
function apellidos(text: string | null | undefined): Set<string> {
    const out = new Set<string>();
    for (const coautor of comparable(text ?? '').replace(/\bet al\b/g, '').split(/\s*(?:;|&|\band\b|\by\b)\s*/)) {
        const c = coautor.trim();
        if (!c) continue;
        const tokens = (c.includes(',') ? c.split(',')[0]! : c).trim().split(' ').filter(Boolean);
        if (tokens.length === 0) continue;
        // Con coma, lo de antes es el apellido entero; sin coma, el último
        // token y las partículas que lo preceden.
        let desde = c.includes(',') ? 0 : tokens.length - 1;
        while (!c.includes(',') && desde > 0 && PARTICULAS.has(tokens[desde - 1]!)) desde--;
        out.add(tokens.slice(desde).join(''));
    }
    return out;
}

export interface ExclusionCandidate {
    citationKey?: string | null;
    author?: string | null;
}

/**
 * La exclusión que alcanza a un libro o a una fuente, o `null`.
 *
 * Se comparan APELLIDOS: los de la clave excluida («McCartney», «William
 * Varner», «Carson y Moo») contra los del autor del libro y los de su clave
 * de cita. Una clave de varios autores alcanza sólo a la obra que los tiene
 * a todos.
 */
export function exclusionFor(
    candidate: ExclusionCandidate,
    exclusions: ReadonlyArray<ExcludedSource> | null | undefined,
): ExcludedSource | null {
    if (!exclusions || exclusions.length === 0) return null;
    const delCandidato = new Set([...apellidos(candidate.author), ...apellidos(candidate.citationKey)]);
    if (delCandidato.size === 0) return null;
    for (const ex of exclusions) {
        const buscados = apellidos(ex.key);
        if (buscados.size > 0 && [...buscados].every(a => delCandidato.has(a))) return ex;
    }
    return null;
}

/**
 * Ordena una lista dejando las excluidas al final, sin alterar el orden
 * relativo de cada grupo.
 */
export function excludedLast<T>(items: ReadonlyArray<T>, isExcluded: (item: T) => boolean): T[] {
    return [...items.filter(i => !isExcluded(i)), ...items.filter(isExcluded)];
}

/**
 * El encuadre que leen los pasos que REDACTAN, con las exclusiones adelante.
 *
 * El encuadre es texto libre del estudiante; las exclusiones son un dato
 * aparte. Los pasos que escriben (análisis, prosa, introducción, conclusión,
 * ensamble, coherencia, plan de uso) tienen que saber las dos cosas. Los que
 * sólo BUSCAN en la biblioteca no lo usan: una lista de nombres en la consulta
 * acercaría justamente esos libros.
 */
export function briefWithExclusions(
    paper: { assignmentBrief: string | null; excludedSources?: ReadonlyArray<ExcludedSource> | null; displayLanguage: 'es' | 'en' },
): string | null {
    const claves = (paper.excludedSources ?? []).map(e => e.key.trim()).filter(Boolean);
    if (claves.length === 0) return paper.assignmentBrief;
    const linea = paper.displayLanguage === 'en'
        ? `Sources excluded from this paper (do not cite them or rely on them): ${claves.join(', ')}.`
        : `Fuentes excluidas de este trabajo (no las cites ni te apoyes en ellas): ${claves.join(', ')}.`;
    // Primero: el planificador recorta el encuadre largo por el final, y la
    // exclusión es lo que no se puede perder.
    return paper.assignmentBrief?.trim() ? `${linea}\n\n${paper.assignmentBrief.trim()}` : linea;
}
