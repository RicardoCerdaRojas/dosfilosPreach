#!/usr/bin/env node
/**
 * Tabla número de Strong → lema hebreo con puntos, para «Páginas por lema».
 *
 * morphhb trae cada palabra del AT con su lema como NÚMERO de Strong
 * («c/3318»), no como palabra hebrea, y un léxico se busca por la palabra. La
 * tabla sale de HebrewStrong.xml de Open Scriptures (CC BY 4.0; el texto de
 * Strong es de dominio público). Atribución: «Open Scriptures Hebrew Bible
 * Project», en la página de créditos.
 *
 * Es un dato fijo: se calcula UNA vez y se embarca como JSON que la página del
 * selector carga sólo cuando la fuente es un léxico hebreo.
 *
 * Regenerar sólo si cambia la fuente:
 *   node scripts/build-hebrew-strong-lemmas.mjs
 */
import { writeFileSync } from 'node:fs';

const URL = 'https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/HebrewStrong.xml';
const OUT = 'packages/web/src/data/hebrew/strongLemmas.json';

const res = await fetch(URL);
if (!res.ok) throw new Error(`HTTP ${res.status} al bajar HebrewStrong.xml`);
const xml = await res.text();

const table = {};
for (const m of xml.matchAll(/<entry id="H(\d+)">\s*<w [^>]*>([^<]+)<\/w>/g)) {
    table[m[1]] = m[2].trim();
}
const n = Object.keys(table).length;
if (n < 8000) throw new Error(`Sólo ${n} entradas: el formato de la fuente cambió`);
writeFileSync(OUT, JSON.stringify(table) + '\n');
console.log(`${n} lemas → ${OUT}`);
