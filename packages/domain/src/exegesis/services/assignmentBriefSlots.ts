import { getBookById, type BibleBookId } from '../../bible/canon/BibleCanon';
import { parsePassageReference, type PassageReference } from '../../bible/canon/passage-reference';

/**
 * Los huecos del encargo de un tipo de trabajo, y el pasaje que quedó fijo.
 *
 * El encargo del «TP Semanal» se escribe una vez y vale para todas las
 * entregas. En el TP #9 (Santiago 4:11-17) traía fijo el pasaje del primer
 * TP y el hueco [FUENTES DE LA SEMANA ANTERIOR] tal cual: el fundador tuvo
 * que reescribir las dos cosas a mano (B5, B4). Lo que cambia por entrega
 * es un hueco que se llena al crear el trabajo:
 *
 *   [PASAJE]                          → «Santiago 4:11-17»
 *   [FUENTES DE LA SEMANA ANTERIOR]   → «Adamson, Mayor y Metzger»
 *
 * Un hueco sin dato queda escrito, a la vista, para que el estudiante lo
 * complete: inventar un valor sería redactar el encargo por él.
 */

export type BriefSlot = 'passage' | 'previousSources';

/** Cómo se escribe cada hueco. Sin mayúsculas ni acentos que cuenten. */
const HUECOS: Record<BriefSlot, RegExp> = {
    passage: /\[\s*(?:pasaje|passage)\s*\]/giu,
    previousSources: /\[\s*(?:fuentes\s+de\s+la\s+semana\s+anterior|fuentes\s+del\s+trabajo\s+anterior|fuentes\s+de\s+la\s+entrega\s+anterior|previous\s+(?:week\s+)?sources)\s*\]/giu,
};

/** El hueco del pasaje, tal como se escribe en una plantilla. */
export const BRIEF_PASSAGE_SLOT: Record<'es' | 'en', string> = { es: '[PASAJE]', en: '[PASSAGE]' };

export interface BriefSlotValues {
    /** El pasaje del trabajo, ya escrito («Santiago 4:11-17»). */
    passage: string | null;
    /**
     * Las fuentes que no se pueden repetir de la entrega anterior del mismo
     * tipo. `null`: no hay entrega anterior; `[]`: la hubo y nada de lo que
     * citó queda prohibido.
     */
    previousSources: ReadonlyArray<string> | null;
    language: 'es' | 'en';
}

export interface FilledBrief {
    text: string;
    /** Los huecos que se llenaron. */
    filled: BriefSlot[];
    /** Los que estaban y quedaron escritos por falta de dato. */
    pending: BriefSlot[];
}

/** «Adamson, Mayor y Metzger». */
export function joinSourceKeys(keys: ReadonlyArray<string>, language: 'es' | 'en'): string {
    const k = keys.map(x => x.trim()).filter(Boolean);
    if (k.length <= 1) return k[0] ?? '';
    return `${k.slice(0, -1).join(', ')} ${language === 'en' ? 'and' : 'y'} ${k[k.length - 1]}`;
}

export function hasBriefSlot(body: string, slot: BriefSlot): boolean {
    HUECOS[slot].lastIndex = 0;
    return HUECOS[slot].test(body);
}

/** Llena los huecos que tienen dato; los demás quedan escritos. */
export function fillBriefSlots(body: string, values: BriefSlotValues): FilledBrief {
    const filled: BriefSlot[] = [];
    const pending: BriefSlot[] = [];
    let text = body;
    const valor: Record<BriefSlot, string | null> = {
        passage: values.passage?.trim() || null,
        previousSources: values.previousSources && values.previousSources.length > 0
            ? joinSourceKeys(values.previousSources, values.language)
            : null,
    };
    for (const slot of ['passage', 'previousSources'] as const) {
        if (!hasBriefSlot(text, slot)) continue;
        const v = valor[slot];
        if (v === null) { pending.push(slot); continue; }
        text = text.replace(HUECOS[slot], v);
        filled.push(slot);
    }
    return { text, filled, pending };
}

/** Un pasaje nombrado en el encargo, con dónde está. */
export interface BriefPassageMention {
    start: number;
    end: number;
    text: string;
    ref: PassageReference;
}

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Los pasajes del libro `bookId` nombrados en el encargo («Santiago
 * 4:1-10», «Stg. 4:12»). Se busca con los nombres del canon de tres letras
 * o más, sin acentos ni mayúsculas.
 */
