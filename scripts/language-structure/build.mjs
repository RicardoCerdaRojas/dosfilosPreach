#!/usr/bin/env node
/**
 * Genera los datos lingüísticos por capítulo que usan los tutores de idioma:
 * morfología (MorphGNT / OSHB) + estructura sintáctica (MACULA), alineadas y
 * verificadas, en `packages/web/public/language-data/v1/{gr,he}/<libro>/<cap>.json`.
 *
 * Por qué existe (fase módulos de idioma, G0, 2026-10-07):
 *   - Los tutores descargaban MorphGNT y OSHB en el navegador desde GitHub en
 *     `@master`: un cambio aguas arriba cambiaba nuestros datos sin aviso.
 *   - MACULA pesa hasta 16,7 MB por libro (Lucas): imposible en una tablet.
 *     Por capítulo, compactado, son 7-30 KB comprimidos.
 *   - Alinear MACULA por POSICIÓN es un error silencioso: MACULA ordena las
 *     palabras según el árbol sintáctico. Medido en Santiago: por posición, 204
 *     de 1.739 caen en otra palabra; por identificador, 0.
 *
 * Fuentes FIJADAS por commit (subirlas es una decisión; el script se corre de
 * nuevo y el diff muestra qué cambió). Licencias en el `manifest.json` que se
 * genera junto a los datos.
 *
 * Uso: node scripts/language-structure/build.mjs [--only=JAS,Ruth]
 * Las descargas quedan en .cache/language-structure/ (fuera del repo).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const SOURCES = {
    maculaGreek: { repo: 'Clear-Bible/macula-greek', sha: '8423afe47b9e8f24b7772e808af45c7159a6fe7e', license: 'CC BY 4.0' },
    maculaHebrew: { repo: 'Clear-Bible/macula-hebrew', sha: '47db250bd55d0d8577f2a94fba114ef16c35b23c', license: 'CC BY 4.0' },
    morphgnt: { repo: 'morphgnt/sblgnt', sha: 'aaed91e57c8e4a8dc9a2383e129ca5e75fe6393d', license: 'Morfología MorphGNT: CC BY-SA 3.0 · texto SBLGNT: CC BY 4.0' },
    morphhb: { repo: 'openscriptures/morphhb', sha: '3d15126fb1ef74867fc1434be1942e837932691f', license: 'Morfología OSHB: CC BY 4.0 · texto WLC: dominio público' },
};

const OUT = 'packages/web/public/language-data/v1';
const CACHE = '.cache/language-structure';
const cdn = (src, path) => `https://cdn.jsdelivr.net/gh/${SOURCES[src].repo}@${SOURCES[src].sha}/${path}`;

// Griego: el mismo orden canónico en MorphGNT y en MACULA. Clave = BibleBookId del proveedor.
export const GREEK_BOOKS = [
    ['MAT', '61-Mt', '01-matthew'], ['MRK', '62-Mk', '02-mark'], ['LUK', '63-Lk', '03-luke'], ['JHN', '64-Jn', '04-john'],
    ['ACT', '65-Ac', '05-acts'], ['ROM', '66-Ro', '06-romans'], ['1CO', '67-1Co', '07-1corinthians'], ['2CO', '68-2Co', '08-2corinthians'],
    ['GAL', '69-Ga', '09-galatians'], ['EPH', '70-Eph', '10-ephesians'], ['PHP', '71-Php', '11-philippians'], ['COL', '72-Col', '12-colossians'],
    ['1TH', '73-1Th', '13-1thessalonians'], ['2TH', '74-2Th', '14-2thessalonians'], ['1TI', '75-1Ti', '15-1timothy'], ['2TI', '76-2Ti', '16-2timothy'],
    ['TIT', '77-Tit', '17-titus'], ['PHM', '78-Phm', '18-philemon'], ['HEB', '79-Heb', '19-hebrews'], ['JAS', '80-Jas', '20-james'],
    ['1PE', '81-1Pe', '21-1peter'], ['2PE', '82-2Pe', '22-2peter'], ['1JN', '83-1Jn', '23-1john'], ['2JN', '84-2Jn', '24-2john'],
    ['3JN', '85-3Jn', '25-3john'], ['JUD', '86-Jud', '26-jude'], ['REV', '87-Re', '27-revelation'],
];

// Hebreo: clave = nombre de archivo de morphhb (el `morphhbKey` del tutor); MACULA usa su abreviatura.
export const HEBREW_BOOKS = [
    ['Gen', '01-Gen'], ['Exod', '02-Exo'], ['Lev', '03-Lev'], ['Num', '04-Num'], ['Deut', '05-Deu'], ['Josh', '06-Jos'],
    ['Judg', '07-Jdg'], ['Ruth', '08-Rut'], ['1Sam', '09-1Sa'], ['2Sam', '10-2Sa'], ['1Kgs', '11-1Ki'], ['2Kgs', '12-2Ki'],
    ['1Chr', '13-1Ch'], ['2Chr', '14-2Ch'], ['Ezra', '15-Ezr'], ['Neh', '16-Neh'], ['Esth', '17-Est'], ['Job', '18-Job'],
    ['Ps', '19-Psa'], ['Prov', '20-Pro'], ['Eccl', '21-Ecc'], ['Song', '22-Sng'], ['Isa', '23-Isa'], ['Jer', '24-Jer'],
    ['Lam', '25-Lam'], ['Ezek', '26-Ezk'], ['Dan', '27-Dan'], ['Hos', '28-HOS'], ['Joel', '29-Jol'], ['Amos', '30-Amo'],
    ['Obad', '31-Oba'], ['Jonah', '32-Jon'], ['Mic', '33-Mic'], ['Nah', '34-Nam'], ['Hab', '35-Hab'], ['Zeph', '36-Zep'],
    ['Hag', '37-Hag'], ['Zech', '38-Zec'], ['Mal', '39-Mal'],
];

async function descargar(src, path) {
    const local = join(CACHE, SOURCES[src].sha.slice(0, 12), path);
    if (existsSync(local)) return readFileSync(local, 'utf8');
    const res = await fetch(cdn(src, path));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${src}/${path}`);
    const text = await res.text();
    mkdirSync(dirname(local), { recursive: true });
    writeFileSync(local, text);
    return text;
}

const attrs = (s) => Object.fromEntries([...(s ?? '').matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

/**
 * Árbol lowfat → cláusulas y palabras. Cada cláusula conoce su padre (la
 * cláusula que la contiene), su regla (S-V-O, Conj-CL…) y su rol en el padre:
 * el suyo o el del grupo que la envuelve, salvo que ese grupo sea una frase
 * nominal (una relativa dentro de un objeto NO es el objeto). Los roles de
 * error de MACULA («err__…») se descartan.
 */
