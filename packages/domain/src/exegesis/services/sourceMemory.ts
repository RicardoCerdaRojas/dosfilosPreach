import type { ExegesisPaperSummary } from '../entities/ExegesisPaperSummary';
import type { SourceType } from '../entities/SourceType';

/**
 * Qué citó el autor en su entrega anterior.
 *
 * Sale de una regla real de su plan de estudios, escrita en el encuadre de
 * Santiago 2:1-13: «Prohibido citar McCartney, Ropes, Varner: el plan de
 * estudios no permite repetir una fuente en semanas consecutivas».
 *
 * Los tres son exactamente los que había citado la semana anterior, y el
 * sistema tenía el dato:
 *
 *     2026-09-16  Santiago 1  citó Ropes, McCartney, Varner, Wallace y Steffen
 *     2026-09-23  Santiago 2  el encuadre prohíbe Ropes, McCartney, Varner
 *
 * Quien hizo cumplir la regla fue el autor, a mano, escribiéndola en el
 * encuadre de la semana siguiente. Si un día no se acuerda, nadie la aplica.
 *
 * «Anterior» se resuelve por ORDEN y no por una ventana de días. El sílabo
 * dice «semanas consecutivas», y consecutiva es la entrega de antes: inventar
 * un plazo de catorce días sería poner un número que nadie pidió y que falla
 * la semana que el alumno entrega dos trabajos.
 */

export interface PreviousDelivery {
    paperId: string;
    title: string | null;
    passage: ExegesisPaperSummary['passage'];
    createdAt: Date;
    /** Lo que esa entrega citó. Ordenado, para que la lista no baile. */
    citedSourceKeys: ReadonlyArray<string>;
    /**
     * El tipo de cada clave citada, de las fuentes de esa entrega (TP #8, 8a,
     * A7): la regla de no repetir es por tipo. Una clave sin fuente que la
     * declare (citada por fuera del corpus) no aparece. Ausente: no se sabe,
     * y todo se propone como antes. Una lista porque dos obras pueden
     * compartir clave (la *Grammar* y las *Word Pictures* de Robertson): la
     * regla toma la más restrictiva.
     */
    citedSourceTypes?: Readonly<Record<string, ReadonlyArray<SourceType>>>;
}

/**
 * La entrega inmediatamente anterior a un trabajo, entre las del mismo autor.
 *
 * Sólo cuentan las que CITARON algo: un trabajo abierto y sin aceptar nada no
 * es una entrega anterior, es un borrador abierto en paralelo, y tomarlo por
 * tal haría que el aviso dependiera de en qué orden se crearon dos borradores.
 *
 * `null` cuando es el primero, cuando el trabajo no está en la lista, o cuando
 * ninguno de los anteriores citó nada.
 */
export function previousDelivery(
    summaries: ReadonlyArray<ExegesisPaperSummary>,
    currentPaperId: string,
): PreviousDelivery | null {
    return previousDeliveries(summaries, currentPaperId, 1)[0] ?? null;
}

/**
 * Las últimas `count` entregas anteriores, de la más reciente a la más vieja.
 * La gramática se alterna (A7): para sugerir «la otra» hay que mirar dos.
 */
export function previousDeliveries(
    summaries: ReadonlyArray<ExegesisPaperSummary>,
    currentPaperId: string,
    count: number,
): PreviousDelivery[] {
    const actual = summaries.find(s => s.id === currentPaperId);
    if (!actual) return [];

    return summaries
        .filter(s => s.id !== currentPaperId)
        .filter(s => s.citedSourceKeys.length > 0)
        .filter(s => s.createdAt.getTime() < actual.createdAt.getTime())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, count)
        .map(previa => {
            const citadas = new Set(previa.citedSourceKeys);
            const tipos: Record<string, SourceType[]> = {};
            for (const f of previa.sources ?? []) {
                if (!f.citationKey || !citadas.has(f.citationKey)) continue;
                const lista = (tipos[f.citationKey] ??= []);
                if (!lista.includes(f.sourceType)) lista.push(f.sourceType);
            }
            return {
                paperId: previa.id,
                title: previa.title ?? null,
                passage: previa.passage,
                createdAt: previa.createdAt,
                citedSourceKeys: [...previa.citedSourceKeys].sort(),
                citedSourceTypes: tipos,
            };
        });
}

/**
 * Qué fuentes del corpus actual ya se citaron en la entrega anterior.
 *
 * Devuelve las claves, no un veredicto. La regla de cuántas semanas hay que
 * esperar la pone el sílabo de cada curso y no este código; lo que el sistema
 * puede afirmar es el hecho: esto lo citaste la vez pasada.
 */
export function repeatedFromPreviousDelivery(
    corpusCitationKeys: ReadonlyArray<string | null>,
    previous: PreviousDelivery | null,
): ReadonlySet<string> {
    if (!previous) return new Set();
    const anteriores = new Set(previous.citedSourceKeys);
    const out = new Set<string>();
    for (const key of corpusCitationKeys) {
        if (key && anteriores.has(key)) out.add(key);
    }
    return out;
}

/**
 * Entre qué trabajos se busca la entrega anterior (etapa 2). Para un trabajo
 * en un proyecto: los del mismo proyecto de origen y los sueltos, nunca los
 * de OTRO proyecto, porque un TP de otro curso no es «la entrega anterior»
 * de éste. Un trabajo suelto mira todo, como antes.
 *
 * Los sueltos cuentan porque un trabajo hecho antes de los proyectos puede
 * ser del mismo curso: el TP #9 nació en NT785 y los TP #5 a #8 están
 * sueltos; sin ellos el TP #9 perdía el aviso de lo citado en el TP #8.
 */
export function summariesForDeliveryMemory(
    summaries: ReadonlyArray<ExegesisPaperSummary>,
    paper: { projectId?: string | null },
): ExegesisPaperSummary[] {
    if (!paper.projectId) return [...summaries];
    // Un trabajo de otro proyecto que colabora con éste también cuenta.
    return summaries.filter(s => !s.projectId || s.projectId === paper.projectId || (s.linkedProjectIds ?? []).includes(paper.projectId!));
}
