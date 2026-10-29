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
 * Lo que la memoria de entregas lee de un resumen. El escritorio del curso
 * (`projectDesk`) arma este mínimo con sus estudios y usa la MISMA regla, así
 * la mesa y el analizador no eligen «la anterior» de dos maneras distintas.
 */
export type DeliveryMemorySummary = Pick<ExegesisPaperSummary, 'id' | 'title' | 'passage' | 'createdAt' | 'citedSourceKeys'>
    & { sources?: ExegesisPaperSummary['sources'] };

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
    summaries: ReadonlyArray<DeliveryMemorySummary>,
    currentPaperId: string,
): PreviousDelivery | null {
    return previousDeliveries(summaries, currentPaperId, 1)[0] ?? null;
}

/**
 * Las últimas `count` entregas anteriores, de la más reciente a la más vieja.
 * La gramática se alterna (A7): para sugerir «la otra» hay que mirar dos.
 */
export function previousDeliveries(
    summaries: ReadonlyArray<DeliveryMemorySummary>,
    currentPaperId: string,
    count: number,
): PreviousDelivery[] {
    const actual = summaries.find(s => s.id === currentPaperId);
    if (!actual) return [];
    return deliveriesBefore(summaries.filter(s => s.id !== currentPaperId), actual.createdAt, count);
}

/**
 * Las últimas entregas antes de un momento, para un trabajo que todavía no
 * existe: al CREAR el TP #10, el hueco [FUENTES DE LA SEMANA ANTERIOR] del
 * encargo se llena con lo citado en el TP #9 (TP #9, B4).
 */
export function deliveriesBefore(
    summaries: ReadonlyArray<DeliveryMemorySummary>,
    before: Date,
    count: number,
): PreviousDelivery[] {
    return summaries
        .filter(s => s.citedSourceKeys.length > 0)
        .filter(s => s.createdAt.getTime() < before.getTime())
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

/**
 * Entre qué trabajos del curso se busca la entrega anterior de un tipo de
 * trabajo: los del MISMO tipo (TP #9, B4/B11). El TP semanal se compara con
 * el TP semanal anterior, no con el ensayo que se entregó en medio. Cuentan
 * los que nacieron como ese tipo y los que el calendario vincula a una
 * entrada de ese tipo (un TP suelto traído al curso).
 *
 * Si ninguno de los otros es de ese tipo (trabajos de antes de los tipos,
 * sueltos sin vincular), el corpus de un trabajo que ya existe mira la lista
 * entera: perder la entrega anterior es peor que compararse con un trabajo
 * de otro tipo. Al CREAR (`fallbackToAll: false`) no: la primera entrega de
 * un tipo no tiene anterior, y llenar el encargo con lo que citó un ensayo
 * o un trabajo suelto de otro libro sería inventarla (revisión de B4).
 */
export function summariesOfSameWorkType<S extends Pick<ExegesisPaperSummary, 'id'> & { projectWorkTypeId?: string | null }>(
    summaries: ReadonlyArray<S>,
    paper: { id?: string | null; projectWorkTypeId?: string | null },
    project: { courseSchedule?: ReadonlyArray<{ workTypeId: string; paperId?: string | null }> | null } | null | undefined,
    options: { fallbackToAll?: boolean } = {},
): S[] {
    const tipo = paper.projectWorkTypeId;
    if (!tipo) return [...summaries];
    const vinculados = new Set((project?.courseSchedule ?? []).filter(e => e.workTypeId === tipo && e.paperId).map(e => e.paperId!));
    const delTipo = (s: S) => s.id === paper.id || s.projectWorkTypeId === tipo || vinculados.has(s.id);
    const mismos = summaries.filter(delTipo);
    if (mismos.some(s => s.id !== paper.id)) return mismos;
    return options.fallbackToAll === false ? mismos : [...summaries];
}
