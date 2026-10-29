import type { CanonicalVerseAnalysis } from '../entities/CanonicalVerseAnalysis';
import type { CitationReview, VerifiedCitation } from '../entities/CitationVerification';
import { collectAnalysisClaims } from './analysisClaims';
import { mapAllVerdictsByPath } from './citationReview';
import { pagesOverlap } from './evidenceForCitation';
import { findInlineCitations } from './inlineCitations';
import type { ProseReviewerFinding } from './proseReview';

/**
 * Lo que el revisor con modelo de «Revisión antes de entregar» necesita
 * además del análisis, y el filtro de lo que devuelve (TP #9).
 *
 * B39: en 4:14 el revisor pidió «restituir el criterio de τό» después de que
 * el estudiante lo corrigió a propósito (el artículo es una variante: NA28 lo
 * marca dudoso) y dejó escrito en la revisión de la cita «el criterio no
 * decide; se corrige en la prosa». El revisor tomaba el análisis como verdad
 * porque no veía esa nota.
 *
 * B40: el revisor pidió «la referencia a Wallace, p. 961», que no existe (961
 * es de Robertson). Una observación que nombra una cita que no está en el
 * análisis, ni en la prosa, ni en las notas del estudiante, se descarta.
 */

/** Una nota de revisión manual, con la cita a la que se refiere en legible. */
export interface ProseReviewNote {
    /** «Robertson, p. 767 (pregunta 2, criterio decisivo)». */
    citation: string;
    note: string;
    /** La pregunta del análisis donde vive la cita, si vive en una respuesta. */
    questionNumber?: number;
}

/**
 * Las notas de revisión manual de la versión (`citationReviews`), legibles
 * para el revisor: la ruta `questionAnswers[0].decisiveCriterion.sources[1]`
 * no le dice nada; «Robertson, p. 767 (pregunta 2, criterio decisivo)», sí.
 */
export function reviewNotesForReviewer(
    analysis: CanonicalVerseAnalysis | null,
    verdicts: ReadonlyArray<VerifiedCitation>,
    reviews: ReadonlyArray<Pick<CitationReview, 'path' | 'note'>>,
    language: 'es' | 'en',
): ProseReviewNote[] {
    const en = language === 'en';
    const claims = new Map(analysis ? collectAnalysisClaims(analysis).map(c => [c.path, c] as const) : []);
    const veredictos = mapAllVerdictsByPath(analysis, verdicts);
    const out: ProseReviewNote[] = [];
    for (const r of reviews) {
        const note = r.note?.trim();
        if (!note) continue;
        const claim = claims.get(r.path);
        const v = veredictos.get(r.path);
        const qa = /^questionAnswers\[(\d+)\]/.exec(r.path);
        const questionNumber = qa ? analysis?.questionAnswers?.[Number(qa[1])]?.questionNumber : undefined;
        const donde = qa
            ? (en ? ` (question ${questionNumber ?? Number(qa[1]) + 1}${r.path.includes('decisiveCriterion') ? ', decisive criterion' : ''})`
                : ` (pregunta ${questionNumber ?? Number(qa[1]) + 1}${r.path.includes('decisiveCriterion') ? ', criterio decisivo' : ''})`)
            : r.path.startsWith('prosa@') ? (en ? ' (in the prose)' : ' (en la prosa)') : '';
        const cita = claim
            ? `${claim.sourceKey}, p. ${claim.page}${claim.pageEnd && claim.pageEnd !== claim.page ? `–${claim.pageEnd}` : ''}`
            : v ? [v.author, v.pages].filter(Boolean).join(', ') : r.path;
        out.push({ citation: `${cita}${donde}`, note, ...(typeof questionNumber === 'number' ? { questionNumber } : {}) });
    }
    return out;
}

