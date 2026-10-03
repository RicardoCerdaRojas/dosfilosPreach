import type { ExegeticalPaper } from '../entities/ExegeticalPaper';
import { rubricPreset } from '../entities/PaperRubric';

/**
 * ¿Este trabajo se ENTREGA (un trabajo práctico, un paper de curso) o se USA
 * (el estudio de un sermón)?
 *
 * Un estudio para predicar no lleva portada ni se califica por páginas, y sin
 * esta pregunta la pantalla le pedía las dos cosas: «Portada · falta» y
 * «Faltan ~2 páginas» en Jonás 4:5-11. Lo decide la rúbrica —la de
 * predicación lo dice—, porque es la que declara qué se espera del trabajo.
 */
export function paperIsDelivered(paper: Pick<ExegeticalPaper, 'rubric'>): boolean {
    return rubricPreset(paper.rubric) !== 'preaching';
}
