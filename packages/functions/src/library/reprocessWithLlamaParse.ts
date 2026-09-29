import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { appCheckCallableOptions } from '../config/appCheckOptions';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LlamaParseClient, pagesToMarkedText, pagesToMarkdown } from './llamaParseClient';
import { consumePagesAdmin, readBalance } from './processingBalance';
import { recordLlamaParseUsage, selectLlamaParseAccount } from './llamaParseAccountSelector';
import { isMarkerOnlyMarkdown } from './indexCoverage';
import { truncateUtf8 } from './truncateUtf8';
import { randomUUID } from 'crypto';
import { censusOf } from './scriptCensus';
import { abrirFicha, cerrarFicha, cronometrar, preflightDe } from './fichaDeCorrida';

const ADMIN_EMAIL = 'rdocerda@gmail.com';

interface ReprocessRequest {
    resourceId: string;
    force?: boolean;  // Re-extract even if already on LlamaParse
}

/**
 * Callable Cloud Function: re-extracts a single library_resource using LlamaParse.
 *
 * Authorized callers:
 *   - Admin (`ADMIN_EMAIL`) — for Core Library curation flows.
 *   - The resource owner (`auth.uid === resource.userId`) — for the
 *     user-facing "Reintentar Premium" action surfaced when the
 *     extraction cascade degraded from the user's requested tier.
 *
 * Pre-conditions enforced before starting (so we fail fast instead of
 * burning 5+ minutes on a doomed run):
 *   - For non-admin callers: `processingBalance.premiumPagesAvailable`
 *     must cover the resource's existing `pageCount` estimate.
 *
 * Safe to call repeatedly (idempotent when `force=false` and the
 * resource is already on LlamaParse).
 */
