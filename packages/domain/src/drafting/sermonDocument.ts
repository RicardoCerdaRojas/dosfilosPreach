import { decodeEntity } from '../services/sermonReading';
/**
 * El sermón como DOCUMENTO: lo que el Word y el PDF dibujan.
 *
 * Los dos exportadores leían el markdown cada uno a su manera y ninguno lo
 * entendía: el Word dejaba `<br />`, `>` y `*` literales, y el PDF además
 * imprimía `**Puntos:**` y adivinaba los títulos por el largo de la línea
 * (sermón 6 de Jonás, 2026-10-03). Un solo modelo, leído una vez, para que
 * los dos digan lo mismo.
 *
 * Cubre lo que el sermón trae de verdad (medido en el publicado): títulos
 * `##`/`###`, viñetas `*`/`-`, listas `1.`, citas en bloque `>`, negrita y
 * cursiva en línea, `<br />` y escapes de markdown. `<br>` es un salto de
 * línea, como lo lee la vista previa (`SermonPreview`): dos seguidos separan
 * párrafos, uno solo dentro de un párrafo junta sus líneas con un espacio.
 */

export interface InlineRun {
    text: string;
    bold?: boolean;
    italic?: boolean;
    /**
     * Un salto de línea dentro del párrafo (`LINE_BREAK_RULE`): el pastor
     * cortó la línea a mano. Va con `text` vacío.
     */
    lineBreak?: boolean;
}

export type SermonBlock =
    | { kind: 'heading'; level: 1 | 2 | 3; runs: InlineRun[] }
    | { kind: 'paragraph'; runs: InlineRun[] }
    /** `start`: el número del primer ítem de una lista numerada (una lista cortada por un párrafo sigue en 2). */
    | { kind: 'list'; ordered: boolean; start: number; items: InlineRun[][] }
    | { kind: 'quote'; paragraphs: InlineRun[][] };

/** `<br>` en cualquiera de sus formas: un salto de línea, nunca texto. */
const BR = /<br\s*\/?>/gi;

/**
 * Quita los escapes de markdown (`\[`, `\*`, …) y resuelve las entidades.
 * Antes sólo `&nbsp;` y `&amp;`: el `&#x20;` que deja el editor al final de
 * un renglón salía literal en el Word y el PDF, igual que en el atril.
 */
