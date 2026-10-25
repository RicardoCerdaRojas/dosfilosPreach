/**
 * Genera `packages/domain/src/bible/versification/readerLastVerse.ts`: el
 * último versículo de cada capítulo en la numeración del LECTOR (RVR1960),
 * solo para los libros donde las dos versificaciones difieren.
 *
 * Por qué hace falta: la tabla de versificación dice dónde se corre la
 * numeración, no cuántos versículos tiene cada capítulo. Un rango de
 * capítulos enteros del lector («Jonás 1-4», «Nehemías 4-6») se convierte al
 * original por sus dos extremos — 1 del primer capítulo y el ÚLTIMO del
 * capítulo final —, y ese último versículo no se puede sacar de la tabla
 * cuando el capítulo final no se corre (Jonás 4, Nehemías 6).
 *
 * Fuente: `packages/infrastructure/src/bible/data/rvr1960.json`, la misma
 * Biblia que lee el pastor. La prueba de paridad
 * (`packages/infrastructure/src/bible/repositories/__tests__/readerLastVerse.rvr1960.test.ts`)
 * compara la tabla con el archivo, así que una regeneración olvidada se nota.
 *
 * Correr: node scripts/generar-ultimo-verso-lector.mjs
 * Es idempotente. Correrlo de nuevo si cambia `versificationMap.ts`.
 */
import fs from 'fs';
import path from 'path';

const FUENTE = 'packages/infrastructure/src/bible/data/rvr1960.json';
const MAPA = 'packages/domain/src/bible/versification/versificationMap.ts';
const DESTINO = 'packages/domain/src/bible/versification/readerLastVerse.ts';

/** Id del canon → id del libro en rvr1960.json (los de `BIBLE_BOOKS_ES`). Solo el AT: el NT no difiere. */
const ID_RVR = {
    GEN: 'gn', EXO: 'ex', LEV: 'lv', NUM: 'nm', DEU: 'dt', JOS: 'js', JDG: 'jud', RUT: 'rt',
    '1SA': '1sm', '2SA': '2sm', '1KI': '1kgs', '2KI': '2kgs', '1CH': '1ch', '2CH': '2ch',
    EZR: 'ezr', NEH: 'ne', EST: 'et', JOB: 'job', PSA: 'ps', PRO: 'prv', ECC: 'ec', SNG: 'so',
    ISA: 'is', JER: 'jr', LAM: 'lm', EZK: 'ez', DAN: 'dn', HOS: 'ho', JOL: 'jl', AMO: 'am',
    OBA: 'ob', JON: 'jn', MIC: 'mi', NAM: 'na', HAB: 'hk', ZEP: 'zp', HAG: 'hg', ZEC: 'zc', MAL: 'ml',
};

// Los libros salen del mapa generado: la tabla cubre exactamente los que difieren.
const mapa = fs.readFileSync(MAPA, 'utf8');
const bloque = mapa.split('BOOKS_WITH_VERSIFICATION_DIFFERENCES')[1];
if (!bloque) throw new Error(`No se encontró BOOKS_WITH_VERSIFICATION_DIFFERENCES en ${MAPA}`);
const libros = [...bloque.matchAll(/'([0-9A-Z]{3})'/g)].map(m => m[1]);

const biblia = JSON.parse(fs.readFileSync(FUENTE, 'utf8'));
const filas = libros.map(id => {
    const rvr = ID_RVR[id];
    const libro = rvr && biblia.find(b => b.id === rvr);
    if (!libro) throw new Error(`Libro sin datos en ${FUENTE}: ${id}`);
    return `    ${/^\d/.test(id) ? `'${id}'` : id}: [${libro.chapters.map(c => c.length).join(', ')}],`;
}).join('\n');

const contenido = `import type { BibleBookId } from '../canon/BibleCanon';

/**
 * ARCHIVO GENERADO — no editar a mano.
 * Regenerar con: node scripts/generar-ultimo-verso-lector.mjs
 *
 * El último versículo de cada capítulo en la numeración del LECTOR (RVR1960),
 * solo para los ${libros.length} libros donde la versificación del lector y la del
 * original difieren (\`BOOKS_WITH_VERSIFICATION_DIFFERENCES\`). El índice 0 es
 * el capítulo 1.
 *
 * Fuente: \`packages/infrastructure/src/bible/data/rvr1960.json\`. La prueba de
 * paridad vive en infrastructure (\`readerLastVerse.rvr1960.test.ts\`), donde
 * está el archivo.
 */
export const READER_LAST_VERSE: Readonly<Partial<Record<BibleBookId, ReadonlyArray<number>>>> = {
${filas}
};

/**
 * El último versículo del capítulo del lector, o \`null\` si el libro no está
 * en la tabla (no difiere) o el capítulo no existe.
 */
export function readerLastVerse(book: BibleBookId, chapter: number): number | null {
    return READER_LAST_VERSE[book]?.[chapter - 1] ?? null;
}
`;

fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
fs.writeFileSync(DESTINO, contenido);
console.log(`${libros.length} libros → ${DESTINO}`);
