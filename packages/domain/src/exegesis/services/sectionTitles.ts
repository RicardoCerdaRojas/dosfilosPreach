import { formatPassageReference } from '../../bible/canon/passage-reference';
import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import { sectionHeadingKey } from './composedVerseSections';

/**
 * El título aprobado de cada sección de versículo, por la clave de su título
 * en el ensamble («Salmo 23:3» → «El pastor que restaura y guía (v. 3)»).
 * El exportador imprime el aprobado donde el ensamble dice la referencia;
 * todo lo demás sigue buscando la sección por la referencia (etapa 3.4).
 */
export function approvedSectionTitles(paper: Pick<ExegeticalPaper, 'steps' | 'displayLanguage' | 'sectionTitles'>): Map<string, string> {
    const out = new Map<string, string>();
    const titulos = paper.sectionTitles ?? {};
    for (const step of paper.steps ?? []) {
        const titulo = titulos[step.id]?.trim();
        if (step.kind !== 'verse' || !step.verseRef || !titulo) continue;
        out.set(sectionHeadingKey(formatPassageReference(step.verseRef, paper.displayLanguage)), titulo);
    }
    return out;
}