/** Una cita nombrada en el texto de una observación: «Wallace, p. 961». */
export interface CitaNombrada {
    key: string;
    pages: string;
    /** Hoja del archivo, no página impresa (`pageKind: 'sheet'`). */
    kind?: 'sheet';
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PAGINA = String.raw`(?:pp?\.|págs?\.|páginas?|pages?|hojas?|sheets?)`;

/** «Wallace, p. 236» o «Wallace, hoja 12»: cómo se le nombra al revisor cada cita disponible. */
export function availableCitationLabel(c: CitaNombrada, language: 'es' | 'en'): string {
    const rotulo = c.kind === 'sheet' ? (language === 'en' ? 'sheet' : 'hoja') : 'p.';
    return `${c.key}, ${rotulo} ${c.pages}`;
}

/**
 * Las citas con autor y página que nombra un texto libre. Dos formas: el autor
 * y la página detrás («Wallace, p. 961», «Wallace (p. 961)», «Wallace, 961»,
 * «Wallace p. 961») y la página delante («la p. 961 de Wallace»).
 *
 * Entre el autor y el número tiene que haber coma, paréntesis o «p.»: «Wallace
 * 3 veces» no es una cita. Y un año sin «p.» («(Wallace, 1996)») tampoco
 * (revisión de B40).
 */
export function citationsNamedIn(text: string, keys: ReadonlyArray<string>): CitaNombrada[] {
    const out: CitaNombrada[] = [];
    const conRotulo = new RegExp(PAGINA, 'iu');
    for (const key of keys.map(k => k?.trim()).filter((k): k is string => !!k)) {
        const k = escapar(key);
        const detras = new RegExp(String.raw`(?<![\p{L}])${k}(?![\p{L}])(\s*[,(]\s*(?:${PAGINA}\s*)?|\s+${PAGINA}\s*)(\d+(?:\s*[–-]\s*\d+)?)(?!\d)(?![:.,]\d)`, 'giu');
        const delante = new RegExp(String.raw`${PAGINA}\s*(\d+(?:\s*[–-]\s*\d+)?)\s+(?:de|of|in|en)\s+${k}(?![\p{L}])`, 'giu');
        for (const m of text.matchAll(detras)) {
            const n = Number(m[2]);
            if (!conRotulo.test(m[1]!) && /^\d+$/.test(m[2]!) && n >= 1500 && n <= 2100) continue;
            out.push({ key, pages: m[2]! });
        }
        for (const m of text.matchAll(delante)) out.push({ key, pages: m[1]! });
    }
    return out;
}

/** Las citas que el revisor puede nombrar: las del análisis, las de la prosa y las de las notas. */
export function availableCitations(
    analysis: CanonicalVerseAnalysis | null,
    prose: string,
    notes: ReadonlyArray<Pick<ProseReviewNote, 'note' | 'citation'>>,
    keys: ReadonlyArray<string>,
): CitaNombrada[] {
    const out: CitaNombrada[] = [];
    if (analysis) {
        for (const c of collectAnalysisClaims(analysis)) {
            out.push({
                key: c.sourceKey,
                pages: c.pageEnd && c.pageEnd !== c.page ? `${c.page}–${c.pageEnd}` : String(c.page),
                ...(c.pageKind === 'sheet' ? { kind: 'sheet' as const } : {}),
            });
        }
        // Las que la sintaxis y las notas del análisis citan dentro del texto.
        for (const m of findInlineCitations(stringsOf(analysis).join('\n'), keys)) {
            if (m.pages) out.push(deLaForma(m));
        }
    }
    for (const m of findInlineCitations(prose, keys)) if (m.pages) out.push(deLaForma(m));
    // Una nota del estudiante nombra páginas a su modo («Robertson … en la p.
    // 961»): toda página de una nota vale para las fuentes que la nota nombra.
    for (const n of notes) {
        const texto = `${n.citation} ${n.note}`;
        const paginas = [...texto.matchAll(/\d+(?:\s*[–-]\s*\d+)?/g)].map(m => m[0]);
        for (const key of keys) {
            if (!new RegExp(String.raw`(?<![\p{L}])${escapar(key)}(?![\p{L}])`, 'iu').test(texto)) continue;
            for (const p of paginas) out.push({ key, pages: p });
        }
    }
    return out;
}

/**
 * Descarta la observación que nombra una cita que no está en ninguna parte:
 * el revisor no puede pedir una referencia que el trabajo no tiene (B40).
 */
export function withoutInventedCitations(
    findings: ReadonlyArray<ProseReviewerFinding>,
    available: ReadonlyArray<CitaNombrada>,
    keys: ReadonlyArray<string>,
): ProseReviewerFinding[] {
    const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    const existe = (c: CitaNombrada) => available.some(a =>
        (normal(a.key) === normal(c.key) || normal(a.key).startsWith(`${normal(c.key)} `)) && pagesOverlap(a.pages, c.pages));
    return findings.filter(f => citationsNamedIn(`${f.problem}\n${f.fix}`, keys).every(existe));
}

function deLaForma(m: { author: string; pages: string | null; raw: string }): CitaNombrada {
    return { key: m.author, pages: m.pages ?? '', ...(/(?<!\p{L})hojas?(?!\p{L})/iu.test(m.raw) ? { kind: 'sheet' as const } : {}) };
}

function stringsOf(x: unknown): string[] {
    if (typeof x === 'string') return [x];
    if (Array.isArray(x)) return x.flatMap(stringsOf);
    if (x && typeof x === 'object') return Object.values(x).flatMap(stringsOf);
    return [];
}
