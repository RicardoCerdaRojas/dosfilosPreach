import type { SourceType } from '../entities/SourceType';
import type { ExtractedBibliographyEntry } from '../ports/ICourseBibliographyExtractor';

/**
 * Lectores de RIS y BibTeX, con reglas fijas (etapa 2b): lo que exportan
 * ATLA, New Testament Abstracts, Zotero o EndNote entra sin el asistente y
 * sin costo. Es la puerta a las bases de la disciplina, que el sistema no
 * puede consultar directo (acceso institucional).
 */

const POR_TIPO_RIS: Record<string, SourceType> = {
    JOUR: 'journal-article', JFULL: 'journal-article', MGZN: 'journal-article', EJOUR: 'journal-article',
    BOOK: 'theological-monograph', EBOOK: 'theological-monograph', EDBOOK: 'theological-monograph',
    CHAP: 'theological-monograph', ECHAP: 'theological-monograph', THES: 'theological-monograph',
    DICT: 'theological-dictionary', ENCYC: 'theological-dictionary',
};

const POR_TIPO_BIB: Record<string, SourceType> = {
    article: 'journal-article', book: 'theological-monograph', incollection: 'theological-monograph',
    inbook: 'theological-monograph', phdthesis: 'theological-monograph', mastersthesis: 'theological-monograph',
};

/** Cuántas páginas hay entre «210» y «215» (6). Sin fin, o al revés, no se sabe. */
function paginas(inicio?: string | null, fin?: string | null): number | null {
    const a = parseInt(inicio ?? '', 10);
    const b = parseInt(fin ?? '', 10);
    return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a + 1 : null;
}

function año(v?: string | null): number | null {
    const m = /\b(1[5-9]\d\d|20\d\d)\b/.exec(v ?? '');
    return m ? Number(m[1]) : null;
}

/** RIS: un registro por bloque «TY - … ER -». */
export function parseRis(text: string): ExtractedBibliographyEntry[] {
    const out: ExtractedBibliographyEntry[] = [];
    let actual: Record<string, string[]> | null = null;
    const cerrar = () => {
        if (!actual) return;
        const v = (k: string) => actual![k]?.[0]?.trim() || null;
        const title = v('TI') ?? v('T1') ?? v('CT');
        if (title) {
            const autores = [...(actual.AU ?? []), ...(actual.A1 ?? [])].map(a => a.trim()).filter(Boolean);
            const tipo = POR_TIPO_RIS[(v('TY') ?? '').toUpperCase()];
            const serie = v('T2') ?? v('JO') ?? v('JF') ?? v('T3');
            const sp = v('SP');
            const ep = v('EP') ?? (sp?.includes('-') ? sp.split('-')[1]! : null);
            out.push({
                title,
                author: autores.length ? autores.join(' y ') : null,
                series: [serie, v('VL')].filter(Boolean).join(' ') || null,
                year: año(v('PY') ?? v('Y1') ?? v('DA')),
                publisher: v('PB'),
                requirement: 'recommended',
                sourceType: tipo ?? null,
                note: null,
                pageCount: paginas(sp?.split('-')[0], ep),
                doi: v('DO'),
                isbn: v('SN'),
            });
        }
        actual = null;
    };
    for (const linea of text.split(/\r?\n/)) {
        const m = /^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/.exec(linea);
        if (!m) continue;
        const [, k, valor] = m;
        if (k === 'TY') { cerrar(); actual = {}; }
        if (k === 'ER') { cerrar(); continue; }
        if (actual) (actual[k!] ??= []).push(valor!);
    }
    cerrar();
    return out;
}

/** BibTeX: «@tipo{clave, campo = {valor}, …}». Llaves y comillas; sin macros. */
export function parseBibtex(text: string): ExtractedBibliographyEntry[] {
    const out: ExtractedBibliographyEntry[] = [];
    // La clave no lleva llaves ni espacios: si no, «@comment{…}» se tragaba el registro siguiente.
    const re = /@(\w+)\s*\{\s*([^,{}\s]*),/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const tipo = m[1]!.toLowerCase();
        if (tipo === 'comment' || tipo === 'string' || tipo === 'preamble') continue;
        // El cuerpo llega hasta la llave que cierra el registro.
        let nivel = 1, i = re.lastIndex;
        for (; i < text.length && nivel > 0; i++) {
            if (text[i] === '{') nivel++;
            else if (text[i] === '}') nivel--;
        }
        const cuerpo = text.slice(re.lastIndex, i - 1);
        re.lastIndex = i;
        const campos: Record<string, string> = {};
        const campo = /(\w+)\s*=\s*(\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))/g;
        let c: RegExpExecArray | null;
        while ((c = campo.exec(cuerpo))) campos[c[1]!.toLowerCase()] = (c[3] ?? c[4] ?? c[5] ?? '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
        if (!campos.title) continue;
        const [sp, ep] = (campos.pages ?? '').split(/-+|–/);
        out.push({
            title: campos.title,
            author: campos.author ? campos.author.split(/\s+and\s+/i).join(' y ') : null,
            series: [campos.journal ?? campos.booktitle ?? campos.series, campos.volume].filter(Boolean).join(' ') || null,
            year: año(campos.year),
            publisher: campos.publisher ?? null,
            requirement: 'recommended',
            sourceType: POR_TIPO_BIB[tipo] ?? null,
            note: null,
            pageCount: paginas(sp, ep),
            doi: campos.doi ?? null,
            isbn: campos.isbn ?? null,
        });
    }
    return out;
}

/** Qué formato tiene un archivo, por su extensión o su contenido. */
export function bibliographyFileFormat(name: string, text: string): 'ris' | 'bibtex' | null {
    if (/\.ris$/i.test(name) || /^TY\s{2}-/m.test(text)) return 'ris';
    if (/\.bib(tex)?$/i.test(name) || /@\w+\s*\{/.test(text)) return 'bibtex';
    return null;
}
