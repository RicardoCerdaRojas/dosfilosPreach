#!/usr/bin/env node
/**
 * Cuántas veces aparece cada lema hebreo (número de Strong) en todo el AT.
 *
 * Es lo que ordena la «Selección sugerida» de un léxico: un hápax como
 * קִיקָיוֹן va antes que אָמַר, que aparece más de cinco mil veces y cuya
 * entrada no le enseña nada al estudio de un pasaje. El texto no cambia, así
 * que se cuenta UNA vez acá y se embarca como JSON; contarlo en el navegador
 * obligaría a bajar los 39 libros de morphhb.
 *
 * Fuente: morphhb (Open Scriptures; WLC de dominio público, morfología
 * CC BY 4.0, ver Créditos). Regenerar sólo si cambia la fuente:
 *   node scripts/build-hebrew-strong-frequency.mjs
 */
import { writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/openscriptures/morphhb/master/wlc';
const BOOKS = [
    'Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs',
    '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer',
    'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph',
    'Hag', 'Zech', 'Mal',
];
const OUT = 'packages/web/src/data/hebrew/strongFrequency.json';

const counts = {};
for (const book of BOOKS) {
    const res = await fetch(`${BASE}/${book}.xml`);
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${book}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<w [^>]*lemma="([^"]*)"/g)) {
        // «c/3318», «m/5921 a»: el número es la parte que empieza con dígito.
        const parte = m[1].split('/').map(p => p.trim()).find(p => /^\d/.test(p));
        if (!parte) continue;
        const n = parseInt(parte, 10);
        counts[n] = (counts[n] ?? 0) + 1;
    }
}
const n = Object.keys(counts).length;
if (n < 7000) throw new Error(`Sólo ${n} lemas: algún libro no bajó`);
writeFileSync(OUT, JSON.stringify(counts) + '\n');
console.log(`${n} lemas → ${OUT}`);
