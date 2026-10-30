import type { SourceType } from '../entities/SourceType';
import type { BibliographicData } from './bibliography';

/**
 * Léxicos y gramáticas de referencia en las notas, como pide la guía de TMS
 * (2024–2025, «Léxicos y gramáticas», y nota 31).
 *
 * La primera nota va completa. Las siguientes usan la abreviatura:
 * - léxico: la entrada entre comillas, la abreviatura y el tomo y página:
 *   «כָּבוֹד», *HALOT*, 2:457;
 * - gramática: la sección sin coma —GKC §18— o la página con coma.
 * Las abreviaturas de un TÍTULO van en cursiva (*IBHS*, *HALOT*, *BHRG*) y
 * las de los AUTORES no (BDAG, BDB, BDF, GKC, Joüon): medido en el PDF de la
 * guía, hojas 50–53.
 *
 * Y la nota 31: «artículos de revistas, capítulos citados, entradas de
 * diccionario y léxicos» no usan «Ibid.», sino su forma abreviada.
 */
export type ReferenceKind = 'lexicon' | 'grammar';

export interface ReferenceAbbreviation {
    abbreviation: string;
    italic: boolean;
    kind: ReferenceKind | null;
}

interface GuideEntry {
    abbreviation: string;
    italic: boolean;
    kind: ReferenceKind;
    /** El título de la guía, sin artículo y normalizado. */
    title: RegExp;
    /**
     * El autor o editor: varias obras comparten título —Louw–Nida y Thayer
     * también son «Greek-English Lexicon of the New Testament»; Holladay,
     * «A Concise Hebrew and Aramaic Lexicon…»— y sin él se confunden.
     */
    author: RegExp;
}

/** La tabla de la guía, en su orden: título y autor de cada obra. */
const GUIDE: ReadonlyArray<GuideEntry> = [
    { abbreviation: 'BDAG', italic: false, kind: 'lexicon', title: /greek-english lexicon of the new testament/, author: /bauer|danker|arndt|gingrich/ },
    { abbreviation: 'BDB', italic: false, kind: 'lexicon', title: /hebrew and english lexicon of the old testament/, author: /brown|driver|briggs/ },
    { abbreviation: 'BDF', italic: false, kind: 'grammar', title: /greek grammar of the new testament/, author: /blass|debrunner|funk/ },
    { abbreviation: 'BHRG', italic: true, kind: 'grammar', title: /biblical hebrew reference grammar/, author: /merwe|naud[eé]|kroeze/ },
    { abbreviation: 'GKC', italic: false, kind: 'grammar', title: /gesenius(?:'s?)? hebrew grammar/, author: /gesenius|kautzsch|cowley/ },
    { abbreviation: 'HALOT', italic: true, kind: 'lexicon', title: /hebrew and aramaic lexicon of the old testament/, author: /k[oö]e?hler|baumgartner|stamm/ },
    { abbreviation: 'IBHS', italic: true, kind: 'grammar', title: /introduction to biblical hebrew syntax/, author: /waltke|o'connor/ },
    { abbreviation: 'Joüon', italic: false, kind: 'grammar', title: /grammar of biblical hebrew/, author: /jo[uü]on|muraoka/ },
];

function normalizado(text: string): string {
    return text.normalize('NFC').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
}

/**
 * La abreviatura de una obra de referencia: la escrita en la ficha o, si no
 * hay, la de la guía reconocida por el título. `null` si no es una de ellas.
 */
export function referenceAbbreviationOf(data: BibliographicData): ReferenceAbbreviation | null {
    const escrita = data.abbreviation?.trim();
    const titulo = normalizado([data.title, data.subtitle].filter(Boolean).join(' '));
    const autor = normalizado(data.author ?? '');
    const porTitulo = GUIDE.find(g => g.title.test(titulo) && g.author.test(autor));
    if (escrita) {
        // Escrita entre asteriscos, va en cursiva: las abreviaturas de un
        // título (*TWOT*, *NIDOTTE*) lo van y las de autor no, y fuera de la
        // tabla de la guía solo quien la escribe sabe cuál es.
        const enCursiva = /^\*[^*]+\*$/.test(escrita);
        const limpia = enCursiva ? escrita.slice(1, -1).trim() : escrita;
        const deLaGuia = GUIDE.find(g => g.abbreviation.toLowerCase() === limpia.toLowerCase());
        return {
            abbreviation: deLaGuia?.abbreviation ?? limpia,
            italic: deLaGuia?.italic ?? enCursiva,
            kind: deLaGuia?.kind ?? porTitulo?.kind ?? null,
        };
    }
    return porTitulo ? { abbreviation: porTitulo.abbreviation, italic: porTitulo.italic, kind: porTitulo.kind } : null;
}

/**
 * La entrada de un léxico, cuando la cita la dice con «s.v.»: «(BDAG, s.v.
 * σοφία)». El título entre comillas de una cita NO es la entrada: en la
 * tubería real es el nombre de la obra (`displayLabel`), y tomarlo por
 * entrada imprimía «"Brown-Driver-Briggs Hebrew Lexicon", BDB, 945».
 */
export function lexiconEntryOf(rawCitation: string): string | null {
    const m = rawCitation.match(/s\.\s?v\.\s*["“«]?([^,;)"”»]+)/i);
    return m?.[1]?.trim() || null;
}

/** Léxico o gramática según el tipo de fuente del corpus. */
export function referenceKindOfSourceType(type: SourceType | null | undefined): ReferenceKind | null {
    if (type === 'lexicon-technical' || type === 'theological-dictionary') return 'lexicon';
    if (type === 'grammar-syntax') return 'grammar';
    return null;
}

/** Nota 31: estas obras no usan «Ibid.», sino su forma abreviada. */
export function sourceTypeWithoutIbid(type: SourceType | null | undefined): boolean {
    return type === 'lexicon-technical' || type === 'theological-dictionary' || type === 'journal-article';
}

/**
 * La nota siguiente de un léxico o una gramática de referencia.
 * `entry` es la palabra del léxico, cuando la cita la trae.
 */
export function formatReferenceShortNote(
    ref: Pick<ReferenceAbbreviation, 'abbreviation' | 'italic'>,
    kind: ReferenceKind,
    entry: string | null,
    pages: string | null,
): string {
    const abreviatura = ref.italic ? `*${ref.abbreviation}*` : ref.abbreviation;
    const pagina = (pages ?? '').trim().replace(/^(?:pp?\.|págs?\.)\s*/i, '');
    if (kind === 'lexicon') {
        return [entry?.trim() ? `«${entry.trim()}»` : null, abreviatura, pagina || null].filter(Boolean).join(', ');
    }
    // «No debe usarse una coma junto con el símbolo de la sección (§).»
    if (!pagina) return abreviatura;
    return pagina.startsWith('§') ? `${abreviatura} ${pagina}` : `${abreviatura}, ${pagina}`;
}
