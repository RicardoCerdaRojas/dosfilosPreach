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
    /** Para un título que comparten varias obras. */
    author?: RegExp;
}

/** La tabla de la guía, en su orden. */
const GUIDE: ReadonlyArray<GuideEntry> = [
    { abbreviation: 'BDAG', italic: false, kind: 'lexicon', title: /greek-english lexicon of the new testament/ },
    { abbreviation: 'BDB', italic: false, kind: 'lexicon', title: /hebrew and english lexicon of the old testament/ },
    { abbreviation: 'BDF', italic: false, kind: 'grammar', title: /greek grammar of the new testament/ },
    { abbreviation: 'BHRG', italic: true, kind: 'grammar', title: /biblical hebrew reference grammar/ },
    { abbreviation: 'GKC', italic: false, kind: 'grammar', title: /gesenius'? hebrew grammar/ },
    { abbreviation: 'HALOT', italic: true, kind: 'lexicon', title: /hebrew and aramaic lexicon of the old testament/ },
    { abbreviation: 'IBHS', italic: true, kind: 'grammar', title: /introduction to biblical hebrew syntax/ },
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
    const porTitulo = GUIDE.find(g => g.title.test(titulo) && (!g.author || g.author.test(autor)));
    if (escrita) {
        const deLaGuia = GUIDE.find(g => g.abbreviation.toLowerCase() === escrita.toLowerCase());
        return {
            abbreviation: deLaGuia?.abbreviation ?? escrita,
            italic: deLaGuia?.italic ?? false,
            kind: deLaGuia?.kind ?? porTitulo?.kind ?? null,
        };
    }
    return porTitulo ? { abbreviation: porTitulo.abbreviation, italic: porTitulo.italic, kind: porTitulo.kind } : null;
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
