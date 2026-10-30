import { formatShortNote, type BibliographicData } from './bibliography';

/**
 * El «Ibid.» que abre página, leído del Word guardado por Word (fase
 * «Lecciones del TI #2», etapa 2.3; B65).
 *
 * La guía de TMS (hoja 22): «Evite el uso de "Ibid." si su nota al pie cae
 * en una página nueva». Es lo único de la revisión que no se puede saber
 * antes de exportar: las páginas las arma Word al abrir. Pero el archivo que
 * Word guarda trae `<w:lastRenderedPageBreak/>` donde partió cada página, y
 * contándolos en orden se sabe la página de cada llamada de nota. Medido
 * sobre el Word del TI #2: las 34 notas caen en la misma página que en su
 * PDF.
 *
 * Funciones puras sobre el texto del XML: el lector del .docx vive en la web.
 */
export interface SavedWordIbidFinding {
    /** El número de la nota, como lo ve el lector (orden de las llamadas). */
    note: number;
    page: number;
    /** El texto de la nota con «Ibid.». */
    text: string;
    /** El número de la nota anterior, la que «Ibid.» repite. */
    previousNote: number;
    /** El texto de la última nota que nombra la obra, de la que sale la forma abreviada. */
    workNote: string;
    /**
     * La página que citó la nota anterior: la que repite un «Ibid.» solo. En
     * una cadena «565» → «Ibid., 566.» → «Ibid.», es 566.
     */
    previousPage: string | null;
}

export interface SavedWordIbidReview {
    /** `false` si el archivo no trae las páginas: no lo guardó Word. */
    paginated: boolean;
    pages: number;
    notes: number;
    findings: SavedWordIbidFinding[];
}

/**
 * «Ibid.», «Ibíd.», «Ibídem» e «Idem»: los rótulos que puede fijar la guía
 * (`IbidRules.label`), y que el exportador escribe.
 */
const IBID = /^\s*(?:ib[ií]d(?:em)?|[ií]dem)\b/i;

/** La página de una nota: lo que va después de la última coma, sin el punto final. */
function paginaDe(nota: string): string | null {
    const ibid = nota.match(/^\s*(?:ib[ií]d(?:em)?|[ií]dem)\.?,\s*(.+?)\.?\s*$/i);
    if (ibid) return ibid[1]!.trim();
    if (IBID.test(nota)) return null;
    return nota.match(/,\s*([^,]+?)\.?\s*$/)?.[1]?.trim() ?? null;
}

/** El texto de cada nota por su id, sin los separadores de Word. */
function footnoteTexts(footnotesXml: string): Map<string, string> {
    const out = new Map<string, string>();
    for (const m of footnotesXml.matchAll(/<w:footnote\b([^>]*)>([\s\S]*?)<\/w:footnote>/g)) {
        if (/w:type="/.test(m[1]!)) continue;
        const id = m[1]!.match(/w:id="(-?\d+)"/)?.[1];
        if (!id) continue;
        out.set(id, [...m[2]!.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(t => decodeXml(t[1]!)).join('').trim());
    }
    return out;
}

function decodeXml(text: string): string {
    return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export function reviewSavedWordIbid(documentXml: string, footnotesXml: string): SavedWordIbidReview {
    const textos = footnoteTexts(footnotesXml);
    let pagina = 1;
    let saltos = 0;
    const llamadas: Array<{ id: string; page: number }> = [];
    for (const m of documentXml.matchAll(/<w:lastRenderedPageBreak\/>|<w:footnoteReference\b[^>]*w:id="(\d+)"/g)) {
        if (m[1] === undefined) { pagina++; saltos++; } else llamadas.push({ id: m[1], page: pagina });
    }
    const findings: SavedWordIbidFinding[] = [];
    let obra = '';
    let paginaAnterior: string | null = null;
    llamadas.forEach((llamada, i) => {
        const texto = textos.get(llamada.id) ?? '';
        const esIbid = IBID.test(texto);
        if (esIbid && i > 0 && llamadas[i - 1]!.page !== llamada.page) {
            findings.push({ note: i + 1, page: llamada.page, text: texto, previousNote: i, workNote: obra, previousPage: paginaAnterior });
        }
        if (!esIbid) obra = texto;
        // Un «Ibid.» solo repite la página anterior: no la cambia.
        paginaAnterior = paginaDe(texto) ?? paginaAnterior;
    });
    return { paginated: saltos > 0 || llamadas.length === 0, pages: pagina, notes: llamadas.length, findings };
}

/**
 * La forma abreviada que reemplaza al «Ibid.»: la obra de `workNote`,
 * reconocida por su título en las fichas, con la página del «Ibid.» o, si es
 * «Ibid.» solo, la de la nota de la obra. `null` si la obra no se reconoce.
 */
export function shortFormForIbid(
    finding: Pick<SavedWordIbidFinding, 'text' | 'workNote' | 'previousPage'>,
    fichas: ReadonlyArray<BibliographicData>,
): string | null {
    const nota = finding.workNote.toLowerCase();
    // La ficha que mejor explica la nota: la del título más largo que aparece
    // en ella, y antes la que además nombra a su autor. Un título corto
    // («Psalms») de otra obra no gana (revisión adversarial).
    const puntaje = (f: BibliographicData): number => {
        const titulos = [f.shortTitle, f.title].map(t => (t ?? '').trim().toLowerCase()).filter(t => t.length >= 4 && nota.includes(t));
        if (titulos.length === 0) return 0;
        const apellido = ((f.authorSorted ?? '').split(',')[0] || (f.author ?? '').trim().split(/\s+/).pop() || '').trim().toLowerCase();
        return Math.max(...titulos.map(t => t.length)) + (apellido && nota.includes(apellido) ? 1000 : 0);
    };
    const ficha = [...fichas].sort((a, b) => puntaje(b) - puntaje(a))[0];
    if (!ficha || puntaje(ficha) === 0) return null;
    const pagina = paginaDe(finding.text) ?? finding.previousPage ?? undefined;
    return `${formatShortNote(ficha, pagina)}.`;
}
