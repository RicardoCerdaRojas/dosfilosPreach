import type { ExegeticalStep } from '../entities/ExegeticalStep';
import type { ProjectSource } from '../entities/ProjectSource';

/**
 * Renombrar la clave de una fuente renombra también lo ya escrito con ella.
 *
 * En el TP #6 la fuente de Nestle-Aland se renombró de «Aland» a «NA28» en
 * el corpus, y lo que ya estaba generado siguió diciendo «Aland»: el
 * verificador respondía «ninguna fuente coincide con el autor de esta cita»,
 * y el trabajo ensamblado citaba «(Aland, p. 722)» con «NA28» en la
 * bibliografía. Nada propagaba el cambio.
 */

function escapar(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * La clave como PALABRA dentro de un texto, nunca como parte de otra:
 * «Aland» no toca «Alandia». Si el texto ya decía la clave nueva al lado
 * («Aland, NA28, p. 722»), se deja una sola («NA28, p. 722»).
 */
export function renameKeyInText(text: string, from: string, to: string): string {
    if (!from || from === to || !text.includes(from)) return text;
    const comoPalabra = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(from)}(?![\\p{L}\\p{N}])`, 'gu');
    const repetida = new RegExp(`(?<![\\p{L}\\p{N}])(${escapar(to)})(?:,\\s*${escapar(to)}(?![\\p{L}\\p{N}]))+`, 'gu');
    return text.replace(comoPalabra, to).replace(repetida, '$1');
}

/**
 * Lo mismo sobre un valor cualquiera (el análisis canónico entero): en todo
 * texto —los `sourceKey` incluidos— la clave se cambia como palabra.
 */
export function renameKeyInValue<T>(value: T, from: string, to: string): T {
    if (typeof value === 'string') return renameKeyInText(value, from, to) as T;
    if (Array.isArray(value)) return value.map(v => renameKeyInValue(v, from, to)) as T;
    if (value && typeof value === 'object' && !(value instanceof Date)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = renameKeyInValue(v, from, to);
        }
        return out as T;
    }
    return value;
}

/**
 * Un paso con la clave renombrada en todas sus versiones: el análisis y la
 * prosa. Los veredictos del verificador no se tocan: son de la verificación
 * anterior y se rehacen al volver a verificar.
 */
export function renameKeyInStep(step: ExegeticalStep, from: string, to: string): ExegeticalStep {
    const versiones = step.versions.map(v => ({
        ...v,
        markdown: renameKeyInText(v.markdown, from, to),
        ...(v.canonicalAnalysis ? { canonicalAnalysis: renameKeyInValue(v.canonicalAnalysis, from, to) } : {}),
    }));
    const porId = (id: string | undefined) => versiones.find(v => v.id === id) ?? null;
    return {
        ...step,
        versions: versiones,
        current: step.current ? porId(step.current.id) ?? step.current : step.current,
        accepted: step.accepted ? porId(step.accepted.id) ?? step.accepted : step.accepted,
    };
}

/**
 * Las claves que el análisis cita y que ya no son de ninguna fuente del
 * corpus: lo que queda de un renombre hecho antes de que se propagara.
 */
export function orphanCitationKeys(
    analysis: unknown,
    sources: ReadonlyArray<Pick<ProjectSource, 'citationKey'>>,
): string[] {
    const vigentes = new Set(sources.map(s => s.citationKey).filter((k): k is string => !!k));
    const huerfanas = new Set<string>();
    const recorrer = (v: unknown): void => {
        if (Array.isArray(v)) { v.forEach(recorrer); return; }
        if (v && typeof v === 'object') {
            for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
                if (k === 'sourceKey' && typeof x === 'string' && x && !vigentes.has(x)) huerfanas.add(x);
                else recorrer(x);
            }
        }
    };
    recorrer(analysis);
    return [...huerfanas].sort();
}

/**
 * La fuente que probablemente corresponde a una clave huérfana: la que nombra
 * esa clave como palabra en su rótulo («Aland» en «Nestle-Aland (NA28)»).
 * `null` si ninguna o si hay más de una: entonces elige el estudiante.
 */
export function guessSourceForOrphanKey<S extends Pick<ProjectSource, 'citationKey' | 'displayLabel'>>(
    key: string,
    sources: ReadonlyArray<S>,
): S | null {
    const comoPalabra = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(key)}(?![\\p{L}\\p{N}])`, 'iu');
    const candidatas = sources.filter(s => s.citationKey && comoPalabra.test(s.displayLabel ?? ''));
    return candidatas.length === 1 ? candidatas[0]! : null;
}
