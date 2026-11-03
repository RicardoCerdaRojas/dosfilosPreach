import { toast } from 'sonner';
import { i18n } from '@/i18n';

/**
 * El único error de escritura que el autor no puede resolver reintentando: Firestore
 * rechazó el documento por tamaño. Cada botón muestra su propio «no se pudo», y sin
 * esto nada diría por qué. Los textos son los que da el emulador según lo que no
 * cupo, y el que se documenta para producción.
 */
export function avisarSiDocumentoLleno(error: unknown): void {
    if (error instanceof Error && /maximum (entity|allowed) size|longer than \d+ bytes|invalid nested entity/i.test(error.message)) {
        toast.error(i18n.t('exegesis:detail.documentFull'), { duration: 12000 });
    }
}
