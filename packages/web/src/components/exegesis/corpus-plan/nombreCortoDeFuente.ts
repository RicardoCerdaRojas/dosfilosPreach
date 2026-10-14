import type { ProjectSource } from '@dosfilos/domain';

/**
 * Cómo se nombra una fuente en una ficha chica: su clave de cita (McCartney,
 * Ropes), o el título si no tiene. Con el título cortado a 40 letras no se
 * sabía de quién era cada ficha del plan (TP #7, #26).
 */
export function nombreCortoDeFuente(source: Pick<ProjectSource, 'citationKey' | 'displayLabel'>): string {
    return source.citationKey?.trim() || source.displayLabel;
}
