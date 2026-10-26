import {
    GUIDE_MAX_ADDITIONAL_RULES,
    GUIDE_RULE_TEXT_MAX,
    normalizeGuideRule,
    type AIProject,
    type IAIProjectRepository,
    type IUserStyleGuideRepository,
    type UserStyleGuide,
} from '@dosfilos/domain';
import { UpdateProjectUseCase } from '../faculty/UpdateProjectUseCase';
import { UpdateUserStyleGuideManifestUseCase } from './UpdateUserStyleGuideManifestUseCase';

export type AddRuleToStyleGuideErrorCode =
    | 'empty-rule'
    | 'rule-too-long'
    | 'project-unavailable'
    | 'pattern-not-found'
    | 'guide-not-found'
    | 'guide-without-manifest'
    | 'guide-full';

/** Un error con código estable: la página lo traduce (la capa de aplicación no tiene i18n). */
export class AddRuleToStyleGuideError extends Error {
    constructor(readonly code: AddRuleToStyleGuideErrorCode, message: string) {
        super(message);
        this.name = 'AddRuleToStyleGuideError';
        Object.setPrototypeOf(this, AddRuleToStyleGuideError.prototype);
    }
}

export interface AddRuleToStyleGuideInput {
    ownerId: string;
    projectId: string;
    /** El patrón de corrección (`FeedbackPattern.id`) que se pasa a la guía. */
    patternId: string;
    /** La guía donde queda: la del tipo de trabajo o la del curso (`courseGuideCandidates`). */
    guideId: string;
    /** El texto de la regla, escrito o confirmado por el estudiante. No se redacta por él. */
    ruleText: string;
}

export interface AddRuleToStyleGuideResult {
    project: AIProject;
    guide: UserStyleGuide;
    /** `false` si la guía ya tenía esa regla (normalizada): no se duplicó. */
    added: boolean;
}

/**
 * «Pasar a tu guía» (`docs/FASE_ESCRITORIO_PROYECTO_2026-10.md` §9.1): una
 * corrección que se repite pasa a `manifest.additionalRules` de la guía, que
 * leen el analizador y el revisor de prosa del trabajo siguiente.
 *
 * - Escribe por el MISMO camino que el editor de la guía
 *   (`UpdateUserStyleGuideManifestUseCase`): valida el manifiesto y lo marca
 *   `user-edited`. Como el editor, reescribe el manifiesto entero sobre lo
 *   recién leído.
 * - No duplica: si la guía ya tiene la regla (sin distinguir mayúsculas,
 *   tildes ni punto final), no la agrega, pero igual registra la decisión.
 * - Respeta el tope de reglas (`GUIDE_MAX_ADDITIONAL_RULES`).
 * - Registra la decisión en el proyecto (`decision: 'guide'`, `guideId`,
 *   `ruleText`, `decidedAt`) por `UpdateProjectUseCase` con `courseOps`, que
 *   relee el proyecto.
 *
 * Orden: primero la guía y después el proyecto. Si falla el segundo paso, la
 * regla ya está en la guía y repetir no la duplica.
 */
export class AddRuleToStyleGuideUseCase {
    constructor(
        private readonly styleGuideRepository: IUserStyleGuideRepository,
        private readonly projectRepository: IAIProjectRepository,
        private readonly now: () => Date = () => new Date(),
    ) { }

    async execute(input: AddRuleToStyleGuideInput): Promise<AddRuleToStyleGuideResult> {
        const { ownerId, projectId, patternId, guideId } = input;
        if (!ownerId || !projectId || !patternId || !guideId) throw new Error('AddRuleToStyleGuide: ownerId, projectId, patternId y guideId requeridos');
        const ruleText = (input.ruleText ?? '').replace(/\s+/g, ' ').trim();
        if (!ruleText || !normalizeGuideRule(ruleText)) throw new AddRuleToStyleGuideError('empty-rule', 'La regla está vacía');
        if (ruleText.length > GUIDE_RULE_TEXT_MAX) throw new AddRuleToStyleGuideError('rule-too-long', `La regla pasa de ${GUIDE_RULE_TEXT_MAX} caracteres`);

        const project = await this.projectRepository.getProject(projectId).catch(() => null);
        if (!project || project.userId !== ownerId || project.deletedAt) {
            throw new AddRuleToStyleGuideError('project-unavailable', `Proyecto ${projectId} no disponible`);
        }
        if (!(project.feedbackPatterns ?? []).some(p => p.id === patternId)) {
            throw new AddRuleToStyleGuideError('pattern-not-found', `Patrón ${patternId} no existe en el proyecto`);
        }

        const guide = await this.styleGuideRepository.getGuide(ownerId, guideId);
        if (!guide) throw new AddRuleToStyleGuideError('guide-not-found', `Guía ${guideId} no encontrada`);
        if (!guide.manifest) {
            throw new AddRuleToStyleGuideError('guide-without-manifest', 'La guía todavía no tiene sus reglas extraídas: ábrela en su editor antes de pasarle una regla');
        }

        const reglas = guide.manifest.additionalRules ?? [];
        const n = normalizeGuideRule(ruleText);
        const yaEsta = reglas.some(r => normalizeGuideRule(r) === n);
        let guiaFinal = guide;
        if (!yaEsta) {
            if (reglas.length >= GUIDE_MAX_ADDITIONAL_RULES) {
                throw new AddRuleToStyleGuideError('guide-full', `La guía ya tiene ${GUIDE_MAX_ADDITIONAL_RULES} reglas`);
            }
            guiaFinal = await new UpdateUserStyleGuideManifestUseCase(this.styleGuideRepository).execute({
                ownerId, guideId,
                manifest: { ...guide.manifest, additionalRules: [...reglas, ruleText] },
            });
        }

        const actualizado = await new UpdateProjectUseCase(this.projectRepository).execute(projectId, {
            courseOps: [{ op: 'decidePattern', patternId, decision: 'guide', guideId, ruleText, at: this.now().toISOString() }],
        });
        return { project: actualizado, guide: guiaFinal, added: !yaEsta };
    }
}
