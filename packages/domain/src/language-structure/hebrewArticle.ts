/**
 * El artículo hebreo y el rol de la palabra en su oración (U4, revisión del
 * profesor 2026-11, Rut 3:6 הַגֹּרֶן).
 *
 * 1. ANTECEDENTE DEL ARTÍCULO. Un sustantivo común con artículo cuyo mismo
 *    sustantivo (lema y número) ya apareció poco antes. Es un DATO, no una
 *    regla: el artículo PUEDE retomarlo (anafórico, Putnam §1.4.3), y lo decide
 *    quien lee. Medido a mano sobre el AT (2026-11-12): con el antecedente en el
 *    mismo versículo acierta 18 de 25; a uno, 20 de 24; a dos, 22 de 24; a tres,
 *    15 de 24. Los fallos son de sentido (otro referente con la misma palabra,
 *    uso genérico, título en aposición) y no se filtran con forma: por eso no se
 *    rotula «Regla». Rut 3:6 está a tres versículos de 3:3.
 *
 *    Se descartan, por forma: arameo (su estado enfático no es el artículo);
 *    únicos (tierra, cielos, Dios, mar, sol, luna); tiempo («hoy», «esta noche»,
 *    «el primero del mes»: demostrativo); כֹּל; direcciones; un ordinal, «otro»
 *    o «último» detrás (es OTRO de la serie, como en griego, 1 Co 15:47); el
 *    distributivo «הָאַמָּה מִזֶּה וְהָאַמָּה מִזֶּה»; y el título tras un nombre
 *    propio («עַדְנָה הַשָּׂר», 2 Cr 17:14-15).
 *
 * 2. EL ROL DE MACULA CONTRA LO QUE DIJO EL ASISTENTE. En Rut 3:6 el análisis
 *    viejo decía «objeto directo» y MACULA da «adv» (complemento adverbial de
 *    meta: «descendió a la era», Putnam §2.4.2a). Medido sobre 19 análisis del
 *    prompt actual: 0 choques. Sirve para lo guardado con prompts anteriores.
 */
import { verseWords, type ChapterStructure, type StructureWord } from './chapterStructure.js';

export interface HebrewArticleFact {
    /** Posición de la palabra con artículo entre las del versículo. */
    readonly ordinal: number;
    /** Dónde apareció antes el mismo sustantivo. */
    readonly antecedent: { readonly text: string; readonly verse: number };
    /** El antecedente está en el mismo versículo. */
    readonly sameVerse: boolean;
}

/** Hasta cuántos versículos atrás se busca (dentro del capítulo). */
const VENTANA = 5;
const lema = (l: string) => l.split('/').pop()!.trim();
const conArticulo = (w: StructureWord) => (w.parts ?? []).some(p => p.m === 'Td' || /^Rd/.test(p.m));
/** El sustantivo común de la palabra (su código OSHB sin prefijo). */
const nucleo = (w: StructureWord) => (w.parts ?? []).map(p => p.m).find(m => /^Nc/.test(m));
const numero = (m: string) => m[3];
const versiculo = (w: StructureWord) => Number(w.r.split('!')[0]);
const limpio = (t: string) => t.normalize('NFC').replace(/[֑-ֽ֯׀׃]/g, '');

const EXCLUIDOS: ReadonlySet<string> = new Set([
    '776', '8064', '430', '3220', '8121', '3394', // tierra, cielos, Dios, mar, sol, luna
    '3117', '3915', '1242', '6153', '6256', '8141', '2320', // día, noche, mañana, tarde, tiempo, año, mes
    '3605', // כֹּל
    '4217', '6828', '5045', '1864', '4628', // oriente, norte, neguev, sur, occidente
]);
/** Primero…décimo, «último», «otro». */
const OTRO_DE_LA_SERIE: ReadonlySet<string> = new Set(['7223', '8145', '7992', '7243', '2549', '8345', '7637', '8066', '8671', '6224', '314', '312']);

export function hebrewArticleAntecedents(ch: ChapterStructure, verse: number): HebrewArticleFact[] {
    if (ch.lang !== 'he') return [];
    const previas: StructureWord[] = [];
    for (let v = Math.max(1, verse - VENTANA); v < verse; v++) previas.push(...verseWords(ch, v));
    const ws = verseWords(ch, verse);
    const out: HebrewArticleFact[] = [];
    ws.forEach((w, i) => {
        const m = nucleo(w);
        if (!w.m?.startsWith('H') || !conArticulo(w) || !m || EXCLUIDOS.has(lema(w.l))) return;
        const sig = ws[i + 1], prev = ws[i - 1];
        if (sig && OTRO_DE_LA_SERIE.has(lema(sig.l))) return;
        if (sig && lema(sig.l) === '2088' && sig.l.split('/').includes('m')) return;
        if (prev && (prev.parts ?? []).some(p => /^Np/.test(p.m))) return;
        const mismo = (x: StructureWord) => lema(x.l) === lema(w.l) && numero(nucleo(x) ?? '') === numero(m);
        const ante = [...previas, ...ws.slice(0, i)].reverse().find(mismo);
        if (!ante) return;
        out.push({ ordinal: i, antecedent: { text: limpio(ante.t), verse: versiculo(ante) }, sameVerse: versiculo(ante) === verse });
    });
    return out;
}

/** Lo que el texto del asistente dice de la función, en grueso. */
function claseDe(fn: string): 'objeto' | 'sujeto' | 'adverbial' | undefined {
    const t = fn.toLowerCase();
    if (/objeto directo/.test(t)) return 'objeto';
    if (/^\s*sujeto\b/.test(t)) return 'sujeto';
    if (/complemento (circunstancial|adverbial)|acusativo (de lugar|adverbial|de direcci)/.test(t)) return 'adverbial';
    return undefined;
}

/**
 * ¿El texto del asistente contradice el rol de MACULA? Sólo los choques claros:
 * un complemento adverbial llamado «objeto directo» (Rut 3:6), un objeto
 * llamado «sujeto» y al revés. Lo demás (texto libre, roles vecinos) no se juzga.
 */
export function hebrewRoleConflict(role: string | undefined, syntacticFunction: string | undefined): boolean {
    if (!role || !syntacticFunction) return false;
    const c = claseDe(syntacticFunction);
    if (role === 'adv') return c === 'objeto' || c === 'sujeto';
    if (role === 'o' || role === 'o2') return c === 'sujeto' || c === 'adverbial';
    if (role === 's') return c === 'objeto' || c === 'adverbial';
    return false;
}

/** Los roles de MACULA que la ficha nombra (los demás no dicen nada nuevo: verbo, frase preposicional). */
export const HEBREW_ROLES_SHOWN: ReadonlySet<string> = new Set(['s', 'o', 'o2', 'adv', 'p']);
