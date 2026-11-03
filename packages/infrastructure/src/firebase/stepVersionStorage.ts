import type { VerifiedCitation } from '@dosfilos/domain';

/**
 * Cómo se guardan las versiones de un paso sin repetir lo que no cambió.
 *
 * Editar la prosa no cambia el análisis ni sus veredictos, y cada versión los
 * copiaba enteros: unos 56 KB por edición, en un documento con límite de 1 MB. En
 * el TP #9, compactar baja de 883 a 650 KB y una edición suma 5 KB (medido).
 *
 * Es solo la forma guardada: al leer, cada versión vuelve completa, y el dominio
 * no se entera. La aceptada, la última aceptada y la vigente siempre guardan su
 * copia entera, porque hay quien lee el documento sin pasar por aquí
 * (`getExegesisPapersSummary`). Las referencias se recalculan en cada escritura.
 *
 * **Se despliega en dos pasos.** El código anterior no entiende las referencias:
 * una pestaña abierta durante el despliegue leería versiones sin análisis y, al
 * escribir, las volvería definitivas. Primero sale la lectura; la escritura se
 * enciende en otro despliegue, cuando ya no queden pestañas de antes
 * (`WRITE_COMPACT_VERSIONS`).
 */
export const WRITE_COMPACT_VERSIONS = false;

type VersionCruda = Record<string, unknown> & { id: string };

const CAMPO_ANALISIS = 'canonicalAnalysisIn';
const CAMPO_VEREDICTOS = 'analysisVerdictsIn';

/** Mismo texto sea cual sea el orden de las claves: Firestore las devuelve ordenadas. */
function clave(valor: unknown): string {
    return JSON.stringify(valor, (_k, v) => (
        v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
            : v
    ));
}

const esDeLaProsa = (v: Pick<VerifiedCitation, 'origin'>) => v.origin === 'prose';

/**
 * Los veredictos, partidos en los del análisis y los de la prosa. `null` si no
 * vienen en ese orden: al volver a unirlos cambiaría, así que se dejan como están.
 */
function partirVeredictos(veredictos: unknown): { analisis: VerifiedCitation[]; prosa: VerifiedCitation[] } | null {
    if (!Array.isArray(veredictos)) return null;
    const lista = veredictos as VerifiedCitation[];
    const corte = lista.findIndex(esDeLaProsa);
    const analisis = corte === -1 ? lista : lista.slice(0, corte);
    const prosa = corte === -1 ? [] : lista.slice(corte);
    return prosa.every(esDeLaProsa) && analisis.length > 0 ? { analisis, prosa } : null;
}

/** Las versiones listas para guardar: cada repetición apunta a una copia completa. */
export function compactVersions(
    versiones: readonly VersionCruda[],
    conCopiaEntera: ReadonlyArray<string | null | undefined>,
): VersionCruda[] {
    /** De cada grupo de iguales, a cuál apuntan los demás: una de las enteras o la última. */
    const copias = (claveDe: (v: VersionCruda) => string | null) => {
        const copia = new Map<string, string>();
        for (const v of versiones) {
            const c = claveDe(v);
            if (c === null) continue;
            const anterior = copia.get(c);
            if (!anterior || !conCopiaEntera.includes(anterior)) copia.set(c, v.id);
        }
        return (v: VersionCruda) => {
            const c = claveDe(v);
            const id = c === null || conCopiaEntera.includes(v.id) ? null : copia.get(c);
            return id && id !== v.id ? id : null;
        };
    };
    const copiaDelAnalisis = copias(v => (v.canonicalAnalysis ? clave(v.canonicalAnalysis) : null));
    const copiaDeVeredictos = copias(v => {
        const partes = partirVeredictos(v.citationVerdicts);
        return partes ? clave(partes.analisis) : null;
    });

    return versiones.map(v => {
        const salida: VersionCruda = { ...v };
        const analisis = copiaDelAnalisis(v);
        if (analisis) {
            delete salida.canonicalAnalysis;
            salida[CAMPO_ANALISIS] = analisis;
        }
        const veredictos = copiaDeVeredictos(v);
        if (veredictos) {
            salida.citationVerdicts = partirVeredictos(v.citationVerdicts)!.prosa;
            salida[CAMPO_VEREDICTOS] = veredictos;
        }
        return salida;
    });
}

/** Las versiones como se leyeron, cada una otra vez completa. */
export function expandVersions(versiones: readonly VersionCruda[]): VersionCruda[] {
    const porId = new Map(versiones.map(v => [v.id, v]));
    return versiones.map(v => {
        const { [CAMPO_ANALISIS]: deAnalisis, [CAMPO_VEREDICTOS]: deVeredictos, ...salida } = v;
        if (typeof deAnalisis === 'string') {
            const copia = porId.get(deAnalisis);
            if (copia?.canonicalAnalysis) salida.canonicalAnalysis = copia.canonicalAnalysis;
            else console.warn('[stepVersionStorage] análisis sin su copia', v.id, deAnalisis);
        }
        if (typeof deVeredictos === 'string') {
            const copia = partirVeredictos(porId.get(deVeredictos)?.citationVerdicts);
            if (copia) salida.citationVerdicts = [...copia.analisis, ...((v.citationVerdicts as VerifiedCitation[]) ?? [])];
            else console.warn('[stepVersionStorage] veredictos sin su copia', v.id, deVeredictos);
        }
        return salida as VersionCruda;
    });
}

/**
 * Desde aquí se recorta el historial al escribir: Firestore rechaza 1.048.576 bytes.
 * El margen cubre el nombre del documento, que `firestoreBytes` no cuenta (54 bytes).
 */
export const PAPER_BYTES_MAX = 1_048_576 - 8 * 1024;

/**
 * Cuánto pesa un valor según las reglas de Firestore: texto, sus bytes + 1; número
 * y fecha, 8; booleano y nulo, 1; cada campo de un mapa, su nombre + 1 + su valor,
 * más 32 por mapa. Contra el emulador nunca subestima, y los 32 de los mapas anidados
 * sobran hasta unos 80 KB en el TP #9: se prefiere avisar antes a que falle la escritura.
 */
export function firestoreBytes(valor: unknown): number {
    if (valor === undefined) return 0;
    if (valor === null || typeof valor === 'boolean') return 1;
    if (typeof valor === 'number') return 8;
    if (typeof valor === 'string') return new TextEncoder().encode(valor).length + 1;
    if (valor instanceof Date || typeof (valor as { toDate?: unknown }).toDate === 'function') return 8;
    if (Array.isArray(valor)) return valor.reduce((suma: number, v) => suma + firestoreBytes(v), 0);
    return Object.entries(valor as object).reduce(
        (suma, [campo, v]) => suma + new TextEncoder().encode(campo).length + 1 + firestoreBytes(v),
        32,
    );
}