export function passagesNamedInBrief(body: string, bookId: BibleBookId): BriefPassageMention[] {
    const book = getBookById(bookId);
    if (!book || !body) return [];
    const texto = body.normalize('NFC');
    // Mismo largo que `texto`: los acentos de un texto NFC son un carácter.
    const plano = quitarAcentos(texto).toLowerCase();
    if (plano.length !== texto.length) return [];
    const nombres = [...new Set([book.nameEs, book.nameEn, ...book.aliases].map(n => quitarAcentos(n).toLowerCase().trim()))]
        .filter(n => n.length >= 3)
        .sort((a, b) => b.length - a.length);
    if (nombres.length === 0) return [];
    const re = new RegExp(
        `(?<![\\p{L}\\d])(${nombres.map(escapar).join('|')})\\.?\\s+(\\d+(?:[:.]\\d+)?(?:\\s*[-–—]\\s*\\d+(?:[:.]\\d+)?)?)(?![\\d:])`,
        'gu',
    );
    const out: BriefPassageMention[] = [];
    for (const m of plano.matchAll(re)) {
        // «1 Juan 4:7», «II Corintios», «Primera de Juan»: es OTRO libro. Sin
        // esto, en un TP de Juan 3:16-21 «1 Juan 4:7-12» se leía Juan 4:7-12.
        if (OTRO_LIBRO_NUMERADO.test(plano.slice(Math.max(0, m.index! - 24), m.index!))) continue;
        const cola = m[2]!.replace(/\s*[–—]\s*/g, '-').replace(/\s*-\s*/g, '-');
        const r = parsePassageReference(`${book.nameEn} ${cola}`);
        if (!r.ok || r.ref.bookId !== bookId) continue;
        const start = m.index!;
        const end = start + m[0].length;
        out.push({ start, end, text: texto.slice(start, end), ref: r.ref });
    }
    return out;
}

/** Lo que precede al nombre de un libro numerado («1 », «II », «primera de »). */
const OTRO_LIBRO_NUMERADO = /(?:^|[^\p{L}\d])(?:[1-3]|i{1,3}|primera|segunda|tercera|primer|first|second|third)\.?(?:\s+(?:de|of))?\s*$/u;

/** Si dos referencias son el mismo pasaje. */
export function samePassage(a: PassageReference, b: PassageReference): boolean {
    return mismo(a, b);
}

const mismo = (a: PassageReference, b: PassageReference) =>
    a.bookId === b.bookId && a.chapterStart === b.chapterStart && a.chapterEnd === b.chapterEnd
    && a.verseStart === b.verseStart && a.verseEnd === b.verseEnd;

/** Versículo como número comparable (capítulo, versículo). Sin versículo: el capítulo entero. */
const desde = (r: PassageReference) => r.chapterStart * 1000 + (r.verseStart ?? 0);
const hasta = (r: PassageReference) => r.chapterEnd * 1000 + (r.verseEnd ?? 999);

/**
 * Los pasajes del encargo que PODRÍAN haber quedado fijos de otra entrega:
 * rangos de versículos del mismo libro distintos del pasaje y no contenidos
 * en él. «Stg. 4:12» dentro de una pregunta del TP de 4:11-17 no cuenta, ni
 * un capítulo entero («en el contexto de Santiago 4»); «sobre Santiago
 * 4:1-10», heredado del TP anterior, sí (B5). Es una lista de candidatos:
 * «a la luz de Santiago 1:19-21» también es un rango legítimo, y por eso
 * el estudiante elige cuáles reemplazar (revisión de B5).
 */
export function stalePassagesInBrief(body: string, passage: PassageReference): BriefPassageMention[] {
    return passagesNamedInBrief(body, passage.bookId).filter(m => {
        if (mismo(m.ref, passage)) return false;
        if (m.ref.verseStart === null) return false;
        const esRango = m.ref.chapterStart !== m.ref.chapterEnd || m.ref.verseStart !== m.ref.verseEnd;
        if (!esRango) return false;
        const dentro = desde(m.ref) >= desde(passage) && hasta(m.ref) <= hasta(passage);
        return !dentro;
    });
}

/** Reemplaza las menciones por un texto (el pasaje de este trabajo o el hueco). */
export function replaceBriefPassages(body: string, mentions: ReadonlyArray<BriefPassageMention>, replacement: string): string {
    const texto = body.normalize('NFC');
    let out = '';
    let i = 0;
    for (const m of [...mentions].sort((a, b) => a.start - b.start)) {
        if (m.start < i) continue;
        out += texto.slice(i, m.start) + replacement;
        i = m.end;
    }
    return out + texto.slice(i);
}