export function leerLowfat(xml) {
    const clausulas = [];
    const palabras = [];
    // `cons`: el rol del CONSTITUYENTE de la cláusula al que pertenece lo que
    // está adentro (el grupo hijo directo de la cláusula). En «τὸ καλὸν ὄνομα»
    // (Stg 2:7) el rol «o» está en el grupo, no en las palabras: sin esto, un
    // objeto de varias palabras no tenía rol y no se podía ver si iba antes
    // del verbo.
    const pila = []; // { cl: índice|null, role, cls, cons }
    const rol = (r) => (r && !r.startsWith('err') ? r : '');
    for (const m of xml.matchAll(/<wg(\s[^>]*)?>|<\/wg>|<w\s([^>]*)>([^<]*)<\/w>/gs)) {
        const g = m[0];
        if (g === '</wg>') { pila.pop(); continue; }
        if (g.startsWith('<wg')) {
            const a = attrs(m[1]);
            const padre = [...pila].reverse().find(x => x.cl !== null)?.cl ?? null;
            if (a.class === 'cl') {
                const tope = pila[pila.length - 1];
                const envolvente = tope && tope.cls !== 'np' ? tope.role : '';
                clausulas.push({ id: clausulas.length, parent: padre, rule: a.rule ?? '', role: rol(a.role) || rol(envolvente), words: [] });
                pila.push({ cl: clausulas.length - 1, role: '', cls: 'cl', cons: '' });
            } else {
                const tope = pila[pila.length - 1];
                const cons = tope && tope.cls === 'cl' ? rol(a.role) : (tope?.cons ?? '');
                pila.push({ cl: null, role: a.role ?? '', cls: a.class ?? '', cons });
            }
            continue;
        }
        const a = attrs(m[2]);
        const cl = [...pila].reverse().find(x => x.cl !== null)?.cl ?? null;
        const tope = pila[pila.length - 1];
        const cons = tope && tope.cls !== 'cl' ? tope.cons : '';
        palabras.push({ id: a['xml:id'], ref: a.ref, text: m[3], role: rol(a.role) || cons, morph: a.morph ?? '', clause: cl });
    }
    return { clausulas, palabras };
}

