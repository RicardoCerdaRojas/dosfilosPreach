import type { CanonicalVerseAnalysis, CitationPageKind } from '../entities/CanonicalVerseAnalysis';
import type { CitationReview, VerifiedCitation } from '../entities/CitationVerification';
import { collectAnalysisClaims, type AnalysisClaim } from './analysisClaims';

/**
 * Corregir una cita del análisis en su sitio, sin volver a generar el paso.
 *
 * Nace del caso Waltke-O'Connor: la afirmación —el Polel funcionando como
 * Piel para שוב, frente al Hifil— era correcta y estaba en la página 436;
 * la cita decía 440. Sin poder corregir el número, las salidas eran
 * regenerar el verso entero (que reescribe lo que estaba bien) o marcar la
 * cita como revisada a mano y dejar en el trabajo una página falsa. Ambas
 * peores que cambiar un número.
 *
 * Tres ediciones y ninguna más: la página, la oración textual, y quitar la
 * cita. No se puede reescribir la afirmación desde aquí a propósito —eso
 * es redactar, no cotejar, y la afirmación es lo que el verificador
 * contrasta contra la fuente—.
 */
export type CitationEdit =
    | { kind: 'page'; page: number; pageKind: CitationPageKind }
    | { kind: 'quote'; quote: string }
    | { kind: 'remove' };

/** Qué se corrigió, para que el trabajo conserve el rastro. */
export interface CitationCorrection {
    path: string;
    kind: CitationEdit['kind'];
    /** Cómo estaba antes: página y unidad, o la oración que había. */
    before: { page: number; pageKind?: CitationPageKind; verbatimQuote?: string | null };
    after: { page?: number; pageKind?: CitationPageKind; verbatimQuote?: string | null };
    correctedAt: Date;
}

/** Sitios cuyo esquema admite una oración textual de la fuente. */
const QUOTABLE_SITES = new Set(['commentator', 'crux']);

/**
 * Campos por los que una ruta de cita puede pasar. La lista es cerrada
 * para que una ruta inventada no pueda escribir en cualquier parte del
 * análisis.
 */
const PATH_FIELDS = new Set([
    'commentatorEngagement',
    'translationCruxes',
    'commentatorPositions',
    'lexicalAnalyses',
    'generalSemanticRange',
    'sources',
    'loadingSources',
    'footnoteExtensions',
    'oldTestamentLinks',
    'historicalContext',
]);

interface PathStep {
    field: string;
    /** `null` en un campo que no es lista, como `generalSemanticRange`. */
    index: number | null;
}

/**
 * Descompone una ruta como `footnoteExtensions[0].sources[1]`.
 *
 * Las rutas las escribe `collectAnalysisClaims`; esto las deshace. Hay
 * prueba de que TODA ruta que aquella produce se puede recorrer aquí: si
 * una de las dos cambia sin la otra, corregir una cita escribiría en el
 * sitio equivocado o no escribiría nada.
 */
export function parseCitationPath(path: string): PathStep[] | null {
    if (!path) return null;
    const steps: PathStep[] = [];
    for (const segment of path.split('.')) {
        const m = /^([A-Za-z]+)(\[(\d+)\])?$/.exec(segment);
        if (!m) return null;
        const field = m[1]!;
        if (!PATH_FIELDS.has(field)) return null;
        steps.push({ field, index: m[3] === undefined ? null : Number(m[3]) });
    }
    return steps.length > 0 ? steps : null;
}

/** Marca de que un elemento se va de su lista. */
const REMOVE = Symbol('remove');

type Leaf = Record<string, unknown>;

/**
 * Aplica una edición a la cita que vive en `path` y devuelve un análisis
 * nuevo. No muta el recibido: el anterior sigue sirviendo para realinear
 * los veredictos.
 *
 * Lanza cuando la ruta no existe o no admite la edición, en vez de
 * devolver el análisis intacto: una corrección que no corrige nada y no
 * avisa es peor que un error.
 */
export function editCitationAt(
    analysis: CanonicalVerseAnalysis,
    path: string,
    edit: CitationEdit,
): CanonicalVerseAnalysis {
    const steps = parseCitationPath(path);
    if (!steps) throw new Error(`Ruta de cita inválida: ${path}`);

    const claim = collectAnalysisClaims(analysis).find(c => c.path === path);
    if (!claim) throw new Error(`No hay cita en ${path}`);
    if (edit.kind === 'quote' && !QUOTABLE_SITES.has(claim.site)) {
        throw new Error(`El sitio ${claim.site} no guarda oración textual`);
    }
    if (edit.kind === 'page' && (!Number.isInteger(edit.page) || edit.page < 1)) {
        throw new Error(`Página inválida: ${edit.page}`);
    }

    const apply = (leaf: Leaf): Leaf | typeof REMOVE => {
        if (edit.kind === 'remove') return REMOVE;
        if (edit.kind === 'page') return { ...leaf, page: edit.page, pageKind: edit.pageKind };
        const quote = edit.quote.trim();
        // Firestore no guarda `undefined`; una oración vacía se borra
        // quitando el campo, que es como lo dejan los análisis sin cita.
        if (!quote) {
            const { verbatimQuote: _drop, ...rest } = leaf;
            return rest;
        }
        return { ...leaf, verbatimQuote: quote };
    };

    return updateIn(analysis as unknown as Leaf, steps, apply) as unknown as CanonicalVerseAnalysis;
}

