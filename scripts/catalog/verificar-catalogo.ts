/**
 * Verifica el catálogo curado de recomendaciones contra bases abiertas
 * (Open Library, Crossref y la BNE), sin claves.
 *
 * Uso: npx tsx scripts/catalog/verificar-catalogo.ts JAS JON RUT 2PE NEH [--todas]
 *
 * Por cada obra de esos libros (propias del libro y del grupo que las
 * cubre) dice si se encontró un registro que coincida en TÍTULO (≥ 0,8 de
 * las palabras del título más corto), APELLIDO del primer autor y AÑO
 * (± 2, o una de las ediciones del registro). El puntaje de la base no se
 * usa: medido el 2026-10-23, Crossref le dio 31,0 a una obra inventada y
 * 31,2 a Moo (docs/FASE_BUSCAR_LITERATURA_2026-10.md).
 *
 * Del registro sale la evidencia (`verified`) y el ISBN de la edición
 * citada, nunca de memoria. Sin `--todas` solo revisa las obras que no
 * tienen `verified`. Imprime el resultado y lo deja en
 * scripts/catalog/.verificacion.json para copiarlo al catálogo.
 */
import { writeFileSync } from 'node:fs';
import { getSourceRecommendations, type SourceRecommendation } from '../../packages/domain/src/exegesis/recommendations';
import { SOURCE_TYPE_CATALOG, type SourceType } from '../../packages/domain/src/exegesis/entities/SourceType';
import type { BibleBookId } from '../../packages/domain/src/bible/canon/BibleCanon';

const UA = 'DosFilosPreach-catalogo/1.0 (mailto:rdocerda@gmail.com)';
const VACIAS = new Set(['the', 'of', 'and', 'a', 'an', 'on', 'to', 'in', 'la', 'el', 'de', 'del', 'los', 'las', 'una', 'un', 'y', 'en', 'sobre', 'der', 'die', 'das', 'und', 'zu']);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palabras = (s: string) => norm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !VACIAS.has(w));
const principal = (t: string) => t.split(/[:/]/)[0]!;
/** Las palabras en común sobre el título más corto (solo la parte principal, antes de «:»). */
function parecido(a: string, b: string): number {
    const x = palabras(principal(a)), y = palabras(principal(b));
    if (!x.length || !y.length) return 0;
    const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
    return corto.filter(w => largo.includes(w)).length / corto.length;
}
const apellido = (autor: string) => norm(autor.split(',')[0]!.split('&')[0]!.trim()).split(/\s+/).pop()!;
/** Todos los apellidos nombrados («Blomberg, Craig L.; Kamell, Mariam J.»): basta que coincida uno (editores incluidos). */
const apellidos = (autor: string) => autor.split(';').map(a => apellido(a.replace(/\(.*?\)/g, ''))).filter(Boolean);
// Palabra completa, no subcadena: «moo» está dentro de «moody» (revisión de la 2c).
const algunAutor = (r: SourceRecommendation, nombres: string[]) => apellidos(r.author).some(ap => nombres.some(n => norm(n).split(/[^a-z]+/).includes(ap)));
/**
 * Con un ISBN dado, el título COMPLETO tiene que coincidir: en la
 * calibración, «The Apostolic Fathers: Greek Texts…» pasaba con el ISBN de
 * «The Apostolic Fathers in English» porque el título principal es igual.
 */
function mismoTituloCompleto(nuestro: string, registro: string): boolean {
    const x = palabras(nuestro), y = palabras(registro);
    if (!x.length || !y.length) return false;
    const cubre = (a: string[], b: string[]) => a.filter(w => b.includes(w)).length / a.length;
    return cubre(x, y) >= 0.8 && cubre(y, x) >= 0.8;
}
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));
async function json(url: string): Promise<any> {
    for (let i = 0; i < 3; i++) {
        const r = await fetch(url, { headers: { 'User-Agent': UA } });
        if (r.status === 429 || r.status >= 500) { await espera(2000 * (i + 1)); continue; }
        if (!r.ok) return null;
        return r.json();
    }
    return null;
}
async function texto(url: string): Promise<string | null> {
    const r = await fetch(url, { headers: { 'User-Agent': UA } });
    return r.ok ? r.text() : null;
}

