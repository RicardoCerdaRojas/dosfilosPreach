import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { ExegeticalMethod } from '../entities/ExegeticalPaper';
import type { SourceType } from '../entities/SourceType';
import { isObservationTool, separatesObservation } from './exegeticalStrategy';

/**
 * Las piezas del análisis que son OBSERVACIÓN (etapa 2, capa 3): lo que en
 * los métodos exegético y mixto se arma solo con las herramientas, antes del
 * diálogo con los comentarios (Fee 13.1). La traducción inicial también es
 * observación, pero es texto sin citas. Los vínculos con el AT no: la
 * intertextualidad se apoya en literatura (Beale y Carson, Hays).
 */
export const OBSERVATION_FIELDS = [
    'textualCriticism', 'syntacticAnalysis', 'lexicalAnalyses', 'historicalContext',
] as const satisfies ReadonlyArray<keyof CanonicalVerseAnalysis>;

export type ObservationField = typeof OBSERVATION_FIELDS[number];

/** Una cita a la literatura dentro de la observación. */
export interface ObservationCitationAlert {
    field: ObservationField;
    sourceKey: string;
}

/**
 * El control fijo del método, sin llamada extra: qué piezas de la
 * observación citan una obra de LITERATURA (comentario, monografía,
 * artículo). En una sola llamada el asistente ve todo el corpus; este
 * control muestra si la observación se apoyó en un comentario.
 *
 * Una clave que comparten una herramienta y una obra de literatura (la
 * *Grammar* y las *Word Pictures* de Robertson) no se marca: no se sabe
 * cuál se citó. Una clave que ninguna fuente declara tampoco: ese caso ya lo
 * limpia el saneador de claves.
 */
export function observationCitationAlerts(
    analysis: Pick<CanonicalVerseAnalysis, ObservationField>,
    sources: ReadonlyArray<{ citationKey?: string | null; sourceType: SourceType }>,
    method: ExegeticalMethod | null | undefined,
): ObservationCitationAlert[] {
    if (!separatesObservation(method)) return [];
    const tipos = new Map<string, SourceType[]>();
    for (const s of sources) {
        const k = s.citationKey?.trim();
        if (!k) continue;
        tipos.set(k, [...(tipos.get(k) ?? []), s.sourceType]);
    }
    const esLiteratura = (key: string) => {
        const ts = tipos.get(key);
        return !!ts && ts.length > 0 && ts.every(t => !isObservationTool(t));
    };
    const out: ObservationCitationAlert[] = [];
    for (const field of OBSERVATION_FIELDS) {
        const vistas = new Set<string>();
        recorrer(analysis[field], key => {
            if (vistas.has(key) || !esLiteratura(key)) return;
            vistas.add(key);
            out.push({ field, sourceKey: key });
        });
    }
    return out;
}

function recorrer(node: unknown, onKey: (key: string) => void): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => recorrer(n, onKey)); return; }
    const key = (node as { sourceKey?: unknown }).sourceKey;
    if (typeof key === 'string' && key.trim()) onKey(key.trim());
    for (const v of Object.values(node)) recorrer(v, onKey);
}
