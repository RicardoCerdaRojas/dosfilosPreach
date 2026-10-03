import { rubricPreset, type PaperRubric } from '@dosfilos/domain';

type T = (key: string, opts?: Record<string, unknown>) => string;

/**
 * El nombre de la rúbrica en pantalla.
 *
 * Las dos del sistema decían «Default del sistema» y no se distinguían: el
 * fundador no sabía si su estudio tenía la de predicación (Jonás 4:5-11).
 * Ahora dice cuál es y si se editó; las extraídas y las de plantilla siguen
 * diciendo de dónde salieron.
 */
export function rubricLabel(rubric: PaperRubric, t: T): string {
    const preset = rubricPreset(rubric);
    if (preset && rubric.provenance === 'system-default') {
        return t('paperSetup.subSteps.rubric.presetSystem', { preset: t(`paperSetup.subSteps.rubric.preset.${preset}`) });
    }
    if (preset && rubric.provenance === 'user-edited') {
        return t('paperSetup.subSteps.rubric.presetEdited', { preset: t(`paperSetup.subSteps.rubric.preset.${preset}`) });
    }
    return t(`paperSetup.subSteps.rubric.provenance.${rubric.provenance}`);
}

/**
 * La justificación de una expectativa estructural. La clave manda; el respaldo
 * de las rúbricas académicas viejas (que guardaban literales en inglés) ya NO
 * se aplica a la de predicación: le ponía las justificaciones de la académica.
 */
export function expectationJustification(
    rubric: PaperRubric,
    section: string,
    expectation: { justificationKey?: string; justification: string },
    t: T,
): string {
    if (expectation.justificationKey) return t(expectation.justificationKey);
    if (rubric.provenance === 'system-default' && rubricPreset(rubric) === 'academic') {
        return t(`paperSetup.subSteps.plan.rubricJustification.${section}`);
    }
    return expectation.justification;
}
