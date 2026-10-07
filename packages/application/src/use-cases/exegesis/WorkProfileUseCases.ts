import { ASSIGNMENT_BRIEF_MAX_CHARS, PAPER_COVER_FIELDS, PAPER_COVER_FIELDS_POR_ENTREGA } from '@dosfilos/domain';
import type {
    ExegeticalPaper,
    PaperCover,
    IExegeticalPaperRepository,
    IUserAssignmentBriefRepository,
    IUserRubricRepository,
    IWorkProfileRepository,
    WorkProfile,
} from '@dosfilos/domain';
import { WORK_PROFILE_NAME_MAX_CHARS } from '@dosfilos/domain';

export interface SaveWorkProfileFromPaperInput {
    ownerId: string;
    paperId: string;
    displayName: string;
    course?: string;
    /**
     * Plantilla de rúbrica a la que apuntar. Si no se da, se CREA una con la
     * rúbrica del trabajo (ver el caso de uso).
     */
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
 * rúbrica y el encuadre siguen viajando como PUNTEROS a plantillas, pero
 * las plantillas se crean aquí, con lo que el trabajo tiene: en el TP #6 el
 * perfil aplicó la rúbrica del sistema (12 páginas, doble espacio, 13
 * fuentes) porque el botón nunca supo qué plantilla había usado el trabajo,
 * y aunque lo supiera, la rúbrica AJUSTADA dentro del trabajo no estaba en
 * ninguna plantilla. Decisión del fundador (2026-10-07): crear las
 * plantillas al guardar, con el nombre del perfil, y que se vean y editen
 * en el directorio como cualquier otra.
 */
export class SaveWorkProfileFromPaperUseCase {
    constructor(
        private paperRepository: IExegeticalPaperRepository,
        private profileRepository: IWorkProfileRepository,
        private rubricRepository: IUserRubricRepository,
        private briefRepository: IUserAssignmentBriefRepository,
    ) { }

    async execute(input: SaveWorkProfileFromPaperInput): Promise<WorkProfile> {
        const displayName = input.displayName.trim().slice(0, WORK_PROFILE_NAME_MAX_CHARS);
        if (!input.ownerId || !input.paperId) {
            throw new Error('SaveWorkProfileFromPaperUseCase: ownerId and paperId required');
        }
        if (!displayName) throw new Error('SaveWorkProfileFromPaperUseCase: displayName required');

        const paper = await this.paperRepository.getPaper(input.ownerId, input.paperId);
        if (!paper) throw new Error(`Paper ${input.paperId} not found`);

        const rubricTemplateId = input.rubricTemplateId
            ?? (paper.rubric
                ? (await this.rubricRepository.createRubric({
                    ownerId: input.ownerId, displayName, isDefault: false, rubric: paper.rubric,
                })).id
                : null);
        const brief = paper.assignmentBrief?.trim() ?? '';
        const briefTemplateId = input.briefTemplateId
            ?? (brief
                ? (await this.briefRepository.createBrief({
                    ownerId: input.ownerId, displayName, isDefault: false,
                    body: brief.slice(0, ASSIGNMENT_BRIEF_MAX_CHARS),
                })).id
                : null);

        return this.profileRepository.createProfile({
            ownerId: input.ownerId,
            displayName,
            ...(input.course?.trim() ? { course: input.course.trim() } : {}),
            rubricTemplateId,
            briefTemplateId,
            styleGuideId: paper.styleGuideId ?? null,
            exegeticalStrategy: paper.exegeticalStrategy === 'free' ? 'free' : 'dialectical',
            cover: coverDelCurso(paper.cover),
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

/**
 * La portada que se hereda: lo que NO cambia entre entregas del curso.
 *
 * El título del trabajo es de la entrega —«Trabajo práctico #3»— y sin
 * esto cada trabajo nuevo del curso nacería llamándose como el anterior.
 */
function coverDelCurso(cover: PaperCover | null | undefined): PaperCover | null {
    if (!cover) return null;
    // Se recorre la lista de campos y no las claves del objeto: así lo
    // que se hereda es lo que el dominio reconoce, y no todo lo que
    // venga guardado de una versión anterior.
    const heredable: PaperCover = {};
    for (const campo of PAPER_COVER_FIELDS) {
        if (PAPER_COVER_FIELDS_POR_ENTREGA.includes(campo)) continue;
        const valor = cover[campo];
        if (valor) heredable[campo] = valor;
    }
    return Object.keys(heredable).length > 0 ? heredable : null;
}
