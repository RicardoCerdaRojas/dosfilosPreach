/**
 * Markdown chunker for LlamaParse structured output.
 *
 * LlamaParse produces Markdown with:
 *   - Page markers:  <!-- page: N -->
 *   - Headings:      # (h1), ## (h2), ### (h3)
 *   - Separators:    ---  (between pages)
 *   - Regular text, tables, lists
 *
 * This chunker splits into semantic chunks that respect structure while
 * staying within a target token size.
 */

export interface MarkdownChunk {
    text: string;
    page: number;             // Best-effort page (based on <!-- page: N --> markers)
    section: string | null;   // Deepest heading (e.g. "1.2 El aoristo ingresivo")
    sectionPath: string[];    // Full heading breadcrumb, h1 → h2 → h3
    chunkType: 'narrative' | 'table' | 'list' | 'heading-only';
    charStart: number;        // Position in the original markdown
    charEnd: number;
}

export interface ChunkerOptions {
    /** Target maximum characters per chunk (roughly tokens*4). Default 2000 (~500 tokens). */
    maxChars?: number;
    /** Minimum chunk size — smaller chunks get merged with neighbours. Default 200. */
    minChars?: number;
    /** Overlap between consecutive chunks. Default 150 chars. */
    overlapChars?: number;
}

const DEFAULT_MAX = 2000;
const DEFAULT_MIN = 200;
const DEFAULT_OVERLAP = 150;

/**
 * Chunk a LlamaParse-style structured Markdown document.
 * Returns chunks with page number, section breadcrumb, and chunk type metadata.
 */
export function chunkStructuredMarkdown(
    markdown: string,
    options: ChunkerOptions = {}
): MarkdownChunk[] {
    const maxChars = options.maxChars ?? DEFAULT_MAX;
    const minChars = options.minChars ?? DEFAULT_MIN;
    const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP;

    // Step 0: sin cercas de código ni etiquetas de tabla HTML (ver limpiarParaIndexar).
    // Step 1: extract page-blocks from the page markers
    const pageBlocks = splitByPageMarkers(limpiarParaIndexar(markdown));

    // Step 2: for each page, split by headings and track the heading hierarchy
    const rawChunks: MarkdownChunk[] = [];
    const headingStack: string[] = [];

    for (const block of pageBlocks) {
        const sections = splitBySections(block.content);

        for (const section of sections) {
            // Update the heading stack when we encounter a heading
            if (section.headingLevel !== null && section.headingText) {
                // Pop stack to proper depth, then push new heading.
                //
                // The depth is clamped to the stack's current length on
                // purpose. A document that SKIPS a heading level (`#` then
                // `###` with no `##` between — routine in LlamaParse output
                // of real commentaries) would otherwise grow the array by
                // assigning `.length`, which leaves a HOLE. The spread below
                // materialises that hole as `undefined`, and Firestore
                // rejects the entire chunk write with "Cannot use undefined
                // as a Firestore value (found in field
                // metadata.sectionPath.`1`)" — killing the whole indexing job.
                // Clamping collapses the skipped level instead, which also
                // reads better as a breadcrumb.
                headingStack.length = Math.min(section.headingLevel - 1, headingStack.length);
                headingStack.push(section.headingText);
            }

            const sectionPath = [...headingStack];
            const currentSection = sectionPath[sectionPath.length - 1] ?? null;

            // If the section body is small, keep it as one chunk
            if (section.body.length <= maxChars) {
                const text = quitarMarcasDeTitulo(section.body).trim();
                // Un texto corto sin título (el final de un párrafo que viene de
                // la página anterior, o el cuerpo de un título ilegible
                // descartado) se conserva: mergeTinyChunks lo junta con el
                // vecino. Antes se tiraba y ese texto no existía en el índice.
                if (text.length > 0) {
                    rawChunks.push({
                        text,
                        page: block.page,
                        section: currentSection,
                        sectionPath,
                        chunkType: detectChunkType(text),
                        charStart: section.charStart,
                        charEnd: section.charEnd,
                    });
                }
                continue;
            }

            // Body too big — split into character-based chunks with overlap
            const pieces = splitIntoOverlappingChunks(
                quitarMarcasDeTitulo(section.body),
                maxChars,
                overlapChars,
                section.charStart
            );
            for (const piece of pieces) {
                rawChunks.push({
                    text: piece.text.trim(),
                    page: block.page,
                    section: currentSection,
                    sectionPath,
                    chunkType: detectChunkType(piece.text),
                    charStart: piece.charStart,
                    charEnd: piece.charEnd,
                });
            }
        }
    }

    // Step 3: merge chunks smaller than minChars with their neighbours
    return mergeTinyChunks(rawChunks, minChars);
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface PageBlock { page: number; content: string; }

function splitByPageMarkers(md: string): PageBlock[] {
    const regex = /<!--\s*page:\s*(\d+)\s*-->/gi;
    const blocks: PageBlock[] = [];
    let lastIndex = 0;
    let currentPage = 1;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(md)) !== null) {
        if (match.index > lastIndex) {
            blocks.push({
                page: currentPage,
                content: md.substring(lastIndex, match.index),
            });
        }
        currentPage = parseInt(match[1], 10);
        lastIndex = match.index + match[0].length;
    }
    // Trailing content
    if (lastIndex < md.length) {
        blocks.push({
            page: currentPage,
            content: md.substring(lastIndex),
        });
    }

    // If no page markers found, treat whole doc as page 1
    if (blocks.length === 0) {
        blocks.push({ page: 1, content: md });
    }
    return blocks;
}

