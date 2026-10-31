import { MAX_THESIS_CHARS, type ExegeticalPaper, type IExegeticalPaperRepository, type PaperThesis } from '@dosfilos/domain';

export interface SetPaperThesisInput {
    ownerId: string;
    paperId: string;
    /** El texto de la tesis. Vacío la quita. */
    text: string;
    /** `true` la aprueba: desde ahí la leen la conclusión y la introducción. */
    approve: boolean;
    /** De dónde salió. Por omisión, del estudiante. */
    origin?: PaperThesis['origin'];
}

/**
 * Guarda la tesis del trabajo (fase «Lecciones del TI #2», etapa 3.2).
 *
 * Cambiar el texto de una tesis aprobada la vuelve borrador si no se pide
 * aprobarla de nuevo: los compositores no deben leer una tesis que el
 * estudiante no aprobó con ese texto.
 */
export class SetPaperThesisUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: SetPaperThesisInput): Promise<ExegeticalPaper> {
        if (!input.ownerId || !input.paperId) throw new Error('SetPaperThesisUseCase: ownerId y paperId requeridos');
        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const texto = input.text.trim().slice(0, MAX_THESIS_CHARS);
        if (!texto) return this.paperRepository.updatePaper(input.ownerId, input.paperId, { thesis: null });
        const ahora = new Date();
        const anterior = paper.thesis ?? null;
        const mismoTexto = anterior?.text.trim() === texto;
        const thesis: PaperThesis = {
            text: texto,
            origin: input.origin ?? (anterior && !mismoTexto && anterior.origin !== 'student' ? 'edited' : anterior?.origin ?? 'student'),
            approvedAt: input.approve ? ahora : mismoTexto ? anterior?.approvedAt ?? null : null,
            updatedAt: ahora,
        };
        return this.paperRepository.updatePaper(input.ownerId, input.paperId, { thesis });
    }
}