/** Sólo letras, sin acentos, marcas del aparato (⸀…⸅) ni números de variante. */
export const sinMarcas = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}]/gu, '').toLowerCase();
/** El texto de MorphGNT sin las marcas del aparato crítico de SBLGNT («⸀1ἄλλῳ» → «ἄλλῳ»). */
export const sinAparato = (s) => s.replace(/[\u2E00-\u2E05]\d*/g, '');
const consonantes = (s) => s.replace(/[^\u05D0-\u05EA]/g, '');
const capVers = (ref) => { const [, cv, n] = ref.match(/^\S+ (\d+:\d+)!(\d+)$/) ?? []; return cv ? { cv, n: Number(n) } : null; };

/**
 * Cláusulas de un capítulo, con sus palabras como «vers!n» EN EL ORDEN DEL
 * TEXTO (MACULA las da en orden de árbol) y los padres renumerados. Se
 * conservan los ANCESTROS de toda cláusula con palabras, aunque no tengan
 * palabras propias (coordinaciones como ClCl) o éstas estén en otro capítulo:
 * si no, sus hijas quedaban sin padre y se perdía el anidamiento.
 */
export function clausulasDelCapitulo(clausulas, palabras, cap, orden) {
    const porCl = new Map();
    for (const p of palabras) {
        const r = capVers(p.ref ?? '');
        if (!r || p.clause === null || r.cv.split(':')[0] !== String(cap)) continue;
        const clave = `${r.cv.split(':')[1]}!${r.n}`;
        if (!orden.has(clave)) continue;
        const lista = porCl.get(p.clause) ?? [];
        if (!lista.includes(clave)) lista.push(clave);
        porCl.set(p.clause, lista);
    }
    const guardar = new Set();
    for (const id of porCl.keys()) {
        let c = id;
        while (c !== null && c !== undefined && !guardar.has(c)) { guardar.add(c); c = clausulas[c].parent; }
    }
    const ids = [...guardar].sort((a, b) => a - b);
    const nuevo = new Map(ids.map((id, i) => [id, i]));
    return ids.map(id => {
        const c = clausulas[id];
        const w = (porCl.get(id) ?? []).sort((a, b) => orden.get(a) - orden.get(b));
        return { p: c.parent === null ? null : nuevo.get(c.parent), rule: c.rule, role: c.role, w };
    });
}

const ordenDe = (words) => new Map(words.map((w, i) => [w.r, i]));

/**
 * Griego: se alinea VERSÍCULO por versículo. MACULA trae versículos que
 * SBLGNT no tiene (la perícopa de la adúltera, Jn 7:53-8:11): alinear el libro
 * entero por posición corría todo lo que sigue.
 */
