/**
 * Auditoría de las citas de un trabajo exegético.
 *
 * Lista cada cita con su fuente, su número, qué clase de número es y si esa
 * fuente tiene numeración confirmada. Es la tabla que hubo que armar a mano
 * cuando un trabajo real salió con diez de once citas apuntando a la hoja del
 * PDF y diciendo «p.»; tenerla en un comando es lo que vuelve repetible la
 * revisión antes de entregar.
 *
 *   npx tsx scripts/auditar-citas.ts <paperId>
 *
 * Requiere credenciales de aplicación (`gcloud auth application-default login`).
 */
import admin from 'firebase-admin';
import { printedLabelIn, type PageNumbering } from '../packages/domain/src/exegesis/outline/pageNumbering';

const PAPER_ID = process.argv[2];
if (!PAPER_ID) {
    console.error('Uso: npx tsx scripts/auditar-citas.ts <paperId>');
    process.exit(1);
}

if (!admin.apps.length) admin.initializeApp({ projectId: 'dosfilosapp' });
const db = admin.firestore();

interface Cita {
    verso: string;
    sourceKey: string;
    page: number;
    pageKind?: 'printed' | 'sheet';
    donde: string;
}

/** Recorre los seis sitios del análisis que llevan cita. */
function citasDe(ca: any, verso: string): Cita[] {
    const out: Cita[] = [];
    const push = (c: any, donde: string) => {
        if (!c?.sourceKey || typeof c.page !== 'number') return;
        out.push({ verso, sourceKey: c.sourceKey, page: c.page, pageKind: c.pageKind, donde });
    };
    for (const c of ca.commentatorEngagement ?? []) push(c, 'comentarista');
    for (const crux of ca.translationCruxes ?? []) {
        for (const p of crux.commentatorPositions ?? []) push(p, `crux ${crux.phrase ?? ''}`.trim());
    }
    for (const l of ca.lexicalAnalyses ?? []) {
        for (const s of l.generalSemanticRange?.sources ?? []) push(s, `léxico ${l.lemma ?? ''}`.trim());
        for (const s of l.loadingSources ?? []) push(s, `léxico ${l.lemma ?? ''}`.trim());
    }
    for (const f of ca.footnoteExtensions ?? []) for (const s of f.sources ?? []) push(s, 'nota');
    for (const o of ca.oldTestamentLinks ?? []) for (const s of o.sources ?? []) push(s, 'vínculo AT');
    for (const h of ca.historicalContext ?? []) for (const s of h.sources ?? []) push(s, 'contexto');
    return out;
}

async function main() {
    const snap = await db.collection('exegeticalPapers').doc(PAPER_ID).get();
    if (!snap.exists) throw new Error(`No existe el paper ${PAPER_ID}`);
    const paper = snap.data() as any;

    // Numeración de cada fuente citable, por clave de cita.
    const numeraciones = new Map<string, { numbering: PageNumbering | null; titulo: string }>();
    for (const source of paper.sources ?? []) {
        if (!source.citationKey) continue;
        const resourceId = source.sourceLibraryResourceId ?? source.corpusId;
        const r = await db.collection('library_resources').doc(resourceId).get();
        const data = r.data() as any;
        numeraciones.set(source.citationKey, {
            numbering: data?.pageNumbering ?? null,
            titulo: data?.title ?? source.displayLabel ?? resourceId,
        });
    }

    const citas: Cita[] = [];
    for (const step of paper.steps ?? []) {
        const ca = step.current?.canonicalAnalysis;
        if (!ca) continue;
        const r = ca.reference;
        citasDe(ca, r ? `${r.chapterStart}:${r.verseStart}` : step.kind).forEach(c => citas.push(c));
    }

    console.log(`\nPaper ${PAPER_ID} — ${citas.length} citas\n`);
    console.log('verso    fuente        nº    clase      numeración de la fuente        veredicto');
    console.log('─'.repeat(100));

    let sospechosas = 0;
    for (const c of citas) {
        const info = numeraciones.get(c.sourceKey);
        const kind = c.pageKind ?? 'sheet';
        const confirmada = info?.numbering?.origin === 'confirmed';
        const estado = !info?.numbering ? 'ninguna'
            : info.numbering.origin === 'confirmed' ? 'confirmada' : 'sólo propuesta';

        let veredicto: string;
        if (kind === 'printed') {
            veredicto = confirmada ? 'OK — página impresa' : '⚠ dice impresa pero la fuente no está confirmada';
        } else if (!confirmada) {
            // Correcto: el sistema no sabe la página y no la inventa.
            veredicto = 'OK — se citará como «hoja»';
        } else {
            // `printedLabelIn` y no `printedPageIn`: en un tramo romano el
            // segundo devuelve null a propósito —para que nadie escriba
            // «p. 222» sobre una página que se imprime «ccxxii»— y esta
            // auditoría reportaba como sospechosas las citas a los
            // preliminares de un libro que están perfectamente bien.
            const impresa = printedLabelIn(info!.numbering, c.page);
            veredicto = impresa === null
                ? '⚠ hoja fuera de todo tramo numerado'
                : `hoja ${c.page} → se rendirá como p. ${impresa}`;
        }
        if (veredicto.startsWith('⚠')) sospechosas++;

        console.log(
            `${c.verso.padEnd(8)} ${c.sourceKey.slice(0, 12).padEnd(13)} ${String(c.page).padStart(4)}  ` +
            `${kind.padEnd(9)} ${estado.padEnd(30)} ${veredicto}`,
        );
    }

    console.log('\nFuentes del trabajo:');
    for (const [key, info] of numeraciones) {
        const n = info.numbering;
        const tramos = n?.segments
            .map(s => `${s.fromSheet}-${s.toSheet}: ${s.offset ?? 'sin num.'}${s.style === 'roman' ? ' (romano)' : ''}`)
            .join(' | ');
        console.log(`  ${key.padEnd(12)} ${n ? `[${n.origin}] ${tramos}` : 'sin numeración'}`);
    }
    console.log(sospechosas === 0
        ? '\n✓ Ninguna cita afirma una página que el sistema no pueda justificar.'
        : `\n⚠ ${sospechosas} cita(s) para mirar a mano.`);
}

main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
});
