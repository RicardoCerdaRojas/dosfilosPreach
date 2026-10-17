import type { LibraryResourceEntity } from '@dosfilos/domain';

/**
 * Si un recurso recién extraído todavía no dice qué número lleva impresa cada
 * hoja (ver `LibraryCalibrationCallout`). Aparte para que lo use también el
 * contador de avisos de la barra.
 */

/** Ventana de «recién subido»: con toda la biblioteca, el aviso decía 64 de 72 y se ignoraba (ver `LibraryCalibrationCallout`). */
const DIAS_RECIENTE = 7;

export function needsCalibration(resource: LibraryResourceEntity): boolean {
    if (resource.textExtractionStatus !== 'ready') return false;
    // Un recurso de una sola página no se cita por página; preguntarlo sería ruido.
    if ((resource.pageCount ?? 0) < 2) return false;
    const numbering = (resource as { pageNumbering?: { origin?: string } | null }).pageNumbering;
    if (numbering?.origin === 'confirmed') return false;
    return esReciente((resource as { extractedAt?: Date | null }).extractedAt);
}

function esReciente(extractedAt: Date | null | undefined): boolean {
    if (!extractedAt) return false;
    const cuando = extractedAt instanceof Date ? extractedAt.getTime() : Date.parse(String(extractedAt));
    if (!Number.isFinite(cuando)) return false;
    return Date.now() - cuando < DIAS_RECIENTE * 24 * 60 * 60 * 1000;
}
