import type { ExegeticalPaper, IExegeticalPaperRepository, PaperCover } from '@dosfilos/domain';

export interface UpdatePaperCoverInput {
    ownerId: string;
    paperId: string;
    /** `null` quita la portada; el .docx vuelve a salir sin ella. */
    cover: PaperCover | null;
}

/** Cuánto se guarda de cada campo. Una portada no necesita párrafos. */
const MAX_FIELD_CHARS = 120;

/**
 * Guarda los datos de portada del trabajo.
 *
 * Se limpian aquí y no en la interfaz porque son datos que viajan al
 * documento entregable: un espacio de más al final de «The Master's
 * Seminary » sale impreso en la portada, y nadie lo ve hasta que el
 * trabajo está entregado.
 */
export class UpdatePaperCoverUseCase {
    constructor(private paperRepository: IExegeticalPaperRepository) { }

    async execute(input: UpdatePaperCoverInput): Promise<ExegeticalPaper> {
        if (!input.ownerId) throw new Error('UpdatePaperCoverUseCase: ownerId required');
        if (!input.paperId) throw new Error('UpdatePaperCoverUseCase: paperId required');

        const clean = normalizeCover(input.cover);
        return this.paperRepository.updatePaper(input.ownerId, input.paperId, { cover: clean });
    }
}

/**
 * Deja solo los campos con contenido. Una portada con todos los campos
 * vacíos es `null`: así el exportador sabe que no hay portada en vez de
 * dibujar una en blanco.
 */
export function normalizeCover(cover: PaperCover | null): PaperCover | null {
    if (!cover) return null;
    const entries = (['institution', 'author', 'place', 'date', 'course'] as const)
        .map(key => [key, cover[key]?.trim().slice(0, MAX_FIELD_CHARS) ?? ''] as const)
        .filter(([, value]) => value.length > 0);
    return entries.length > 0 ? Object.fromEntries(entries) as PaperCover : null;
}