interface Resultado {
    book: string; sourceType: SourceType; author: string; title: string; year: number;
    status: 'verified' | 'not-found';
    verified?: { source: 'openlibrary' | 'crossref' | 'bne'; ref: string; checkedAt: string };
    isbn?: string | null; nota?: string; encontrado?: string;
}

/** El ISBN-13 de la edición del año citado, leído del registro de esa edición. */
async function isbnDeLaEdicion(isbns: string[], año: number): Promise<string | null> {
    const trece = [...new Set(isbns.filter(i => /^97[89]\d{10}$/.test(i)))].slice(0, 12);
    for (const i of trece) {
        const ed = await json(`https://openlibrary.org/isbn/${i}.json`);
        await espera(300);
        const m = String(ed?.publish_date ?? '').match(/\d{4}/);
        if (m && Number(m[0]) === año) return i;
    }
    return null;
}

async function porOpenLibrary(r: SourceRecommendation): Promise<Partial<Resultado> | null> {
    // Si ya trae ISBN, se lee esa edición y se compara.
    if (r.isbn) {
        const ed = await json(`https://openlibrary.org/isbn/${r.isbn}.json`);
        if (ed?.title && mismoTituloCompleto(r.title, [ed.title, ed.subtitle].filter(Boolean).join(': '))) {
            const m = String(ed.publish_date ?? '').match(/\d{4}/);
            const añoOk = !m || Math.abs(Number(m[0]) - r.year) <= 2;
            if (añoOk) return { status: 'verified', verified: { source: 'openlibrary', ref: `/isbn/${r.isbn}`, checkedAt: '' }, isbn: r.isbn, encontrado: `${ed.title} (${ed.publish_date ?? '?'})` };
        }
    }
    const campos = 'key,title,subtitle,author_name,first_publish_year,publish_year,isbn,publisher';
    const porCampos = new URLSearchParams({ title: principal(r.title).trim(), author: apellido(r.author), limit: '8', fields: campos });
    // Si la búsqueda por campos no trae nada («&» contra «and», autor como editor), una búsqueda abierta.
    const abierta = new URLSearchParams({ q: `${principal(r.title).trim()} ${apellido(r.author)}`, limit: '8', fields: campos });
    let d = await json(`https://openlibrary.org/search.json?${porCampos}`);
    if (!d?.docs?.length) { await espera(300); d = await json(`https://openlibrary.org/search.json?${abierta}`); }
    for (const w of d?.docs ?? []) {
        const titulo = [w.title, w.subtitle].filter(Boolean).join(': ');
        if (parecido(r.title, titulo) < 0.8) continue;
        if (!algunAutor(r, w.author_name ?? [])) continue;
        const años: number[] = w.publish_year ?? (w.first_publish_year ? [w.first_publish_year] : []);
        if (!años.some(a => Math.abs(a - r.year) <= 2)) continue;
        const isbn = await isbnDeLaEdicion(w.isbn ?? [], r.year);
        const editorial = (w.publisher ?? []).some((p: string) => palabras(p).some(x => palabras(r.publisher).includes(x))) ? '' : ` · EDITORIAL DISTINTA: ${(w.publisher ?? []).slice(0, 3).join(' / ')}`;
        return { status: 'verified', verified: { source: 'openlibrary', ref: w.key, checkedAt: '' }, isbn, encontrado: `${titulo} · ${(w.author_name ?? [])[0]} · ${años.sort().join(',').slice(0, 40)}${editorial}` };
    }
    return null;
}

async function porCrossref(r: SourceRecommendation): Promise<Partial<Resultado> | null> {
    const q = new URLSearchParams({ 'query.bibliographic': `${r.title} ${apellido(r.author)}`, rows: '5', select: 'DOI,title,author,issued,type', mailto: 'rdocerda@gmail.com' });
    const d = await json(`https://api.crossref.org/works?${q}`);
    for (const it of d?.message?.items ?? []) {
        const titulo = (it.title ?? [''])[0];
        if (parecido(r.title, titulo) < 0.8) continue;
        if (!algunAutor(r, (it.author ?? []).map((a: any) => String(a.family ?? '')))) continue;
        const año = it.issued?.['date-parts']?.[0]?.[0];
        if (año && Math.abs(año - r.year) > 2) continue;
        return { status: 'verified', verified: { source: 'crossref', ref: `doi:${it.DOI}`, checkedAt: '' }, encontrado: `${titulo} (${año ?? '?'})` };
    }
    return null;
}