async function griego(only, informe) {
    for (const [book, mg, mac] of GREEK_BOOKS) {
        if (only && !only.has(book)) continue;
        const texto = await descargar('morphgnt', `${mg}-morphgnt.txt`);
        const xml = await descargar('maculaGreek', `SBLGNT/lowfat/${mac}.xml`);
        const filas = texto.split('\n').filter(Boolean).map(l => l.trim().split(/\s+/));
        const { clausulas, palabras } = leerLowfat(xml);
        const maculaPorVers = new Map();
        for (const p of palabras) {
            const r = capVers(p.ref ?? '');
            if (!r) continue;
            maculaPorVers.set(r.cv, [...(maculaPorVers.get(r.cv) ?? []), { ...p, n: r.n }]);
        }
        for (const lista of maculaPorVers.values()) lista.sort((a, b) => a.id.localeCompare(b.id));
        let distintas = 0;
        const capitulos = new Map();
        const posEnVers = new Map();
        for (const [bcv, pos, parse, text, , , lemma] of filas) {
            const cap = Number(bcv.slice(2, 4)), vers = Number(bcv.slice(4, 6));
            const cv = `${cap}:${vers}`;
            const i = posEnVers.get(cv) ?? 0;
            posEnVers.set(cv, i + 1);
            const m = maculaPorVers.get(cv)?.[i];
            if (!m || m.n !== i + 1 || sinMarcas(m.text) !== sinMarcas(text)) distintas++;
            const lista = capitulos.get(cap) ?? [];
            lista.push({ r: `${vers}!${i + 1}`, t: sinAparato(text), l: lemma, pos, parse, role: m?.role ?? '' });
            capitulos.set(cap, lista);
        }
        // Palabras de MACULA de versículos que SBLGNT sí tiene y que nadie usó.
        for (const [cv, lista] of maculaPorVers) if ((posEnVers.get(cv) ?? 0) > 0 && lista.length !== posEnVers.get(cv)) distintas++;
        informe.push({ lang: 'gr', book, palabras: filas.length, macula: palabras.length, distintas });
        if (distintas > 0) continue;
        limpiar(`gr/${book}`);
        for (const [cap, words] of capitulos) {
            escribir(`gr/${book}/${cap}.json`, { lang: 'gr', book, chapter: cap, words, clauses: clausulasDelCapitulo(clausulas, palabras, cap, ordenDe(words)) });
        }
    }
}

/**
 * Palabras de OSHB por versículo, en orden de documento. El qere (que OSHB
 * guarda en una nota, después del ketiv) CUENTA: MACULA numera el ketiv y el
 * qere por separado, y quitarlo corría el resto del versículo una posición
 * (Rut 1:8: desde יַעַשׂ, 8 palabras con el código de la vecina). El ketiv
 * queda marcado; el tutor lo descarta desde #726. Una palabra puede traer
 * marcado interno (letra grande o pequeña: `<seg type="x-large">`, como la
 * ע y la ד del Shemá en Dt 6:4): se le quita, no se la pierde.
 */
export function leerOshb(xml) {
    const out = new Map();
    for (const v of xml.matchAll(/<verse osisID="[^.]+\.(\d+)\.(\d+)">(.*?)<\/verse>/gs)) {
        const ws = [...v[3].matchAll(/<w\s([^>]*)>(.*?)<\/w>/gs)].map(m => ({ ...attrs(m[1]), text: m[2].replace(/<[^>]+>/g, '') }));
        out.set(`${v[1]}:${v[2]}`, ws);
    }
    return out;
}

/**
 * Hebreo: toda palabra tiene que calzar en CONSONANTES con sus piezas de
 * MACULA, y toda palabra de MACULA tiene que quedar usada; si no, es un error
 * de alineación y el libro no se escribe. Si calzan pero el CÓDIGO difiere, es
 * un desacuerdo entre las fuentes, no de alineación: se informa y vale el de
 * OSHB (medido: uno solo en todo el AT, Lv 27:16 בַּחֲמִשִּׁים, OSHB `Rd`
 * —con artículo— y MACULA `R`).
 */
