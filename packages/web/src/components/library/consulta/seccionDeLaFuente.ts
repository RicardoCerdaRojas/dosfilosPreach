import type { FuenteDeConsulta } from '@dosfilos/infrastructure';

/** La sección que se cita: la última parte de la ruta («GEN 1:1 › JAS 3:17» → «JAS 3:17»). */
export function seccionDeLaFuente(f: Pick<FuenteDeConsulta, 'seccion'>): string | null {
    return f.seccion?.split(' › ').pop()?.trim() || null;
}
