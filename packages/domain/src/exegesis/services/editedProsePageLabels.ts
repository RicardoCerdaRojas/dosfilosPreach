import type { PaperFormatting } from '../entities/PaperRubric';
import { applyPageLabelStyle } from './citationStyle';

/**
 * Lo que el estudiante editó, devuelto a la forma en que se GUARDA la prosa.
 *
 * El editor muestra la prosa como se entrega (`applyPageLabelStyle`): en un
 * TP que pide «(Carballosa, 208)» el estudiante ve eso y no «(Carballosa,
 * p. 208)», que es la forma interna (TP #6, #25). Pero al guardar se escribía
 * lo que se veía, y la forma entregada reemplazaba a la guardada en todo el
 * paso. Medido en el TP #9 (Santiago 4:12, 2026-10-28): la versión generada
 * decía «(Tuggy, p. 257)»; tras «Editar contenido aceptado» las tres versiones
 * editadas dicen «(Tuggy, 257)», aunque el estudiante no tocó esa cita. El
 * número suelto ya no dice que es una página, y el reetiquetado de hojas
 * (`relabelProsePages`) busca «p. N».
 *
 * La regla: cada cita que el estudiante dejó como estaba vuelve a su forma
 * guardada; la que escribió o cambió queda TAL CUAL la escribió, con «p.» o
 * sin él. El documento sale igual en los dos casos, porque el exportador
 * vuelve a aplicar `applyPageLabelStyle` a todo al entregar.
 *
 * Se compara cita por cita (los tramos de un paréntesis separados por «;»):
 * corregir la página de Robertson en «(Tuggy, 90; Robertson, 574)» no le
 * quita el rótulo a la de Tuggy.
 *
 * Sin la forma «sin p.» en la entrega, el editor ya mostraba la guardada y
 * no hay nada que devolver.
 */
export function restoreStoredPageLabels(
    edited: string,
    stored: string,
    formatting: PaperFormatting | null,
): string {
    if (applyPageLabelStyle(stored, formatting) === stored) return edited;
    const guardadas = new Map<string, string>();
    for (const grupo of stored.match(/\([^()]*\)/g) ?? []) {
        for (const tramo of grupo.slice(1, -1).split(';')) {
            const interna = tramo.trim();
            const entregada = applyPageLabelStyle(`(${interna})`, formatting).slice(1, -1);
            // La primera forma guardada gana: «p.» y «pp.» del mismo número son raros
            // y cualquiera de los dos vuelve a decir que es una página.
            if (entregada !== interna && !guardadas.has(entregada)) guardadas.set(entregada, interna);
        }
    }
    if (guardadas.size === 0) return edited;
    return edited.replace(/\([^()]*\)/g, grupo => {
        const tramos = grupo.slice(1, -1).split(';').map(tramo => {
            const texto = tramo.trim();
            const interna = guardadas.get(texto);
            return interna === undefined ? tramo : tramo.replace(texto, () => interna);
        });
        return `(${tramos.join(';')})`;
    });
}
