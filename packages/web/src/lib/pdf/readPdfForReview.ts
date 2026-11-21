import { reviewSheets, type ReviewSheet } from '@dosfilos/domain';
import { groupLines, pageNumberInBand, usablePageLabels, type PdfTextItemLike } from './readPdfAnnotations';

const PDFJS_ASSETS = {
    wasmUrl: '/pdfjs/wasm/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
} as const;

/** Si la hoja de la muestra abre un capítulo (casi nunca lleva folio), se mira la siguiente: hasta tantas. */
const HOJAS_POR_MUESTRA = 3;
/** Menos letras que esto en todas las hojas leídas: el PDF es una imagen sin capa de texto. */
const LETRAS_DE_UN_PDF_CON_TEXTO = 200;

export interface PdfReviewRead {
    numPages: number;
    producer: string | null;
    creator: string | null;
    hasText: boolean;
    front: ReviewSheet[];
    samples: ReviewSheet[];
}

/**
 * Lee del PDF solo las MUESTRAS de la bandeja (decisión 4 del fundador): las
 * primeras hojas y tres del cuerpo. pdf.js pide por rangos (`disableAutoFetch`):
 * un comentario de 600 hojas no se descarga entero. Todo ocurre en el
 * navegador: el texto no sale a ningún servicio.
 */
export async function readPdfForReview(url: string): Promise<PdfReviewRead> {
    const { pdfjsLib } = await import('../pdfWorker');
    // Las mismas opciones que el visor (PdfPageViewer), que funcionan con las URL
    // firmadas: con `disableStream: true` la descarga falla («Failed to fetch»).
    const task = pdfjsLib.getDocument({ url, disableAutoFetch: true, disableStream: false, ...PDFJS_ASSETS });
    const doc = await task.promise;
    try {
        const numPages = doc.numPages;
        const info = ((await doc.getMetadata().catch(() => null))?.info ?? {}) as { Producer?: unknown; Creator?: unknown };
        const etiquetas = usablePageLabels(await doc.getPageLabels().catch(() => null), numPages);
        const leer = async (sheet: number): Promise<ReviewSheet> => {
            const page = await doc.getPage(sheet);
            const items = (await page.getTextContent()).items.filter((i): i is typeof i & PdfTextItemLike => 'str' in i);
            // De arriba abajo: la portada y los créditos se leen en su orden.
            const lines = groupLines(items).sort((a, b) => b.y - a.y);
            const enBanda = pageNumberInBand(lines, page.view, numPages);
            return { sheet, lines: lines.map(l => l.text), folio: etiquetas?.[sheet - 1]?.trim() || enBanda?.number || null };
        };
        const { front: primeras, samples: muestras } = reviewSheets(numPages);
        const front: ReviewSheet[] = [];
        for (const n of primeras) front.push(await leer(n));
        const samples: ReviewSheet[] = [];
        for (const n of muestras) {
            let hoja = await leer(n);
            for (let k = 1; k < HOJAS_POR_MUESTRA && !hoja.folio && n + k <= numPages; k++) hoja = await leer(n + k);
            samples.push(hoja);
        }
        const letras = [...front, ...samples].reduce((s, h) => s + h.lines.join('').length, 0);
        const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
        return { numPages, producer: texto(info.Producer), creator: texto(info.Creator), hasText: letras >= LETRAS_DE_UN_PDF_CON_TEXTO, front, samples };
    } finally {
        void task.destroy();
    }
}