export const reprocessWithLlamaParse = onCall<ReprocessRequest>(
    {
        ...appCheckCallableOptions(),
        region: 'us-central1',
        memory: '2GiB',
        timeoutSeconds: 900,  // 15 minutes — enough for 700+ page documents in fast mode
        // All possible LlamaParse account secrets must be declared so the
        // multi-account selector can resolve any of them at runtime. Add new
        // ones here when you provision additional accounts.
        secrets: [
            'LLAMAPARSE_API_KEY',          // account #1 (existing, legacy env name)
            'LLAMAPARSE_API_KEY_FREE_1',   // account #2
        ],
    },
    async (request) => {
        const callerEmail = request.auth?.token?.email ?? 'unauthenticated';
        const callerUid = request.auth?.uid;
        console.log(`[Reprocess] Called by ${callerEmail} (uid=${callerUid?.substring(0, 8) ?? 'n/a'})`);

        if (!request.auth || !callerUid) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const { resourceId, force = false } = request.data;
        if (!resourceId) throw new HttpsError('invalid-argument', 'resourceId is required');
        console.log(`[Reprocess] Starting for resourceId=${resourceId}, force=${force}`);

        const db = getFirestore();
        const storage = getStorage();
        const resourceRef = db.collection('library_resources').doc(resourceId);
        const snap = await resourceRef.get();
        if (!snap.exists) throw new HttpsError('not-found', `Resource ${resourceId} not found`);

        const data = snap.data()!;

        // Authorization: admin OR the resource owner.
        const isAdmin = callerEmail === ADMIN_EMAIL;
        const isOwner = data.userId === callerUid;
        if (!isAdmin && !isOwner) {
            throw new HttpsError('permission-denied', 'You can only reprocess your own resources');
        }

        if (!force && data.extractionVersion === '3.0-llamaparse') {
            console.log(`[Reprocess] ${resourceId} already on LlamaParse. Skipping (use force=true to override).`);
            return { success: true, skipped: true, reason: 'already-llamaparse' };
        }

        // Balance pre-check for non-admin callers. Admin reprocess is
        // backed by the shared Core Library budget so it doesn't hit the
        // user's quota. For users we estimate pages from the existing
        // `pageCount` (set by the previous extractor) and refuse early
        // if balance can't cover it. Estimate uses a 20% buffer because
        // page counts can shift slightly between extractors.
        if (!isAdmin) {
            const estimate = Math.ceil((data.pageCount ?? 1) * 1.2);
            const balance = await readBalance(callerUid);
            if (balance.premiumPagesAvailable < estimate) {
                throw new HttpsError(
                    'resource-exhausted',
                    `Saldo insuficiente: necesitas ~${estimate} páginas premium, tienes ${balance.premiumPagesAvailable}.`,
                    {
                        required: estimate,
                        available: balance.premiumPagesAvailable,
                    },
                );
            }
            console.log(`[Reprocess] Balance check OK: ${balance.premiumPagesAvailable} premium available, ~${estimate} estimated`);
        }

        // Pick a LlamaParse account from the multi-account pool (Hito 6).
        // Throws when nothing is configured — clearer error than a blank API key.
        let selected;
        try {
            selected = await selectLlamaParseAccount();
        } catch (err: any) {
            console.error('[Reprocess] LlamaParse account selection failed:', err.message);
            throw new HttpsError('failed-precondition', err.message);
        }
        console.log(
            `[Reprocess] Using account ${selected.accountId} (${selected.accountName}); ${selected.availableCredits} credits available`,
        );

        // Parse storageUrl — may be "gs://bucket/path" OR Firebase HTTPS download URL
        // HTTPS format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{url-encoded-path}?alt=media&token=...
        const { bucket: bucketName, path: storagePath } = parseFirebaseStorageLocation(
            data.storageUrl,
            'dosfilosapp.firebasestorage.app'
        );
        if (!storagePath) throw new HttpsError('failed-precondition', `Resource ${resourceId}: could not parse storageUrl "${data.storageUrl}"`);
        console.log(`[Reprocess] Parsed storage location: bucket=${bucketName}, path=${storagePath}`);

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(storagePath);

        // Download PDF to temp
        const tempFilePath = path.join(os.tmpdir(), `${resourceId}.pdf`);
        await file.download({ destination: tempFilePath });
        const stats = fs.statSync(tempFilePath);
        console.log(`[Reprocess] ${data.title ?? resourceId}: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        const runId = randomUUID();
        await abrirFicha(db, {
            runId,
            resourceId,
            userId: data.userId,
            path: 'reprocess-premium',
            fileBytes: stats.size,
            requestedMode: 'premium',
            preflight: preflightDe(data.preflight),
        });
        const intento = cronometrar('llamaparse', selected.accountId);

        try {
            await resourceRef.update({
                textExtractionStatus: 'processing',
                processingStartedAt: FieldValue.serverTimestamp(),
                updatedAt: new Date(),
            });

            const buffer = fs.readFileSync(tempFilePath);
            const client = new LlamaParseClient(selected.apiKey);
            const result = await client.parseDocument(buffer, `${resourceId}.pdf`, {
                mode: 'fast',
                language: 'es',
                parsingInstruction: 'Preserva con precisión los caracteres griegos (α-ω) y hebreos (א-ת). Mantén la estructura de capítulos, secciones, tablas y notas al pie.',
                maxPollSeconds: 840,  // 14 minutes — leave buffer under function timeout
                pollIntervalMs: 3000,
            });

            const extractedText = pagesToMarkedText(result.pages);
            const structuredMarkdown = pagesToMarkdown(result.pages);

            // Rótulos de página sin texto entre ellos es una extracción
            // vacía. Guardarla como buena es lo que dejó a Wallace
            // indexado hasta la página 433 de 711.
            if (isMarkerOnlyMarkdown(structuredMarkdown)) {
                throw new HttpsError(
                    'internal',
                    `LlamaParse devolvió ${result.pages.length} página(s) rotuladas sin texto: extracción vacía. Reintenta más tarde.`,
                );
            }

            // Firestore topa el documento en 1 MiB. Se trunca por BYTES:
            // `substring` cuenta caracteres, y 900.000 caracteres de
            // griego pesan ~1,8 MB — la escritura entera se rechazaba.
            // El trigger de extracción ya lo había corregido; este
            // camino había quedado con el corte viejo.
            const MAX_BYTES = 900_000;
            const textBytes = Buffer.byteLength(extractedText, 'utf8');
            let finalText = extractedText;
            let wasTruncated = false;
            if (textBytes > MAX_BYTES) {
                finalText = truncateUtf8(extractedText, MAX_BYTES);
                wasTruncated = true;
            }

            // Store structured Markdown in Storage
            const userId: string = data.userId;
            const mdPath = `users/${userId}/library/${resourceId}/structured.md`;
            const mdFile = bucket.file(mdPath);
            await mdFile.save(structuredMarkdown, {
                contentType: 'text/markdown; charset=utf-8',
                metadata: { resourceId, extractionVersion: '3.0-llamaparse' },
            });
            const structuredContentUrl = `gs://${bucketName}/${mdPath}`;

            await resourceRef.update({
                textContent: finalText,
                textExtractionStatus: 'ready',
                extractedAt: new Date(),
                pageCount: result.pages.length,
                characterCount: extractedText.length,
                extractedWithLlamaParse: true,
                extractedWithGemini: false,
                extractionVersion: '3.0-llamaparse',
                // Reprocess succeeded at Premium → clear any prior warning
                // and error so the card stops showing the amber tooltip.
                extractionWarning: null,
                extractionError: null,
                structuredContentUrl,
                // El censo del texto nuevo: sin esto quedaba el de la
                // extracción anterior y la tarjeta juzgaba otro libro.
                scriptCensus: censusOf(extractedText),
                needsReindex: true,
                wasTruncated,
                updatedAt: new Date(),
            });

            const creditos = result.jobMetadata.job_credits_usage;
            await cerrarFicha(db, runId, {
                outcome: 'ready',
                extractionVersion: '3.0-llamaparse',
                pagesExpected: typeof data.pageCount === 'number' ? data.pageCount : undefined,
                pagesEmitted: result.pages.length,
                text: extractedText,
                llamaParseCredits: typeof creditos === 'number' ? creditos : undefined,
                engines: [intento('ok')],
            });

            // Debit the premium processing balance for the actual pages consumed.
            // Non-fatal on error — extraction already succeeded.
            try {
                await consumePagesAdmin(data.userId, 'premium', result.pages.length);
            } catch (balanceErr: any) {
                console.warn(
                    `[Reprocess] Balance update skipped for ${data.userId}: ${balanceErr.message}`,
                );
            }

            // Track usage on the selected LlamaParse account so the rotation
            // logic knows when to switch. Use ACTUAL credits from
            // jobMetadata (LlamaParse returns 0 for cached jobs); using
            // pageCount inflates the counter and eventually makes accounts
            // look exhausted while the dashboard has capacity. Same root
            // cause as the cascade-side bug fixed in extractPdfWithGemini.ts.
            try {
                const reportedCredits = result.jobMetadata.job_credits_usage;
                const creditsToRecord = typeof reportedCredits === 'number'
                    ? reportedCredits
                    : result.pages.length;
                if (creditsToRecord > 0) {
                    await recordLlamaParseUsage(selected.accountId, creditsToRecord);
                } else {
                    console.log(`[Reprocess] LlamaParse charged 0 credits (cached/free); skipping counter update`);
                }
            } catch (accountErr: any) {
                console.warn(
                    `[Reprocess] Account usage update skipped for ${selected.accountId}: ${accountErr.message}`,
                );
            }

            console.log(`[Reprocess] ✅ ${resourceId}: ${result.pages.length} pages, ${result.jobMetadata.job_credits_usage ?? '?'} credits`);

            return {
                success: true,
                resourceId,
                pageCount: result.pages.length,
                characterCount: extractedText.length,
                creditsUsed: result.jobMetadata.job_credits_usage ?? 0,
                wasTruncated,
            };
        } catch (err: any) {
            const errorMessage = err?.message ?? 'Unknown error';
            const errorStack = err?.stack ?? '';
            console.error(`[Reprocess] ❌ ${resourceId}: ${errorMessage}`);
            console.error('[Reprocess] Stack:', errorStack);
            await resourceRef.update({
                textExtractionStatus: 'failed',
                extractionError: errorMessage,
                updatedAt: new Date(),
            });
            await cerrarFicha(db, runId, { outcome: 'failed', reason: errorMessage, engines: [intento('error', errorMessage)] });
            // Propagate the real error message so the admin UI shows useful info
            throw new HttpsError('internal', `Reprocess failed: ${errorMessage}`, {
                originalMessage: errorMessage,
            });
        } finally {
            try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ }
        }
    }
);

