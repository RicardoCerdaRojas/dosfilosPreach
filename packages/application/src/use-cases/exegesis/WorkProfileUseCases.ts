import type {
    ExegeticalPaper,
    IExegeticalPaperRepository,
    IWorkProfileRepository,
    WorkProfile,
} from '@dosfilos/domain';
import { WORK_PROFILE_NAME_MAX_CHARS } from '@dosfilos/domain';

export interface SaveWorkProfileFromPaperInput {
    ownerId: string;
    paperId: string;
    displayName: string;
    course?: string;
    /** Plantilla de rúbrica que este trabajo usó, si el usuario la recuerda. */
    rubricTemplateId?: string | null;
    briefTemplateId?: string | null;
    makeDefault?: boolean;
}

/**
 * Guarda cómo quedó configurado un trabajo, para el siguiente del curso.
 *
 * Se guarda DESDE UN TRABAJO y no desde un formulario en blanco porque es
 * el único momento en que la configuración existe y está probada: el
 * estudiante acaba de entregar con ella. Pedirle que la reescriba en otro
 * sitio es pedirle que la recuerde.
 *
 * Lo que se copia del trabajo: guía de estilo, método y portada. La
 * rúbrica y el encuadre viajan como punteros a sus plantillas, si las
 * hay: la rúbrica del trabajo es una copia congelada, y guardar esa copia
 * dentro del perfil crearía una tercera verdad sobre la misma rúbrica.
 */
export class SaveWorkProfileFromPaperUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private profileRepository: IWorkProfileRepository,
    ) { }

    async execute(input: SaveWorkProfileFromPaperInput): Promise<WorkProfile> {
        const displayName = input.displayName.trim().slice(0, WORK_PROFILE_NAME_MAX_CHARS);
        if (!input.ownerId || !input.paperId) {
            throw new Error('SaveWorkProfileFromPaperUseCase: ownerId and paperId required');
        }
        if (!displayName) throw new Error('SaveWorkProfileFromPaperUseCase: displayName required');

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        return this.profileRepository.createProfile({
            ownerId: input.ownerId,
            displayName,
            ...(input.course?.trim() ? { course: input.course.trim() } : {}),
            rubricTemplateId: input.rubricTemplateId ?? null,
            briefTemplateId: input.briefTemplateId ?? null,
            styleGuideId: paper.styleGuideId ?? null,
            exegeticalStrategy: paper.exegeticalStrategy === 'free' ? 'free' : 'dialectical',
            cover: paper.cover ?? null,
            isDefault: input.makeDefault ?? false,
        });
    }
}

/**
 * Lo que un perfil aporta al crear un trabajo.
 *
 * Se devuelve como datos y no se aplica adentro del caso de uso de
 * creación: la interfaz muestra los valores ya puestos y el estudiante
 * puede cambiar cualquiera antes de crear. Un perfil que decide en
 * silencio es un perfil que el usuario no revisa.
 */
export interface WorkProfileDefaults {
    rubricTemplateId: string | null;
    briefTemplateId: string | null;
    styleGuideId: string | null;
    exegeticalStrategy: 'free' | 'dialectical';
    cover: ExegeticalPaper['cover'];
}

export function defaultsOfProfile(profile: WorkProfile): WorkProfileDefaults {
    return {
        rubricTemplateId: profile.rubricTemplateId,
        briefTemplateId: profile.briefTemplateId,
        styleGuideId: profile.styleGuideId,
        exegeticalStrategy: profile.exegeticalStrategy,
        cover: profile.cover ?? null,
    };
}
