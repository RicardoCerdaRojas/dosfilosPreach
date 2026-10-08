import type { ClauseRelation, ConstituentRole, StructureNode } from './verseStructure.js';

/**
 * La LECTURA de cada cláusula (G1 + G5, opción «b» del fundador, 2026-10-08):
 * lo que el dato no da y el asistente sí. La estructura —qué cláusula depende
 * de cuál, su conector, su relación— ya está decidida desde MACULA; el
 * asistente sólo la lee:
 *
 *   - el VALOR de la cláusula y por qué («condición real», «juramento
 *     solemne»), con una frase de explicación;
 *   - la relación que el texto deja ABIERTA: ἵνα (propósito o resultado),
 *     ὅτι / כִּי (causa o contenido);
 *   - la función de lo ANTEPUESTO al verbo: foco (énfasis) o marco (tema).
 *
 * El código valida: un número de cláusula que no existe, una elección donde
 * la relación no es ambigua o un foco donde nada va antepuesto se descartan.
 * Lección de H1-H3: Luna sin razonamiento no sigue bien las instrucciones que
 * piden comparar; lo que se puede comprobar, se comprueba aquí.
 */

export type ResolvedRelation = 'purpose' | 'result' | 'ground' | 'content';
export type FrontingFunction = 'focus' | 'frame';

export interface ClauseReading {
    /** `StructureNode.index` de la fila. */
    readonly index: number;
    /** Primera palabra de la fila al generarse: si los datos cambian, la lectura no se pega a otra fila. */
    readonly anchor: string;
    readonly value: string;
    readonly explanation: string;
    readonly resolved?: ResolvedRelation;
    readonly fronting?: FrontingFunction;
}

/** Qué puede elegir el asistente en cada relación ambigua. */
const OPCIONES: Partial<Record<ClauseRelation, readonly ResolvedRelation[]>> = {
    purposeOrResult: ['purpose', 'result'],
    groundOrContent: ['ground', 'content'],
};

const RELACION_ES: Record<ClauseRelation, string> = {
    main: 'principal', addition: 'adición', development: 'desarrollo', contrast: 'contraste', alternative: 'alternativa',
    ground: 'fundamento', inference: 'inferencia', condition: 'condición (prótasis)', question: 'pregunta («si»)',
    exception: 'excepción («sino»)', purpose: 'propósito', negativePurpose: 'propósito negativo («para que no»)',
    result: 'resultado', purposeOrResult: 'propósito o resultado', groundOrContent: 'causa o contenido',
    comparison: 'comparación', time: 'tiempo', relative: 'relativa', participial: 'participio', infinitival: 'infinitivo',
    speech: 'discurso directo', chain: 'cadena narrativa (wayyiqtol)', conjunctive: 'waw + verbo',
    disjunctive: 'waw + no verbo (disyuntiva)', asyndetic: 'asíndeton (sin conjunción)',
};

const ROL_ES: Record<Exclude<ConstituentRole, ''>, string> = {
    s: 'sujeto', v: 'verbo', o: 'objeto', o2: 'segundo objeto', io: 'objeto indirecto', adv: 'adverbial',
    pp: 'complemento preposicional', p: 'predicado', vc: 'copulativo', aux: 'auxiliar',
};

/**
 * El tramo del prompt con la tarea de lectura. Vacío si no hay filas (sin
 * datos de estructura, no se pide nada: mejor sin lectura que inventada).
 */
export function buildClauseReadingTask(nodes: readonly StructureNode[]): string {
    if (!nodes.length) return '';
    const base = Math.min(...nodes.map(n => n.depth));
    const filas = nodes.map((n, i) => {
        const texto = n.words.map(w => w.t).join(' ');
        const conector = n.words.find(w => w.r === n.connector)?.t;
        const partes = [
            `relación: ${RELACION_ES[n.relation]}${n.conditionalClass ? `, ${n.conditionalClass}.ª clase` : ''}`,
            n.isApodosis ? 'APÓDOSIS' : '',
            conector ? `conector ${conector}` : '',
            n.verbless ? 'nominal (sin verbo)' : '',
            OPCIONES[n.relation] ? `→ ELEGIR "resolved": ${OPCIONES[n.relation]!.map(o => `"${o}"`).join(' o ')}` : '',
            n.fronted.length
                ? `antepuesto al verbo: ${n.fronted.map(f => `${ROL_ES[f.role as Exclude<ConstituentRole, ''>] ?? f.role} (${n.words.filter(w => f.rs.includes(w.r)).map(w => w.t).join(' ')})`).join(', ')} → ELEGIR "fronting": "focus" o "frame"`
                : '',
        ].filter(Boolean);
        return `${i + 1}. [nivel ${n.depth - base}] ${texto} — ${partes.join(' — ')}`;
    });
    return `
Y "clauseReadings": la LECTURA de cada cláusula. La ESTRUCTURA ya está decidida
desde el texto (qué cláusula depende de cuál, su conector, su relación): NO la
cambies ni la discutas; léela. Por cada cláusula numerada abajo devuelve:
- "n": su número;
- "value": su valor en 2 a 5 palabras («condición real», «consecuencia
  temporal», «juramento solemne», «propósito del ruego»);
- "explanation": UNA frase que diga por qué, apoyada en el conector, la forma
  verbal o el orden de las palabras;
- "resolved": SÓLO donde la cláusula dice ELEGIR "resolved". «purpose»
  (propósito: lo que se busca) o «result» (resultado: lo que se sigue); «ground»
  (causa: «porque») o «content» (contenido: «que», lo dicho o sabido). En las
  demás, omítelo;
- "fronting": SÓLO donde dice ELEGIR "fronting". «focus» si lo antepuesto es
  lo nuevo, lo contrastado o lo enfatizado; «frame» si fija el tema, el tiempo
  o el escenario de lo que sigue. En las demás, omítelo.

CLÁUSULAS:
${filas.join('\n')}`;
}

/** Valida la respuesta contra las filas: lo que no calza, se descarta. */
export function parseClauseReadings(raw: unknown, nodes: readonly StructureNode[]): ClauseReading[] {
    if (!Array.isArray(raw)) return [];
    const out: ClauseReading[] = [];
    const vistos = new Set<number>();
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        const n = typeof r.n === 'number' ? r.n : Number(r.n);
        const fila = Number.isInteger(n) ? nodes[n - 1] : undefined;
        if (!fila || vistos.has(n) || !fila.words[0]) continue;
        const value = typeof r.value === 'string' ? r.value.trim().slice(0, 80) : '';
        const explanation = typeof r.explanation === 'string' ? r.explanation.trim().slice(0, 400) : '';
        if (!value && !explanation) continue;
        const opciones = OPCIONES[fila.relation];
        const resolved = opciones?.includes(r.resolved as ResolvedRelation) ? (r.resolved as ResolvedRelation) : undefined;
        const fronting = fila.fronted.length && (r.fronting === 'focus' || r.fronting === 'frame') ? r.fronting : undefined;
        vistos.add(n);
        out.push({
            index: fila.index,
            anchor: fila.words[0].r,
            value,
            explanation,
            ...(resolved ? { resolved } : {}),
            ...(fronting ? { fronting } : {}),
        });
    }
    return out;
}

/** La lectura de una fila, si la hay y sigue anclada a la misma primera palabra. */
export function readingFor(node: StructureNode, readings: readonly ClauseReading[] | undefined): ClauseReading | undefined {
    return readings?.find(r => r.index === node.index && r.anchor === node.words[0]?.r);
}
