import type { ExegeticalPaper } from '@dosfilos/domain';
import { useUserStyleGuides } from './useUserStyleGuides';

/**
 * La guía de estilo que rige este trabajo: la que fijó (`paper.styleGuideId`)
 * o, si no fijó ninguna, la activa del usuario. Es el mismo orden que usan el
 * orquestador y el setup; aquí vive una vez para la tarjeta lateral y para el
 * exportador, que ahora lee de la guía cómo se arma la portada.
 */
export function useEffectiveStyleGuide(paper: Pick<ExegeticalPaper, 'styleGuideId'> | null | undefined) {
    const { guides, activeGuide } = useUserStyleGuides();
    const pinned = paper?.styleGuideId ? guides.find(g => g.id === paper.styleGuideId) ?? null : null;
    return { guide: pinned ?? activeGuide, isInherited: !pinned && activeGuide !== null };
}
