/**
 * Relleno del índice de pasajes (fase «buscador de la biblioteca», etapa 3).
 *
 * El indexador deja en cada fragmento `refs` —los pasajes bíblicos que nombra—
 * desde esta etapa. Los fragmentos ya indexados no los tienen, y reindexar
 * para eso volvería a pagar los vectores de toda la biblioteca. Esto calcula
 * `refs` del texto y la sección que YA están guardados y escribe sólo ese
 * campo: los vectores no se tocan.
 *
 * Idempotente: un fragmento cuyo `refs` ya es el que saldría no se escribe.
 * Por eso sirve también para volver a pasar si el reconocedor mejora.
 *
 * Correrlo DESPUÉS de desplegar el indexador que escribe `refs`. Cada
 * escritura exige que el fragmento no haya cambiado desde que se leyó
 * (`lastUpdateTime`): si un reindexado lo recreó en el medio (mismo id, texto
 * nuevo), la escritura falla y se cuenta, en vez de pegarle claves del texto
 * viejo.
 *
 *   npx tsx scripts/rellenar-refs.ts                    # sólo informa (toda la colección)
 *   npx tsx scripts/rellenar-refs.ts --uid <uid>        # sólo la biblioteca de un usuario
 *   npx tsx scripts/rellenar-refs.ts --escribir         # escribe en PRODUCCIÓN (pide OK)
 *
 * Requiere credenciales de aplicación (`gcloud auth application-default login`).
 */
import admin from 'firebase-admin';
import { refsDeFragmento } from '../packages/functions/src/library/pasajes/refsDeTexto';

const PROJECT_ID = 'dosfilosapp';
const ESCRIBIR = process.argv.includes('--escribir');
const opcion = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const UID = opcion('--uid');
const PAGINA = 500;

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const iguales = (a: ReadonlyArray<string> | undefined, b: ReadonlyArray<string>) =>
    Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

async function main(): Promise<void> {
    let base: FirebaseFirestore.Query = db.collection('document_chunks');
    if (UID) base = base.where('userId', '==', UID);
    base = base.orderBy(admin.firestore.FieldPath.documentId()).select('text', 'metadata', 'refs');

    const escritor = ESCRIBIR ? db.bulkWriter() : null;
    let leidos = 0, conPasaje = 0, aEscribir = 0, refsTotales = 0, escritos = 0;
    const fallas = new Map<string, number>();
    // Sólo se reintentan los errores pasajeros; «no existe» (5) y «cambió» (9) no.
    escritor?.onWriteError(e => e.failedAttempts < 3 && e.code !== 5 && e.code !== 9);
    const muestras: string[] = [];
    let ultimo: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    for (;;) {
        const snap = await (ultimo ? base.startAfter(ultimo) : base).limit(PAGINA).get();
        if (snap.empty) break;
        for (const d of snap.docs) {
            leidos++;
            const sectionPath = (d.get('metadata')?.sectionPath as string[] | undefined) ?? [];
            const refs = refsDeFragmento(String(d.get('text') ?? ''), sectionPath);
            if (refs.length > 0) { conPasaje++; refsTotales += refs.length; }
            if (iguales(d.get('refs') as string[] | undefined, refs)) continue;
            aEscribir++;
            if (muestras.length < 8 && refs.length > 0) muestras.push(`${d.id}: ${refs.slice(0, 6).join(', ')}${refs.length > 6 ? ' …' : ''}`);
            escritor?.update(d.ref, { refs }, { lastUpdateTime: d.updateTime })
                .then(() => { escritos++; })
                .catch((e: { code?: number; message?: string }) => {
                    const clave = e.code === 9 ? 'cambió desde que se leyó' : e.code === 5 ? 'ya no existe' : String(e.message ?? e).slice(0, 80);
                    fallas.set(clave, (fallas.get(clave) ?? 0) + 1);
                });
        }
        ultimo = snap.docs[snap.docs.length - 1]!;
        process.stdout.write(`\r${leidos} leídos, ${aEscribir} a escribir`);
    }
    await escritor?.close();
    console.log(`\n${leidos} fragmentos${UID ? ` de ${UID}` : ''}; ${conPasaje} nombran algún pasaje (${leidos ? Math.round(100 * conPasaje / leidos) : 0} %), ${refsTotales} claves en total.`);
    console.log(ESCRIBIR ? `${escritos} de ${aEscribir} escritos.` : `${aEscribir} se escribirían (correr con --escribir).`);
    for (const [motivo, n] of fallas) console.log(`  sin escribir (${motivo}): ${n}`);
    for (const m of muestras) console.log(`  ${m}`);
}

main().catch(err => { console.error(err); process.exit(1); });
