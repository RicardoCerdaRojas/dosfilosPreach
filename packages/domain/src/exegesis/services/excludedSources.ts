import { formatPassageReference } from '../../bible/canon/passage-reference';
import type { SourceType } from '../entities/SourceType';
import { repeatedFromPreviousDelivery, type PreviousDelivery } from './sourceMemory';

/**
 * Una fuente que este trabajo no puede usar.
 *
 * En el TP #6 (Santiago 3, 2026-10-07) el encuadre decía «no citar
 * McCartney, Varner, Ropes, Robertson» —el sílabo no permite repetir una
 * fuente en semanas consecutivas— y «Extraer de mi biblioteca» recomendó
 * justamente esos cuatro, sin aviso. La regla vivía sólo en el texto del
 * encuadre, y ese texto no lo lee el ranking de la biblioteca.
 *
 * No se ocultan: el sílabo de otro curso podría permitirlas. Van al final de
 * cada lista, marcadas, y agregarlas pide confirmación.
 */
export interface ExcludedSource {
    /** Cómo se cita: «McCartney», «Carson y Moo». */
    key: string;
    /**
     * El trabajo anterior que la citó, cuando la exclusión salió de ahí
     * («Citada en el TP #5»). `null` cuando la agregó el estudiante.
     */
    previousPaperTitle: string | null;
}

/**
 * Qué hace la regla de no repetir con cada tipo de fuente (TP #8, 8a, A7).
 *
 * - `exclude`: no se repite en semanas consecutivas. Los comentarios: es la
 *   regla del sílabo del fundador («solo los comentarios críticos y
 *   exegéticos»).
 * - `alternate`: se puede repetir, pero conviene alternar. Las gramáticas:
 *   el sílabo no las restringe y el fundador las alterna por prudencia
 *   (Robertson una semana, Wallace la siguiente). Se propone excluirla y se
 *   sugiere la otra.
 * - `free`: no se propone. Léxicos, texto base, aparato y el resto: antes
 *   la propuesta traía Tuggy, NA28 y Robertson, y el estudiante los
 *   desmarcaba a mano cada semana (#1).
 */
export type SourceRepetitionRule = 'exclude' | 'alternate' | 'free';
export type SourceRepetitionPolicy = Readonly<Partial<Record<SourceType, SourceRepetitionRule>>>;

export const DEFAULT_SOURCE_REPETITION_POLICY: SourceRepetitionPolicy = {
    'commentary-critical': 'exclude',
    'commentary-expository': 'exclude',
    'grammar-syntax': 'alternate',
};

/**
 * La regla de un tipo. Sin tipo (una clave citada que ninguna fuente de esa
 * entrega declara) se excluye, como antes: proponer de más se corrige con un
 * clic; dejar pasar un comentario repetido, no.
 */
export function repetitionRuleFor(
    type: SourceType | null | undefined,
    policy: SourceRepetitionPolicy = DEFAULT_SOURCE_REPETITION_POLICY,
): SourceRepetitionRule {
    if (!type) return 'exclude';
    return policy[type] ?? 'free';
}

/** Una exclusión propuesta, con por qué se propone. Al guardarse queda en `ExcludedSource`. */
export interface ProposedExclusion extends ExcludedSource {
    rule: Exclude<SourceRepetitionRule, 'free'>;
    sourceType: SourceType | null;
    /**
     * Con `alternate`: las del mismo tipo citadas en la entrega anterior a la
     * anterior que esta vez quedan libres. «Robertson (TP #7) → Wallace (TP #6)».
     */
    alternatives: string[];
}

/**
 * Las exclusiones que se proponen al abrir el corpus: lo citado en la
 * entrega anterior, según la regla de su tipo. El estudiante las confirma o
 * las edita; el sistema no decide cuántas semanas hay que esperar.
 */
export function proposeExclusions(
    previous: PreviousDelivery | null,
    language: 'es' | 'en' = 'es',
    options: { beforePrevious?: PreviousDelivery | null; policy?: SourceRepetitionPolicy } = {},
): ProposedExclusion[] {
    if (!previous) return [];
    // Sin título, el pasaje: con `null` la propuesta decía «(trabajo
    // anterior)» y las confirmadas, «agregada por ti», aunque la tarjeta de
    // NA28 sí sabía que era «Santiago 3:1-12» (TP #7, #2 y #10).
    const origen = previous.title?.trim() || formatPassageReference(previous.passage, language);
    // La regla más restrictiva entre las obras que comparten la clave.
    const peso: Record<SourceRepetitionRule, number> = { exclude: 2, alternate: 1, free: 0 };
    const tipoDe = (key: string): SourceType | null => {
        const tipos = previous.citedSourceTypes?.[key] ?? [];
        if (tipos.length === 0) return null;
        return [...tipos].sort((a, b) => peso[repetitionRuleFor(b, options.policy)] - peso[repetitionRuleFor(a, options.policy)])[0]!;
    };
    const out: ProposedExclusion[] = [];
    for (const key of previous.citedSourceKeys) {
        const sourceType = tipoDe(key);
        const rule = repetitionRuleFor(sourceType, options.policy);
        if (rule === 'free') continue;
        const antes = options.beforePrevious;
        const alternatives = rule === 'alternate' && antes
            ? antes.citedSourceKeys.filter(k =>
                !!sourceType && !!antes.citedSourceTypes?.[k]?.includes(sourceType) && !previous.citedSourceKeys.includes(k))
            : [];
        out.push({ key, previousPaperTitle: origen, rule, sourceType, alternatives });
    }
    return out;
}

