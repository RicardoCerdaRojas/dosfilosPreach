/**
 * Las secciones de un sermón: los `##` del markdown, con su slug.
 *
 * VIVE EN EL DOMINIO (A7 de la fase Púlpito premium). Antes había dos copias a
 * mano —`packages/web/src/pages/sermons/preach.tsx` y
 * `packages/mobile/src/core/utils/sermonSections.ts`— con un comentario que
 * pedía mantenerlas iguales. Los slugs anclan las marcas de la tablet
 * (`sectionSlug, offset`, M-05) y la navegación por secciones de la web. La web
 * todavía guarda sus subrayados en el navegador (`useHighlights`); cuando lea
 * las marcas de Firestore (F2), estos slugs son el contrato que las cruza.
 */

export interface SermonSection {
    title: string;
    slug: string;
    /** Cuerpo markdown de la sección (sin el header). */
    body: string;
}

export function slugifyHeader(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
}

const HEADER_RE = /^##\s+(.+?)\s*$/;

/** Sólo títulos y slugs: la navegación por secciones de la web. */
export function extractSections(markdown: string): Array<Pick<SermonSection, 'title' | 'slug'>> {
    return extractSectionsWithBody(markdown)
        .filter((s) => s.title)
        .map(({ title, slug }) => ({ title, slug }));
}

/**
 * Secciones con cuerpo. El texto antes del primer `##` (si existe) entra como
 * sección sin título con slug 'preambulo'.
 */
export function extractSectionsWithBody(markdown: string): SermonSection[] {
    if (!markdown) return [];
    const lines = markdown.split('\n');
    const sections: SermonSection[] = [];
    const seenSlugs = new Set<string>();
    let current: SermonSection | null = null;
    let preamble: string[] = [];

    const pushCurrent = () => {
        if (current) {
            current.body = current.body.trim();
            sections.push(current);
        }
    };

    for (const line of lines) {
        const match = line.match(HEADER_RE);
        if (!match) {
            if (current) current.body += line + '\n';
            else preamble.push(line);
            continue;
        }
        const title = (match[1] ?? '').trim();
        if (!title) continue;
        // El texto antes del primer `##` es la sección `preambulo`: un título
        // que se llame «Preámbulo» no puede llevar el mismo slug, o las marcas
        // de las dos secciones chocan (revisión adversarial de A7).
        if (!current && preamble.join('').trim()) seenSlugs.add('preambulo');
        const slug = slugifyHeader(title);
        if (!slug) continue;
        let suffix = 1;
        let candidate = slug;
        while (seenSlugs.has(candidate)) {
            candidate = `${slug}-${++suffix}`;
        }
        seenSlugs.add(candidate);
        pushCurrent();
        current = { title, slug: candidate, body: '' };
    }
    pushCurrent();

    const pre = preamble.join('\n').trim();
    if (pre) {
        sections.unshift({ title: '', slug: 'preambulo', body: pre });
    }
    return sections;
}

/** Trozo de un párrafo: prosa o un marcador de cita `[N]` (o `[1, 3]`). */
export type InlineToken =
    | { kind: 'text'; text: string }
    | { kind: 'citation'; text: string; ordinals: number[] };

// MISMA regla que packages/web/src/lib/citationMarkers.tsx: el primer
// carácter dentro del corchete debe ser dígito, para no chocar con las
// referencias bíblicas ni con corchetes de prosa.
const CITATION_MARKER_RE = /\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g;

/** Parte un párrafo en prosa + marcadores de cita, preservando el orden. */
export function tokenizeCitations(paragraph: string): InlineToken[] {
    const tokens: InlineToken[] = [];
    let last = 0;
    for (const match of paragraph.matchAll(CITATION_MARKER_RE)) {
        const start = match.index ?? 0;
        if (start > last) tokens.push({ kind: 'text', text: paragraph.slice(last, start) });
        tokens.push({
            kind: 'citation',
            text: match[0],
            ordinals: (match[1] ?? '')
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isInteger(n) && n > 0),
        });
        last = start + match[0].length;
    }
    if (last < paragraph.length) tokens.push({ kind: 'text', text: paragraph.slice(last) });
    return tokens;
}
