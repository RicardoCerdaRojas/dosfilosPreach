#!/usr/bin/env node
/**
 * Convierte los pasos guardados a la forma por REFERENCIA.
 *
 * `step.current` y `step.accepted` guardaban copias enteras de la versión
 * —análisis canónico incluido— de modo que cada versión podía quedar
 * almacenada hasta tres veces. Medido antes de escribir este script: de los
 * 8.595 KB que ocupan los 42 trabajos, 4.145 eran esa duplicación, y el
 * trabajo más grande estaba a 91% del límite de 1 MB por documento.
 *
 * El código nuevo ya escribe y lee la forma por referencia y sigue leyendo la
 * vieja, así que este script no es necesario para que nada funcione: lo que
 * hace es recuperar el espacio de lo YA guardado, sin esperar a que cada paso
 * se vuelva a tocar.
 *
 * SEGURIDAD. Antes de reemplazar una copia por su identificador comprueba que
 * la versión esté en `versions[]`; si no está, la agrega. Nunca se guarda una
 * referencia a algo que no existe, que sería perder el texto.
 *
 *   node scripts/dedupe-step-versions.js            ← ensayo en seco
 *   node scripts/dedupe-step-versions.js --apply    ← escribe
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const APLICA = process.argv.includes('--apply');
const kb = (o) => JSON.stringify(o ?? null).length / 1024;

/** Un paso en la forma por referencia. Espeja `serializeStep` del repositorio. */
function porReferencia(step) {
    const versions = Array.isArray(step.versions) ? [...step.versions] : [];
    const asegura = (v) => {
        if (v && v.id && !versions.some((x) => x && x.id === v.id)) versions.push(v);
    };
    asegura(step.current);
    asegura(step.accepted);

    const { current, accepted, ...resto } = step;
    return {
        ...resto,
        versions,
        currentId: current?.id ?? step.currentId ?? null,
        acceptedId: accepted?.id ?? step.acceptedId ?? null,
    };
}

(async () => {
    initializeApp({ credential: applicationDefault(), projectId: 'dosfilosapp' });
    const db = getFirestore();
    const snap = await db.collection('exegeticalPapers').get();

    let antes = 0;
    let despues = 0;
    let tocados = 0;
    const filas = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        const steps = Array.isArray(data.steps) ? data.steps : [];
        if (steps.length === 0) continue;

        const a = kb(data);
        const nuevos = steps.map(porReferencia);
        const d = kb({ ...data, steps: nuevos });
        antes += a;
        despues += d;

        if (a - d < 1) continue;
        tocados += 1;
        filas.push([(data.title || doc.id).slice(0, 30), a, d]);

        if (APLICA) await doc.ref.update({ steps: nuevos });
    }

    filas.sort((x, y) => (y[1] - y[2]) - (x[1] - x[2]));
    console.log(APLICA ? 'APLICADO\n' : 'ENSAYO EN SECO — no se escribió nada\n');
    console.log('trabajos que cambian:', tocados, 'de', snap.size);
    for (const [t, a, d] of filas.slice(0, 10)) {
        console.log(`  ${t.padEnd(32)} ${a.toFixed(0).padStart(4)} KB → ${d.toFixed(0).padStart(4)} KB`);
    }
    console.log(`\ntotal: ${antes.toFixed(0)} KB → ${despues.toFixed(0)} KB  (${(100 * (1 - despues / antes)).toFixed(0)}% menos)`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
