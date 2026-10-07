import type { ExegeticalPaper, IExegeticalPaperRepository } from '@dosfilos/domain';

export interface RenameCitationKeyInput {
    ownerId: string;
    paperId: string;
    /** La clave vieja, tal como la cita lo generado. */
    from: string;
    /** La clave de una fuente del corpus. */
    to: string;
}

/**
 * Corrige lo generado que sigue citando una clave vieja: «Aland» cuando la
 * fuente ya se llama «NA28» (TP #6). Sólo acepta pasar a la clave de una
 * fuente del corpus, para no inventar una tercera.
 */
export class RenameCitationKeyUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: RenameCitationKeyInput): Promise<ExegeticalPaper> {
        const from = input.from.trim();
        const to = input.to.trim();
        if (!input.ownerId || !input.paperId || !from || !to) {
            throw new Error('RenameCitationKeyUseCase: ownerId, paperId, from and to required');
        }
        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);
        if (!paper.sources.some(s => s.citationKey === to)) {
            throw new Error(`RenameCitationKeyUseCase: «${to}» no es la clave de ninguna fuente del corpus`);
        }
        if (from === to) return paper;
        return this.paperRepository.renameCitationKey(input.ownerId, input.paperId, from, to);
    }
}
