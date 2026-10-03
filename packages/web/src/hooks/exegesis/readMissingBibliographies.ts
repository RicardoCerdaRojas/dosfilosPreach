import { completeWithProposal, type BibliographicData } from '@dosfilos/domain';
import type { PaperBibliographyRow } from './usePaperBibliography';

export type BulkReadStatus = 'proposal' | 'nothing-new' | 'no-text' | 'error';

export interface BulkReadResult {
    row: PaperBibliographyRow;
    status: BulkReadStatus;
    /** La ficha con los huecos llenos (sólo con `proposal`). */
    merged: BibliographicData | null;
    /** Qué campos llenó la portada. */
    filled: Array<keyof BibliographicData>;
}

/** Lo que devuelve leer una portada (`readBibliographyFromCover`). */
export interface CoverRead {
    data: BibliographicData;
    hasText: boolean;
}

/**
 * Lee las portadas de todos los libros a los que les faltan datos.
 *
 * Al heredar el corpus de la serie aparecieron once libros sin «Datos para
 * citar», y cada uno se abría, se leía y se guardaba por separado (#9 del
 * ejercicio de Jonás). Aquí se leen todos, de a `concurrencia`: cada lectura
 * es una llamada al modelo y el proxy limita las llamadas por hora.
 *
 * No guarda nada: devuelve lo que propone cada portada para que el pastor lo
 * revise en una pantalla. Lo ya escrito gana siempre (`completeWithProposal`).
 */
export async function readMissingBibliographies(
    rows: ReadonlyArray<PaperBibliographyRow>,
    read: (resourceId: string) => Promise<CoverRead>,
    opts: { concurrencia?: number; alAvanzar?: (hechas: number, total: number) => void } = {},
): Promise<BulkReadResult[]> {
    const pendientes = rows.filter(r => r.missing.length > 0 && r.editable);
    const resultados = new Map<string, BulkReadResult>();
    const cola = [...pendientes];
    let hechas = 0;
    const trabajar = async () => {
        for (let row = cola.shift(); row; row = cola.shift()) {
            try {
                const r = await read(row.resourceId);
                if (!r.hasText) {
                    resultados.set(row.sourceId, { row, status: 'no-text', merged: null, filled: [] });
                } else {
                    const { data, filled } = completeWithProposal(row.data, r.data);
                    resultados.set(row.sourceId, filled.length > 0
                        ? { row, status: 'proposal', merged: data, filled }
                        : { row, status: 'nothing-new', merged: null, filled: [] });
                }
            } catch (err) {
                console.warn('[bibliografía] no se pudo leer la portada de', row.displayLabel, err);
                resultados.set(row.sourceId, { row, status: 'error', merged: null, filled: [] });
            }
            opts.alAvanzar?.(++hechas, pendientes.length);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.concurrencia ?? 2) }, trabajar));
    // En el orden de la tarjeta, no en el de llegada.
    return pendientes.map(r => resultados.get(r.sourceId)!);
}
