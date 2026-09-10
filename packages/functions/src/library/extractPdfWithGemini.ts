import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LlamaParseClient, pagesToMarkedText, pagesToMarkdown } from './llamaParseClient';
import { recordLlamaParseUsage, selectAllLlamaParseAccounts, type SelectedLlamaParseAccount } from './llamaParseAccountSelector';
import { consumePagesAdmin, type ProcessingMode } from './processingBalance';
import { extractWithGemini } from './geminiExtraction';
import { describeSanitization, sanitizeExtractedText } from './sanitizeExtractedText';
import {
    EXTRACTION_TIMEOUT_SECONDS,
    pollBudgetForAccount,
} from './extractionBudget';
import { armExtractionDeadlineGuard, type DeadlineGuard } from './extractionDeadlineGuard';
import { isMarkerOnlyMarkdown } from './indexCoverage';
import { truncateUtf8 } from './truncateUtf8';
import { describeLayoutRepair, repairExtractedLayout } from './repairExtractedLayout';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import { censusOf } from './scriptCensus';


// Gemini file size limit is 50MB (per-call upload to the Files API).
// Files larger than this skip Gemini and fall to pdf-parse.
const MAX_GEMINI_FILE_SIZE = 50 * 1024 * 1024;
// LlamaParse supports up to 100MB (and we've verified free-tier covers typical theology books)
const MAX_LLAMAPARSE_FILE_SIZE = 100 * 1024 * 1024;

// Get API key from environment
const getApiKey = (): string => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable not set');
    }
    return apiKey;
};

/**
 * LlamaParse extraction — primary path.
 * Returns structured pages with reliable page numbers, plus the
 * actual credits consumed (NOT page count) so the per-account
 * counter mirrors what LlamaParse actually billed. Cached jobs and
 * some operations cost 0 credits even when pages are returned.
 */
async function extractWithLlamaParse(
    tempFilePath: string,
    resourceId: string,
    apiKey: string,
    maxPollSeconds: number,
): Promise<{ text: string; markdown: string; pageCount: number; creditsUsed: number }> {
    const buffer = fs.readFileSync(tempFilePath);
    const client = new LlamaParseClient(apiKey);

    const result = await client.parseDocument(buffer, `${resourceId}.pdf`, {
        mode: 'fast',
        maxPollSeconds,
        language: 'es',  // Most of the corpus is Spanish; Greek/Hebrew inline survives
        parsingInstruction: 'Preserva con precisión los caracteres griegos (α-ω) y hebreos (א-ת). Mantén la estructura de capítulos, secciones, tablas y notas al pie. No traduzcas términos teológicos ni citas bíblicas.',
    });

    // Trust LlamaParse's own credit count when reported; fall back to
    // page count only when the metadata field is missing (defensive
    // against API changes). Using the API-reported value prevents the
    // counter drift that surfaced in production: our counter incremented
    // by `pages.length` even when LlamaParse charged 0 (cached jobs),
    // making accounts look exhausted while the dashboard had capacity.
    const reportedCredits = result.jobMetadata.job_credits_usage;
    const creditsUsed = typeof reportedCredits === 'number'
        ? reportedCredits
        : result.pages.length;

    console.log(`[LlamaParse] Parsed ${result.pages.length} pages. Credits used: ${reportedCredits ?? '? (fallback to pageCount)'}`);

    const text = pagesToMarkedText(result.pages);
    const markdown = pagesToMarkdown(result.pages);

    // Un resultado con los rótulos de todas las páginas y sin texto
    // entre ellos NO es una extracción exitosa: es una vacía que pesa
    // algo. Pasaba por buena porque el archivo existía —así se indexó
    // Wallace hasta la página 433 de 711—. Se trata como fallo de esta
    // cuenta para que la cascada degrade a Gemini, que es exactamente
    // lo que corresponde cuando el motor primario no trajo texto.
    if (isMarkerOnlyMarkdown(markdown)) {
        throw new Error(
            `LlamaParse devolvió ${result.pages.length} página(s) rotuladas sin texto: extracción vacía`,
        );
    }

    return { text, markdown, pageCount: result.pages.length, creditsUsed };
}

