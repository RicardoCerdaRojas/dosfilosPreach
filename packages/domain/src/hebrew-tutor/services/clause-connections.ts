import { GrammaticalCategory, MorphemeRole, VerbForm } from '../value-objects/grammar.js';
import type { ClauseConnection, VerseAnalysis, VerseClause, WordAnalysis } from '../entities/verse-analysis.js';

/**
 * La conexión de cada cláusula, comprobada contra su primera palabra.
 *
 * Lo que se puede decidir mirando la palabra se decide aquí y no se le deja
 * al asistente (bitácora del módulo de hebreo #2 y #4, Rut 1):
 *
 *   - waw + NO verbo  → disyuntiva («וְרוּת דָּבְקָה» = «pero Rut…»)
 *   - waw consecutiva → cadena de wayyiqtol
 *   - el asistente dijo «waw» y la cláusula no empieza con waw → asíndeton
 *   - el asistente dijo «asíndeton» y empieza con waw → waw (según lo que sigue)
 *
 * Lo demás —subordinada, discurso directo, el VALOR lógico— lo pone el
 * asistente; una subordinada unida con waw sigue siendo subordinada. Las cláusulas con índices imposibles se descartan.
 */

const CONEXIONES: ReadonlySet<ClauseConnection> = new Set<ClauseConnection>([
    'FIRST', 'WAYYIQTOL_CHAIN', 'WAW_CONJUNCTIVE', 'WAW_DISJUNCTIVE', 'ASYNDETIC', 'SUBORDINATE', 'QUOTATION',
]);

/** Si la palabra empieza con la conjunción waw, y de qué clase. */
function wawDe(w: WordAnalysis): 'consecutive' | 'conjunctive' | null {
    // La forma (que ya decidió OSHB) manda: «waw consecutiva» se llama también
    // la del weqatal, y por el rol del morfema un weqatal salía «cadena de
    // wayyiqtol».
    const forma = w.verbMorphology?.verbForm;
    if (forma === VerbForm.WAYYIQTOL) return 'consecutive';
    if (forma === VerbForm.WEQATAL) return 'conjunctive';
    const roles = (w.morphemes ?? []).map(m => m.role);
    if (roles.includes(MorphemeRole.WAW_CONSECUTIVE)) return 'consecutive';
    if (roles.includes(MorphemeRole.WAW_CONJUNCTIVE)) return 'conjunctive';
    // Sin morfemas: la letra. וּ al comienzo es waw (ante labial o šewa).
    const letras = (w.hebrewText ?? '').replace(/[\u0591-\u05AF]/g, '');
    // šewa, ḥireq (וִיהִי), ṣere, segol (וֶאֱ…), pataḥ, qameṣ, šureq (וּ).
    return /^\u05D5[\u05B0\u05B4\u05B5\u05B6\u05B7\u05B8\u05BC]/.test(letras) ? 'conjunctive' : null;
}

function esVerbo(w: WordAnalysis): boolean {
    return w.category === GrammaticalCategory.VERB;
}

function conexionComprobada(c: VerseClause, primera: WordAnalysis): ClauseConnection {
    // Una subordinada o un discurso directo unidos con waw («וּבַאֲשֶׁר
    // תָּלִינִי», Rut 1:16) siguen siendo eso: la waw no los vuelve disyuntivos.
    if (c.connection === 'SUBORDINATE' || c.connection === 'QUOTATION') return c.connection;
    const waw = wawDe(primera);
    if (waw === 'consecutive') return 'WAYYIQTOL_CHAIN';
    // וְלֹא / וְאַל + verbo es la continuación negada, no una disyuntiva
    // (1.451 casos de וְלֹא + verbo en OSHB): ahí decide el asistente, y una
    // «asíndeton» con waw es imposible.
    if (waw === 'conjunctive' && primera.category === GrammaticalCategory.NEGATIVE_PARTICLE) {
        return c.connection === 'WAW_DISJUNCTIVE' ? 'WAW_DISJUNCTIVE' : 'WAW_CONJUNCTIVE';
    }
    if (waw === 'conjunctive') return esVerbo(primera) ? 'WAW_CONJUNCTIVE' : 'WAW_DISJUNCTIVE';
    // Sin waw: una «waw» es imposible; lo demás lo decide el asistente.
    if (c.connection === 'WAW_CONJUNCTIVE' || c.connection === 'WAW_DISJUNCTIVE' || c.connection === 'WAYYIQTOL_CHAIN') return 'ASYNDETIC';
    return c.connection;
}

export function checkClauseConnections(analysis: VerseAnalysis): VerseAnalysis {
    const crudas = Array.isArray(analysis.clauses) ? analysis.clauses : [];
    const n = analysis.words.length;
    const clauses: VerseClause[] = [];
    // En orden y sin solaparse: una cláusula repetida o metida dentro de otra
    // se descarta (además chocaba en la clave de la lista en pantalla).
    const ordenadas = crudas
        .filter(c => c && Number.isInteger(c.firstWord) && Number.isInteger(c.lastWord))
        .filter(c => c.firstWord >= 0 && c.lastWord < n && c.firstWord <= c.lastWord)
        .sort((a, b) => a.firstWord - b.firstWord);
    let hasta = -1;
    for (const c of ordenadas) {
        if (c.firstWord <= hasta) continue;
        hasta = c.lastWord;
        // «Inicial» sólo puede ser la primera del versículo.
        const crudaConexion = CONEXIONES.has(c.connection) ? c.connection : 'ASYNDETIC';
        const conexion = crudaConexion === 'FIRST' && clauses.length > 0 ? 'ASYNDETIC' : crudaConexion;
        const comprobada = conexionComprobada({ ...c, connection: conexion }, analysis.words[c.firstWord]!);
        clauses.push({
            ...c,
            type: c.type === 'NOMINAL' ? 'NOMINAL' : 'VERBAL',
            connection: comprobada,
            connector: c.connector ?? null,
            value: c.value ?? '',
            explanation: c.explanation ?? '',
            ...(comprobada !== c.connection ? { adjusted: true } : {}),
        });
    }
    return { ...analysis, clauses };
}
