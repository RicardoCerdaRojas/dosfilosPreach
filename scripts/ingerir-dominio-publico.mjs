/**
 * Ingiere una obra de dominio público a la BIBLIOTECA COMÚN — la que ven
 * todos los usuarios.
 *
 * Existe porque medido en producción: de 13 usuarios, 2 tienen biblioteca
 * propia. Diez de once abren el selector de corpus y no tienen una sola obra
 * que elegir, así que el paper se queda en configuración y el estudio arranca
 * desnudo. El cableado para resolverlo ya estaba —`SYSTEM_SOURCE_OWNER_ID`,
 * que `LibraryService.getUserResourcesWithSystem` une a la biblioteca de cada
 * usuario— y estaba vacío. Esto lo llena.
 *
 * Qué hace, en orden:
 *   1. Sube el markdown convertido a Storage.
 *   2. Crea el `library_resources` bajo `__system__`, con su licencia,
 *      su estado de ingesta y su bloque de citación.
 *   3. Deja que el disparador de auto-indexado haga el resto.
 *
 * ESCRIBE EN PRODUCCIÓN Y ES VISIBLE PARA TODOS. Por eso corre en seco por
 * defecto: sin `--aplicar` muestra exactamente lo que haría y no toca nada.
 *
 * Correr:
 *   node scripts/ingerir-dominio-publico.mjs <ficha.json> <contenido.md> [--aplicar]
 */
import fs from 'fs';
import admin from 'firebase-admin';

const [rutaFicha, rutaContenido] = process.argv.slice(2);
const aplicar = process.argv.includes('--aplicar');

if (!rutaFicha || !rutaContenido) {
    console.error('Uso: node scripts/ingerir-dominio-publico.mjs <ficha.json> <contenido.md> [--aplicar]');
    process.exit(1);
}

/** Centinela de la plataforma. Debe coincidir con el del dominio. */
const SYSTEM_SOURCE_OWNER_ID = '__system__';
const BUCKET = 'dosfilosapp.firebasestorage.app';
/** Ver `STRUCTURED_EXTRACTION_VERSIONS`: es la que habilita el auto-indexado. */
const EXTRACTION_VERSION = '6.0-thml-public-domain';
const INDEXER_VERSION_CURRENT = '2.0-structured';

const ficha = JSON.parse(fs.readFileSync(rutaFicha, 'utf8'));
const contenido = fs.readFileSync(rutaContenido, 'utf8');

// El `textContent` de Firestore está topado por el límite de 1 MiB por
// documento. Es una COPIA de respaldo, nunca la fuente: el indexador lee el
// markdown de Storage. Se recorta con margen.
const TOPE_TEXT_CONTENT = 800_000;

const secciones = (contenido.match(/^## /gm) ?? []).length;
const resumen = {
    id: ficha.id,
    titulo: ficha.title,
    autor: ficha.author,
    licencia: ficha.license,
    ingesta: ficha.ingestionStatus,
    secciones,
    tamañoMB: (contenido.length / 1048576).toFixed(1),
    destino: `gs://${BUCKET}/system-library/${ficha.id}/structured.md`,
    visiblePara: 'TODOS los usuarios',
};

console.log('─'.repeat(64));
console.log(aplicar ? 'APLICANDO' : 'ENSAYO — no se escribe nada (usá --aplicar)');
console.log('─'.repeat(64));
for (const [k, v] of Object.entries(resumen)) console.log(`  ${k.padEnd(13)} ${v}`);

// Guardas de derechos. No son decorativas: una obra sin licencia declarada o
// marcada como «sólo metadatos» no puede ingerirse entera, y llegar hasta acá
// con una de esas puesta significa que alguien se equivocó armando la ficha.
if (ficha.license !== 'Public Domain' && !String(ficha.license).startsWith('CC BY')) {
    console.error(`\n✗ Licencia no apta para ingesta completa: "${ficha.license}"`);
    process.exit(1);
}
if (ficha.ingestionStatus !== 'approved_full_ingestion') {
    console.error(`\n✗ ingestionStatus debe ser approved_full_ingestion (es "${ficha.ingestionStatus}")`);
    process.exit(1);
}
if (secciones < 100) {
    console.error(`\n✗ Sólo ${secciones} secciones: el conversor probablemente falló.`);
    process.exit(1);
}

if (!aplicar) {
    console.log('\nEnsayo terminado. Nada se escribió.');
    process.exit(0);
}

admin.initializeApp({ projectId: 'dosfilosapp', storageBucket: BUCKET });
const db = admin.firestore();
const bucket = admin.storage().bucket();

const rutaStorage = `system-library/${ficha.id}/structured.md`;
console.log(`\n1/3 subiendo ${resumen.tamañoMB} MB a Storage…`);
await bucket.file(rutaStorage).save(contenido, { contentType: 'text/markdown' });

console.log('2/3 creando el recurso…');
const doc = {
    userId: SYSTEM_SOURCE_OWNER_ID,
    isSystemSource: true,
    title: ficha.title,
    shortTitle: ficha.shortTitle ?? null,
    author: ficha.author,
    year: ficha.year,
    type: ficha.type,
    scope: ficha.scope,
    coversBibleBooks: ficha.coversBibleBooks ?? [],
    language: ficha.language,

    license: ficha.license,
    licenseUrl: ficha.licenseUrl ?? null,
    rightsStatus: ficha.rightsStatus,
    ingestionStatus: ficha.ingestionStatus,
    riskLevel: ficha.riskLevel,
    publiclyCitable: true,
    sourceUrl: ficha.sourceUrl,
    citation: ficha.citation,

    // El texto ya viene estructurado: nada que extraer.
    textExtractionStatus: 'ready',
    extractionVersion: EXTRACTION_VERSION,
    structuredContentUrl: `gs://${BUCKET}/${rutaStorage}`,
    textContent: contenido.slice(0, TOPE_TEXT_CONTENT),
    wasTruncated: contenido.length > TOPE_TEXT_CONTENT,
    characterCount: contenido.length,
    extractedAt: new Date(),
    sizeBytes: Buffer.byteLength(contenido),
    pageCount: 0,

    // `needsReindex` en true es lo que hace que el disparador lo tome aunque
    // el documento nazca ya en `ready`: sin transición de estado no habría
    // nada que disparar.
    needsReindex: true,
    indexingStatus: 'pending',
    indexerVersion: null,
    indexedChunkCount: 0,
    coreStores: ficha.coreStores ?? [],

    createdAt: new Date(),
    updatedAt: new Date(),
};

await db.collection('library_resources').doc(ficha.id).set(doc);

console.log('3/3 listo. El disparador de auto-indexado toma el recurso solo.');
console.log(`\nVerificá el avance con:`);
console.log(`  node scripts/verificar-ingesta.mjs ${ficha.id}`);
console.log(`\nIndexador vigente: ${INDEXER_VERSION_CURRENT} · ${secciones} secciones a vectorizar.`);