/**
 * Clean up text extracted by pdf-parse
 * Fixes common issues like words stuck together
 *
 * La separación de mayúscula pegada sólo entendía alfabeto latino, así
 * que el griego y el hebreo salían intactos en su daño: el número de
 * versículo pegado a la palabra y la palabra partida por el guion de
 * fin de línea. Eso lo repara `repairExtractedLayout`, que corre ANTES
 * de colapsar los espacios —necesita ver el salto de línea para
 * reconocer el corte—.
 */
function cleanPdfText(text: string): { text: string; repair: ReturnType<typeof repairExtractedLayout>['report'] } {
    const repaired = repairExtractedLayout(text);
    return {
        text: repaired.text
            // Add space between lowercase and uppercase (camelCase words)
            .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
            // Fix common OCR issues
            .replace(/\s+/g, ' ')  // Multiple spaces to single
            .replace(/\n{3,}/g, '\n\n')  // Multiple newlines to double
            .trim(),
        repair: repaired.report,
    };
}

/**
 * Extract text using pdf-parse (last-resort fallback).
 *
 * Returns `text` with `[PAGE N]` markers AND `markdown` with the
 * `<!-- page: N -->` contract that the indexer expects — so even
 * pdf-parse output is fully auto-indexable. Page boundaries come from:
 *   1. Form-feed characters (`\f`) inserted by pdf-parse between pages
 *      when the source PDF has clean page structure.
 *   2. Equal-segment fallback (text length / numpages) when form-feeds
 *      are missing — citations from these chunks have approximate page
 *      numbers, but a searchable resource with off-by-1 citations beats
 *      "Por procesar" forever.
 */
async function extractWithPdfParse(buffer: Buffer): Promise<{
    text: string;
    markdown: string;
    pageCount: number;
}> {
    const pdfData = await pdfParse(buffer);
    const numpages = Math.max(1, pdfData.numpages);
    const rawText = pdfData.text ?? '';

    // Split into per-page strings — prefer form-feed boundaries (pdf-parse
    // inserts `\f` between pages on most PDFs). When the count doesn't
    // match `numpages` we fall back to equal-segment splitting so the
    // page numbers remain approximately right.
    let pageTexts: string[] = rawText.split('\f');
    if (pageTexts.length !== numpages) {
        const segmentLen = Math.ceil(rawText.length / numpages);
        pageTexts = [];
        for (let i = 0; i < numpages; i++) {
            pageTexts.push(rawText.substring(i * segmentLen, (i + 1) * segmentLen));
        }
    }

    // Clean each page independently (preserves the per-page structure so
    // line-end / multi-space normalization doesn't bleed across pages).
    const cleaned = pageTexts.map(t => cleanPdfText(t));
    const cleanedPages = cleaned.map(c => c.text);
    const repair = cleaned.reduce(
        (acc, c) => ({
            hyphenJoins: acc.hyphenJoins + c.repair.hyphenJoins,
            digitSplits: acc.digitSplits + c.repair.digitSplits,
        }),
        { hyphenJoins: 0, digitSplits: 0 },
    );
    const resumen = describeLayoutRepair(repair);
    if (resumen) console.log(`🔧 [Extract] maquetación reparada: ${resumen}`);

    const text = cleanedPages.map((p, i) => `[PAGE ${i + 1}]\n${p}`).join('\n\n');
    const markdown = cleanedPages
        .map((p, i) => `<!-- page: ${i + 1} -->\n${p}`)
        .join('\n\n---\n\n');

    return { text, markdown, pageCount: numpages };
}

// Gemini extraction (single-pass + batched) lives in `geminiExtraction.ts`
// so the admin callable `processWithGemini.ts` can share the same code
// path. The output contract is `{ text, markdown, pageCount }`; the
// auto-indexer picks up `extractionVersion: '4.0-gemini-standard'` set
// by callers.



/**
 * Cloud Function: Extract text from PDFs using Gemini or pdf-parse fallback
 * 
 * Triggers when a PDF is uploaded to: users/{userId}/library/{resourceId}/{filename}.pdf
 * - Files < 50MB: Uses Gemini for structured extraction with real page numbers
 * - Files >= 50MB: Falls back to pdf-parse with text cleanup
 */
