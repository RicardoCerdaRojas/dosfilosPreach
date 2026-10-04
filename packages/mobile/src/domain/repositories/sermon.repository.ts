import { Sermon, SermonSummary } from '@/domain/models/sermon.model';
import type { PreachingLog } from '@dosfilos/domain';

export interface SermonRepository {
    /** Resúmenes de sermones publicados del usuario autenticado (callable, App Check). */
    getPublishedSummaries(): Promise<SermonSummary[]>;
    /** Títulos de series por id (lectura Firestore directa, cachea offline). */
    getSeriesTitles(seriesIds: string[]): Promise<Record<string, string>>;
    /** Detalle completo (lectura Firestore directa — cae en caché offline del SDK nativo). */
    getSermonById(id: string): Promise<Sermon | null>;
    /**
     * Guarda SÓLO título y cuerpo. Jamás `wizardProgress`: la espina pastoral
     * del wizard vive en la web y tocarla desde acá duplicaría política que ya
     * costó des-duplicar (M-07).
     */
    updateSermonDraft(id: string, patch: { title: string; content: string }): Promise<void>;
    /** Suma una predicación al historial (F3). El campo existía sin cliente. */
    addPreachingLog(id: string, log: PreachingLog): Promise<void>;
    removePreachingLog(id: string, log: PreachingLog): Promise<void>;
}
