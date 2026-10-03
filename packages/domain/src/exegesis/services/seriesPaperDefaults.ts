import type { SeriesExegesisDefaults } from '../../entities/SermonSeries';
import type { AddProjectSourceInput, CreateExegeticalPaperInput } from '../use-cases/dtos';

/**
 * Lo que un trabajo nuevo de una serie toma de la configuración exegética de
 * la serie: guía de estilo, rúbrica y corpus inicial.
 *
 * Lo usaban sólo los trabajos creados al finalizar la serie; «Crear paper»
 * desde una perícopa los ignoraba (Jonás 4:5-11 nació con la rúbrica
 * académica y sin la guía de la serie). Vive aquí para que los dos caminos
 * hagan lo mismo.
 *
 * Sin rúbrica elegida en la serie, el caso de uso aplica la de predicación:
 * un trabajo de una serie es un estudio para predicar.
 */
export function paperDefaultsFromSeries(
    defaults: SeriesExegesisDefaults | null | undefined,
): Pick<CreateExegeticalPaperInput, 'styleGuideId' | 'rubricTemplateId' | 'initialSources'> {
    const initialSources: AddProjectSourceInput[] = (defaults?.sourceRefs ?? []).map(ref => ({
        corpusId: ref.corpusId,
        sourceType: ref.sourceType as AddProjectSourceInput['sourceType'],
        displayLabel: ref.displayLabel,
        mode: ref.mode,
        sourceLibraryResourceId: ref.libraryResourceId,
    }));
    return {
        styleGuideId: defaults?.styleGuideId ?? null,
        ...(defaults?.rubricTemplateId ? { rubricTemplateId: defaults.rubricTemplateId } : {}),
        ...(initialSources.length > 0 ? { initialSources } : {}),
    };
}
