import { missingRequiredInputs, type ExegeticalPaper } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { usePaperInputs, useUpdatePaperInputs } from '@/hooks/exegesis/usePaperInputs';
import { PaperInputsList } from './PaperInputsList';
import { PaperRequirementsCard } from './PaperRequirementsCard';
import { CourseRulesCard } from './CourseRulesCard';

/**
 * «Entradas y requisitos» (fase «Asistente del corpus», A5): lo que el curso
 * dio para este trabajo, qué pide y las reglas que rigen. Va primero en la
 * configuración: el procedimiento reúne las entradas antes de todo, con el
 * plazo a la vista.
 */
export function PaperInputsSubStep({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const datos = usePaperInputs(paper);
    const guardar = useUpdatePaperInputs(paper.id);
    const faltan = missingRequiredInputs(datos.statuses);
    return (
        <div className="space-y-5">
            <header className="space-y-1">
                <h2 className="font-serif text-xl font-semibold text-foreground">{t('inputs.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('inputs.subtitle')}</p>
                <p role="status" className="text-sm font-medium text-foreground" data-testid="entradas-estado">
                    {faltan.length === 0
                        ? t('inputs.statusLine.ready')
                        : t('inputs.statusLine.missing', { count: faltan.length, list: faltan.map(f => t(`inputs.kind.${f.kind}`)).join(', ') })}
                </p>
            </header>
            <PaperInputsList
                statuses={datos.statuses}
                marks={paper.inputMarks ?? {}}
                saving={guardar.isPending}
                onSaveMarks={inputMarks => guardar.mutateAsync({ inputMarks })}
            />
            <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
                <PaperRequirementsCard
                    requirements={datos.requirements}
                    warnings={datos.warnings}
                    units={datos.units}
                    marks={paper.requirementMarks ?? {}}
                    manual={paper.manualRequirements ?? []}
                    saving={guardar.isPending}
                    onSave={patch => guardar.mutateAsync({
                        ...(patch.requirementMarks ? { requirementMarks: patch.requirementMarks } : {}),
                        ...(patch.manualRequirements ? { manualRequirements: [...patch.manualRequirements] } : {}),
                    })}
                />
                <CourseRulesCard
                    key={(paper.ignoredGrammarCategories ?? []).join('|')}
                    guideRules={datos.guideRules}
                    ignored={paper.ignoredGrammarCategories ?? []}
                    projectId={datos.projectId}
                    saving={guardar.isPending}
                    onSaveIgnored={ignoredGrammarCategories => guardar.mutateAsync({ ignoredGrammarCategories })}
                />
            </div>
        </div>
    );
}
