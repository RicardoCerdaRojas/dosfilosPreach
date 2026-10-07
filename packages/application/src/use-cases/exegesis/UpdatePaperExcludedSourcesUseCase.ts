import type { ExcludedSource, ExegeticalPaper, IExegeticalPaperRepository } from '@dosfilos/domain';

export interface UpdatePaperExcludedSourcesInput {
    ownerId: string;
    paperId: string;
    /** `[]` confirma que no hay exclusiones; ya no se vuelven a proponer. */
    excludedSources: ReadonlyArray<ExcludedSource>;
}

const MAX_KEY_CHARS = 80;

/**
 * Guarda las fuentes que el trabajo no puede usar.
 *
 * Se limpian aquí: la clave viaja a los prompts que redactan, y una clave
 * vacía o repetida («McCartney», «mccartney ») sería ruido en cada uno.
 */
export class UpdatePaperExcludedSourcesUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdatePaperExcludedSourcesInput): Promise<ExegeticalPaper> {
        if (!input.ownerId) throw new Error('UpdatePaperExcludedSourcesUseCase: ownerId required');
        if (!input.paperId) throw new Error('UpdatePaperExcludedSourcesUseCase: paperId required');
        return this.paperRepository.updatePaper(input.ownerId, input.paperId, {
            excludedSources: normalizeExcludedSources(input.excludedSources),
        });
    }
}

export function normalizeExcludedSources(list: ReadonlyArray<ExcludedSource>): ExcludedSource[] {
    const vistas = new Set<string>();
    const out: ExcludedSource[] = [];
    for (const e of list) {
        const key = e.key.trim().replace(/\s+/g, ' ').slice(0, MAX_KEY_CHARS);
        const id = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (!key || vistas.has(id)) continue;
        vistas.add(id);
        out.push({ key, previousPaperTitle: e.previousPaperTitle?.trim() || null });
    }
    return out;
}
