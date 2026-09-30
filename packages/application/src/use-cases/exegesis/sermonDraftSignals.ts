import type { CitationManifest, SermonContent } from '@dosfilos/domain';
import { parseSermonCitations } from './sermonCitationParser';
import { verifyOne } from './VerifySermonCitationsUseCase';
import { buildDraftCorpus } from './verifyDraftCitations';

/**
 * Instrumentación de sombra del draft — CONTRATO COMÚN + COLECTOR DETERMINISTA.
 *
 * Dos colectores emiten la misma forma (`DraftShadowSignal[]`) al mismo recorder
 * (`recordSermonDraftShadow`), pero AISLADOS: el determinista (aquí) es barato,
 * confiable y corre siempre; el juez LLM (aparte) es caro, muestreado, y su caída
 * NUNCA afecta a este. Non-blocking, sin enforcement — solo mide.
 */

export interface DraftShadowSignal {
    /** Identificador de la señal, ej. 'authorityQuote.fabricated'. */
    key: string;
    /** Origen: determinista (barato/confiable) vs juez LLM (caro/probabilístico). */
    kind: 'deterministic' | 'judged';
    value: number | string | boolean;
    /** true = heurística con sesgo conocido (deuda), NO medición dura. */
    proxy?: boolean;
    /** Para señales del juez: yes | unclear | no (unclear → cola de revisión). */
    verdict?: 'yes' | 'unclear' | 'no';
}

interface VerseRange {
    ch: number;
    v1: number;
    v2: number;
}

/** Extrae refs "cap:verso[-verso]" de un texto (para la heurística de verso). */
function verseRefs(text: string): VerseRange[] {
    const out: VerseRange[] = [];
    const re = /\b(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push({ ch: Number(m[1]), v1: Number(m[2]), v2: m[3] ? Number(m[3]) : Number(m[2]) });
    }
    return out;
}

function rangesOverlap(a: VerseRange, b: VerseRange): boolean {
    if (a.ch !== b.ch) return false;
    return a.v1 <= b.v2 && b.v1 <= a.v2;
}

/**
 * Señales DETERMINISTAS del borrador. PURO (sin LLM, sin IO). Reusa el verificador
 * de citas existente. Mide sobre el draft que se le da (lo que llega al pastor).
 *
 * - `authorityQuote.total` / `.fabricated`: citas de autoridad que NO resuelven al
 *   manifest (probablemente inventadas). Determinista, confiable.
 * - `citation.total` / `.verseMismatch`: citas cuyo excerpt refiere versos que no
 *   solapan los del punto. **PROXY** (`proxy:true`): el chunk no tiene metadata de
 *   verso → se infiere del texto del excerpt. Sesgo conocido (ver deuda en byblos).
 */
export function computeDeterministicDraftSignals(
    draft: SermonContent,
    manifest: CitationManifest | undefined,
): DraftShadowSignal[] {
    const corpus = buildDraftCorpus(draft);
    const signals: DraftShadowSignal[] = [];

    // ── authorityQuote fabricada (determinista) ──────────────────────────
    let aqTotal = 0;
    let aqFabricated = 0;
    for (const b of draft.body ?? []) {
        if (!b.authorityQuote?.trim()) continue;
        aqTotal += 1;
        const cites = parseSermonCitations(b.authorityQuote);
        // Fabricada si no hay ninguna cita verificada contra el manifest (autor +
        // texto anclado). Sin parse (no nombra fuente) → tampoco verifica → fabricada.
        const verified = cites.some((c) => verifyOne(c, corpus).status === 'verified');
        if (!verified) aqFabricated += 1;
    }
    signals.push({ key: 'authorityQuote.total', kind: 'deterministic', value: aqTotal });
    signals.push({ key: 'authorityQuote.fabricated', kind: 'deterministic', value: aqFabricated });

    // ── cita-verso-equivocado (PROXY heurístico) ─────────────────────────
    const entries = manifest?.entries ?? [];
    let citTotal = 0;
    let verseMismatch = 0;
    for (const b of draft.body ?? []) {
        const pointRefs = verseRefs(b.point ?? '');
        const markers = [...(b.content ?? '').matchAll(/\[(\d+)\]/g)].map((mm) => Number(mm[1]));
        for (const n of markers) {
            const e = entries[n - 1];
            if (!e) continue;
            citTotal += 1;
            const exRefs = verseRefs(e.excerpt ?? '');
            // Solo cuenta como mismatch cuando AMBOS tienen refs completos y ninguno
            // solapa — conservador (no cuenta lo que no puede comparar). Under-cuenta
            // a propósito para no inflar con falsos positivos.
            if (pointRefs.length > 0 && exRefs.length > 0) {
                const overlaps = exRefs.some((er) => pointRefs.some((pr) => rangesOverlap(pr, er)));
                if (!overlaps) verseMismatch += 1;
            }
        }
    }
    signals.push({ key: 'citation.total', kind: 'deterministic', value: citTotal });
    signals.push({ key: 'citation.verseMismatch', kind: 'deterministic', value: verseMismatch, proxy: true });

    return signals;
}