/**
 * Parse a Firebase Storage location string into { bucket, path }.
 * Supports:
 *   1. gs://bucket-name/path/to/file
 *   2. https://firebasestorage.googleapis.com/v0/b/bucket-name/o/url%2Fencoded%2Fpath?alt=media&token=...
 *   3. https://storage.googleapis.com/bucket-name/path/to/file (legacy)
 */
function parseFirebaseStorageLocation(
    url: string,
    defaultBucket: string
): { bucket: string; path: string } {
    if (!url) return { bucket: defaultBucket, path: '' };

    // Case 1: gs:// scheme
    const gsMatch = url.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (gsMatch) {
        return { bucket: gsMatch[1], path: decodeURIComponent(gsMatch[2]) };
    }

    // Case 2: Firebase download URL
    // Pattern: /v0/b/{bucket}/o/{encoded-path}?...
    const fbMatch = url.match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/);
    if (fbMatch) {
        return { bucket: fbMatch[1], path: decodeURIComponent(fbMatch[2]) };
    }

    // Case 3: storage.googleapis.com legacy URL
    const gcsMatch = url.match(/^https?:\/\/storage\.googleapis\.com\/([^/]+)\/(.+?)(\?|$)/);
    if (gcsMatch) {
        return { bucket: gcsMatch[1], path: decodeURIComponent(gcsMatch[2]) };
    }

    return { bucket: defaultBucket, path: '' };
}
