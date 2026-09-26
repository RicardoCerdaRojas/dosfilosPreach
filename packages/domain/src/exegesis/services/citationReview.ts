import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { CitationReview, CitationStatus, VerifiedCitation } from '../entities/CitationVerification';
import { collectAnalysisClaims } from './analysisClaims';

/**
 * Los veredictos de una verificación, indexados por la ruta de la cita en
 * el análisis.
 *
 * El verificador identifica cada cita por `offset`, que es su índice en
 * `collectAnalysisClaims`. La interfaz identifica cada cita por dónde vive
 * (`commentatorEngagement[2]`). Esto une las dos: la ruta es estable
 * mientras el análisis no cambie, y cuando cambia, los veredictos viejos
 * dejan de aplicar de todos modos.
 */
export function mapVerdictsByPath(
    analysis: CanonicalVerseAnalysis,
    verdicts: ReadonlyArray<VerifiedCitation>,
): Map<string, VerifiedCitation> {
    const claims = collectAnalysisClaims(analysis);
    const out = new Map<string, VerifiedCitation>();
    for (const v of verdicts) {
        const claim = claims[v.offset];
        if (claim) out.set(claim.path, v);
    }
    return out;
}

/**
 * Citas que impiden aceptar el paso: las que el verificador no pudo respaldar
 * y nadie revisó a mano.
 *
 * La regla es la que ya rige el Estudio Madre: se bloquea lo que está mal, no
 * lo que está incompleto. «Coincidencia baja» y «revisión manual» son dudas
 * de grado —el sistema miró y quedó a medias— y una duda no bloquea. Un paso
 * sin verificar tampoco: no se sabe que esté mal.
 *
 * Bloquean dos:
 *
 *   - `not-found`: una afirmación atribuida a una fuente que no la contiene.
 *   - `page-unverifiable`: una página citada que no se comparó con nada. No
 *     es una duda de grado sino una afirmación sin respaldo: el número lo
 *     puso el modelo y ningún fragmento lo sostiene. Salía en verde, y así
 *     llegó una página inexistente a un trabajo entregado.
 *
 * El nombre dice «blocking» y no «notFound» a propósito: una función que
 * devuelve dos clases de cita y se llama por una sola es la misma clase de
 * mentira silenciosa que este cambio retira del verificador.
 */
const BLOQUEAN: ReadonlySet<CitationStatus> = new Set(['not-found', 'page-unverifiable']);

export function unreviewedBlockingCitations(
    analysis: CanonicalVerseAnalysis,
    verdicts: ReadonlyArray<VerifiedCitation>,
    reviews: ReadonlyArray<CitationReview>,
): string[] {
    const reviewed = new Set(reviews.map(r => r.path));
    const out: string[] = [];
    for (const [path, v] of mapVerdictsByPath(analysis, verdicts)) {
        if (BLOQUEAN.has(v.status) && !reviewed.has(path)) out.push(path);
    }
    return out;
}

/**
 * Cuántas citas quedan PENDIENTES en cada veredicto.
 *
 * Vive al lado de `unreviewedBlockingCitations` porque aplica la MISMA regla:
 * una cita revisada a mano ya no está pendiente. Estaban separadas y sólo una
 * la aplicaba — los contadores de la pantalla sumaban todo y el bloqueo de
 * aceptación descontaba lo revisado, así que la misma pantalla podía decir
 * «3 citas no encontradas» y a la vez dejar aceptar el paso. Dos derivaciones
 * del mismo dato que no podían tener razón las dos.
 *
 * Lo verificado no se descuenta ni se revisa: no es una observación.
 */
export function pendingCitationCounts(
    verdictsByPath: ReadonlyMap<string, VerifiedCitation>,
    reviewedPaths: ReadonlySet<string>,
): Record<CitationStatus, number> {
    const out: Record<CitationStatus, number> = {
        verified: 0, 'page-mismatch': 0, 'page-unverifiable': 0,
        'fuzzy-low': 0, 'not-found': 0, 'manual-pending': 0,
    };
    for (const [path, v] of verdictsByPath) {
        if (v.status !== 'verified' && reviewedPaths.has(path)) continue;
        out[v.status]++;
    }
    return out;
}

/**
 * Cuántas observaciones se resolvieron a mano.
 *
 * Se cuenta aparte para que el trabajo hecho no desaparezca de la pantalla al
 * descontarlo de los contadores: quedarse sin observaciones porque se
 * revisaron todas y quedarse sin ellas porque nunca hubo son dos estados
 * distintos, y un contador en cero no los separa.
 */
export function reviewedCitationCount(
    verdictsByPath: ReadonlyMap<string, VerifiedCitation>,
    reviewedPaths: ReadonlySet<string>,
): number {
    let n = 0;
    for (const [path, v] of verdictsByPath) {
        if (v.status !== 'verified' && reviewedPaths.has(path)) n++;
    }
    return n;
}

/**
 * Se lanza al aceptar un paso con citas no encontradas y sin revisar. Lleva
 * las rutas para que la interfaz pueda llevar al usuario a cada una.
 */
export class UnreviewedCitationsError extends Error {
    readonly name = 'UnreviewedCitationsError';
    constructor(readonly paths: ReadonlyArray<string>) {
        super(`${paths.length} cita(s) sin respaldo y sin revisar`);
        Object.setPrototypeOf(this, UnreviewedCitationsError.prototype);
    }
}

export function isUnreviewedCitationsError(err: unknown): err is UnreviewedCitationsError {
    return err instanceof UnreviewedCitationsError
        || (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'UnreviewedCitationsError');
}
