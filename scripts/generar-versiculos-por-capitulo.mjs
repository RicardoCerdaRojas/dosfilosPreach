/**
 * Genera `packages/domain/src/bible/canon/versesPerChapter.ts`: cuántos
 * versículos tiene cada capítulo, para que el selector de pasaje no acepte
 * versículos que no existen (TP #9, B1: aceptó «Santiago 4:11-19» y la
 * grilla mostraba 50 versículos; Santiago 4 tiene 17).
 *
 * Fuente: la RVR1960 del repo (versificación del lector) y el mapa de
 * versificación de las SBU (`versificationMap.ts`) para el texto original.
 * Por capítulo se guarda el MAYOR de los dos conteos: un pasaje se escribe
 * en cualquiera de las dos numeraciones y la validación no puede rechazar
 * un versículo que existe en una de ellas.
 *
 * Correr: node scripts/generar-versiculos-por-capitulo.mjs (idempotente).
 */
import fs from 'fs';

const ORDEN_RVR = [
    'gn', 'ex', 'lv', 'nm', 'dt', 'js', 'jud', 'rt',
    '1sm', '2sm', '1kgs', '2kgs', '1ch', '2ch',
    'ezr', 'ne', 'et', 'job', 'ps', 'prv', 'ec', 'so',
    'is', 'jr', 'lm', 'ez', 'dn',
    'ho', 'jl', 'am', 'ob', 'jn', 'mi', 'na', 'hk', 'zp', 'hg', 'zc', 'ml',
    'mt', 'mk', 'lk', 'jo', 'act', 'rm',
    '1co', '2co', 'gl', 'eph', 'ph', 'col',
    '1ts', '2ts', '1ti', '2ti', 'tit', 'phm', 'hb', 'jm',
    '1pe', '2pe', '1jo', '2jo', '3jo', 'jd', 're',
];
const CANON = [
    'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT',
    '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST',
    'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN',
    'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
    'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL',
    '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE',
    '1JN', '2JN', '3JN', 'JUD', 'REV',
];

const rvr = JSON.parse(fs.readFileSync('packages/web/src/assets/bible/rvr1960.json', 'utf8'));
const porId = new Map(rvr.map(b => [b.id, b]));
const mapa = fs.readFileSync('packages/domain/src/bible/versification/versificationMap.ts', 'utf8');
const tramos = [...mapa.matchAll(/\{ book: '(\w+)', chapter: (\d+), from: (\d+), to: (\d+), originalChapter: (\d+), originalFrom: (\d+), originalTo: (\d+) \}/g)]
    .map(m => ({ book: m[1], originalChapter: Number(m[5]), originalTo: Number(m[7]) }));

/**
 * El NT del original (NA28/SBLGNT) donde tiene MÁS versículos que la RVR y
 * el mapa de las SBU no lo dice (solo cubre el AT). Ap 12:18 («Καὶ
 * ἐστάθη…»): la RVR lo imprime como 13:1. 3 Jn 15 y 2 Co 13:14 ya los
 * cubre el mayor de los dos conteos; Hch 19:41 está en los dos.
 */
const NT_ORIGINAL_MAYOR = { REV: { 12: 18 } };

const tabla = {};
CANON.forEach((id, i) => {
    const libro = porId.get(ORDEN_RVR[i]);
    if (!libro) throw new Error(`Falta ${ORDEN_RVR[i]} en la RVR`);
    const conteos = libro.chapters.map(c => c.length);
    for (const t of tramos.filter(x => x.book === id)) {
        const k = t.originalChapter - 1;
        if (k < conteos.length) conteos[k] = Math.max(conteos[k], t.originalTo);
    }
    for (const [cap, n] of Object.entries(NT_ORIGINAL_MAYOR[id] ?? {})) {
        conteos[Number(cap) - 1] = Math.max(conteos[Number(cap) - 1], n);
    }
    tabla[id] = conteos;
});

const filas = CANON.map(id => `    ${/^\d/.test(id) ? `'${id}'` : id}: [${tabla[id].join(', ')}],`).join('\n');
const salida = `import type { BibleBookId } from './BibleCanon';

/**
 * ARCHIVO GENERADO — no editar a mano.
 * Regenerar con: node scripts/generar-versiculos-por-capitulo.mjs
 *
 * Versículos por capítulo: el mayor entre la versificación del lector
 * (RVR1960) y la del texto original (mapa de las SBU; en el NT, el NA28), para validar un
 * pasaje sin rechazar uno que existe en alguna de las dos.
 */
export const VERSES_PER_CHAPTER: Readonly<Record<BibleBookId, ReadonlyArray<number>>> = {
${filas}
};
`;
fs.writeFileSync('packages/domain/src/bible/canon/versesPerChapter.ts', salida);
console.log('ok', Object.values(tabla).reduce((a, c) => a + c.length, 0), 'capítulos');
