import { useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import {
    computeRubricCompliance,
    getSourceTypeOrderIndex,
    type ExegeticalPaper,
    type RequirementCheck,
    type SourceType,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useLibrary } from '@/hooks/library';
import { RecommendationsSection } from '../recommendations/RecommendationsSection';
import { useAttachLibrarySource } from '@/hooks/exegesis/useAttachLibrarySource';

/**
 * Visual gap analysis between the paper's corpus and its rubric.
 *
 * Renders one of two states:
 *   - All minimums met → green "compliant" banner with a count of
 *     sources and an encouraging next-step nudge.
 *   - One or more gaps → amber/red banner listing the missing types,
 *     each with the rubric's pedagogical justification + examples
 *     localized through the SourceType i18n catalog. Optional
 *     requirements that have no entries are NOT shown — they'd dilute
 *     the signal.
 *
 * The card is read-only: it explains the gap but doesn't take an
 * action. The upload form below is the action.
 *
 * Stateless component. Recomputed by the parent on every source
 * change so the card stays in sync without effects.
 */
interface RubricGapCardProps {
    paper: ExegeticalPaper;
    /**
     * Abre el diálogo único de agregar, con la biblioteca filtrada al tipo que
     * pide este requisito. NO es otra puerta de subida: la fila no agrega
     * nada, sólo lleva a buscar lo que falta donde se busca todo.
     * The parent (`CorpusSubStep`) reacts by pre-selecting that
     * type in the upload form below and scrolling it into view.
     */
    onPickType?: (type: SourceType) => void;
}

export function RubricGapCard({ paper, onPickType }: RubricGapCardProps) {
    const { t } = useTranslation('exegesis');
    const rubric = paper.rubric;

    if (!rubric) {
        return (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {t('paperSetup.subSteps.corpus.gap.noRubric')}
            </div>
        );
    }

    const sourceTypes = paper.sources.map(s => s.sourceType);
    const report = computeRubricCompliance(sourceTypes, rubric);

    // Surface only requirements with `required > 0` — zero-minimum
    // entries are recommendations, shown later in a separate
    // collapsible if the user wants to engage them. Keeps the gap
    // signal sharp.
    //
    // Sort by canonical SOURCE_TYPE_GROUPS position so the gap card
    // matches the academic-priority order used everywhere else (rubric
    // editor + summary view): primary text → lexical → commentaries
    // → background. The original report.requirements order mirrors
    // the rubric's insertion order, which feels arbitrary here.
    const visibleRequirements = report.requirements
        .filter(r => r.required > 0)
        .sort((a, b) => getSourceTypeOrderIndex(a.sourceType) - getSourceTypeOrderIndex(b.sourceType));
    const totalSources = paper.sources.length;

    // Suppress the "rubric satisfied" success card when there are no
    // sources yet — with a permissive or strategy-only rubric the
    // condition is technically true (no minimums to fail) but the
    // user hasn't done any work and the message reads as misleading.
    // The hero / role-coverage card handles the empty-state messaging.
    if (report.meetsMinimums && totalSources === 0) return null;

    if (report.meetsMinimums) {
        return (
            <div className="rounded-lg border border-success/30 bg-success-subtle p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-success-subtle-foreground">
                        {t('paperSetup.subSteps.corpus.gap.metTitle')}
                    </h3>
                    <p className="text-xs text-success-subtle-foreground mt-1">
                        {t('paperSetup.subSteps.corpus.gap.metBody', { count: totalSources })}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-warning/30 bg-warning-subtle p-4 space-y-3">
            <header className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-warning-subtle-foreground">
                        {t('paperSetup.subSteps.corpus.gap.gapsTitle', {
                            satisfied: report.requirements.filter(r => r.satisfied).length,
                            total: visibleRequirements.length,
                        })}
                    </h3>
                    <p className="text-xs text-warning-subtle-foreground mt-1">
                        {t('paperSetup.subSteps.corpus.gap.gapsBody', { missing: report.totalMissing })}
                    </p>
                </div>
            </header>
            <ul className="space-y-2 pl-7">
                {visibleRequirements
                    .filter(r => !r.satisfied)
                    .map(r => (
                        <RequirementRow key={r.sourceType} check={r} paper={paper} onPickType={onPickType} />
                    ))}
                {visibleRequirements
                    .filter(r => r.satisfied)
                    .map(r => (
                        <RequirementRow key={r.sourceType} check={r} paper={paper} onPickType={onPickType} />
                    ))}
            </ul>
        </div>
    );
}

/**
 * Adjunta al corpus una obra recomendada que el pastor YA tiene en su
 * biblioteca, con el tipo del requisito que la tarjeta estaba cubriendo.
 *
 * El rol se deja sin elegir a propósito: la recomendación cubre un
 * REQUISITO de la rúbrica (que se mide por tipo), y el rol dialéctico es
 * una decisión aparte que el pastor toma en la lista de fuentes. Fijarlo
 * acá sería volver a decidir por él.
 */
function useAttachRecommendationMatch(paper: ExegeticalPaper, sourceType: SourceType) {
    const { t } = useTranslation('exegesis');
    const attachLibrarySource = useAttachLibrarySource();
    return useCallback(
        async (libraryResourceId: string, title: string) => {
            try {
                await attachLibrarySource.attach({
                    paperId: paper.id,
                    libraryResourceId,
                    sourceType,
                    displayLabel: title,
                    passage: paper.passage,
                    assignmentBrief: paper.assignmentBrief,
                    language: paper.displayLanguage,
                });
                toast.success(t('paperSetup.subSteps.corpus.recommendations.attachedToast', { title }));
            } catch (err) {
                console.error('[exegesis] attach recommendation match failed:', err);
                toast.error(t('paperSetup.subSteps.corpus.recommendations.attachFailedToast'));
            }
        },
        [attachLibrarySource, paper, sourceType, t],
    );
}

function RequirementRow({
    check,
    paper,
    onPickType,
}: {
    check: RequirementCheck;
    paper: ExegeticalPaper;
    onPickType?: (type: SourceType) => void;
}) {
    const { t } = useTranslation('exegesis');
    const library = useLibrary();
    const attachMatch = useAttachRecommendationMatch(paper, check.sourceType);
    const label = t(`sourceTypes.${check.sourceType}.label`);
    const examples = t(`sourceTypes.${check.sourceType}.examples`);

    return (
        <li className="flex items-start gap-2 text-xs">
            {check.satisfied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
            ) : (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-warning text-warning-foreground text-[10px] font-semibold mt-0 shrink-0">
                    {check.missing}
                </span>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className={check.satisfied
                        ? 'text-success-subtle-foreground font-medium'
                        : 'text-warning-subtle-foreground font-medium'}
                    >
                        {label} · {check.have}/{check.required}
                    </p>
                    {/* Sin biblioteca no hay dónde buscar, y el enlace
                        prometería una estantería vacía. */}
                    {!check.satisfied && onPickType && library.resources.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onPickType(check.sourceType)}
                            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 hover:bg-warning/20 transition-colors"
                            title={t('paperSetup.subSteps.corpus.gap.findForType', { type: label })}
                        >
                            <Search className="h-3 w-3" />
                            {t('paperSetup.subSteps.corpus.gap.findForTypeShort')}
                        </button>
                    )}
                </div>
                <p className="text-warning-subtle-foreground leading-snug mt-0.5">
                    {check.justification}
                </p>
                <p className="text-[11px] text-muted-foreground italic mt-0.5">
                    {examples}
                </p>
                {/* v1.7 corpus recommendations — curated bibliography
                    surfaced under each requirement gap. Renders an empty
                    state when no curation exists for (book × sourceType),
                    which is also the signal that drives the catalog
                    expansion priority. */}
                <RecommendationsSection
                    bookId={paper.passage.bookId}
                    sourceType={check.sourceType}
                    paperLanguage={paper.displayLanguage}
                    paperId={paper.id}
                    onAttachMatch={attachMatch}
                />
            </div>
        </li>
    );
}
