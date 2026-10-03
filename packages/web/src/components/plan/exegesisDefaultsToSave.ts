import type { SeriesExegesisDefaults } from '@dosfilos/domain';
/**
 * «Estudio para predicación (sistema)» se guarda como `null`, no se omite: la
 * serie se escribe con merge y una clave omitida dejaba la plantilla anterior
 * (revisión adversarial de C1).
 */
export function rubricIdFromOption(value: string): string | null {
    return value === '__auto' ? null : value;
}

export function exegesisDefaultsToSave(input: {
    rubricId: string | null | undefined;
    styleGuideId: string | null | undefined;
    sourceRefs: SeriesExegesisDefaults['sourceRefs'];
}): SeriesExegesisDefaults {
    return {
        ...(input.rubricId !== undefined ? { rubricTemplateId: input.rubricId } : {}),
        ...(input.styleGuideId !== undefined ? { styleGuideId: input.styleGuideId } : {}),
        sourceRefs: input.sourceRefs,
    };
}