async function porBne(r: SourceRecommendation): Promise<Partial<Resultado> | null> {
    const consulta = `alma.title="${principal(r.title).trim().replace(/"/g, '')}" AND alma.creator="${apellido(r.author)}"`;
    const xml = await texto(`https://catalogo.bne.es/view/sru/34BNE_INST?version=1.2&operation=searchRetrieve&maximumRecords=5&query=${encodeURIComponent(consulta)}`);
    if (!xml) return null;
    for (const rec of xml.split('<record xmlns="http://www.loc.gov/MARC21/slim">').slice(1)) {
        const campo = (tag: string, code: string) => [...rec.matchAll(new RegExp(`tag="${tag}"[\\s\\S]*?</datafield>`, 'g'))]
            .map(m => m[0].match(new RegExp(`code="${code}">([^<]*)<`))?.[1] ?? '').filter(Boolean);
        const titulo = [...campo('245', 'a'), ...campo('245', 'b')].join(' ');
        const autor = [...campo('100', 'a'), ...campo('700', 'a')].join(' ');
        const año = Number(([...campo('264', 'c'), ...campo('260', 'c')].join(' ').match(/\d{4}/) ?? [0])[0]);
        const id = rec.match(/tag="001">([^<]+)</)?.[1] ?? '?';
        if (parecido(r.title, titulo) < 0.8 || !algunAutor(r, [autor])) continue;
        if (año && Math.abs(año - r.year) > 2) continue;
        const isbn = campo('020', 'a').map(x => x.replace(/[^0-9X]/g, '')).find(x => x.length === 13) ?? null;
        return { status: 'verified', verified: { source: 'bne', ref: `bne:${id}`, checkedAt: '' }, isbn: r.isbn ?? isbn, encontrado: `${titulo} · ${autor} (${año || '?'})` };
    }
    return null;
}

async function main() {
    const todas = process.argv.includes('--todas');
    const libros = process.argv.slice(2).filter(a => !a.startsWith('--')) as BibleBookId[];
    const hoy = new Date().toISOString().slice(0, 10);
    const vistos = new Set<string>();
    const out: Resultado[] = [];
    for (const book of libros) {
        for (const sourceType of Object.keys(SOURCE_TYPE_CATALOG) as SourceType[]) {
            for (const r of getSourceRecommendations(book, sourceType, 'es')) {
                const clave = `${r.author}|${r.title}|${r.year}`;
                if (vistos.has(clave)) continue;
                vistos.add(clave);
                if (r.verified && !todas) continue;
                const articulo = sourceType === 'journal-article';
                const enEspañol = r.languages.length === 1 && r.languages[0] === 'es';
                const intentos = articulo ? [porCrossref, porOpenLibrary] : enEspañol ? [porOpenLibrary, porBne] : [porOpenLibrary, porCrossref, porBne];
                let hallado: Partial<Resultado> | null = null;
                for (const f of intentos) {
                    hallado = await f(r).catch(() => null);
                    await espera(400);
                    if (hallado) break;
                }
                const res: Resultado = {
                    book, sourceType, author: r.author, title: r.title, year: r.year,
                    status: hallado ? 'verified' : 'not-found',
                    ...(hallado ?? {}),
                    ...(hallado?.verified ? { verified: { ...hallado.verified, checkedAt: hoy } } : {}),
                };
                if (hallado && r.isbn && hallado.isbn && hallado.isbn !== r.isbn) res.nota = `ISBN del catálogo ${r.isbn} ≠ registro ${hallado.isbn}`;
                out.push(res);
                console.log(`${res.status === 'verified' ? '✓' : '✗'} ${book} ${sourceType.padEnd(22)} ${r.author.slice(0, 22).padEnd(22)} ${r.year} ${r.title.slice(0, 50)}`
                    + (res.verified ? `\n     ${res.verified.source} ${res.verified.ref} · ISBN ${res.isbn ?? '—'} · ${res.encontrado}` : ''));
            }
        }
    }
    writeFileSync('scripts/catalog/.verificacion.json', JSON.stringify(out, null, 2));
    const ok = out.filter(x => x.status === 'verified').length;
    console.log(`\n${ok} de ${out.length} verificadas.`);
}
main().catch(e => { console.error(e); process.exit(1); });