export const extractPdfWithGemini = onObjectFinalized(
    {
        bucket: 'dosfilosapp.firebasestorage.app',
        region: 'us-central1',
        memory: '2GiB',
        // Storage triggers (`onObjectFinalized`) are capped at 540s by
        // the Firebase platform — the deploy CLI rejects anything
        // higher with "timeouts exceed the maximum allowed for their
        // trigger type". Carson/Moo-class books (50 MB / 790 págs) sit
        // right at this edge; if the cascade hits the cap mid-write the
        // resource can end up zombie.
        //
        // For docs that genuinely need >540s, use the manual
        // `reprocessWithLlamaParse` callable (HTTP trigger, 900s budget)
        // — surfaced via the "Reintentar Premium" button when an
        // upload degrades.
        timeoutSeconds: 540,
        secrets: [
            'GEMINI_API_KEY',
            // Two free-tier LlamaParse accounts at launch:
            //   - `LLAMAPARSE_API_KEY`         → account #1 (preserved from the
            //     legacy single-account env so the existing prod key keeps
            //     working untouched)
            //   - `LLAMAPARSE_API_KEY_FREE_1`  → account #2 (added for
            //     rotation capacity)
            // Both are referenced from docs in the `llamaparseAccounts`
            // Firestore collection via the `apiKeySecretEnv` field. To scale
            // beyond 2 accounts, add the new secret name here and in
            // `reprocessWithLlamaParse.ts`, then create the matching account
            // doc in Firestore.
            'LLAMAPARSE_API_KEY',
            'LLAMAPARSE_API_KEY_FREE_1',
        ],
    },
    async (event) => {
        const db = getFirestore();
        const storage = getStorage();
        const filePath = event.data.name;
        const contentType = event.data.contentType;
        // Reloj de la invocación. Lo leen el presupuesto de espera por
        // cuenta y los registros: sin él, «cuánto queda» es una
        // suposición.
        const invocationStartedAt = Date.now();
        const elapsedSeconds = () => (Date.now() - invocationStartedAt) / 1000;
        let deadlineGuard: DeadlineGuard | null = null;

        console.log(`📄 [Extract] Processing file: ${filePath}`);

        // Only process PDFs in library folder
        if (!filePath || !contentType?.includes('pdf')) {
            console.log('Skipping: Not a PDF file');
            return;
        }

        // Check if it's in the library path
        const libraryPathMatch = filePath.match(/^users\/([^/]+)\/library\/([^/]+)\//);
        if (!libraryPathMatch) {
            console.log('Skipping: Not in library path');
            return;
        }

        const userId = libraryPathMatch[1];
        const resourceId = libraryPathMatch[2];

        console.log(`📚 [Extract] Processing for user: ${userId}, resource: ${resourceId}`);

        try {
            // Wait for document to exist (may be created shortly after upload)
            let resourceDoc;
            const resourceRef = db.collection('library_resources').doc(resourceId);
            const maxRetries = 5;
            const retryDelayMs = 3000;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                resourceDoc = await resourceRef.get();
                if (resourceDoc.exists) {
                    console.log(`✅ [Extract] Document found on attempt ${attempt}`);
                    break;
                }
                console.log(`⏳ [Extract] Document not found (attempt ${attempt}/${maxRetries}), waiting ${retryDelayMs}ms...`);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                }
            }

            if (!resourceDoc || !resourceDoc.exists) {
                console.log(`⚠️ [Extract] Resource document ${resourceId} not found after ${maxRetries} attempts`);
                return;
            }

            // Update status to processing.
            // `processingStartedAt` is the wall-clock anchor the UI uses
            // to render "Procesando hace 4m 23s" without depending on
            // when the user opened the page. Server-stamped via
            // serverTimestamp() so client clock skew can't make the
            // elapsed time go negative or jitter.
            await resourceRef.update({
                textExtractionStatus: 'processing',
                processingStartedAt: FieldValue.serverTimestamp(),
                updatedAt: new Date(),
            });
            console.log(`🔄 [Extract] Set status to 'processing' for resource ${resourceId}`);

            // A partir de acá la invocación puede morir de vieja, y a esa
            // muerte no se le pone `catch`. El guardia deja el motivo
            // escrito mientras todavía hay proceso para escribirlo; si la
            // extracción termina bien después, su escritura lo pisa.
            deadlineGuard = armExtractionDeadlineGuard(async () => {
                console.error(`⏱️ [Extract] Tiempo agotado para ${resourceId}; se marca 'failed' antes de que la plataforma corte`);
                await resourceRef.update({
                    textExtractionStatus: 'failed',
                    extractionError: `La extracción superó el tiempo máximo de ${EXTRACTION_TIMEOUT_SECONDS} s. Reintenta con Premium, que dispone de más tiempo.`,
                    extractionFailureReason: 'timeout',
                    extractionAttemptedAt: new Date(),
                    updatedAt: new Date(),
                });
            });

            // Download PDF to temp file
            const bucket = storage.bucket(event.data.bucket);
            const file = bucket.file(filePath);
            const tempFilePath = path.join(os.tmpdir(), `${resourceId}.pdf`);

            await file.download({ destination: tempFilePath });
            const stats = fs.statSync(tempFilePath);
            const fileSizeMB = stats.size / 1024 / 1024;
            console.log(`📥 [Extract] Downloaded file: ${fileSizeMB.toFixed(2)} MB`);

            // Pre-read the PDF page count cheaply with pdf-parse so the
            // Gemini path can detect silent truncation (returning fewer
            // pages than the source has). This 1-2s up-front read is
            // worth it: without the ground truth, Gemini's "I returned
            // 40 pages" looks like a complete extraction even when the
            // source has 378 pages. Failing fast lets the cascade
            // degrade to pdf-parse, which delivers ALL the content.
            let expectedPageCount: number | undefined;
            try {
                const buf = fs.readFileSync(tempFilePath);
                const meta = await pdfParse(buf);
                expectedPageCount = meta.numpages;
                console.log(`📐 [Extract] PDF has ${expectedPageCount} page(s) per pdf-parse`);
            } catch (metaErr: any) {
                console.warn(`⚠️ [Extract] pdf-parse pre-read failed (continuing without page count): ${metaErr?.message ?? metaErr}`);
            }

            // Definite-assignment: the cascade below always assigns these
            // — either via a successful LlamaParse account, the Gemini
            // fallback, or the pdf-parse last resort. TS can't narrow
            // through the for-loop so we mark them definite to avoid
            // forced sentinel values.
            let extractedText!: string;
            let pageCount!: number;
            let extractionVersion!: string;
            let structuredMarkdown: string | null = null;

            // Honor the user's choice when they explicitly picked a tier
            // at upload time. Field is optional — when absent, fall back
            // to the legacy "premium-first cascade" so existing uploads
            // and any non-form code paths keep behaving as before.
            //
            //   'standard' → skip LlamaParse entirely. Goes straight to
            //                Gemini → pdf-parse. Debits standard pages.
            //   'premium'  → cascade as today. Debits premium when
            //                LlamaParse runs successfully; standard when
            //                it falls back.
            const requestedMode = resourceDoc.data()?.requestedExtractionMode as 'standard' | 'premium' | undefined;
            const userOptedOutOfPremium = requestedMode === 'standard';

            // Resolve every eligible LlamaParse account upfront so the
            // cascade can iterate them on per-account failure (rate limit,
            // queue timeout, account-side error) before degrading to
            // Gemini. Empty list when user opted into Standard, file
            // exceeds LlamaParse's 100 MB cap, or no account is configured.
            let llamaAccounts: SelectedLlamaParseAccount[] = [];
            if (!userOptedOutOfPremium && stats.size <= MAX_LLAMAPARSE_FILE_SIZE) {
                try {
                    llamaAccounts = await selectAllLlamaParseAccounts();
                } catch (selectErr: any) {
                    console.warn(`⚠️ [Extract] LlamaParse account lookup failed: ${selectErr.message}`);
                }
            } else if (userOptedOutOfPremium) {
                console.log(`📄 [Extract] User opted for STANDARD; skipping LlamaParse for resource ${resourceId}`);
            }
            const canUseLlamaParse = llamaAccounts.length > 0;
            // Track which account ultimately succeeded so we can record
            // its usage after the cascade finishes. Also collected for
            // structured-failure debugging.
            let llamaSucceededOn: SelectedLlamaParseAccount | null = null;
            // Actual credits LlamaParse charged for the successful job
            // (NOT page count — see comment in extractWithLlamaParse).
            let llamaCreditsUsed = 0;
            const llamaErrors: Array<{ account: string; error: string }> = [];

            // Extraction priority:
            //   1. LlamaParse (primary) — best structure/page preservation.
            //      Tries every eligible account before degrading.
            //   2. Gemini 2.5 Flash (fallback) — reliable text extraction.
            //   3. pdf-parse (last resort) — local, free, basic.
            if (canUseLlamaParse) {
                for (const [index, account] of llamaAccounts.entries()) {
                    // El presupuesto se calcula acá, contra lo que la
                    // invocación ya gastó, y no como constante: la
                    // descarga del PDF y la lectura previa de páginas ya
                    // consumieron tiempo, y el fallback de Gemini
                    // necesita quedar alcanzable.
                    const pollSeconds = pollBudgetForAccount({
                        elapsedSeconds: elapsedSeconds(),
                        accountsRemaining: llamaAccounts.length - index,
                    });
                    if (pollSeconds === 0) {
                        console.warn(
                            `⏱️ [Extract] Sin tiempo para la cuenta ${account.accountId} (${Math.round(elapsedSeconds())}s gastados de ${EXTRACTION_TIMEOUT_SECONDS}s); se baja al fallback con aire`,
                        );
                        llamaErrors.push({ account: account.accountId, error: 'sin presupuesto de tiempo restante' });
                        break;
                    }
                    console.log(`🦙 [Extract] Trying LlamaParse account ${account.accountId} (${account.availableCredits} credits available, ${pollSeconds}s de espera)`);
                    try {
                        const result = await extractWithLlamaParse(tempFilePath, resourceId, account.apiKey, pollSeconds);
                        extractedText = result.text;
                        pageCount = result.pageCount;
                        structuredMarkdown = result.markdown;
                        extractionVersion = '3.0-llamaparse';
                        llamaSucceededOn = account;
                        llamaCreditsUsed = result.creditsUsed;
                        break; // Success — stop trying other accounts.
                    } catch (llamaError: any) {
                        const msg = llamaError?.message ?? String(llamaError);
                        console.warn(`⚠️ [Extract] LlamaParse account ${account.accountId} failed: ${msg}`);
                        llamaErrors.push({ account: account.accountId, error: msg });
                        // Loop continues — try next account.
                    }
                }

                if (llamaSucceededOn) {
                    // Record actual credits consumed (from LlamaParse's
                    // jobMetadata) — not page count. Cached jobs report
                    // 0 credits even when pages > 0; using page count
                    // there inflates our counter and eventually makes
                    // accounts look exhausted while the dashboard shows
                    // capacity remaining (the bug that broke Carson/Moo
                    // routing on 2026-05-03).
                    try {
                        if (llamaCreditsUsed > 0) {
                            await recordLlamaParseUsage(llamaSucceededOn.accountId, llamaCreditsUsed);
                        } else {
                            console.log(`💰 [Extract] LlamaParse charged 0 credits (cached/free); skipping counter update`);
                        }
                    } catch (usageErr: any) {
                        console.warn(`[Extract] Account usage update skipped: ${usageErr.message}`);
                    }
                } else {
                    // Every LlamaParse account failed. Degrade to Gemini
                    // (or pdf-parse if Gemini can't handle the size).
                    console.warn(
                        `⚠️ [Extract] All ${llamaAccounts.length} LlamaParse account(s) failed; falling back to Gemini. Errors: ${JSON.stringify(llamaErrors)}`,
                    );
                    if (stats.size <= MAX_GEMINI_FILE_SIZE) {
                        // Batched extraction (router inside extractWithGemini)
                        // handles long page counts by splitting into chunks,
                        // so we no longer need the 12MB heuristic that used
                        // to bail out for text-heavy commentaries.
                        try {
                            const result = await extractWithGemini(tempFilePath, resourceId, getApiKey(), expectedPageCount, userId);
                            extractedText = result.text;
                            pageCount = result.pageCount;
                            structuredMarkdown = result.markdown;
                            extractionVersion = '4.0-gemini-standard';
                        } catch (geminiError) {
                            console.warn(`⚠️ [Extract] Gemini also failed, using pdf-parse:`, geminiError);
                            const buffer = fs.readFileSync(tempFilePath);
                            const result = await extractWithPdfParse(buffer);
                            extractedText = result.text;
                            pageCount = result.pageCount;
                            structuredMarkdown = result.markdown;
                            extractionVersion = '5.0-pdfparse-structured';
                        }
                    } else {
                        // >50MB exceeds Gemini Files API per-file cap.
                        // Could be revisited later by chunking the source
                        // PDF before upload — but that's a follow-up.
                        console.log(
                            `📄 [Extract] Skipping Gemini fallback (${(stats.size / 1024 / 1024).toFixed(1)} MB > 50MB Gemini cap); going straight to pdf-parse`,
                        );
                        const buffer = fs.readFileSync(tempFilePath);
                        const result = await extractWithPdfParse(buffer);
                        extractedText = result.text;
                        pageCount = result.pageCount;
                        structuredMarkdown = result.markdown;
                        extractionVersion = '5.0-pdfparse-structured';
                    }
                }
            } else if (stats.size <= MAX_GEMINI_FILE_SIZE) {
                // No LlamaParse path AND file fits Gemini's 50MB cap.
                // Batched extraction now handles long page counts by
                // splitting, so the old 12MB heuristic is gone.
                console.log(`🤖 [Extract] Using Gemini (${userOptedOutOfPremium ? 'user opted standard' : 'no LlamaParse key'})`);
                try {
                    const result = await extractWithGemini(tempFilePath, resourceId, getApiKey(), expectedPageCount, userId);
                    extractedText = result.text;
                    pageCount = result.pageCount;
                    structuredMarkdown = result.markdown;
                    extractionVersion = '4.0-gemini-standard';
                } catch (geminiError) {
                    console.warn(`⚠️ [Extract] Gemini failed, falling back to pdf-parse:`, geminiError);
                    const buffer = fs.readFileSync(tempFilePath);
                    const result = await extractWithPdfParse(buffer);
                    extractedText = result.text;
                    pageCount = result.pageCount;
                    structuredMarkdown = result.markdown;
                    extractionVersion = '5.0-pdfparse-structured';
                }
            } else {
                console.log(`📄 [Extract] Using pdf-parse (file > 100MB or no LlamaParse)`);
                const buffer = fs.readFileSync(tempFilePath);
                const result = await extractWithPdfParse(buffer);
                extractedText = result.text;
                pageCount = result.pageCount;
                structuredMarkdown = result.markdown;
                extractionVersion = '5.0-pdfparse-structured';
            }

            const usedGemini = extractionVersion === '4.0-gemini-standard' || extractionVersion === '2.0-gemini';
            const usedLlamaParse = extractionVersion === '3.0-llamaparse';

            // Saneamiento en el borde de escritura: lo que sale de un PDF de
            // tercero no es texto confiable. Se limpia ACÁ, antes de truncar y
            // antes de guardar, para que ni Firestore ni el `structured.md` de
            // Storage lleguen a contener invisibles — el indexador vuelve a
            // sanear como segunda línea, pero el archivo en reposo ya queda
            // limpio y auditable.
            const textSan = sanitizeExtractedText(extractedText);
            extractedText = textSan.text;
            const textSanSummary = describeSanitization(textSan.report);
            if (textSanSummary) console.log(`🧼 [Extract] textContent: ${textSanSummary}`);

            if (structuredMarkdown) {
                const mdSan = sanitizeExtractedText(structuredMarkdown);
                structuredMarkdown = mdSan.text;
                const mdSanSummary = describeSanitization(mdSan.report);
                if (mdSanSummary) console.log(`🧼 [Extract] structured.md: ${mdSanSummary}`);
            }

            console.log(`📝 [Extract] Extracted ${extractedText.length} characters / ${Buffer.byteLength(extractedText, 'utf8')} bytes from ${pageCount} pages`);

            // Firestore caps each document at 1,048,576 bytes (1 MiB).
            // Truncate textContent BY BYTES (not characters) to stay
            // safely under the cap. The previous code used
            // `substring(0, MAX_BYTES)` which slices by char count —
            // safe for ASCII but catastrophic for Greek/Hebrew (1 char
            // ≈ 2 bytes UTF-8) where 900K chars becomes ~1.8 MB and
            // Firestore rejects the whole write with INVALID_ARGUMENT.
            // For NTG28 (1020p of dense Greek) this killed the entire
            // extraction.
            //
            // Headroom: the cap is 1,048,576 bytes for the WHOLE doc.
            // Title/author/metadata/etc add ~5-20 KB, so MAX 800K bytes
            // for textContent leaves ~250 KB of safety margin. The
            // full content is also persisted to `structuredContentUrl`
            // in Cloud Storage (no size limit) — textContent in
            // Firestore is just for legacy reads + quick previews.
            const MAX_TEXT_BYTES = 800_000;
            const textBytes = Buffer.byteLength(extractedText, 'utf8');
            let finalText = extractedText;
            let wasTruncated = false;

            if (textBytes > MAX_TEXT_BYTES) {
                console.log(`⚠️ [Extract] Text too large (${textBytes} bytes), truncating to ${MAX_TEXT_BYTES} bytes...`);
                finalText = truncateUtf8(extractedText, MAX_TEXT_BYTES);
                wasTruncated = true;
                console.log(`✂️  [Extract] Truncated to ${Buffer.byteLength(finalText, 'utf8')} bytes`);
            }

            // If structured Markdown is available (LlamaParse), store it in Storage
            // so it doesn't hit Firestore's 1MB limit and is available for Phase 2 chunking.
            let structuredContentUrl: string | null = null;
            if (structuredMarkdown) {
                try {
                    const mdPath = `users/${userId}/library/${resourceId}/structured.md`;
                    const mdFile = bucket.file(mdPath);
                    await mdFile.save(structuredMarkdown, {
                        contentType: 'text/markdown; charset=utf-8',
                        metadata: { resourceId, extractionVersion },
                    });
                    structuredContentUrl = `gs://${event.data.bucket}/${mdPath}`;
                    console.log(`📦 [Extract] Stored structured Markdown at ${structuredContentUrl}`);
                } catch (mdErr) {
                    console.warn(`⚠️ [Extract] Failed to store structured Markdown:`, mdErr);
                }
            }

            // Compute a user-facing warning when the actual extraction
            // tier is below what the user explicitly requested. This is
            // what the UI surfaces in the engine-badge tooltip so the
            // user understands why their Premium upload ended up on
            // Standard or Basic — and can decide whether to reprocess.
            //
            // Examples written to Firestore:
            //   - "Premium falló en 2 cuenta(s); usamos Estándar (Gemini)."
            //   - "Premium falló y archivo >12MB; usamos Básico (pdf-parse)."
            //   - "Estándar falló; usamos Básico (pdf-parse)."
            //
            // Always cleared (set to null) on success-at-requested-tier
            // so a successful reprocess removes any stale warning.
            let extractionWarning: string | null = null;
            if (requestedMode === 'premium' && extractionVersion !== '3.0-llamaparse') {
                const accountSummary = llamaErrors.length > 0
                    ? `Premium falló en ${llamaErrors.length} cuenta(s)`
                    : 'Premium no estuvo disponible';
                if (extractionVersion === '4.0-gemini-standard' || extractionVersion === '2.0-gemini') {
                    extractionWarning = `${accountSummary}; usamos Estándar (Gemini).`;
                } else if (extractionVersion === '5.0-pdfparse-structured') {
                    extractionWarning = `${accountSummary} y Gemini tampoco pudo procesar; usamos Básico (pdf-parse) sin cobro. Reprocesa con Premium para mejor calidad.`;
                }
            } else if (requestedMode === 'standard' && extractionVersion === '5.0-pdfparse-structured') {
                extractionWarning = 'Gemini falló; usamos Básico (pdf-parse) sin cobro. Considera reprocesar.';
            }
            // Note: requestedMode === undefined (legacy uploads) gets no
            // warning — we don't know what they asked for.

            // Update Firestore document with extracted text and ready status
            const updateData: Record<string, any> = {
                textContent: finalText,
                textExtractionStatus: 'ready',
                extractedAt: new Date(),
                pageCount,
                characterCount: extractedText.length,
                extractedWithGemini: usedGemini,
                extractedWithLlamaParse: usedLlamaParse,
                extractionVersion,
                extractionWarning, // null clears any prior warning on a clean reprocess
                // Censo de escrituras del texto COMPLETO. Se cuenta acá y no
                // después porque `textContent` se guarda truncado a 800 KB por
                // el límite de Firestore: contarlo luego daría otro número.
                // Quien juzga si la extracción sirve es el dominio.
                scriptCensus: censusOf(finalText),
                needsReindex: true,
                wasTruncated,
                updatedAt: new Date()
            };
            if (structuredContentUrl) updateData.structuredContentUrl = structuredContentUrl;

            await resourceRef.update(updateData);
            console.log(`✅ [Extract] Updated resource ${resourceId} (${extractionVersion}, status: ready)`);

            // Debit the user's processing balance based on which engine
            // actually ran. The user only pays for the tier they got:
            //
            //   3.0-llamaparse              → premium  (paid Premium, got Premium)
            //   4.0-gemini-standard         → standard (paid Standard or Premium-degraded, got Standard)
            //   2.0-gemini (legacy)         → standard
            //   5.0-pdfparse-structured     → FREE     (last-resort fallback, no API cost
            //   fallback-pdfparse (legacy)  → FREE     to us, lower-quality output the user
            //                                          didn't ask for)
            //
            // Why pdf-parse is free: it runs locally with no third-party
            // API cost, and it's only reached when both LlamaParse AND
            // Gemini failed. Charging for our own degradation would
            // erode trust in the pipeline — the user paid for Standard
            // or Premium quality, getting Basic isn't what they bought.
            //
            // Non-fatal: if the debit fails we log and proceed —
            // billing is the source of truth, this is a UX-quota
            // synchronization concern.
            const isFreeFallback = extractionVersion === 'fallback-pdfparse'
                || extractionVersion === '5.0-pdfparse-structured';
            if (isFreeFallback) {
                console.log(`💳 [Extract] Skipping debit for ${userId.substring(0, 8)}... — pdf-parse fallback is free`);
            } else {
                try {
                    const debitMode: ProcessingMode = extractionVersion === '3.0-llamaparse'
                        ? 'premium'
                        : 'standard';
                    await consumePagesAdmin(userId, debitMode, pageCount);
                    console.log(`💳 [Extract] Debited ${pageCount} ${debitMode} pages from user ${userId.substring(0, 8)}...`);
                } catch (debitErr) {
                    console.warn(`⚠️ [Extract] Balance debit failed (non-fatal):`, debitErr);
                }
            }

            // Increment the user's monthly pagesProcessed counter. Server-side so the
            // client can't understate usage. Best-effort — logs but doesn't fail the
            // extraction if the counter update errors.
            try {
                const now = new Date();
                const periodKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
                const counterRef = db.doc(`users/${userId}/usage_counters/${periodKey}`);
                await counterRef.set({
                    userId,
                    periodKey,
                    pagesProcessed: FieldValue.increment(pageCount),
                    docsUploadedThisMonth: FieldValue.increment(1),
                    lastEventAt: now,
                }, { merge: true });
                const counterSnap = await counterRef.get();
                if (!counterSnap.data()?.firstEventAt) {
                    await counterRef.set({ firstEventAt: now }, { merge: true });
                }
                console.log(`📊 [Extract] Incremented usage: +${pageCount} pages, +1 doc for user ${userId.substring(0, 8)}...`);
            } catch (counterErr) {
                console.warn(`⚠️ [Extract] Failed to update usage counter:`, counterErr);
            }

            // Cleanup temp file
            fs.unlinkSync(tempFilePath);
            console.log(`🧹 [Extract] Cleanup complete`);

        } catch (error) {
            console.error(`❌ [Extract] Error extracting text:`, error);

            try {
                const resourceRef = db.collection('library_resources').doc(resourceId);
                await resourceRef.update({
                    textExtractionStatus: 'failed',
                    extractionError: error instanceof Error ? error.message : 'Unknown error',
                    extractionFailureReason: 'error',
                    extractionAttemptedAt: new Date(),
                    updatedAt: new Date()
                });
                console.log(`❌ [Extract] Set status to 'failed' for resource ${resourceId}`);
            } catch (updateError) {
                console.error('Failed to update error status:', updateError);
            }

            throw error;
        } finally {
            deadlineGuard?.disarm();
        }
    }
);