function unescape(text: string): string {
    return text
        .replace(/\\([\\`*_{}[\]()#+\-.!>|])/g, '$1')
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => decodeEntity(entity) ?? whole);
}

/**
 * Negrita y cursiva en línea. `**a**`, `__a__`, `*a*`, `_a_`; un asterisco
 * suelto queda como texto. Los espacios se conservan tal cual.
 */
export function parseInline(text: string): InlineRun[] {
    // El párrafo ENTERO, con sus saltos, y recién después se parte en
    // renglones: así una negrita que cruza un salto sigue siendo negrita
    // (revisión adversarial). Es la regla de los saltos de línea
    // (`LINE_BREAK_RULE`), la misma del atril y la web. La barra del salto
    // estándar (la ÚLTIMA barra antes del salto) no se lee; una barra escrita
    // a propósito (`\\`) sí, y la del final del párrafo también.
    const normalizado = text.replace(BR, '\n').replace(/\\(\r?\n)/g, '$1').replace(/\r\n/g, '\n');
    const runs: InlineRun[] = [];
    for (const run of parseInlineLine(normalizado)) {
        // Un salto ya resuelto adentro de una negrita queda como está.
        if (run.lineBreak) {
            runs.push(run);
            continue;
        }
        run.text.split('\n').forEach((parte, i) => {
            if (i > 0) runs.push({ text: '', lineBreak: true });
            if (parte) runs.push({ ...run, text: parte });
        });
    }
    // Un salto al principio o al final del párrafo no es un renglón.
    while (runs[0]?.lineBreak) runs.shift();
    while (runs[runs.length - 1]?.lineBreak) runs.pop();
    return runs;
}

function parseInlineLine(fuente: string): InlineRun[] {
    const runs: InlineRun[] = [];
    // `***a***` (negrita y cursiva) primero: si no, la rama de negrita deja
    // asteriscos sueltos.
    const re = /(\*\*\*|___)(?=\S)([\s\S]+?)(?<=\S)\1|(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\3|(?<![*\w])([*_])(?=\S)([^*_]+?)(?<=\S)\5(?![*\w])/g;
    let ultimo = 0;
    for (const m of fuente.matchAll(re)) {
        const i = m.index ?? 0;
        if (i > ultimo) runs.push({ text: unescape(fuente.slice(ultimo, i)) });
        if (m[1]) {
            for (const r of parseInline(m[2]!)) runs.push({ ...r, bold: true, italic: true });
        } else if (m[3]) {
            // La negrita puede llevar cursiva adentro.
            for (const r of parseInline(m[4]!)) runs.push({ ...r, bold: true });
        } else {
            runs.push({ text: unescape(m[6]!), italic: true });
        }
        ultimo = i + m[0].length;
    }
    if (ultimo < fuente.length) runs.push({ text: unescape(fuente.slice(ultimo)) });
    return mergeRuns(runs.filter(r => r.lineBreak || r.text.length > 0));
}

function mergeRuns(runs: InlineRun[]): InlineRun[] {
    const out: InlineRun[] = [];
    for (const r of runs) {
        const prev = out[out.length - 1];
        // Un salto nunca se funde con el texto de al lado.
        if (prev && !prev.lineBreak && !r.lineBreak && !!prev.bold === !!r.bold && !!prev.italic === !!r.italic) prev.text += r.text;
        else out.push({ ...r });
    }
    return out;
}

/** El texto plano de unos runs (para medir, buscar o probar). */
export function runsText(runs: ReadonlyArray<InlineRun>): string {
    return runs.map(r => (r.lineBreak ? '\n' : r.text)).join('');
}

export function parseSermonDocument(markdown: string): SermonBlock[] {
    const lineas = (markdown ?? '').replace(/\r\n?/g, '\n').replace(BR, '\n').split('\n');
    // Los títulos se nivelan respecto del menor del documento: el Taller
    // escribe `##`/`###` y los sermones viejos `#`/`##`, y los dos deben
    // quedar como nivel 1 y 2.
    const profundidades = lineas.map(l => l.trim().match(/^(#{1,6})\s/)?.[1]!.length).filter((n): n is number => !!n);
    const minimo = profundidades.length > 0 ? Math.min(...profundidades) : 1;
    const bloques: SermonBlock[] = [];
    let parrafo: string[] = [];
    let lista: { ordered: boolean; start: number; items: string[] } | null = null;
    let cita: string[][] | null = null;

    const cerrarParrafo = () => {
        // Los renglones del párrafo se conservan (LINE_BREAK_RULE).
        const t = parrafo.join('\n').trim();
        if (t) bloques.push({ kind: 'paragraph', runs: parseInline(t) });
        parrafo = [];
    };
    const cerrarLista = () => {
        if (lista && lista.items.length > 0) {
            bloques.push({ kind: 'list', ordered: lista.ordered, start: lista.start, items: lista.items.map(i => parseInline(i)) });
        }
        lista = null;
    };
    const cerrarCita = () => {
        if (cita) {
            const ps = cita.map(p => p.join('\n').trim()).filter(Boolean).map(p => parseInline(p));
            if (ps.length > 0) bloques.push({ kind: 'quote', paragraphs: ps });
        }
        cita = null;
    };
    const cerrarTodo = () => { cerrarParrafo(); cerrarLista(); cerrarCita(); };

    for (const cruda of lineas) {
        const linea = cruda.trimEnd();
        const t = linea.trim();

        if (!t) {
            // Una línea en blanco cierra el párrafo. En una cita abre otro
            // párrafo de la misma cita (si la línea siguiente sigue con `>`);
            // una lista sigue si la próxima línea es otro ítem.
            cerrarParrafo();
            if (cita) cita.push([]);
            continue;
        }
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { cerrarTodo(); continue; }

        const h = t.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            cerrarTodo();
            const nivel = Math.min(3, Math.max(1, h[1]!.length - minimo + 1)) as 1 | 2 | 3;
            bloques.push({ kind: 'heading', level: nivel, runs: parseInline(h[2]!.replace(/\s*#+\s*$/, '')) });
            continue;
        }

        const q = t.match(/^>\s?(.*)$/);
        if (q) {
            cerrarParrafo(); cerrarLista();
            if (!cita) cita = [[]];
            const dentro = q[1]!.trim();
            if (dentro) cita[cita.length - 1]!.push(dentro);
            else cita.push([]);
            continue;
        }
        if (cita) {
            // Continuación perezosa: una línea sin `>` justo después de la
            // cita sigue en ella (así llega «> **Jonás 4:6**<br/>6 Y preparó…»).
            const actual = cita[cita.length - 1]!;
            if (actual.length > 0) { actual.push(t); continue; }
            cerrarCita();
        }

        const v = t.match(/^[*\-+]\s+(.*)$/);
        const n = t.match(/^\d+[.)]\s+(.*)$/);
        if (v || n) {
            cerrarParrafo();
            const ordered = !!n;
            if (lista && lista.ordered !== ordered) cerrarLista();
            if (!lista) {
                // Una numerada respeta su número: cortada por un párrafo, la
                // siguiente sigue donde iba y no vuelve a «1.».
                const numero = n ? Number(t.match(/^(\d+)/)![1]) : 1;
                lista = { ordered, start: numero, items: [] };
            }
            lista.items.push((v ?? n)![1]!);
            continue;
        }
        if (lista) {
            // Continuación con sangría de un ítem; si no, la lista terminó.
            if (/^\s{2,}\S/.test(linea)) {
                lista.items[lista.items.length - 1] += `\n${t}`;
                continue;
            }
            cerrarLista();
        }
        parrafo.push(t);
    }
    cerrarTodo();
    return bloques;
}

export interface SermonBibliographyEntry {
    title: string;
    author?: string;
    page?: string;
    usedFor?: string;
}

/**
 * «Fuentes consultadas», numeradas como las marcas `[N]` de la prosa. El
 * manifiesto manda cuando existe; si no, la bibliografía vieja. Vivía copiada
 * en el Word y en el PDF.
 */
export function sermonBibliographyEntries(
    manifest: { entries: ReadonlyArray<{ sourceId: string; title: string; author?: string; page?: string }> } | undefined,
    bibliography: ReadonlyArray<{ sourceId?: string; title: string; author?: string; page?: string; usedFor?: string }> | undefined,
): SermonBibliographyEntry[] {
    if (manifest && manifest.entries.length > 0) {
        const porId = new Map((bibliography ?? []).filter(b => b.sourceId).map(b => [b.sourceId!, b]));
        return manifest.entries.map(e => {
            const rag = porId.get(e.sourceId);
            return {
                title: rag?.title || e.title,
                author: rag?.author || e.author,
                page: rag?.page || e.page,
                usedFor: rag?.usedFor,
            };
        });
    }
    return (bibliography ?? [])
        .filter(s => s?.title?.trim())
        .map(s => ({ title: s.title, author: s.author, page: s.page, usedFor: s.usedFor }));
}
