import { parsePageRange, type VerifiedCitation } from '@dosfilos/domain';
import type { CitationTarget } from '@/components/exegesis/citation/CitationSourceModal';

/**
 * Dónde abrir una cita de la prosa, desde su veredicto: la fuente, la primera
 * página y si es impresa u hoja (TP #8, 8b, D5). Una cita de la prosa no
 * tiene afirmación en el análisis de donde sacarlo.
 */
export function citaDeLaProsa(v: VerifiedCitation): CitationTarget | null {
    const pagina = parsePageRange(v.pages)?.start ?? null;
    if (!v.author || pagina === null) return null;
    return { sourceKey: v.author, page: pagina, pageKind: /\bhoja\b/i.test(v.raw ?? '') ? 'sheet' : 'printed' };
}
