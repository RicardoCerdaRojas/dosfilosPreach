/**
 * Backfill de la numeración impresa de los recursos ya indexados.
 *
 * Los libros que están en la biblioteca nunca van a pasar por el paso de
 * calibración de la subida, así que sin esto el trabajo sólo serviría para los
 * que vengan. Corriendo esto, los recursos cuya numeración el detector resuelve
 * quedan citables por página impresa sin que nadie toque nada.
 *
 * Lo que NO hace: confirmar. Todo lo que escribe entra como
 * `origin: 'detected'`, que es lo que después distingue una propuesta que
 * nadie miró de un número que alguien comparó contra el ejemplar. La pantalla
 * de calibración es la que asciende a `'confirmed'`.
 *
 *   npx tsx scripts/backfill-page-numbering.ts            # sólo informa
 *   npx tsx scripts/backfill-page-numbering.ts --apply    # escribe
 *
 * Requiere credenciales de aplicación (`gcloud auth application-default login`).
 */
import admin from 'firebase-admin';
import { detectNumberingSegments, type PageNumbering } from '../packages/domain/src/exegesis/outline/pageNumbering';

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'dosfilosapp';

interface SheetSample {
    page: number;
    text: string;
}

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

/**
 * Primera y última línea de cada hoja, que es donde vive el folio.
 *
 * Se reconstruye desde los fragmentos y no desde el PDF porque es la misma
 * evidencia que usa la app: si el detector no lo ve acá, tampoco lo vería en
 * producción, y el informe tiene que decir la verdad sobre lo que va a pasar.
 */
async function sheetsOf(resourceId: string): Promise<SheetSample[]> {
    const snap = await db.collection('document_chunks')
        .where('resourceId', '==', resourceId)
        .select('metadata', 'text', 'chunkIndex')
        .get();

    const byPage = new Map<number, { index: number; text: string }[]>();
    for (const doc of snap.docs) {
        const data = doc.data() as { metadata?: { page?: number }; text?: string; chunkIndex?: number };
        const page = data.metadata?.page;
        if (page == null) continue;
        const parts = byPage.get(page) ?? [];
        parts.push({ index: data.chunkIndex ?? 0, text: data.text ?? '' });
        byPage.set(page, parts);
    }

    const out: SheetSample[] = [];
    for (const [page, parts] of byPage) {
        parts.sort((a, b) => a.index - b.index);
        const lines = parts.map(p => p.text).join('\n')
            .split('\n').map(l => l.trim()).filter(Boolean);
        const first = lines[0] ?? '';
        const last = lines[lines.length - 1] ?? '';
        out.push({ page, text: last && last !== first ? `${first} ${last}` : first });
    }
    return out.sort((a, b) => a.page - b.page);
}

function describe(numbering: PageNumbering): string {
    return numbering.segments
        .map(s => `${s.fromSheet}-${s.toSheet}: ${s.offset === null ? 'sin numeración' : s.offset}`)
        .join(' | ');
}

async function main() {
    const resources = await db.collection('library_resources').get();
    let detected = 0;
    let skippedExisting = 0;
    let undetectable = 0;

    for (const doc of resources.docs) {
        const data = doc.data() as { title?: string; fileName?: string; pageNumbering?: PageNumbering };
        const label = (data.title ?? data.fileName ?? doc.id).slice(0, 48);

        // Una numeración confirmada por una persona no se toca jamás: el
        // detector es una inferencia sobre un texto que el OCR pudo estropear,
        // y sobreescribir a quien abrió el libro reintroduciría el error.
        if (data.pageNumbering?.origin === 'confirmed') {
            skippedExisting++;
            console.log(`  =  ${label} — ya confirmada, se respeta`);
            continue;
        }

        const numbering = detectNumberingSegments(await sheetsOf(doc.id));
        if (!numbering) {
            undetectable++;
            console.log(`  ·  ${label} — sin numeración detectable, queda para calibrar a mano`);
            continue;
        }

        detected++;
        console.log(`  ✓  ${label} — ${describe(numbering)}`);
        if (APPLY) await doc.ref.update({ pageNumbering: numbering, updatedAt: new Date() });
    }

    console.log(`\n${detected} con numeración detectada, ${undetectable} para calibrar a mano, ${skippedExisting} ya confirmadas.`);
    if (!APPLY) console.log('(informe solamente — volvé a correr con --apply para escribir)');
}

main().catch(err => {
    console.error('ERROR:', err);
    process.exit(1);
});