async function hebreo(only, informe) {
    for (const [book, mac] of HEBREW_BOOKS) {
        if (only && !only.has(book)) continue;
        const oshb = leerOshb(await descargar('morphhb', `wlc/${book}.xml`));
        const capitulos = [...new Set([...oshb.keys()].map(k => Number(k.split(':')[0])))].sort((a, b) => a - b);
        let total = 0, distintas = 0, ketiv = 0, faltan = 0;
        const desacuerdos = [];
        const salida = [];
        for (const cap of capitulos) {
            const xml = await descargar('maculaHebrew', `WLC/lowfat/${mac}-${String(cap).padStart(3, '0')}-lowfat.xml`);
            if (!xml) { faltan++; continue; }
            const { clausulas, palabras } = leerLowfat(xml);
            const partes = new Map();
            for (const p of palabras) {
                const r = capVers(p.ref ?? '');
                if (!r) continue;
                const k = `${r.cv}!${r.n}`;
                partes.set(k, [...(partes.get(k) ?? []), p]);
            }
            const usadas = new Set();
            const words = [];
            for (const [cv, ws] of oshb) {
                if (Number(cv.split(':')[0]) !== cap) continue;
                ws.forEach((w, i) => {
                    total++;
                    const clave = `${cv}!${i + 1}`;
                    usadas.add(clave);
                    const ps = (partes.get(clave) ?? []).sort((a, b) => a.id.localeCompare(b.id));
                    const esKetiv = w.type === 'x-ketiv';
                    if (esKetiv) ketiv++;
                    else if (consonantes(ps.map(p => p.text).join('')) !== consonantes(w.text)) distintas++;
                    else if (ps.map(p => p.morph).join('/') !== (w.morph ?? '').replace(/^[HA]/, '')) {
                        desacuerdos.push(`${clave} OSHB ${w.morph} / MACULA ${ps.map(p => p.morph).join('/')}`);
                    }
                    const principal = ps.find(p => p.role) ?? ps[0];
                    words.push({
                        r: `${cv.split(':')[1]}!${i + 1}`, t: w.text.replace(/\//g, ''), l: w.lemma ?? '', m: w.morph ?? '',
                        role: principal?.role ?? '', ...(esKetiv ? { ketiv: true } : {}),
                        parts: ps.map(p => ({ t: p.text, m: p.morph, role: p.role })),
                    });
                });
            }
            for (const k of partes.keys()) if (!usadas.has(k)) distintas++;
            salida.push([cap, { lang: 'he', book, chapter: cap, words, clauses: clausulasDelCapitulo(clausulas, palabras, cap, ordenDe(words)) }]);
        }
        informe.push({
            lang: 'he', book, palabras: total, distintas, ketiv,
            ...(desacuerdos.length ? { desacuerdos: desacuerdos.join(' · ') } : {}),
            ...(faltan ? { falta: `${faltan} cap. de MACULA` } : {}),
        });
        if (distintas > 0 || faltan > 0) continue;
        limpiar(`he/${book}`);
        for (const [cap, data] of salida) escribir(`he/${book}/${cap}.json`, data);
    }
}

/** Borra lo anterior de un libro: un sha nuevo no deja archivos viejos mezclados. */
function limpiar(rel) {
    rmSync(join(OUT, rel), { recursive: true, force: true });
}

let bytes = 0;
const indice = { gr: {}, he: {} };
function escribir(rel, data) {
    indice[data.lang][data.book] = Math.max(indice[data.lang][data.book] ?? 0, data.chapter);
    const ruta = join(OUT, rel);
    mkdirSync(dirname(ruta), { recursive: true });
    const json = JSON.stringify(data);
    bytes += Buffer.byteLength(json);
    writeFileSync(ruta, json);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const arg = process.argv.find(a => a.startsWith('--only='));
    const only = arg ? new Set(arg.slice(7).split(',')) : null;
    const informe = [];
    await griego(only, informe);
    await hebreo(only, informe);
    // Una corrida parcial no reescribe el manifiesto: quedaría con sólo esos libros.
    if (!only) writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({
        version: 1,
        // Capítulos por libro: para no pedir uno que no existe (el sitio devuelve HTML con 200).
        books: indice,
        sources: SOURCES,
        // Los archivos de `gr/` llevan códigos de MorphGNT (CC BY-SA 3.0): se
        // distribuyen bajo esa misma licencia. Los de `he/`, CC BY 4.0.
        dataLicense: { gr: 'CC BY-SA 3.0 (deriva de MorphGNT) · MACULA Greek CC BY 4.0 · SBLGNT CC BY 4.0', he: 'CC BY 4.0 (MACULA Hebrew, morfología OSHB) · WLC dominio público' },
        attribution: [
            'MACULA Greek y MACULA Hebrew Linguistic Datasets, Clear Bible, Inc. (CC BY 4.0).',
            'MorphGNT, James K. Tauber y colaboradores (CC BY-SA 3.0), sobre el SBL Greek New Testament (SBLGNT, CC BY 4.0).',
            'Open Scriptures Hebrew Bible (OSHB), morfología CC BY 4.0, sobre el Westminster Leningrad Codex (dominio público).',
        ],
    }, null, 2));
    console.table(informe);
    console.log(`escrito: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    const malos = informe.filter(x => x.distintas > 0 || x.falta);
    if (malos.length) { console.error('ALINEACIÓN CON DIFERENCIAS:', malos); process.exit(1); }
}
