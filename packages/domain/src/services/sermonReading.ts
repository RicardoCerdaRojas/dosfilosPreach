/**
 * Reading model of a sermon section — the renderable text plus, for every
 * character, where it came from in the raw markdown.
 *
 * WHY THE SOURCE MAP EXISTS. The pulpit reader strips markdown before
 * painting it (bold markers, internal anchors, `<br/>`), so a span the pastor
 * long-presses lives in *rendered* coordinates. Annotations, however, are
 * anchored in the RAW markdown body of the section (M-05: `(sectionSlug,
 * offset)`), because that is the only string both the tablet and the web can
 * derive identically from `sermon.content` — each platform renders it its own
 * way. Without the map the two coordinate systems silently disagree and the
 * highlight made on Saturday lands on the wrong words on Sunday.
 *
 * Consequence: normalization and highlighting are built HERE, together. A
 * renderer that strips markdown on its own — and then anchors against the
 * stripped text — is the drift this module exists to prevent.
 */

import { splitSentences } from './sentenceSegmentation';
import { findBibleReferences } from '../bible/referenceSpans';

/** Text plus `map[i]` = index in the original string of rendered char `i`. */
export interface SourceMappedText {
    text: string;
    map: number[];
}

/**
 * LA REGLA DEL FORMATO, una sola para todo el producto (2026-10-05).
 *
 * Lo que el pastor marca en el editor —negrita, cursiva, subrayado— se ve
 * igual en la web, el atril, el detalle del sermón y Word/PDF. El editor
 * guarda la negrita y la cursiva como markdown (`**`, `*`) y el subrayado
 * como HTML (`<u>…</u>`): la web lo mostraba, pero el atril quitaba el
 * énfasis (texto plano) y dejaba las etiquetas `<u>` escritas, y Word y PDF
 * también. Lo vio el fundador predicando Jonás.
 *
 * Valen igual `<b>`/`<strong>` y `<i>`/`<em>`, por si llegan pegados.
 */
export const INLINE_FORMAT_RULE = 'lo que se marca en el editor se ve igual en todas partes';

/** Un tramo con formato, en coordenadas del texto al que pertenece. */
export interface FormatSpan {
    start: number;
    end: number;
    bold?: true;
    italic?: true;
    underline?: true;
}

const BOLD = 1;
const ITALIC = 2;
const UNDERLINE = 4;

/** Los tramos con formato de un texto mapeado, según el formato de cada carácter de origen. */
function formatSpans(text: string, map: readonly number[], format: Uint8Array | undefined): FormatSpan[] {
    if (!format) return [];
    const spans: FormatSpan[] = [];
    let open: { start: number; flags: number } | null = null;
    const close = (end: number) => {
        if (!open) return;
        const span: FormatSpan = { start: open.start, end };
        if (open.flags & BOLD) span.bold = true;
        if (open.flags & ITALIC) span.italic = true;
        if (open.flags & UNDERLINE) span.underline = true;
        spans.push(span);
        open = null;
    };
    for (let i = 0; i < text.length; i += 1) {
        const flags = format[map[i] ?? -1] ?? 0;
        if (open && open.flags !== flags) close(i);
        if (!open && flags) open = { start: i, flags };
    }
    close(text.length);
    return spans;
}

/**
 * Parte un texto en tramos con su formato, para dibujarlo con estilos
 * anidados (el detalle del sermón en mobile).
 */
export function formatRuns(
    text: string,
    spans: readonly FormatSpan[] = [],
): { text: string; bold?: true; italic?: true; underline?: true }[] {
    const runs: { text: string; bold?: true; italic?: true; underline?: true }[] = [];
    let cursor = 0;
    for (const span of spans) {
        if (span.start > cursor) runs.push({ text: text.slice(cursor, span.start) });
        const { start, end, ...style } = span;
        runs.push({ text: text.slice(start, end), ...style });
        cursor = end;
    }
    if (cursor < text.length) runs.push({ text: text.slice(cursor) });
    return runs.filter((r) => r.text.length > 0);
}

/**
 * What a block IS, which decides how the pulpit treats it.
 *
 *  - `paragraph` / `subheading` / `listitem` — delivery material: the pastor
 *    says these out loud.
 *  - `quote` — a markdown blockquote. This is STUDY apparatus: the commentary
 *    excerpt he read on Tuesday, often in another language. On Sunday it must
 *    collapse to a mark he can open, not sit in the delivery flow taking a
 *    whole screen at delivery size.
 *
 * The split is structural, not a guess about content. Cross-reference lists
 * are study material too, but telling them apart from a delivery list needs
 * heuristics over heading names — that belongs upstream, in what the
 * generator writes into the delivery markdown, not in the reader.
 */
