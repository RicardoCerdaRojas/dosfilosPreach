#!/usr/bin/env node
/**
 * Baja un recurso de la biblioteca para medirlo y extraer reglas (R1,
 * docs/FASE_REGLAS_DESDE_GRAMATICAS_2026-10.md). SÓLO LECTURA: no escribe nada
 * en Firestore ni en Storage.
 *
 *   node scripts/language-rules/bajar-recurso.cjs <resourceId> <carpeta>
 *
 * Deja en <carpeta>:
 *   recurso.pdf     el PDF original
 *   capa.txt        su capa de texto (`pdftotext -layout`), hojas separadas por \f
 *   estructurado.md la extracción de la biblioteca (si existe)
 *   meta.json       título, autor, páginas, desfase hoja → página impresa, motor
 *
 * El texto de los libros NO va al repo: la carpeta tiene que estar fuera de él.
 * Credenciales: las de aplicación de gcloud (`gcloud auth application-default login`).
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '../..');
const [resourceId, carpeta] = process.argv.slice(2);
if (!resourceId || !carpeta) {
    console.error('Uso: node scripts/language-rules/bajar-recurso.cjs <resourceId> <carpeta fuera del repo>');
    process.exit(2);
}
const destino = path.resolve(carpeta);
/**
 * ¿Está dentro del repo? Con la ruta REAL (sin enlaces simbólicos) del ancestro que exista, y sin
 * distinguir mayúsculas en macOS: «/Users/…/DEV/dosfilosPreach/x» pasaba (revisión de R1).
 */
function real(p) {
    let q = p;
    const resto = [];
    while (!fs.existsSync(q)) { resto.unshift(path.basename(q)); q = path.dirname(q); }
    return path.join(fs.realpathSync(q), ...resto);
}
const comparable = p => (process.platform === 'darwin' || process.platform === 'win32' ? p.toLowerCase() : p);
const raiz = comparable(fs.realpathSync(RAIZ));
const dest = comparable(real(destino));
if (dest === raiz || dest.startsWith(raiz + path.sep)) {
    console.error(`La carpeta está dentro del repo (${destino}): el texto de los libros no se commitea. Usa una fuera.`);
    process.exit(2);
}
fs.mkdirSync(destino, { recursive: true });
// Una carpeta reutilizada no mezcla libros: se borra lo del recurso anterior antes de bajar.
for (const f of ['recurso.pdf', 'capa.txt', 'estructurado.md', 'meta.json']) fs.rmSync(path.join(destino, f), { force: true });

const admin = require(path.join(RAIZ, 'node_modules/firebase-admin'));
admin.initializeApp({ projectId: 'dosfilosapp', storageBucket: 'dosfilosapp.firebasestorage.app' });

(async () => {
    const doc = await admin.firestore().doc(`library_resources/${resourceId}`).get();
    if (!doc.exists) throw new Error(`No existe library_resources/${resourceId}`);
    const r = doc.data();
    const meta = {
        id: resourceId,
        title: r.title, author: r.author, type: r.type,
        pageCount: r.pageCount,
        pageNumbering: r.pageNumbering ?? null,
        extractionVersion: r.extractionVersion ?? null,
        scriptCensus: r.scriptCensus ?? null,
    };
    fs.writeFileSync(path.join(destino, 'meta.json'), JSON.stringify(meta, null, 1));

    const [files] = await admin.storage().bucket().getFiles({ prefix: `users/${r.userId}/library/${resourceId}/` });
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length !== 1) throw new Error(`El recurso tiene ${pdfs.length} PDF en Storage; se esperaba uno`);
    const pdf = pdfs[0];
    await pdf.download({ destination: path.join(destino, 'recurso.pdf') });
    const md = files.find(f => f.name.endsWith('structured.md'));
    if (md) await md.download({ destination: path.join(destino, 'estructurado.md') });

    execFileSync('pdftotext', ['-layout', path.join(destino, 'recurso.pdf'), path.join(destino, 'capa.txt')]);
    console.log(`${meta.title} — ${meta.author}: ${meta.pageCount} hojas → ${destino}`);
    console.log(`desfase: ${JSON.stringify(meta.pageNumbering?.segments ?? 'sin dato')}  ·  extracción: ${meta.extractionVersion}`);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
