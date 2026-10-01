import type { ExegeticalPaper } from '@dosfilos/domain';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';

/**
 * El estándar de cita que dice la guía de estilo de este trabajo: la adjunta
 * o, si no hay, la activa. `null` si la guía no lo nombra.
 *
 * Lo leen el editor de la rúbrica y su resumen. El resumen mostraba «—» cuando
 * la rúbrica HEREDABA el estándar de la guía (`citationStandard: null` a
 * propósito), y el autor creyó que no se había guardado.
 */
export function useGuideCitationStandard(paper: ExegeticalPaper): string | null {
    const { guides, activeGuide } = useUserStyleGuides();
    const guide = paper.styleGuideId
        ? guides.find(g => g.id === paper.styleGuideId) ?? null
        : activeGuide;
    return guide?.manifest?.citationStyleLabel ?? null;
}
