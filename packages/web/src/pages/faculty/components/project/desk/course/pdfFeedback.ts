import { normalizePatternName, type FeedbackPattern, type FeedbackPatternKind } from '@dosfilos/domain';

/**
 * Lo que propone el diálogo de la devolución para cada comentario leído del
 * PDF. Es una PROPUESTA a la vista y cambiable: el estudiante decide si es
 * una corrección, una fortaleza o si no va al registro.
 */

export type ProposalReason = 'praise' | 'correction' | 'empty';

export interface FeedbackKindProposal {
    kind: FeedbackPatternKind;
    /** `empty`: una marca sin texto, hay que escribir qué era. */
    reason: ProposalReason;
}

/** Sin tildes y en minúsculas, para comparar palabras. */
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Lo que pide un cambio, aunque venga con un elogio («Buena idea, pero
 * falta la cita», «Excelente. Agrega el número de página»): el comentario
 * mixto es una corrección, porque hay algo que hacer. Imperativos, matices
 * («aunque», «sería mejor») y reparos («mal», «no queda claro»). «no es»
 * no, porque el elogio también lo usa («no es meramente descriptiva,
 * sino…», TI #1); tampoco «solo» suelto («no solo la reportas»).
 */
const PIDE_CAMBIO = new RegExp([
    'revisa\\w*', 'corrige', 'corregir', 'falta', 'faltan', 'evita', 'evitar', 'error', 'errores', 'errata',
    'cuidado', 'ojo', 'debes', 'deberias?', 'hay que', 'conviene', 'convendr\\w*', 'pero', 'sin embargo', 'aunque',
    'agrega\\w*', 'anade\\w*', 'cambia\\w*', 'cuida\\w*', 'aclara\\w*', 'explica', 'explicar', 'cita', 'citar', 'quita\\w*',
    'elimina\\w*', 'considera\\w*', 'seria mejor', 'podrias', 'no queda claro', 'confus\\w*', 'mal', 'incorrect\\w*',
    'but', 'needs?', 'unclear', 'consider', 'please', 'instead', 'should', 'revise', 'fix', 'avoid', 'missing', 'check',
    'typo', 'careful', 'however', 'add',
].map(w => `\\b${w}\\b`).join('|'));

/**
 * El elogio, en español y en inglés. «correct(a|o)» con límite de palabra:
 * «incorrecto» no es elogio. «precisamente» tampoco (es «justamente»).
 */
const ELOGIO = new RegExp([
    'excelente', 'excelentes', 'muy buen[ao]?s?', 'buen[ao]?s? (?:trabajo|tesis|analisis|argumento|hallazgo|observacion|uso|punto|decision|cierre)',
    'sobresaliente', 'solid[ao]s?', 'correct[ao]s?', 'correctamente', 'precis[ao]s?', 'precision', 'bien (?:aplicad|hech|logrado|resuelt|argumentad|fundad)\\w*',
    'ejemplar', 'impecable', 'acertad[ao]s?', 'notable', 'muy bien', 'bien visto',
    'excellent', 'very good', 'great', 'outstanding', 'solid', 'correct', 'correctly', 'precise', 'precisely', 'accurate',
    'well done', 'well applied', 'good work', 'nice', 'exemplary', 'strong',
].map(w => `\\b${w}\\b`).join('|'));

/** Un elogio negado, hasta tres palabras antes: «no es correcto», «no es del todo precisa», «not correct». */
const ELOGIO_NEGADO = new RegExp(`\\b(?:no|nada|poco|poca|not|isn'?t|never)\\s+(?:\\S+\\s+){0,3}?(?:${ELOGIO.source})`);

/**
 * Una frase que empieza pidiendo: «Precisa la fuente» (el verbo, no el
 * adjetivo), «Solo el primero es correcto», «Only the first…».
 */
const EMPIEZA_PIDIENDO = /^(?:precisa|precisá|solo|sólo|only)\b/;

/** Las frases de un comentario: corta en «. », «! », «? » antes de mayúscula (no en «analiza...»), ni en «v. 14»). */
export function sentencesOf(text: string): string[] {
    return text.split(/(?<=[.!?…])\s+(?=[¿¡«"“(]?[A-ZÁÉÍÓÚÑ])/u).map(f => f.trim()).filter(Boolean);
}

/**
 * La propuesta para un comentario, frase por frase: es fortaleza solo si
 * TODAS las frases son elogio y ninguna pide algo. Una pregunta, un
 * pedido, un reparo o un elogio negado → corrección; sin texto →
 * corrección marcada «sin comentario: escribe qué era». Ante la duda,
 * corrección: proponer «fortaleza» para algo que pide un cambio esconde
 * una corrección, que es el error caro. Determinista y sin servidor. En el
 * TI #1 del Salmo 23: 12 elogios y 3 correcciones, como los contó el
 * fundador.
 */
export function proposeFeedbackKind(text: string | null | undefined): FeedbackKindProposal {
    const original = (text ?? '').trim();
    if (!original) return { kind: 'correction', reason: 'empty' };
    const correccion: FeedbackKindProposal = { kind: 'correction', reason: 'correction' };
    if (original.includes('?')) return correccion;
    const frases = sentencesOf(original).map(f => plano(f).replace(/^[¿¡«"“(\s]+/, ''));
    for (const f of frases) {
        if (EMPIEZA_PIDIENDO.test(f) || PIDE_CAMBIO.test(f) || ELOGIO_NEGADO.test(f) || !ELOGIO.test(f)) return correccion;
    }
    return { kind: 'strength', reason: 'praise' };
}

/** Tope del nombre que se propone (el patrón acepta más, pero un nombre se lee de un vistazo). */
export const SUGGESTED_NAME_MAX = 60;

/** Lo que va antes de un punto que NO cierra la frase: «v. 14», «Cf. Waltke», «s.v. λόγος», «p. 5». */
const ABREVIATURA = /(?:^|[\s(])(?:v|vv|p|pp|cf|ej|s\.v|etc|ibid|n|nn|cap|vol|ed|ver|lit|e\.g|i\.e)$/i;
/** Un nombre más corto que esto sigue hasta el corte siguiente («v. 14: cierre doble», no «v. 14»). */
const NOMBRE_MIN = 10;

/**
 * El nombre que se propone para el patrón: la primera frase del comentario
 * (hasta el punto, los dos puntos o el punto y coma), cortada en una
 * palabra a 60 caracteres. «Muy buena tesis: no es meramente…» → «Muy
 * buena tesis». No corta tras una abreviatura ni una ficha de tres letras
 * o menos, ni deja un nombre de menos de 10: «v. 14: cierre doble» daba
 * «v», y varias «v» se fundían en un patrón con recurrencia falsa. El
 * estudiante lo cambia.
 */
export function suggestPatternName(comment: string | null | undefined, max = SUGGESTED_NAME_MAX): string {
    const t = (comment ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    let frase = t;
    for (const m of t.matchAll(/[.:;!?…](?=\s|$)/g)) {
        const antes = t.slice(0, m.index).trim();
        if (m[0] === '.') {
            const ficha = /(\S+)$/.exec(antes)?.[1] ?? '';
            if (ABREVIATURA.test(antes) || ficha.replace(/[^\p{L}]/gu, '').length <= 3 && !/\d/.test(ficha)) continue;
        }
        if (antes.length < NOMBRE_MIN) continue;
        frase = antes;
        break;
    }
    frase = frase.replace(/[.,;:!?…]+$/, '');
    if (frase.length <= max) return frase;
    const corte = frase.slice(0, max - 1);
    const espacio = corte.lastIndexOf(' ');
    return `${(espacio > max / 2 ? corte.slice(0, espacio) : corte).replace(/[\s,;:]+$/, '')}…`;
}

export interface PatternMatch {
    /** El patrón del curso con el mismo nombre y la misma clase: se ofrece reutilizarlo. */
    same: FeedbackPattern | null;
    /** El patrón con ese nombre es de la OTRA clase: guardar lo sumaría a ese, con su clase. */
    clash: FeedbackPattern | null;
}

const claseDe = (p: FeedbackPattern): FeedbackPatternKind => (p.kind === 'strength' ? 'strength' : 'correction');

/**
 * El patrón existente que coincide con un nombre (normalizado, como lo
 * compara el dominio al guardar). El dominio reutiliza por nombre sin mirar
 * la clase, así que un nombre que ya usa un patrón de la otra clase se
 * avisa: guardarlo así sumaría una fortaleza a una corrección.
 */
export function matchPattern(patterns: ReadonlyArray<FeedbackPattern>, name: string, kind: FeedbackPatternKind): PatternMatch {
    const n = normalizePatternName(name);
    if (!n) return { same: null, clash: null };
    const p = patterns.find(x => normalizePatternName(x.name) === n) ?? null;
    if (!p) return { same: null, clash: null };
    return claseDe(p) === kind ? { same: p, clash: null } : { same: null, clash: p };
}

export const patternKindOf = claseDe;

/**
 * Un patrón de la misma clase cuyo nombre aparece en el comentario
 * («Distinción textual-crítica» en «Distinción textual-crítica correcta y
 * necesaria»): se OFRECE sumarlo a ese en vez de crear otro. Nombres de
 * menos de 8 letras no cuentan («Sólido» aparece en cualquier parte).
 */
export function similarPattern(patterns: ReadonlyArray<FeedbackPattern>, comment: string, kind: FeedbackPatternKind): FeedbackPattern | null {
    const c = normalizePatternName(comment);
    if (!c) return null;
    return patterns
        .filter(p => claseDe(p) === kind)
        .map(p => ({ p, n: normalizePatternName(p.name) }))
        .filter(({ n }) => n.length >= 8 && c.includes(n))
        .sort((a, b) => b.n.length - a.n.length)[0]?.p ?? null;
}
