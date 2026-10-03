import { parseBriefQuestions } from './briefQuestions';
import { lemmaKey, type VerseMorphologyEntry } from './lemmaPages';

/**
 * Preguntas CANDIDATAS para el encuadre de un estudio para predicar.
 *
 * Pedido del fundador (2026-10-01), con una tensión escrita: descubrir las
 * preguntas leyendo ES el acto exegético (`PREACHING_BRIEF_TEMPLATE`). Por eso
 * el asistente sólo PROPONE; el pastor marca, edita o descarta, y nada entra
 * al encuadre sin que él lo agregue (decisión del fundador, 2026-10-03).
 *
 * Y una barrera que no depende del modelo: cada forma hebrea o griega que una
 * pregunta cite tiene que estar en el pasaje. Una pregunta sobre una palabra
 * que el texto no tiene es una pregunta inventada, y se descarta.
 */
export interface QuestionCandidate {
    question: string;
    /** Por qué vale la pena preguntarlo: qué cruz del texto señala. */
    why: string;
    /** Las formas del original que la pregunta discute. */
    forms: string[];
}

export interface FilteredCandidates {
    kept: QuestionCandidate[];
    dropped: Array<{ question: string; missing: string[] }>;
}

// El maqaf (U+05BE) une dos palabras, no las pega: «חָרָה־לְךָ» son dos.
const PALABRA_ORIGINAL = /[\u0590-\u05BD\u05BF-\u05FF\u0370-\u03FF\u1F00-\u1FFF]+/g;

/**
 * Las claves (`lemmaKey`) de todo lo que aparece en el pasaje: cada palabra,
 * cada morfema de las hebreas (morphhb separa וַ/יְמַן) y cada lema.
 */
export function passageFormKeys(
    verses: ReadonlyArray<VerseMorphologyEntry>,
    lemmas: ReadonlyArray<{ lemma: string }> = [],
): Set<string> {
    const keys = new Set<string>();
    const add = (s: string) => { const k = lemmaKey(s); if (k) keys.add(k); };
    for (const v of verses) {
        for (const t of v.morphology.tokens) {
            add(t.text.replace(/\//g, ''));
            for (const parte of t.text.split('/')) add(parte);
            add(t.lemma);
        }
    }
    for (const l of lemmas) add(l.lemma);
    return keys;
}

/**
 * Deja sólo las candidatas cuyas formas están todas en el pasaje. Se miran las
 * declaradas en `forms` y además toda palabra hebrea o griega escrita en la
 * pregunta: una forma citada en el texto y no declarada también cuenta.
 */
export function filterQuestionCandidates(
    candidates: ReadonlyArray<QuestionCandidate>,
    passageKeys: ReadonlySet<string>,
): FilteredCandidates {
    const kept: QuestionCandidate[] = [];
    const dropped: FilteredCandidates['dropped'] = [];
    for (const c of candidates) {
        const citadas = [
            ...c.forms.flatMap(f => f.match(PALABRA_ORIGINAL) ?? []),
            ...(c.question.match(PALABRA_ORIGINAL) ?? []),
        ];
        const missing = [...new Set(citadas)].filter(w => {
            const k = lemmaKey(w);
            return k.length >= 2 && !passageKeys.has(k);
        });
        if (missing.length > 0) dropped.push({ question: c.question, missing });
        else kept.push(c);
    }
    return { kept, dropped };
}

/**
 * Agrega preguntas al bloque «PREGUNTAS DEL TEXTO» del encuadre, numeradas a
 * continuación de las que ya tenga. Las líneas de la plantilla sin llenar
 * («1.», «2.» solos) se reemplazan.
 *
 * La numeración sigue al mayor número que `parseBriefQuestions` ve en TODO el
 * encuadre, y el encabezado acepta «Preguntas:» o «PREGUNTAS DEL TEXTO:»: con
 * otro rótulo o con «1)» se agregaba un segundo bloque que volvía a empezar en
 * 1, y dos preguntas con el mismo número confunden a qué versículo le toca
 * cada una (revisión adversarial de C4).
 */
export function insertQuestionsIntoBrief(brief: string, questions: ReadonlyArray<string>): string {
    if (questions.length === 0) return brief;
    const lineas = brief.split('\n');
    const inicio = lineas.findIndex(l => /^\s*PREGUNTAS(?:\s+DEL\s+TEXTO)?\s*:?\s*$/i.test(l));
    const sinLlenar = (l: string) => /^\s*\d{1,2}\s*[.)\-]\s*$/.test(l);
    const desde = Math.max(0, ...parseBriefQuestions(lineas.filter(l => !sinLlenar(l)).join('\n')).map(q => q.number));
    const nuevas = questions.map((q, i) => `${desde + i + 1}. ${q}`);
    if (inicio < 0) {
        const base = brief.trimEnd();
        return `${base}${base ? '\n\n' : ''}PREGUNTAS DEL TEXTO\n${nuevas.join('\n')}\n`;
    }
    // El bloque termina en la primera línea en mayúsculas que abre otro.
    let fin = lineas.findIndex((l, i) => i > inicio && /^[A-ZÁÉÍÓÚÑ ]{6,}:?$/.test(l.trim()));
    if (fin < 0) fin = lineas.length;
    const bloque = lineas.slice(inicio + 1, fin).filter(l => !sinLlenar(l));
    while (bloque.length > 0 && !bloque[bloque.length - 1]!.trim()) bloque.pop();
    return [...lineas.slice(0, inicio + 1), ...bloque, ...nuevas, '', ...lineas.slice(fin)].join('\n');
}