interface Section {
    headingLevel: number | null;  // 1, 2, 3, ... or null for body before first heading
    headingText: string | null;
    body: string;                  // Content under this heading (until next heading)
    charStart: number;
    charEnd: number;
}

function splitBySections(text: string): Section[] {
    const sections: Section[] = [];
    // Match headings on their own line
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: Array<{ level: number; text: string; index: number; length: number }> = [];

    let m: RegExpExecArray | null;
    while ((m = headingRegex.exec(text)) !== null) {
        // Una línea ilegible marcada como título (griego roto del OCR) no es
        // un título: queda en el cuerpo y no ensucia el breadcrumb.
        if (esTituloIlegible(m[2])) continue;
        headings.push({
            level: m[1].length,
            text: m[2].trim(),
            index: m.index,
            length: m[0].length,
        });
    }

    if (headings.length === 0) {
        // No headings → whole text is one section
        sections.push({
            headingLevel: null,
            headingText: null,
            body: text,
            charStart: 0,
            charEnd: text.length,
        });
        return sections;
    }

    // Content before first heading
    if (headings[0].index > 0) {
        sections.push({
            headingLevel: null,
            headingText: null,
            body: text.substring(0, headings[0].index),
            charStart: 0,
            charEnd: headings[0].index,
        });
    }

    // Each heading + its body (until next heading)
    for (let i = 0; i < headings.length; i++) {
        const h = headings[i];
        const bodyStart = h.index + h.length;
        const bodyEnd = i + 1 < headings.length ? headings[i + 1].index : text.length;
        sections.push({
            headingLevel: h.level,
            headingText: h.text,
            body: text.substring(bodyStart, bodyEnd),
            charStart: bodyStart,
            charEnd: bodyEnd,
        });
    }

    return sections;
}

/**
 * Un título que en realidad es una línea ilegible del OCR. En Mayor (LlamaParse
 * 3.0) los únicos 7 títulos eran griego roto («τ πνμ μν υ», «s ωσ», «25“.Oμοωs δ
 * καì 'Pααβ…») y quedaban como sección de cientos de fragmentos. Señales: una
 * palabra que mezcla letras griegas y latinas, muchas «palabras» de una sola
 * letra, o un largo que ningún título tiene.
 */
