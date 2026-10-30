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
}

export interface SavedWordIbidReview {
    /** `false` si el archivo no trae las páginas: no lo guardó Word. */
    paginated: boolean;
    pages: number;
    notes: number;
    findings: SavedWordIbidFinding[];
}

const IBID = /^\s*ib[ií]d(?:em)?\b/i;

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
    llamadas.forEach((llamada, i) => {
        const texto = textos.get(llamada.id) ?? '';
        const esIbid = IBID.test(texto);
        if (esIbid && i > 0 && llamadas[i - 1]!.page !== llamada.page) {
            findings.push({ note: i + 1, page: llamada.page, text: texto, previousNote: i, workNote: obra });
        }
        if (!esIbid) obra = texto;
    });
    return { paginated: saltos > 0 || llamadas.length === 0, pages: pagina, notes: llamadas.length, findings };
}

/**
 * La forma abreviada que reemplaza al «Ibid.»: la obra de `workNote`,
 * reconocida por su título en las fichas, con la página del «Ibid.» o, si es
 * «Ibid.» solo, la de la nota de la obra. `null` si la obra no se reconoce.
 */
export function shortFormForIbid(
    finding: Pick<SavedWordIbidFinding, 'text' | 'workNote'>,
    fichas: ReadonlyArray<BibliographicData>,
): string | null {
    const nota = finding.workNote.toLowerCase();
    const ficha = fichas.find(f => {
        const titulos = [f.shortTitle, f.title].map(t => (t ?? '').trim().toLowerCase()).filter(t => t.length >= 4);
        return titulos.some(t => nota.includes(t));
    });
    if (!ficha) return null;
    const pagina = finding.text.match(/^\s*ib[ií]d(?:em)?\.?,\s*([^.]+?)\.?\s*$/i)?.[1]
        ?? finding.workNote.match(/,\s*([\d–:-][\d–:,\s-]*)\.?\s*$/)?.[1]?.trim();
    return `${formatShortNote(ficha, pagina)}.`;
}