export type ReadingBlockKind = 'subheading' | 'paragraph' | 'listitem' | 'quote';

/** One long-pressable unit: a sentence, with its range in the raw body. */
export interface ReadingUnit {
    text: string;
    /** Half-open range `[sourceStart, sourceEnd)` in the raw section body. */
    sourceStart: number;
    sourceEnd: number;
    /**
     * Empieza un renglón nuevo: el pastor cortó la línea a mano dentro del
     * párrafo (Mayúsculas+Enter en el editor). Ver `LINE_BREAK_RULE`.
     */
    lineBreak?: boolean;
    /** Negrita, cursiva y subrayado, en coordenadas de `text` (`INLINE_FORMAT_RULE`). */
    marks?: FormatSpan[];
}

/**
 * LA REGLA DE LOS SALTOS DE LÍNEA, una sola para todo el producto.
 *
 * Un salto de línea que el pastor puso DENTRO de un párrafo se ve como salto,
 * en todas partes: la web, el atril y Word/PDF. Es lo que ya le muestra el
 * editor. El markdown estándar (CommonMark) dice lo contrario —un salto suelto
 * es un espacio— y el editor (MDXEditor) los guardaba así: los tres lectores
 * los convertían en espacio y el texto se pegaba («A nivel institucional Hace
 * muchos años…»). Lo vio el fundador el 2026-10-04.
 *
 * Valen igual el salto suelto (`\n`), el estándar (`\` + salto) y `<br>`.
 * Una línea en blanco sigue separando párrafos.
 */
export const LINE_BREAK_RULE = 'un salto dentro de un párrafo se ve como salto';

export interface ReadingBlock {
    kind: ReadingBlockKind;
    text: string;
    /** Sentences of a paragraph; a subheading is a single unit. */
    units: ReadingUnit[];
    /**
     * Una cita que empieza con una referencia bíblica: es la Escritura del
     * punto («Jonás 4:5-8 — 5 Y salió…»), que se lee en voz alta. El atril
     * muestra sus números de versículo discretos.
     */
    scripture?: boolean;
    /** Negrita, cursiva y subrayado, en coordenadas de `text` (`INLINE_FORMAT_RULE`). */
    marks?: FormatSpan[];
}