export function esTituloIlegible(titulo: string): boolean {
    const t = titulo.trim();
    // Un «título» de más de 150 caracteres es un párrafo marcado por error.
    if (t.length > 150) return true;
    const palabras = t.split(/\s+/).filter(Boolean);
    const griego = (p: string) => /[\u0370-\u03FF\u1F00-\u1FFF]/.test(p);
    // Mezcla de alfabetos DENTRO de una palabra («Oμοωs»); la puntuación separa
    // palabras («pointers—οὗτος» son dos, Wallace).
    const piezas = t.split(/[\s\u2010-\u2015\-.,;:()\[\]{}«»"“”'‘’*/\\|]+/).filter(Boolean);
    if (piezas.some(p => griego(p) && /[A-Za-z]/.test(p))) return true;
    // Letra suelta SOSPECHOSA: una sola letra, sin espíritu ni acento (el
    // artículo «ὁ», «ἡ» es legítimo) y que no sea una conjunción o artículo de
    // una letra («y», «o», «a», «e», «u»). Revisado contra los 17.511 títulos
    // de la biblioteca del fundador (2026-10-16).
    // Sólo latinas y griegas: una gramática de hebreo enumera letras sueltas
    // («Dagesh in ב ג ד כ פ ת») y es un título legítimo.
    const sospechosa = (p: string) => /^[A-Za-z\u0370-\u03FF\u1F00-\u1FFF]$/.test(p) && p.normalize('NFD').length === 1 && !/^[yoaeuYOAEUI]$/.test(p);
    const sueltas = palabras.filter(sospechosa);
    // Una letra latina MINÚSCULA suelta junto a griego («s ωσ», «… 'Pααβ n
    // πóρνn»); una mayúscula suele ser un rótulo («Section B λόγος»).
    if (palabras.some(griego) && sueltas.some(p => /^[a-z]$/.test(p))) return true;
    return palabras.length >= 3 && sueltas.length >= 2 && sueltas.length / palabras.length >= 0.3;
}

/**
 * Corta en trozos de hasta `maxChars` con `overlapChars` de solapamiento, sin
 * partir palabras: cada trozo termina en un límite (párrafo, oración o
 * espacio) y el siguiente EMPIEZA en un límite de palabra. Antes el comienzo
 * avanzaba un paso fijo y caía en medio de una palabra («imonio», «convicte»;
 * medido en la biblioteca del fundador, 2026-10-16).
 */
function splitIntoOverlappingChunks(
    text: string,
    maxChars: number,
    overlapChars: number,
    baseOffset: number
): Array<{ text: string; charStart: number; charEnd: number }> {
    const pieces: Array<{ text: string; charStart: number; charEnd: number }> = [];
    let start = 0;

    while (start < text.length) {
        let end = Math.min(start + maxChars, text.length);

        // Terminar en un límite (párrafo, oración, espacio) si no es el final.
        if (end < text.length) {
            const searchWindow = Math.floor(maxChars * 0.2);
            const boundaryRegions = [
                text.lastIndexOf('\n\n', end),
                text.lastIndexOf('. ', end) >= 0 ? text.lastIndexOf('. ', end) + 1 : -1,
                text.lastIndexOf(' ', end),
            ];
            const bestBoundary = Math.max(...boundaryRegions.filter(b => b > start + maxChars / 2));
            if (bestBoundary > 0 && (end - bestBoundary) <= searchWindow) {
                end = bestBoundary;
            }
        }

        pieces.push({
            text: text.substring(start, end),
            charStart: baseOffset + start,
            charEnd: baseOffset + end,
        });

        if (end >= text.length) break;

        // El siguiente empieza `overlapChars` antes, pero en el comienzo de
        // una palabra; y siempre avanza.
        let next = Math.max(start + 1, end - overlapChars);
        if (next > 0 && /\S/.test(text[next - 1]!) && /\S/.test(text[next] ?? '')) {
            const hastaEspacio = text.slice(next).search(/\s/);
            // Nunca más allá del final del trozo anterior: una «palabra» muy larga
            // (puntos guía, griego o hebreo sin espacios, una URL) dejaba texto
            // fuera de todo fragmento (revisión adversarial).
            next = hastaEspacio < 0 || next + hastaEspacio > end ? end : next + hastaEspacio;
        }
        while (next < text.length && /\s/.test(text[next]!)) next++;
        start = next > start ? next : end;
    }

    return pieces;
}

/** Los «#» de una línea de título que quedó en el cuerpo (un título ilegible descartado). */
function quitarMarcasDeTitulo(texto: string): string {
    return texto.replace(/^#{1,6}\s+/gm, '');
}

/**
 * El markdown listo para partir e indexar: sin las cercas de bloque de código
 * que dejó un lector («```python» envolvía todo Mayor: 968 fragmentos) y con
 * las tablas HTML pasadas a texto (celdas separadas, renglones por fila). El
 * contenido no se toca.
 */
export function limpiarParaIndexar(md: string): string {
    return md
        // Una línea que es sólo una cerca («```» o «```python»).
        .replace(/^\s*```[\w-]*\s*$/gm, '')
        // Una cerca dentro de la línea: sólo con una etiqueta de lenguaje
        // conocida, para no comerse la palabra pegada («```In the…»).
        .replace(/```(?:python|py|javascript|js|typescript|ts|json|text|txt|plaintext|markdown|md|html|xml|bash|sh|latex|tex)?(?![\w])/gi, ' ')
        // Sólo etiquetas de TABLA (minúsculas o mayúsculas): «<b>» y «<p>»
        // son notación de grafemas en las gramáticas y se dejan.
        .replace(/<\/(?:tr|thead|tbody|tfoot|table|caption)>/gi, '\n')
        .replace(/<\/(?:td|th)>/gi, ' | ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(?:table|thead|tbody|tfoot|tr|td|th|caption|colgroup|col)\b[^>]*>/gi, ' ')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n');
}

function detectChunkType(text: string): MarkdownChunk['chunkType'] {
    const trimmed = text.trim();
    if (/^#{1,6}\s/.test(trimmed) && trimmed.split('\n').length <= 2) return 'heading-only';
    if (/(\|.+\|[\s\S]*?){3,}/.test(trimmed)) return 'table';
    if (/^(?:[-*+]|\d+\.)\s+/m.test(trimmed) && /\n(?:[-*+]|\d+\.)\s+/.test(trimmed)) return 'list';
    return 'narrative';
}

function mergeTinyChunks(chunks: MarkdownChunk[], minChars: number): MarkdownChunk[] {
    if (chunks.length === 0) return chunks;

    const merged: MarkdownChunk[] = [];
    let buffer: MarkdownChunk | null = null;

    for (const chunk of chunks) {
        if (chunk.text.length < minChars && buffer !== null && sameSection(buffer, chunk)) {
            // Merge into buffer
            const prev: MarkdownChunk = buffer;
            buffer = {
                text: prev.text + '\n\n' + chunk.text,
                page: prev.page,
                section: prev.section,
                sectionPath: prev.sectionPath,
                chunkType: prev.chunkType,
                charStart: prev.charStart,
                charEnd: chunk.charEnd,
            };
            continue;
        }
        if (buffer !== null) merged.push(buffer);
        buffer = chunk;
    }
    if (buffer !== null) merged.push(buffer);

    return merged;
}

function sameSection(a: MarkdownChunk, b: MarkdownChunk): boolean {
    if (a.sectionPath.length !== b.sectionPath.length) return false;
    return a.sectionPath.every((s, i) => s === b.sectionPath[i]);
}