/** Sin acentos, mayúsculas ni puntuación: «Martín» y «martin.» son la misma clave. */
function comparable(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^\p{L}\p{N}\s,;&'-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Partículas que forman parte del apellido: «de Silva», «van der Watt». */
const PARTICULAS = new Set(['de', 'da', 'del', 'della', 'di', 'do', 'dos', 'du', 'la', 'le', 'van', 'von', 'der', 'den', 'ter']);

/**
 * Los apellidos de un autor (o de una clave), uno por coautor, sin espacios.
 *
 *   «Dan G. McCartney»               → mccartney
 *   «Varner, William»                → varner
 *   «D. A. Carson & Douglas J. Moo»  → carson, moo
 *   «David A. de Silva» / «deSilva»  → desilva
 *
 * Sólo el apellido: comparar contra cualquier palabra del autor hacía que
 * excluir a Martin (Ralph P.) alcanzara a Martin Dibelius.
 */
function apellidos(text: string | null | undefined): Set<string> {
    const out = new Set<string>();
    for (const coautor of comparable(text ?? '').replace(/\bet al\b/g, '').split(/\s*(?:;|&|\band\b|\by\b)\s*/)) {
        const c = coautor.trim();
        if (!c) continue;
        const tokens = (c.includes(',') ? c.split(',')[0]! : c).trim().split(' ').filter(Boolean);
        if (tokens.length === 0) continue;
        // Con coma, lo de antes es el apellido entero; sin coma, el último
        // token y las partículas que lo preceden.
        let desde = c.includes(',') ? 0 : tokens.length - 1;
        while (!c.includes(',') && desde > 0 && PARTICULAS.has(tokens[desde - 1]!)) desde--;
        out.add(tokens.slice(desde).join(''));
    }
    return out;
}

export interface ExclusionCandidate {
    citationKey?: string | null;
    author?: string | null;
}

/**
 * La exclusión que alcanza a un libro o a una fuente, o `null`.
 *
 * Se comparan APELLIDOS: los de la clave excluida («McCartney», «William
 * Varner», «Carson y Moo») contra los del autor del libro y los de su clave
 * de cita. Una clave de varios autores alcanza sólo a la obra que los tiene
 * a todos.
 */
export function exclusionFor(
    candidate: ExclusionCandidate,
    exclusions: ReadonlyArray<ExcludedSource> | null | undefined,
): ExcludedSource | null {
    if (!exclusions || exclusions.length === 0) return null;
    const delCandidato = new Set([...apellidos(candidate.author), ...apellidos(candidate.citationKey)]);
    if (delCandidato.size === 0) return null;
    for (const ex of exclusions) {
        const buscados = apellidos(ex.key);
        if (buscados.size > 0 && [...buscados].every(a => delCandidato.has(a))) return ex;
    }
    return null;
}

/**
 * Ordena una lista dejando las excluidas al final, sin alterar el orden
 * relativo de cada grupo.
 */
export function excludedLast<T>(items: ReadonlyArray<T>, isExcluded: (item: T) => boolean): T[] {
    return [...items.filter(i => !isExcluded(i)), ...items.filter(isExcluded)];
}

/**
 * El encuadre que leen los pasos que REDACTAN, con las exclusiones adelante.
 *
 * El encuadre es texto libre del estudiante; las exclusiones son un dato
 * aparte. Los pasos que escriben (análisis, prosa, introducción, conclusión,
 * ensamble, coherencia, plan de uso) tienen que saber las dos cosas. Los que
 * sólo BUSCAN en la biblioteca no lo usan: una lista de nombres en la consulta
 * acercaría justamente esos libros.
 */
export function briefWithExclusions(
    paper: { assignmentBrief: string | null; excludedSources?: ReadonlyArray<ExcludedSource> | null; displayLanguage: 'es' | 'en' },
): string | null {
    const claves = (paper.excludedSources ?? []).map(e => e.key.trim()).filter(Boolean);
    if (claves.length === 0) return paper.assignmentBrief;
    const linea = paper.displayLanguage === 'en'
        ? `Sources excluded from this paper (do not cite them or rely on them): ${claves.join(', ')}.`
        : `Fuentes excluidas de este trabajo (no las cites ni te apoyes en ellas): ${claves.join(', ')}.`;
    // Primero: el planificador recorta el encuadre largo por el final, y la
    // exclusión es lo que no se puede perder.
    return paper.assignmentBrief?.trim() ? `${linea}\n\n${paper.assignmentBrief.trim()}` : linea;
}

/**
 * ¿La fila de una fuente del corpus avisa «la citaste la vez pasada, no
 * debería entrar»? (TP #8, fase 8a, A7, #15).
 *
 * Sólo mientras las exclusiones del trabajo no se confirmaron: si el
 * estudiante revisó la propuesta y la dejó fuera de las excluidas, repetirle
 * el aviso era discutirle lo que ya decidió. Y sólo para un tipo que la regla
 * restringe: un léxico o el texto base se pueden repetir.
 */
export function warnsRepeatedSource(
    source: { citationKey: string | null; sourceType: SourceType },
    excludedSources: ReadonlyArray<ExcludedSource> | null | undefined,
    previous: PreviousDelivery | null,
    policy: SourceRepetitionPolicy = DEFAULT_SOURCE_REPETITION_POLICY,
): boolean {
    if (!source.citationKey || excludedSources != null) return false;
    if (repetitionRuleFor(source.sourceType, policy) === 'free') return false;
    return repeatedFromPreviousDelivery([source.citationKey], previous).size > 0;
}