/** ¿El texto empieza con una referencia bíblica (salvo comillas o un guion)? */
function startsWithReference(text: string): boolean {
    const first = findBibleReferences(text)[0];
    return !!first && /^[\s"'“”«»*_—–(-]*$/.test(text.slice(0, first.start));
}

/**
 * A markdown construct to erase or unwrap. `emit` returns the text that
 * survives and where inside the match it came from, or `null` to drop the
 * match entirely. `offsetInMatch: -1` marks synthetic text (no source of its
 * own) — it inherits the offset of the match start.
 */
interface RewriteRule {
    re: RegExp;
    emit: (match: RegExpExecArray) => { text: string; offsetInMatch: number } | null;
    /** El formato que da a lo que deja (negrita, cursiva, subrayado). */
    format?: number;
}

/** Entidades HTML que deja el editor web (`&#x20;` es un espacio final). */
const NAMED_ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
export function decodeEntity(entity: string): string | null {
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    if (named !== undefined) return named;
    const code = /^#x([0-9a-f]+)$/i.test(entity)
        ? parseInt(entity.slice(2), 16)
        : /^#(\d+)$/.test(entity)
          ? parseInt(entity.slice(1), 10)
          : NaN;
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return null;
    // Un espacio duro se lee como espacio: en el atril tiene que poder cortar renglón.
    return code === 0xa0 ? ' ' : String.fromCodePoint(code);
}

/** Lo que el markdown escapa con barra invertida: se lee el carácter, no la barra. */
const ESCAPABLE = /\\([\\`*_{}\[\]()#+\-.!>|~])/g;

/**
 * Same set the pulpit reader used to apply as a chain of `.replace()` calls —
 * now offset-preserving. Order matters: links are unwrapped before emphasis
 * so `[**x**](#a)` collapses cleanly.
 */
const RULES: RewriteRule[] = [
    // Las etiquetas de formato del editor (`INLINE_FORMAT_RULE`), ANTES que
    // las entidades: un `&lt;u&gt;` escrito a propósito es texto, no formato.
    { re: /<u>([\s\S]*?)<\/u>/gi, format: UNDERLINE, emit: (m) => ({ text: m[1] ?? '', offsetInMatch: 3 }) },
    {
        re: /<(b|strong)>([\s\S]*?)<\/\1>/gi,
        format: BOLD,
        emit: (m) => ({ text: m[2] ?? '', offsetInMatch: (m[1] ?? '').length + 2 }),
    },
    {
        re: /<(i|em)>([\s\S]*?)<\/\1>/gi,
        format: ITALIC,
        emit: (m) => ({ text: m[2] ?? '', offsetInMatch: (m[1] ?? '').length + 2 }),
    },
    // Una etiqueta de formato sin pareja no se lee.
    { re: /<\/?(?:u|b|strong|i|em)>/gi, emit: () => null },
    // Antes que todo: una entidad puede esconder un carácter que otra regla mira.
    {
        re: /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
        emit: (m) => {
            const text = decodeEntity(m[1] ?? '');
            return text === null ? { text: m[0], offsetInMatch: 0 } : { text, offsetInMatch: -1 };
        },
    },
    { re: /<br\s*\/?>/gi, emit: () => ({ text: '\n', offsetInMatch: -1 }) },
    // Separadores sueltos: `---`, `***`, `* * *`, `___`, o un asterisco solo
    // en su renglón (salía como párrafo «*» al final de una página).
    { re: /^[ \t]*(?:[*_-][ \t]*)+$/gm, emit: () => null },
    // El salto de línea estándar (`\` al final del renglón): la barra no se
    // lee. ANTES que los escapes: si no, `\\` (una barra escrita a propósito)
    // quedaba como `\` y esta regla se la comía (revisión adversarial). Se
    // lleva sólo la ÚLTIMA barra: `\\` + salto deja la barra escrita.
    { re: /\\(?=\r?\n)/g, emit: () => null },
    { re: /\{#[^}]+\}/g, emit: () => null },
    { re: /\[([^\]]+)\]\(#[^)]*\)/g, emit: (m) => ({ text: m[1] ?? '', offsetInMatch: 1 }) },
    // Un asterisco escapado (`\\*`) no abre ni cierra énfasis.
    // El énfasis puede cruzar un salto de renglón (no un párrafo): `**uno↵dos**`.
    {
        re: /(?<!\\)\*\*((?:(?!\n\n)[\s\S])*?[^\\])\*\*/g,
        format: BOLD,
        emit: (m) => ({ text: m[1] ?? '', offsetInMatch: 2 }),
    },
    // El abridor de énfasis no puede ir seguido de espacio: si no, un
    // marcador de lista `* punto` abre énfasis y se come hasta el próximo
    // asterisco, fundiendo dos viñetas en una.
    {
        re: /(?<!\\)\*(\S(?:(?:(?!\n\n)[\s\S])*?[^\s\\])?)\*/g,
        format: ITALIC,
        emit: (m) => ({ text: m[1] ?? '', offsetInMatch: 1 }),
    },
    // Al final, después del énfasis: `\*` no abre ni cierra nada.
    { re: ESCAPABLE, emit: (m) => ({ text: m[1] ?? '', offsetInMatch: 1 }) },
];

/** El texto plano de un fragmento de markdown, con entidades y escapes resueltos. */
export function decodeMarkdownText(text: string): string {
    return text
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => decodeEntity(entity) ?? whole)
        .replace(ESCAPABLE, '$1');
}

function identity(text: string): SourceMappedText {
    const map = new Array<number>(text.length);
    for (let i = 0; i < text.length; i += 1) map[i] = i;
    return { text, map };
}

function applyRule(src: SourceMappedText, rule: RewriteRule, format?: Uint8Array): SourceMappedText {
    const re = new RegExp(rule.re.source, rule.re.flags);
    const out: string[] = [];
    const map: number[] = [];
    let last = 0;
    let match: RegExpExecArray | null;

    const copy = (from: number, to: number) => {
        for (let i = from; i < to; i += 1) {
            out.push(src.text[i]!);
            map.push(src.map[i]!);
        }
    };

    re.lastIndex = 0;
    while ((match = re.exec(src.text)) !== null) {
        if (match[0].length === 0) {
            re.lastIndex += 1;
            continue;
        }
        copy(last, match.index);
        const emitted = rule.emit(match);
        if (emitted) {
            const base = emitted.offsetInMatch >= 0 ? match.index + emitted.offsetInMatch : -1;
            for (let k = 0; k < emitted.text.length; k += 1) {
                out.push(emitted.text[k]!);
                // Lo que queda adentro de un énfasis o una etiqueta lleva su
                // formato, anotado en la posición de ORIGEN: sobrevive a las
                // reglas que siguen, que conservan el mapa.
                if (rule.format && format && base >= 0) {
                    const origin = src.map[base + k];
                    if (origin !== undefined) format[origin] = (format[origin] ?? 0) | rule.format;
                }
                // Fuera del texto original no hay a dónde mapear: se ancla al
                // comienzo del match, que es de donde salió lo emitido.
                map.push(
                    (base >= 0 ? src.map[base + k] : src.map[match.index]) ??
                        src.map[match.index] ??
                        0,
                );
            }
        }
        last = match.index + match[0].length;
    }
    copy(last, src.text.length);
    return { text: out.join(''), map };
}

/** Strip markdown for display while remembering every character's origin. */
export function normalizeSectionBody(body: string): SourceMappedText {
    return normalizeWithFormat(body).mapped;
}

/** Lo mismo, y además el formato de cada posición del ORIGEN (`INLINE_FORMAT_RULE`). */
function normalizeWithFormat(body: string): { mapped: SourceMappedText; format: Uint8Array } {
    const source = body ?? '';
    const format = new Uint8Array(source.length);
    let mapped = identity(source);
    for (const rule of RULES) mapped = applyRule(mapped, rule, format);
    return { mapped, format };
}

function sliceMapped(src: SourceMappedText, start: number, end: number): SourceMappedText {
    return { text: src.text.slice(start, end), map: src.map.slice(start, end) };
}

/** Join lines with a single synthetic space, keeping the map aligned. */
function joinLines(src: SourceMappedText, lines: { start: number; end: number }[]): SourceMappedText {
    const out: string[] = [];
    const map: number[] = [];
    lines.forEach((line, index) => {
        if (index > 0) {
            out.push(' ');
            // The space stands in for the newline that used to be here.
            map.push(src.map[line.start] ?? src.map[src.map.length - 1] ?? 0);
        }
        for (let i = line.start; i < line.end; i += 1) {
            out.push(src.text[i]!);
            map.push(src.map[i]!);
        }
    });
    return { text: out.join(''), map };
}

function toUnits(src: SourceMappedText, format?: Uint8Array): ReadingUnit[] {
    return splitSentences(src.text).map((span) => {
        // Un span siempre cae dentro del texto mapeado; el cero es el ancla
        // honesta para el caso imposible en vez de una aserción.
        const start = src.map[span.start] ?? 0;
        const unit: ReadingUnit = {
            text: span.text,
            sourceStart: start,
            // `end` is exclusive: the last mapped char plus one.
            sourceEnd: (src.map[span.end - 1] ?? start) + 1,
        };
        const marks = formatSpans(span.text, src.map.slice(span.start, span.end), format);
        return marks.length ? { ...unit, marks } : unit;
    });
}

const SUBHEADING_RE = /^#{3,}\s+(.+?)\s*$/;
/** Cita de bloque markdown: `>` con o sin espacio. */
const QUOTE_RE = /^>\s?/;
/** Viñeta o numeral. El asterisco exige espacio, para no chocar con énfasis. */
const LIST_RE = /^(?:[-•+]\s+|\*\s+|\d+[.)]\s+)/;

/**
 * Turn the raw markdown body of one section into renderable blocks whose
 * units carry raw-body offsets.
 *
 * `##` headers are the section cut itself (see `extractSectionsWithBody`), so
 * only `###` and deeper appear here, as subheadings.
 *
 * Blockquote and list markers are consumed HERE. Left in the text they reach
 * the pulpit as literal `>` and `-` characters in the middle of the sermon,
 * and consecutive quoted lines collapse into one run-on line.
 */
export function buildReadingBlocks(body: string): ReadingBlock[] {
    const { mapped: normalized, format } = normalizeWithFormat(body);
    if (!normalized.text.trim()) return [];

    const blocks: ReadingBlock[] = [];

    // Chunks are separated by blank lines, as in the markdown source.
    const chunkBounds: { start: number; end: number }[] = [];
    const separator = /\n{2,}/g;
    let cursor = 0;
    let sep: RegExpExecArray | null;
    while ((sep = separator.exec(normalized.text)) !== null) {
        chunkBounds.push({ start: cursor, end: sep.index });
        cursor = sep.index + sep[0].length;
    }
    chunkBounds.push({ start: cursor, end: normalized.text.length });

    // Cada renglón se parte en oraciones por separado: un salto a mano corta
    // también la unidad (una etiqueta como «A nivel institucional», sin punto,
    // no se funde con la oración que sigue). Ver LINE_BREAK_RULE.
    const push = (kind: ReadingBlockKind, lines: { start: number; end: number }[]) => {
        const units: ReadingUnit[] = [];
        const texts: string[] = [];
        const marks: FormatSpan[] = [];
        let offset = 0;
        for (const line of lines) {
            const mapped = trimMapped(joinLines(normalized, [line]));
            if (!mapped.text) continue;
            const lineUnits = toUnits(mapped, format);
            if (units.length && lineUnits[0]) lineUnits[0] = { ...lineUnits[0], lineBreak: true };
            units.push(...lineUnits);
            if (texts.length) offset += 1; // el '\n' que une los renglones
            for (const span of formatSpans(mapped.text, mapped.map, format)) {
                marks.push({ ...span, start: span.start + offset, end: span.end + offset });
            }
            texts.push(mapped.text);
            offset += mapped.text.length;
        }
        if (!units.length) return;
        const text = texts.join('\n');
        const block: ReadingBlock = kind === 'quote' && startsWithReference(text) ? { kind, text, units, scripture: true } : { kind, text, units };
        blocks.push(marks.length ? { ...block, marks } : block);
    };

    for (const chunk of chunkBounds) {
        if (chunk.end <= chunk.start) continue;

        // Un chunk mezcla subtítulos, prosa, citas y viñetas. Se acumula por
        // tipo y se descarga al cambiar, para que nunca se fundan entre sí.
        let mode: ReadingBlockKind | null = null;
        let buffer: { start: number; end: number }[] = [];
        const flush = () => {
            if (mode) push(mode, buffer);
            mode = null;
            buffer = [];
        };

        let lineStart = chunk.start;
        for (let i = chunk.start; i <= chunk.end; i += 1) {
            if (i !== chunk.end && normalized.text[i] !== '\n') continue;

            // Trim in NORMALIZED coordinates so the joined block never carries
            // a line's leading indentation into the map.
            let ls = lineStart;
            let le = i;
            while (ls < le && /\s/.test(normalized.text[ls] ?? '')) ls += 1;
            while (le > ls && /\s/.test(normalized.text[le - 1] ?? '')) le -= 1;
            lineStart = i + 1;

            const text = normalized.text.slice(ls, le);
            if (!text) continue;

            const heading = text.match(SUBHEADING_RE);
            if (heading) {
                flush();
                // El grupo 1 existe si la regex casó — pero eso lo sabe la
                // regex, no el compilador.
                const title = heading[1] ?? '';
                const offset = text.indexOf(title);
                push('subheading', [{ start: ls + offset, end: ls + offset + title.length }]);
                continue;
            }

            const quote = text.match(QUOTE_RE);
            if (quote) {
                if (mode !== 'quote') flush();
                mode = 'quote';
                // Una línea `>` sola es separador dentro de la cita, no texto.
                if (le > ls + quote[0].length) buffer.push({ start: ls + quote[0].length, end: le });
                continue;
            }

            const bullet = text.match(LIST_RE);
            if (bullet) {
                flush();
                mode = 'listitem';
                buffer.push({ start: ls + bullet[0].length, end: le });
                continue;
            }

            // Una línea suelta tras una viñeta es su continuación envuelta.
            if (mode !== 'listitem') {
                if (mode !== 'paragraph') flush();
                mode = 'paragraph';
            }
            buffer.push({ start: ls, end: le });
        }
        flush();
    }

    return blocks;
}

function trimMapped(src: SourceMappedText): SourceMappedText {
    let start = 0;
    let end = src.text.length;
    while (start < end && /\s/.test(src.text[start] ?? '')) start += 1;
    while (end > start && /\s/.test(src.text[end - 1] ?? '')) end -= 1;
    return sliceMapped(src, start, end);
}
