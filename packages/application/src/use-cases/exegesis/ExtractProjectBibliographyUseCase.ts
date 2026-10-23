import type { ExtractCourseBibliographyInput, ExtractedCourseBibliography, ICourseBibliographyExtractor } from '@dosfilos/domain';
import { ExegesisCreditReservation } from '../../services/ExegesisCreditReservation';

export interface ExtractProjectBibliographyInput extends ExtractCourseBibliographyInput {
    ownerId: string;
}

/** Topes de lo que se manda: un sílabo largo cabe; un libro entero, no. */
export const MAX_BIBLIOGRAPHY_TEXT_CHARS = 60_000;
export const MAX_BIBLIOGRAPHY_ENTRIES_READ = 200;

/**
 * Lee la bibliografía de un sílabo, una lista o una foto (estado del arte,
 * paso 1). Se cobra del plan como las demás lecturas (`extractProjectBibliography`).
 * No guarda nada: la página junta lo leído con las fichas y el estudiante
 * guarda. Por eso se puede leer varias veces y se acumula.
 */
export class ExtractProjectBibliographyUseCase {
    constructor(private extractor: ICourseBibliographyExtractor) { }

    async execute(input: ExtractProjectBibliographyInput): Promise<ExtractedCourseBibliography> {
        if (!input.ownerId) throw new Error('ExtractProjectBibliographyUseCase: ownerId required');
        const text = (input.text ?? '').trim().slice(0, MAX_BIBLIOGRAPHY_TEXT_CHARS);
        if (!input.image && text.length < 10) throw new Error('ExtractProjectBibliographyUseCase: nada que leer');

        const reservation = await ExegesisCreditReservation.open(input.ownerId, 'extractProjectBibliography');
        try {
            reservation.markLlmContacted();
            const leido = await this.extractor.extract({ text, image: input.image ?? null, language: input.language });
            return {
                ...leido,
                entries: leido.entries.filter(e => e.title?.trim()).slice(0, MAX_BIBLIOGRAPHY_ENTRIES_READ),
            };
        } catch (err) {
            await reservation.refundIfPreLlm();
            throw err;
        }
    }
}
