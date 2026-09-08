/**
 * Verifica una obra de la biblioteca común después de ingerirla.
 *
 * Responde las tres preguntas que importan y que no se pueden dar por
 * supuestas: ¿se indexó?, ¿los fragmentos quedaron anclados al pasaje?, y
 * ¿la ve un usuario cualquiera?
 *
 * La tercera es la que suele fallar en silencio: un recurso puede estar
 * perfectamente indexado y seguir invisible si quedó bajo la cuenta de quien
 * lo subió en vez de bajo el centinela de la plataforma. Fue exactamente lo
 * que pasó con la semilla de credos y confesiones.
 *
 * Correr: node scripts/verificar-ingesta.mjs <resourceId>
 */
import admin from 'firebase-admin';

const [resourceId] = process.argv.slice(2);
if (!resourceId) {
    console.error('Uso: node scripts/verificar-ingesta.mjs <resourceId>');
    process.exit(1);
}

const SYSTEM_SOURCE_OWNER_ID = '__system__';

admin.initializeApp({ projectId: 'dosfilosapp' });
const db = admin.firestore();

const snap = await db.collection('library_resources').doc(resourceId).get();
if (!snap.exists) {
    console.error(`✗ No existe el recurso ${resourceId}`);
    process.exit(1);
}
const r = snap.data();

console.log('─'.repeat(64));
console.log(r.title);
console.log('─'.repeat(64));

const visible = r.userId === SYSTEM_SOURCE_OWNER_ID;
console.log(`\n1. ¿La ve todo el mundo?`);
console.log(`   ${visible ? '✓' : '✗'} userId = ${r.userId}` + (visible ? '' : '  ← quedó en una cuenta, nadie más la ve'));

console.log(`\n2. ¿Se indexó?`);
console.log(`   estado:    ${r.indexingStatus ?? '(sin estado)'}`);
console.log(`   fragmentos: ${r.indexedChunkCount ?? 0}`);
console.log(`   indexador: ${r.indexerVersion ?? '(todavía ninguno)'}`);
console.log(`   pendiente: ${r.needsReindex === true ? 'sí — aún no corrió o corrió y falló' : 'no'}`);
if (r.indexingError) console.log(`   ✗ error:   ${r.indexingError}`);

const chunks = await db.collection('document_chunks')
    .where('resourceId', '==', resourceId)
    .limit(400)
    .get();

console.log(`\n3. ¿Los fragmentos quedaron anclados al pasaje?`);
if (chunks.empty) {
    console.log('   ✗ Ningún fragmento todavía.');
} else {
    // El anclaje vive en el encabezado de sección que el chunker preserva.
    // Sin él, el fragmento existe pero el recuperador no sabe de qué pasaje
    // habla, que es justo lo que la conversión desde ThML vino a evitar.
    const conAncla = chunks.docs.filter(d => {
        const j = JSON.stringify(d.data());
        return /"[A-Z1-3]{2,3} \d+(:\d+)?"/.test(j) || /## [A-Z1-3]{2,3} \d+/.test(j);
    }).length;
    console.log(`   muestra revisada: ${chunks.size}`);
    console.log(`   con ancla de pasaje: ${conAncla} (${Math.round(conAncla / chunks.size * 100)}%)`);
    const ejemplo = chunks.docs[0].data();
    const texto = String(ejemplo.text ?? ejemplo.content ?? '');
    console.log(`\n   ejemplo — secciones: ${JSON.stringify(ejemplo.sectionPath ?? ejemplo.headings ?? '(sin ruta)')}`);
    console.log(`   ${texto.slice(0, 180).replace(/\n/g, ' ')}…`);
}

console.log('\n' + '─'.repeat(64));
const listo = visible && r.indexingStatus === 'ready' && (r.indexedChunkCount ?? 0) > 0;
console.log(listo ? '✓ La obra está disponible para todos los usuarios.' : '⏳ Todavía no está lista.');