/** Recorre la ruta reconstruyendo cada nivel, sin tocar el original. */
function updateIn(node: Leaf, steps: ReadonlyArray<PathStep>, apply: (leaf: Leaf) => Leaf | typeof REMOVE): Leaf {
    const [step, ...rest] = steps;
    if (!step) throw new Error('Ruta de cita vacía');

    const value = node[step.field];
    if (step.index === null) {
        if (!isLeaf(value)) throw new Error(`No hay objeto en ${step.field}`);
        const next = rest.length === 0 ? apply(value) : updateIn(value, rest, apply);
        if (next === REMOVE) throw new Error(`No se puede quitar ${step.field}: no es una lista`);
        return { ...node, [step.field]: next };
    }

    if (!Array.isArray(value)) throw new Error(`No hay lista en ${step.field}`);
    const item = value[step.index];
    if (!isLeaf(item)) throw new Error(`No hay elemento en ${step.field}[${step.index}]`);

    const next = rest.length === 0 ? apply(item) : updateIn(item, rest, apply);
    const list = next === REMOVE
        ? [...value.slice(0, step.index), ...value.slice(step.index + 1)]
        : [...value.slice(0, step.index), next, ...value.slice(step.index + 1)];
    return { ...node, [step.field]: list };
}

function isLeaf(value: unknown): value is Leaf {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Veredictos y revisiones del análisis anterior, puestos donde quedaron
 * sus citas en el nuevo.
 *
 * Hace falta porque las dos marcas se anclan de formas distintas y las dos
 * se rompen al editar: el veredicto por `offset` —índice en la lista de
 * afirmaciones— y la revisión por ruta. Quitar una cita corre a todas las
 * siguientes: sin realinear, el veredicto «no encontrada» de la cita 12
 * pasaría a señalar a la 13, que nadie verificó.
 *
 * Las citas se reconocen por sitio, fuente y afirmación —lo que una
 * corrección de página o de oración NO cambia—, y entre iguales, por
 * orden de aparición. Lo que no reaparece, se descarta: su marca hablaba
 * de algo que ya no está en el trabajo.
 */
export function realignCitationMarks(
    before: CanonicalVerseAnalysis,
    after: CanonicalVerseAnalysis,
    marks: { verdicts: ReadonlyArray<VerifiedCitation>; reviews: ReadonlyArray<CitationReview> },
): { verdicts: VerifiedCitation[]; reviews: CitationReview[] } {
    const claimsBefore = collectAnalysisClaims(before);
    const claimsAfter = collectAnalysisClaims(after);

    const indexAfter = new Map<string, number[]>();
    claimsAfter.forEach((claim, i) => {
        const key = signatureOf(claim);
        const list = indexAfter.get(key);
        if (list) list.push(i); else indexAfter.set(key, [i]);
    });

    // Cuántas veces se vio ya cada firma en el análisis anterior: dos citas
    // idénticas en sitios distintos conservan su orden relativo.
    const seen = new Map<string, number>();
    const newIndexOf = new Map<number, number>();
    claimsBefore.forEach((claim, i) => {
        const key = signatureOf(claim);
        const rank = seen.get(key) ?? 0;
        seen.set(key, rank + 1);
        const candidates = indexAfter.get(key);
        const to = candidates?.[rank];
        if (to !== undefined) newIndexOf.set(i, to);
    });

    const pathBefore = new Map(claimsBefore.map((c, i) => [c.path, i] as const));

    const verdicts = marks.verdicts.flatMap(v => {
        const to = newIndexOf.get(v.offset);
        return to === undefined ? [] : [{ ...v, offset: to }];
    });
    const reviews = marks.reviews.flatMap(r => {
        const from = pathBefore.get(r.path);
        const to = from === undefined ? undefined : newIndexOf.get(from);
        const claim = to === undefined ? undefined : claimsAfter[to];
        return claim ? [{ ...r, path: claim.path }] : [];
    });
    return { verdicts, reviews };
}

/** Lo que identifica a una cita a través de una corrección de página. */
function signatureOf(claim: AnalysisClaim): string {
    return `${claim.site}|${claim.sourceKey}|${claim.claim.slice(0, 120)}`;
}
