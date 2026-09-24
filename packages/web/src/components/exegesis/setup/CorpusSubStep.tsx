import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    AlertTriangle,
    BookOpenText,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Eye,
    ExternalLink,
    FileStack,
    FileText,
    Library,
    Loader2,
    Quote,
    RefreshCcw,
    Ruler,
    Search,
    Sparkles,
    Upload,
    X,
    } from 'lucide-react';
import { toast } from 'sonner';
import { libraryService } from '@dosfilos/application';
import {
    CITABLE_SOURCE_TYPES,
    computeEffectiveRoleTargets,
    computeRoleCoverage,
    computeRoleExpectations,
    findMissingRoles,
    resolveSourceRole,
    suggestRoleForType,
    formatPassageReference,
    getBookById,
    hasResolvedNumbering,
    isExcerptSetStale,
    resourceMatchesTestament,
    type ExegeticalPaper,
    type LibraryResource,
    type ProjectSource,
    type ResourceIndexStatus,
    type ResourceType,
    type SourceRole,
    type SourceType,
    type Testament,
    resolveExegeticalStrategy,
    usesRoleCoverage,
    type ExegeticalStrategy,
} from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { HerenciaDeSerie } from './HerenciaDeSerie';
import { pesoDeRecurso, type PesoAcademico } from './pesoAcademico';
import { filtroDeBibliotecaPara } from './tipoAcademico';
import { useLibrary } from '@/hooks/library';
import { useExtractExcerpts } from '@/hooks/exegesis/useExtractExcerpts';
import { useAttachLibrarySource } from '@/hooks/exegesis/useAttachLibrarySource';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useAutoClassifyOtherSources } from '@/hooks/exegesis/useAutoClassifyOtherSources';
import { SourceTypePicker } from './SourceTypePicker';
import { RubricGapCard } from './RubricGapCard';
import { CourseBibliographyCard } from './CourseBibliographyCard';
import { RubricRigorIndicator } from '@/components/exegesis/rubric/RubricRigorIndicator';
import { ExtractFromLibraryDialog } from './ExtractFromLibraryDialog';
import { SourceSelectionModeBadge } from './SourceSelectionModeBadge';
import { CorpusBudgetMeter } from './CorpusBudgetMeter';
import { PageBalanceHint } from './PageBalanceHint';
import { FileDropzone } from '@/components/ui/file-dropzone';

/**
 * Corpus sub-step — the main pedagogical surface of the rubric-driven
 * setup.
 *
 * Three sections, top to bottom:
 *   1. **Gap card** (`RubricGapCard`) — instant feedback on what the
 *      rubric needs vs. what's loaded. Re-renders on every source
 *      change.
 *   2. **Attached sources list** — what's already on the paper, with
 *      inline edit of `sourceType` (so the student can re-classify
 *      without re-uploading) and remove.
 *   3. **Upload form** — file → library_resource → addSource. Uses
 *      the granular `SourceTypePicker` grouped by academic family.
 *
 * Differs from the old wizard's `SourcesStep`: the paper already
 * exists when this sub-step runs, so uploads attach immediately
 * (`addSource.mutateAsync`). No "pending sources" buffer.
 */
interface CorpusSubStepProps {
    paper: ExegeticalPaper;
}

export function CorpusSubStep({ paper }: CorpusSubStepProps) {
    const { t } = useTranslation('exegesis');
    const topLibrary = useLibrary();
    // Background pass: auto-classifies any source still tagged as
    // 'other' once its underlying library resource finishes
    // extracting text. Silent on success (the source row updates in
    // place via the `paper.sources` subscription); silent on failure
    // (logged only). See the hook for skip rules.
    useAutoClassifyOtherSources(paper, topLibrary.resources);

    // Add-source dialog state. A single dialog handles both:
    //   - "Agregar fuente" button at the top of the list (no
    //     pre-selected type — student picks it inside the dialog).
    //   - Per-requirement "Subir" buttons in the gap card
    //     (type pre-selected matching the missing requirement).
    // Replacing the always-visible inline form with a contextual
    // dialog gives clicks immediate visible feedback and avoids
    // the auto-scroll-to-bottom problem the inline form caused.
    const [dialogOpen, setDialogOpen] = useState(false);
    // Lo único que puede venir preseleccionado: el tipo que pide un requisito
    // de la rúbrica, y sólo como FILTRO de la biblioteca. El rol ya no viaja
    // desde afuera — se elige adentro, después de ver qué libro es.
    const [dialogInitialType, setDialogInitialType] = useState<SourceType | null>(null);
    const [dialogPickedResourceId, setDialogPickedResourceId] = useState<string | null>(null);
    // v1.5: separate dialog for the library-extraction flow. Opens
    // independently from the upload dialog so the two paths don't
    // tangle their state — the upload dialog is "I'm bringing a new
    // file or picking ONE library doc as full-document"; the
    // extraction dialog is "I want curated excerpts from MULTIPLE
    // library docs at once."
    const [extractDialogOpen, setExtractDialogOpen] = useState(false);

    const openDialog = (preselect: SourceType | null) => {
        setDialogInitialType(preselect);
        setDialogPickedResourceId(null);
        setDialogOpen(true);
    };

    /** Abre el diálogo con el libro ya marcado, desde la bibliografía del curso. */
    const openDialogForResource = (resourceId: string) => {
        setDialogInitialType(null);
        setDialogPickedResourceId(resourceId);
        setDialogOpen(true);
    };

    // When the paper has zero sources, the user's first decision is
    // "how do I bring sources in?" — so the SourcesList (which renders
    // the extraction hero in that state) becomes the top action and
    // the rubric gap card drops below as a preview of what's coming.
    // Once the user has at least one source, the gap card moves back
    // up because it's now the guidance for what to add next.
    const isStartingEmpty = paper.sources.length === 0;

    return (
        <div className="space-y-6">
            <header className="flex items-center gap-3">
                <FileStack className="h-5 w-5 text-success shrink-0" />
                <h2 className="text-lg font-semibold text-foreground flex-1 min-w-0">
                    {t('paperSetup.subSteps.corpus.heading')}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                    <PageBalanceHint />
                    <StrategyModeBadge strategy={resolveExegeticalStrategy(paper.exegeticalStrategy)} />
                    {/* LA puerta. Antes había cinco —tres botones de rol, un
                        «Subir» por cada requisito de la rúbrica y el genérico—
                        y todas abrían este mismo diálogo: sólo cambiaban qué
                        venía preseleccionado. Cinco puertas al mismo cuarto se
                        leen como cinco maneras distintas de agregar. Ahora la
                        rúbrica y los roles informan y filtran; agregar se hace
                        acá. */}
                    <Button
                        type="button"
                        onClick={() => openDialog(null)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    >
                        <Upload className="h-3 w-3 mr-1" />
                        {t('paperSetup.subSteps.corpus.list.addCta')}
                    </Button>
                </div>
            </header>

            {paper.rubric && <RubricRigorIndicator rubric={paper.rubric} />}

            {isStartingEmpty ? (
                <>
                    <CorpusSourcesList
                        paper={paper}
                        onAdd={() => openDialog(null)}
                        onExtract={() => setExtractDialogOpen(true)}
                    />
                    <RubricGapCard paper={paper} onPickType={(type) => openDialog(type)} />
                    <CourseBibliographyCard paper={paper} onAddResource={openDialogForResource} />
                </>
            ) : (
                <>
                    {usesRoleCoverage(paper.exegeticalStrategy) && (
                        <RoleCoverageCard paper={paper} />
                    )}
                    {/* Suppress the rubric-gap card for dialectical
                        papers whose rubric has no per-type minimums
                        (strategy-only preset). The RoleCoverageCard
                        is the canonical compliance signal in that
                        scenario; rendering RubricGapCard's "cumple la
                        rúbrica" message on top would falsely declare
                        success while the strategy still expects three
                        roles covered. For free-mode papers OR
                        rubrics that DO carry requirements, both cards
                        coexist (rubric answers "which types matter",
                        strategy answers "which roles are balanced"). */}
                    {!(
                        usesRoleCoverage(paper.exegeticalStrategy)
                        && (paper.rubric?.sourceRequirements?.length ?? 0) === 0
                    ) && (
                        <RubricGapCard paper={paper} onPickType={(type) => openDialog(type)} />
                    )}
                    <CourseBibliographyCard paper={paper} onAddResource={openDialogForResource} />
                    <CorpusSourcesList
                        paper={paper}
                        onAdd={() => openDialog(null)}
                        onExtract={() => setExtractDialogOpen(true)}
                    />
                </>
            )}

            <AddSourceDialog
                paper={paper}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                initialType={dialogInitialType}
                initialPickedResourceId={dialogPickedResourceId}
            />

            <ExtractFromLibraryDialog
                paper={paper}
                open={extractDialogOpen}
                onOpenChange={setExtractDialogOpen}
            />
        </div>
    );
}

// ── Sources list ────────────────────────────────────────────────────────

function CorpusSourcesList({
    paper,
    onAdd,
    onExtract,
}: {
    paper: ExegeticalPaper;
    onAdd: () => void;
    onExtract: () => void;
}) {
    const { t } = useTranslation('exegesis');
    const library = useLibrary();
    const strategy = resolveExegeticalStrategy(paper.exegeticalStrategy);
    const sorted = [...paper.sources].sort((a, b) => a.order - b.order);
    // When the user has a stocked library AND no sources on this paper,
    // the curated-extraction path is the differentiator we want them to
    // try first. Hide the secondary buttons and show a hero card instead.
    const showExtractHero = sorted.length === 0 && library.resources.length > 0;
    // Curated-corpus summary: drives the value-reminder banner shown
    // above the source list once the user has extracted excerpts. The
    // banner reinforces the differentiator at the moment of decision
    // (just before "Plan de uso" / generation) so the user feels what
    // they actually built.
    const excerptedSources = sorted.filter(s => s.mode === 'extracted-excerpts');
    const totalExcerpts = excerptedSources.reduce((sum, s) => sum + s.excerpts.length, 0);

    return (
        <section className="space-y-2">
            {/* Arriba de todo, y también con fuentes ya adjuntas: cuando el
                trabajo tiene dos y la serie tiene once, traer las nueve que
                faltan sigue siendo lo más útil de esta pantalla. La tarjeta se
                esconde sola cuando no hay nada que ofrecer. */}
            <HerenciaDeSerie paperId={paper.id} />
            {/* Header only when there are sources to label. The empty
                state's hero card is doing the entry-point work and
                the "(0)" header was just noise on first paint. */}
            {sorted.length > 0 && <CorpusBudgetMeter paper={paper} />}
            {sorted.length > 0 && (
                <header className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                        {t('paperSetup.subSteps.corpus.list.title')} ({sorted.length})
                    </h3>
                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onExtract}
                            className="text-xs"
                        >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {t('paperSetup.subSteps.corpus.list.extractCta')}
                        </Button>
                    </div>
                </header>
            )}
            {sorted.length === 0 ? (
                showExtractHero ? (
                    <ExtractHeroCard
                        libraryCount={library.resources.length}
                        strategy={strategy}
                        onExtract={onExtract}
                    />
                ) : (
                    <EmptySourcesState onAdd={onAdd} />
                )
            ) : (
                <>
                    {totalExcerpts > 0 && (
                        <CuratedSummaryBanner
                            excerptCount={totalExcerpts}
                            sourceCount={excerptedSources.length}
                        />
                    )}
                    {usesRoleCoverage(strategy) ? (
                        <GroupedByRoleList paper={paper} sources={sorted} />
                    ) : (
                        <ul className="space-y-2">
                            {sorted.map(source => (
                                <SourceRow key={source.id} paper={paper} source={source} />
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}

/**
 * Slim summary banner shown above the source list once the user has
 * extracted excerpts. Surfaces the value of the curated approach at
 * the moment they're about to move on to "Plan de uso" / generation:
 * the corpus they built is N fragments from M sources, every fragment
 * traceable back to its original page. Reinforces the differentiator
 * vs runtime RAG (NotebookLM) where the user never sees what the
 * model is actually consuming.
 */

/**
 * Source list grouped into anchor / contrast / technical / sin rol
 * sections, used in dialectical mode so the student can see at a
 * glance how each upload maps to the strategy. Sources whose
 * `sourceType` doesn't suggest a role (style templates, "other")
 * fall into the "sin rol" bucket so nothing disappears.
 *
 * Los grupos vacíos muestran una línea «vacío» y nada más. Tuvieron un botón
 * «Agregar X» por rol, y era la tercera copia de la misma puerta —el chip de
 * cobertura y el héroe tenían la suya—. Agregar se hace en un solo lugar.
 */
function GroupedByRoleList({
    paper,
    sources,
}: {
    paper: ExegeticalPaper;
    sources: ReadonlyArray<ProjectSource>;
}) {
    const { t } = useTranslation('exegesis');
    const groups = useMemo(() => {
        const buckets: Record<SourceRole | 'unrolled', ProjectSource[]> = {
            anchor: [], contrast: [], technical: [], unrolled: [],
        };
        for (const s of sources) {
            // Por rol RESUELTO: si el pastor la puso de ancla, va a anclas
            // aunque su tipo diga otra cosa. Antes acá mandaba el tipo y por
            // eso la fuente aterrizaba en una sección que el pastor no había
            // elegido.
            const { role } = resolveSourceRole(s);
            buckets[role ?? 'unrolled'].push(s);
        }
        return buckets;
    }, [sources]);

    const orderedRoles: ReadonlyArray<SourceRole> = ['anchor', 'contrast', 'technical'];

    return (
        <div className="space-y-4">
            {orderedRoles.map(role => (
                <RoleGroupSection
                    key={role}
                    role={role}
                    paper={paper}
                    sources={groups[role]}
                />
            ))}
            {groups.unrolled.length > 0 && (
                <section className="space-y-1.5">
                    <h4 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {t('paperSetup.subSteps.corpus.list.groupUnrolled', { count: groups.unrolled.length })}
                    </h4>
                    <ul className="space-y-2">
                        {groups.unrolled.map(s => (
                            <SourceRow key={s.id} paper={paper} source={s} />
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

function RoleGroupSection({
    role,
    paper,
    sources,
}: {
    role: SourceRole;
    paper: ExegeticalPaper;
    sources: ReadonlyArray<ProjectSource>;
}) {
    const { t } = useTranslation('exegesis');
    const empty = sources.length === 0;
    return (
        <section className="space-y-1.5">
            <header className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                    {t(`paperSetup.subSteps.corpus.roleCoverage.role.${role}`)}
                    <span className="ml-1.5 text-muted-foreground/70 normal-case tracking-normal font-normal">
                        ({sources.length})
                    </span>
                </h4>
            </header>
            {empty ? (
                <p className="text-[11.5px] italic text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
                    {t('paperSetup.subSteps.corpus.list.groupEmpty')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {sources.map(s => (
                        <SourceRow key={s.id} paper={paper} source={s} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function CuratedSummaryBanner({
    excerptCount,
    sourceCount,
}: {
    excerptCount: number;
    sourceCount: number;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-lg border border-success/30 bg-success-subtle/40 px-4 py-2.5 flex items-start gap-3 mb-2">
            <Sparkles className="h-4 w-4 text-success mt-0.5 shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground">
                    {t('paperSetup.subSteps.corpus.summary.title', {
                        excerptCount,
                        sourceCount,
                    })}
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {t('paperSetup.subSteps.corpus.summary.body')}
                </p>
            </div>
        </div>
    );
}

/**
 * Empty state for users who don't have any library yet — falls back
 * to highlighting the upload path. Lighter visual weight than the
 * extract hero because new users haven't paid the cost of building
 * a library and we don't want to gatekeep them.
 */
/**
 * Compact pill that tells the user which methodology mode the paper
 * is in. Renders next to the page-balance hint at the top of the
 * corpus tab so the framing is visible from the entry point.
 *
 * Read-only for now — switching modes from here is a follow-up that
 * needs a backend mutation (`updatePaperStrategy`). The pill exists
 * primarily to make the chosen mode legible: students see "Modo:
 * Estrategia exegética" and understand WHY they're seeing the
 * role-coverage card; or "Modo: Libre" and understand WHY they're
 * not.
 */
function StrategyModeBadge({ strategy }: { strategy: ExegeticalStrategy }) {
    const { t } = useTranslation('exegesis');
    const dialectical = usesRoleCoverage(strategy);
    return (
        <span
            className={[
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap',
                dialectical
                    ? 'border-success/40 bg-success-subtle text-success-subtle-foreground'
                    : 'border-border bg-muted text-muted-foreground',
            ].join(' ')}
            title={t(`paperSetup.subSteps.corpus.strategyBadge.tooltip.${strategy}`)}
        >
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            {t(`paperSetup.subSteps.corpus.strategyBadge.${strategy}`)}
        </span>
    );
}

/**
 * Dialectical-strategy coverage card. Counts the corpus by suggested
 * role (anchor/contrast/technical) and surfaces "te falta X" nudges
 * when a role is empty. Only rendered for dialectical-mode papers —
 * free-mode users never see it (their explicit choice was no
 * methodology scaffolding).
 *
 * The card is informational + actionable: each missing-role nudge is
 * a button that opens the add-source dialog with the suggested
 * SourceType pre-selected, so the student can fill the gap without
 * navigating menus.
 */
function RoleCoverageCard({
    paper,
}: {
    paper: ExegeticalPaper;
}) {
    const { t } = useTranslation('exegesis');
    const coverage = useMemo(() => computeRoleCoverage(paper.sources), [paper.sources]);
    const rubricExpectations = useMemo(() => computeRoleExpectations(paper.rubric), [paper.rubric]);
    const effectiveTargets = useMemo(() => computeEffectiveRoleTargets(rubricExpectations), [rubricExpectations]);

    // No sources yet: don't render — the hero card is doing the
    // entry-point work in that state.
    if (coverage.total === 0) return null;

    // Three-tier compliance state, per the dialectical strategy's
    // own logic (NOT the rubric's per-type minimums):
    //   - 'missing'  → at least one role has zero sources. Treat as
    //                  non-compliance — the strategy literally requires
    //                  three roles to function (an "ancla + contraste
    //                  + técnica" triangle); zero of any role breaks
    //                  the method, regardless of how many sources the
    //                  other roles carry.
    //   - 'partial'  → every role has ≥1 source but at least one is
    //                  below its target. Real progress, but the user
    //                  can still go deeper. Soft warning tone.
    //   - 'balanced' → every role meets its effective target.
    //
    // This replaces the previous binary (allGood vs not) which couldn't
    // distinguish "5 anchors / 0 contrast / 0 technical" from "3/3/2"
    // — the user pointed out both states currently rendered identically
    // even though only one of them is a structural problem.
    const missingRoles = (['anchor', 'contrast', 'technical'] as const).filter(r => coverage[r] === 0);
    const allBalanced =
        coverage.anchor >= effectiveTargets.anchor &&
        coverage.contrast >= effectiveTargets.contrast &&
        coverage.technical >= effectiveTargets.technical;
    const state: 'missing' | 'partial' | 'balanced' =
        missingRoles.length > 0 ? 'missing' : (allBalanced ? 'balanced' : 'partial');

    const containerTone =
        state === 'balanced' ? 'border-success/30 bg-success-subtle/40'
            : state === 'missing' ? 'border-warning/60 bg-warning-subtle/60'
                : 'border-warning/40 bg-warning-subtle/40';
    const iconTone =
        state === 'balanced' ? 'text-success'
            : 'text-warning-subtle-foreground';
    const Icon = state === 'balanced' ? Sparkles : AlertTriangle;
    const titleKey =
        state === 'balanced' ? 'paperSetup.subSteps.corpus.roleCoverage.balancedTitle'
            : state === 'missing' ? 'paperSetup.subSteps.corpus.roleCoverage.missingTitle'
                : 'paperSetup.subSteps.corpus.roleCoverage.partialTitle';

    // Per-role deficit list for the body. Names which roles are
    // below target and by how much, so the user doesn't have to
    // scan three chips to figure out where the gap is. Empty for
    // the balanced state.
    const deficits = (['anchor', 'contrast', 'technical'] as const)
        .map(r => ({ role: r, gap: Math.max(0, effectiveTargets[r] - coverage[r]) }))
        .filter(d => d.gap > 0);
    const bodyText = (() => {
        if (state === 'balanced') return null;
        if (state === 'missing') return t('paperSetup.subSteps.corpus.roleCoverage.missingBody');
        // Partial: enumerate the specific roles below target. The
        // generic "suma fuentes en los roles que aún están bajo el
        // target" copy was easy to misread when the actual gap was
        // a single source on one role — the user mistook the chip
        // for "close enough" instead of seeing it as a real miss.
        // `count` va además de `gap`: la clave tiene formas `_one`/`_other`
        // e i18next necesita `count` para elegir una. Sin él no resuelve y
        // la pantalla imprime la clave cruda —
        // «paperSetup.subSteps.corpus.roleCoverage.partialDeficitItem»— a
        // la vista del usuario. El chip «Falta 1», cien líneas más abajo
        // en este mismo archivo, siempre lo pasó; esta llamada no.
        const parts = deficits.map(d => t('paperSetup.subSteps.corpus.roleCoverage.partialDeficitItem', {
            role: t(`paperSetup.subSteps.corpus.roleCoverage.role.${d.role}`).toLowerCase(),
            count: d.gap,
            gap: d.gap,
        }));
        const list = parts.join(t('paperSetup.subSteps.corpus.roleCoverage.partialDeficitJoiner'));
        return t('paperSetup.subSteps.corpus.roleCoverage.partialBody', { gaps: list });
    })();

    return (
        <section className={`rounded-xl border p-4 space-y-3 ${containerTone}`}>
            <header className="flex items-start gap-2.5">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconTone}`} aria-hidden />
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                        {t('paperSetup.subSteps.corpus.roleCoverage.eyebrow')}
                    </p>
                    <h3 className="text-sm font-semibold text-foreground mt-0.5">
                        {t(titleKey)}
                    </h3>
                </div>
            </header>

            <div className="grid grid-cols-3 gap-2">
                <RoleCountChip
                    role="anchor"
                    count={coverage.anchor}
                    target={effectiveTargets.anchor}
                    fromRubric={rubricExpectations.anchor > 0}
                />
                <RoleCountChip
                    role="contrast"
                    count={coverage.contrast}
                    target={effectiveTargets.contrast}
                    fromRubric={rubricExpectations.contrast > 0}
                />
                <RoleCountChip
                    role="technical"
                    count={coverage.technical}
                    target={effectiveTargets.technical}
                    fromRubric={rubricExpectations.technical > 0}
                />
            </div>

            {bodyText && (
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                    {bodyText}
                </p>
            )}
        </section>
    );
}

/**
 * Cuánto cubre un rol, y nada más.
 *
 * El chip tuvo un botón «Agregar X» que abría el diálogo con el rol fijado de
 * antemano. Se quitó: el rol es la única decisión que el sistema no puede
 * tomar por el pastor, y se toma UNA vez dentro del diálogo, después de ver
 * qué libro es y qué sugiere su tipo. Fijarlo antes de elegir el libro invertía
 * el orden —comprometía la respuesta antes de conocer la pregunta— y sumaba
 * tres puertas más a la misma habitación.
 */
function RoleCountChip({
    role,
    count,
    target,
    fromRubric,
}: {
    role: SourceRole;
    count: number;
    /** Effective target — rubric minimum if present, strategy suggestion otherwise. */
    target: number;
    /** True when the target came from the rubric (vs strategy fallback). */
    fromRubric: boolean;
}) {
    const { t } = useTranslation('exegesis');
    const ok = count >= target;
    const gap = Math.max(0, target - count);
    return (
        <div
            className={[
                'rounded-lg border px-3 py-2 flex flex-col',
                ok ? 'border-success/30 bg-card' : 'border-warning/40 bg-card',
            ].join(' ')}
        >
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                {t(`paperSetup.subSteps.corpus.roleCoverage.role.${role}`)}
            </p>
            <div className="flex items-center justify-between gap-2">
                <p className={[
                    'text-lg font-semibold tabular-nums leading-tight',
                    ok ? 'text-success' : 'text-warning-subtle-foreground',
                ].join(' ')}>
                    {count}
                    <span className="text-[11px] text-muted-foreground font-normal ml-1">
                        / {target}
                    </span>
                </p>
                {/* Explicit deficit badge so the gap doesn't hide
                    behind subtle color shifts. The user reported
                    that "3/4" reads as "good enough" without this
                    cue — the warning border alone wasn't loud
                    enough when the deficit was a single source. */}
                {!ok && (
                    <span className="inline-flex items-center rounded-full border border-warning/50 bg-warning-subtle px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-warning-subtle-foreground whitespace-nowrap">
                        {t('paperSetup.subSteps.corpus.roleCoverage.deficitBadge', { count: gap, gap })}
                    </span>
                )}
            </div>
            {/* Single-line hint. The previous "(estrategia)" /
                "(rúbrica)" suffix wrapped on every chip and added
                noise — the source of the target is already conveyed
                by the section copy ("Si tu rúbrica especifica un
                mínimo, ese gana; si no, mostramos la estrategia").
                Hidden behind `title` so power users can still inspect
                it on hover. */}
            <p
                className="text-[10.5px] text-muted-foreground leading-tight mt-0.5"
                title={t(fromRubric
                    ? 'paperSetup.subSteps.corpus.roleCoverage.targetSource.rubric'
                    : 'paperSetup.subSteps.corpus.roleCoverage.targetSource.strategy') as string}
            >
                {t(`paperSetup.subSteps.corpus.roleCoverage.hint.${role}`)}
            </p>
        </div>
    );
}

function EmptySourcesState({ onAdd }: { onAdd: () => void }) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center space-y-3">
            <p className="text-xs text-muted-foreground italic">
                {t('paperSetup.subSteps.corpus.list.empty')}
            </p>
            <Button
                type="button"
                onClick={onAdd}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
            >
                <Upload className="h-3 w-3 mr-1" />
                {t('paperSetup.subSteps.corpus.list.addCta')}
            </Button>
        </div>
    );
}

/**
 * Hero card for users who already have a library stocked. Sells the
 * curated-extraction path as the primary route and contrasts it
 * against the dump-the-whole-PDF approach so the differentiator vs
 * generic AI tools (NotebookLM et al.) lands at the entry point —
 * not buried behind a small "Extract" button.
 *
 * Falls back to "Subir archivo nuevo" as a secondary link so the
 * upload path stays one click away.
 */
function ExtractHeroCard({
    libraryCount,
    strategy,
    onExtract,
}: {
    libraryCount: number;
    strategy: ExegeticalStrategy;
    onExtract: () => void;
}) {
    const { t } = useTranslation('exegesis');

    if (usesRoleCoverage(strategy)) {
        return (
            <div className="rounded-xl border border-success/30 bg-success-subtle/40 p-5 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-success/15 p-2 shrink-0">
                        <Sparkles className="h-5 w-5 text-success" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-success font-semibold">
                            {t('paperSetup.subSteps.corpus.hero.dialecticalEyebrow')}
                        </p>
                        <h4 className="text-base font-semibold text-foreground mt-0.5">
                            {t('paperSetup.subSteps.corpus.hero.dialecticalTitle', { count: libraryCount })}
                        </h4>
                        <p className="text-[12.5px] text-foreground/80 leading-relaxed mt-1.5">
                            {t('paperSetup.subSteps.corpus.hero.dialecticalBody')}
                        </p>
                    </div>
                </div>

                {/* Una acción, y la que este héroe vende: extraer fragmentos
                    de toda la biblioteca. Los tres botones de rol pedían
                    comprometer el rol ANTES de elegir el libro —el rol se
                    decide dentro del diálogo, ya viendo qué obra es— y el
                    enlace «o subir un archivo» era una segunda copia del botón
                    de agregar que vive en el encabezado del paso. */}
                <Button
                    type="button"
                    onClick={onExtract}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                    <Sparkles className="h-4 w-4" />
                    {t('paperSetup.subSteps.corpus.hero.primaryCta')}
                </Button>

            </div>
        );
    }

    // Free mode — generic curated-extraction pitch.
    return (
        <div className="rounded-xl border border-success/30 bg-success-subtle/40 p-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-success/15 p-2 shrink-0">
                    <Sparkles className="h-5 w-5 text-success" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-success font-semibold">
                        {t('paperSetup.subSteps.corpus.hero.eyebrow')}
                    </p>
                    <h4 className="text-base font-semibold text-foreground mt-0.5">
                        {t('paperSetup.subSteps.corpus.hero.title', { count: libraryCount })}
                    </h4>
                    <p className="text-[12.5px] text-foreground/80 leading-relaxed mt-1.5">
                        {t('paperSetup.subSteps.corpus.hero.body')}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11.5px]">
                <ComparisonChip
                    icon={<Quote className="h-3.5 w-3.5" />}
                    label={t('paperSetup.subSteps.corpus.hero.bullet1Title')}
                    body={t('paperSetup.subSteps.corpus.hero.bullet1Body')}
                />
                <ComparisonChip
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                    label={t('paperSetup.subSteps.corpus.hero.bullet2Title')}
                    body={t('paperSetup.subSteps.corpus.hero.bullet2Body')}
                />
                <ComparisonChip
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                    label={t('paperSetup.subSteps.corpus.hero.bullet3Title')}
                    body={t('paperSetup.subSteps.corpus.hero.bullet3Body')}
                />
            </div>

            <div className="flex items-center gap-3 pt-1">
                <Button
                    type="button"
                    onClick={onExtract}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                >
                    <Sparkles className="h-4 w-4" />
                    {t('paperSetup.subSteps.corpus.hero.primaryCta')}
                </Button>
            </div>
        </div>
    );
}

function ComparisonChip({
    icon,
    label,
    body,
}: {
    icon: React.ReactNode;
    label: string;
    body: string;
}) {
    return (
        <div className="rounded-md border border-success/20 bg-card/80 px-2.5 py-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success">
                {icon}
                {label}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                {body}
            </p>
        </div>
    );
}

function SourceRow({ paper, source }: { paper: ExegeticalPaper; source: ProjectSource }) {
    const navigate = useNavigate();
    const { t } = useTranslation('exegesis');
    const { updateSource, removeSource } = useExegesisPapers();
    const extractExcerpts = useExtractExcerpts();
    const library = useLibrary();
    const isCitable = CITABLE_SOURCE_TYPES.has(source.sourceType);
    const isExtracted = source.mode === 'extracted-excerpts';
    const isStale = isExcerptSetStale(source, {
        passageRef: formatPassageReference(paper.passage, paper.displayLanguage),
        assignmentBrief: paper.assignmentBrief,
    });
    const canReExtract = isExtracted && !!source.sourceLibraryResourceId;
    // The library_resource backref lets us link to the original PDF
    // for "verify the citation against the source" workflows. Only
    // populated when the source came from the library-extraction flow
    // (Caso 1/2). Direct uploads (Caso 3) never have it.
    const libraryResource = source.sourceLibraryResourceId
        ? library.resources.find(r => r.id === source.sourceLibraryResourceId)
        : null;
    const originalUrl = libraryResource?.storageUrl ?? null;
    // Excerpts panel is collapsed by default — sources can have up to
    // 30 chunks each and unfolding them all by default would dwarf
    // everything else on the page. The user expands when they want
    // to review/edit.
    const [excerptsExpanded, setExcerptsExpanded] = useState(false);

    const rowRole = resolveSourceRole(source);
    const rowSuggestedRoleLabel = rowRole.suggested
        ? t(`paperSetup.subSteps.corpus.roles.${rowRole.suggested}`)
        : t('paperSetup.subSteps.corpus.roles.none');

    const handleTypeChange = async (next: SourceType) => {
        try {
            await updateSource.mutateAsync({
                paperId: paper.id,
                sourceId: source.id,
                sourceType: next,
            });
            toast.success(t('paperSetup.subSteps.corpus.toast.typeUpdated'));
        } catch (err) {
            console.error('[exegesis] update source type failed:', err);
            toast.error(t('paperSetup.subSteps.corpus.toast.typeUpdateFailed'));
        }
    };

    /**
     * Mueve la fuente de rol dialéctico sin tocar su tipo académico. El
     * tipo sigue midiendo la rúbrica; el rol dice qué trabajo hace en el
     * argumento, y esa decisión es del pastor. Cadena vacía = volver a lo
     * que sugiera el tipo.
     */
    const handleRoleChange = async (next: SourceRole | null) => {
        try {
            await updateSource.mutateAsync({
                paperId: paper.id,
                sourceId: source.id,
                chosenRole: next,
            });
            toast.success(t('paperSetup.subSteps.corpus.toast.roleUpdated'));
        } catch (err) {
            console.error('[exegesis] update source role failed:', err);
            toast.error(t('paperSetup.subSteps.corpus.toast.roleUpdateFailed'));
        }
    };

    const handleRemove = async () => {
        try {
            await removeSource.mutateAsync({ paperId: paper.id, sourceId: source.id });
            toast.success(t('paperSetup.subSteps.corpus.toast.removed'));
        } catch (err) {
            console.error('[exegesis] remove source failed:', err);
            toast.error(t('paperSetup.subSteps.corpus.toast.removeFailed'));
        }
    };

    const handleReExtract = async () => {
        if (!source.sourceLibraryResourceId) return;
        try {
            await extractExcerpts.mutateAsync({
                paperId: paper.id,
                selections: [{
                    libraryResourceId: source.sourceLibraryResourceId,
                    sourceType: source.sourceType,
                    displayLabel: source.displayLabel,
                    citationKey: source.citationKey ?? undefined,
                }],
            });
            toast.success(t('paperSetup.subSteps.corpus.staleBanner.toastSuccess'));
        } catch (err) {
            console.error('[exegesis] re-extract source failed:', err);
            toast.error(t('paperSetup.subSteps.corpus.staleBanner.toastError'));
        }
    };

    return (
        <li className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-start gap-2.5">
                {isExtracted
                    ? <Quote className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    : <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate inline-flex items-center gap-1.5">
                        {source.displayLabel}
                        {isExtracted && (
                            <span className="text-[10px] font-medium rounded-full bg-success-subtle text-success-subtle-foreground border border-success/30 px-1.5 py-0 leading-tight">
                                {t('paperSetup.subSteps.corpus.list.excerptsBadge', { count: source.excerpts.length })}
                            </span>
                        )}
                        {isExtracted && <SourceSelectionModeBadge mode={source.excerptSelectionMode} />}
                    </p>
                    {source.citationKey && (
                        <p className="text-[11px] text-muted-foreground">
                            {t('paperSetup.subSteps.corpus.upload.citationKeyLabel')}: {source.citationKey}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => navigate(`/dashboard/exegesis/${paper.id}/fuentes/${source.id}/paginas`)}
                    className="shrink-0 rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {t('paperSetup.subSteps.corpus.picker.adjustPages')}
                </button>
                {originalUrl && (
                    <a
                        href={originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-colors inline-flex items-center"
                        aria-label={t('paperSetup.subSteps.corpus.list.viewOriginal')}
                        title={t('paperSetup.subSteps.corpus.list.viewOriginal')}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                )}
                <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removeSource.isPending}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors disabled:opacity-50"
                    aria-label={t('paperSetup.subSteps.corpus.list.remove')}
                    title={t('paperSetup.subSteps.corpus.list.remove')}
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {isCitable && libraryResource && !hasResolvedNumbering(libraryResource.pageNumbering) && (
                <SinPaginaComprobable resourceId={libraryResource.id} />
            )}

            {isStale && canReExtract && (
                <StaleBanner
                    onReExtract={handleReExtract}
                    isReExtracting={extractExcerpts.isPending}
                    userEditedCount={source.excerpts.filter(e => e.userEdited).length}
                />
            )}

            <SourceTypePicker
                value={source.sourceType}
                onChange={handleTypeChange}
                disabled={updateSource.isPending}
                className="w-full text-xs"
            />

            {/* Mover de rol sin cambiar el tipo. Las dos preguntas viven
                juntas porque se responden juntas, pero son distintas. */}
            {isCitable && (
                <div className="space-y-1">
                    <select
                        value={source.chosenRole ?? ''}
                        onChange={(e) => handleRoleChange((e.target.value || null) as SourceRole | null)}
                        disabled={updateSource.isPending}
                        aria-label={t('paperSetup.subSteps.corpus.upload.roleLabel')}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                        <option value="">
                            {t('paperSetup.subSteps.corpus.upload.roleFollowType', {
                                role: rowSuggestedRoleLabel,
                            })}
                        </option>
                        <option value="anchor">{t('paperSetup.subSteps.corpus.roles.anchor')}</option>
                        <option value="contrast">{t('paperSetup.subSteps.corpus.roles.contrast')}</option>
                        <option value="technical">{t('paperSetup.subSteps.corpus.roles.technical')}</option>
                    </select>
                    {rowRole.divergent && (
                        <RoleDivergenceNote
                            suggested={rowSuggestedRoleLabel}
                            chosen={t(`paperSetup.subSteps.corpus.roles.${rowRole.role}`)}
                            t={t}
                        />
                    )}
                </div>
            )}
            {!isCitable && (
                <p className="text-[10px] text-warning-subtle-foreground inline-flex items-center gap-1">
                    <BookOpenText className="h-3 w-3" />
                    {t('paperSetup.subSteps.corpus.upload.modelPaperHint')}
                </p>
            )}

            {/* v1.5: when this source is in extracted-excerpts mode,
                expose a collapsible review panel with the curated
                chunks. Defaults collapsed because each source can
                carry up to 30 excerpts — opening them all by default
                would dwarf everything else on the setup page. */}
            {isExtracted && (
                <div>
                    <button
                        type="button"
                        onClick={() => setExcerptsExpanded(v => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {excerptsExpanded
                            ? <ChevronDown className="h-3 w-3" />
                            : <ChevronRight className="h-3 w-3" />
                        }
                        {excerptsExpanded
                            ? t('paperSetup.subSteps.corpus.excerpts.collapse')
                            : t('paperSetup.subSteps.corpus.excerpts.expand')
                        }
                    </button>
                    {excerptsExpanded && (
                        <ExcerptsReviewPanel
                            paperId={paper.id}
                            source={source}
                        />
                    )}
                </div>
            )}
        </li>
    );
}

/**
 * Un libro del corpus cuya numeración no resuelve ninguna página impresa.
 *
 * Se dice ACÁ y no en la biblioteca porque acá es donde el libro se va a
 * citar. El aviso de la biblioteca calla a propósito cuando la numeración
 * está confirmada —«este libro no lleva folios» es una respuesta válida para
 * un álbum de láminas, y volver a preguntarla enseñaría a ignorar el aviso—.
 * Pero un comentario de 700 hojas guardado así no es un álbum de láminas: es
 * una calibración que salió mal, y la consecuencia sólo aparece al final, en
 * la cita.
 *
 * Qué pasa si no se resuelve: los fragmentos de este libro llegan al modelo
 * sin ninguna página, de modo que el número que la cita termine llevando no
 * salió de ningún rótulo del sistema. Medido en un trabajo real: el modelo
 * tomó por página una referencia cruzada impresa dentro del texto, y la cita
 * apuntó a una página que habla de otra cosa. El verificador ahora lo marca
 * en ámbar y bloquea la aceptación, que es tarde: este aviso es el momento
 * temprano.
 */
function SinPaginaComprobable({ resourceId }: { resourceId: string }) {
    const { t } = useTranslation('exegesis');
    const navigate = useNavigate();
    return (
        <div className="rounded-md border border-warning/30 bg-warning-subtle/40 px-2.5 py-2 flex items-start gap-2">
            <Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-medium text-warning-subtle-foreground">
                    {t('paperSetup.subSteps.corpus.sinPaginaComprobable.title')}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-warning-subtle-foreground/90">
                    {t('paperSetup.subSteps.corpus.sinPaginaComprobable.body')}
                </p>
            </div>
            <button
                type="button"
                onClick={() => navigate(`/dashboard/library/${resourceId}/numeracion`)}
                className="shrink-0 rounded border border-warning/40 px-2 py-1 text-[11px] font-medium text-warning-subtle-foreground hover:bg-warning-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {t('paperSetup.subSteps.corpus.sinPaginaComprobable.action')}
            </button>
        </div>
    );
}

function StaleBanner({
    onReExtract,
    isReExtracting,
    userEditedCount,
}: {
    onReExtract: () => void;
    isReExtracting: boolean;
    userEditedCount: number;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <div className="rounded-md border border-warning/40 bg-warning-subtle/60 px-2.5 py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning-subtle-foreground mt-0.5 shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold text-warning-subtle-foreground leading-tight">
                    {t('paperSetup.subSteps.corpus.staleBanner.title')}
                </p>
                <p className="text-[11px] text-warning-subtle-foreground/80 leading-snug mt-0.5">
                    {t('paperSetup.subSteps.corpus.staleBanner.body')}
                </p>
                {userEditedCount > 0 && (
                    <p className="text-[10.5px] text-warning-subtle-foreground/80 leading-snug mt-1 italic">
                        {t('paperSetup.subSteps.corpus.staleBanner.preservesEdits', { count: userEditedCount })}
                    </p>
                )}
            </div>
            <Button
                type="button"
                size="sm"
                onClick={onReExtract}
                disabled={isReExtracting}
                className="text-[11px] h-7 gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            >
                {isReExtracting
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCcw className="h-3 w-3" />}
                {t('paperSetup.subSteps.corpus.staleBanner.cta')}
            </Button>
        </div>
    );
}

// ── Excerpts review panel (v1.5) ─────────────────────────────────────────

/**
 * Inline editor for the curated excerpts of an `'extracted-excerpts'`
 * source. Shows each excerpt as a textarea with its source anchor,
 * lets the user edit text or delete entirely, and commits all
 * changes in one batch via `updateSource`.
 *
 * Local state holds the editing draft so unsaved keystrokes don't
 * fire mutation calls per character. "Save changes" commits; "Discard"
 * resets to the persisted state. The button row stays sticky-feeling
 * (within the row's flow) — for v1.5 we don't trap the user; if they
 * navigate away with unsaved changes, the local state is lost. The
 * roadmap's "stale banner" feature lands later; this commit ships
 * the editor only.
 */
function ExcerptsReviewPanel({
    paperId,
    source,
}: {
    paperId: string;
    source: ProjectSource;
}) {
    const { t } = useTranslation('exegesis');
    const { updateSource } = useExegesisPapers();
    // Local working copy. Re-syncs whenever the persisted source
    // identity changes (re-extraction lands new excerpts, another
    // tab edits, etc.) — drops in-flight unsaved edits, acceptable
    // tradeoff for the simple v1.5 editor.
    const [drafts, setDrafts] = useState(() => source.excerpts.map(e => ({ ...e })));
    useEffect(() => {
        setDrafts(source.excerpts.map(e => ({ ...e })));
    }, [source.excerpts]);

    const dirty = useMemo(() => {
        if (drafts.length !== source.excerpts.length) return true;
        return drafts.some((draft, idx) => {
            const original = source.excerpts[idx];
            if (!original) return true;
            return draft.text !== original.text;
        });
    }, [drafts, source.excerpts]);

    const updateText = (idx: number, text: string) => {
        setDrafts(prev => prev.map((d, i) => i === idx
            ? { ...d, text, userEdited: true, editedAt: new Date() }
            : d));
    };

    const removeAt = (idx: number) => {
        setDrafts(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        try {
            await updateSource.mutateAsync({
                paperId,
                sourceId: source.id,
                excerpts: drafts,
            });
            toast.success(t('paperSetup.subSteps.corpus.excerpts.toast.saved'));
        } catch (err) {
            console.error('[exegesis] save excerpts failed:', err);
            toast.error(t('paperSetup.subSteps.corpus.excerpts.toast.saveFailed'));
        }
    };

    const handleDiscard = () => {
        setDrafts(source.excerpts.map(e => ({ ...e })));
    };

    if (drafts.length === 0) {
        return (
            <div className="mt-2 rounded-lg border border-warning/30 bg-warning-subtle/40 px-3 py-2 text-[11px] text-warning-subtle-foreground">
                {t('paperSetup.subSteps.corpus.excerpts.emptyWarning')}
            </div>
        );
    }

    return (
        <div className="mt-2 space-y-2">
            <ul className="space-y-1.5">
                {drafts.map((excerpt, idx) => (
                    <li
                        key={idx}
                        className="rounded-md border border-border bg-muted/30 px-2.5 py-2 space-y-1"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-medium text-muted-foreground inline-flex items-center gap-1.5">
                                <span>{excerpt.sourceLocation || t('paperSetup.subSteps.corpus.excerpts.noAnchor', { index: idx + 1 })}</span>
                                {excerpt.userEdited && (
                                    <span className="text-[9px] uppercase tracking-wide font-semibold rounded bg-info-subtle text-info-subtle-foreground border border-info/30 px-1 py-0">
                                        {t('paperSetup.subSteps.corpus.excerpts.editedBadge')}
                                    </span>
                                )}
                            </p>
                            <button
                                type="button"
                                onClick={() => removeAt(idx)}
                                className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                                aria-label={t('paperSetup.subSteps.corpus.excerpts.delete')}
                                title={t('paperSetup.subSteps.corpus.excerpts.delete')}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                        <textarea
                            value={excerpt.text}
                            onChange={(e) => updateText(idx, e.target.value)}
                            rows={3}
                            className="w-full rounded border border-border bg-card px-2 py-1 text-[11px] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                        />
                    </li>
                ))}
            </ul>
            {dirty && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleDiscard}
                        disabled={updateSource.isPending}
                        className="text-[11px] h-7"
                    >
                        {t('paperSetup.subSteps.corpus.excerpts.discard')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={updateSource.isPending}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] h-7"
                    >
                        {updateSource.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        {t('paperSetup.subSteps.corpus.excerpts.save')}
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Upload form ────────────────────────────────────────────────────────

function AddSourceDialog({
    paper,
    open,
    onOpenChange,
    initialType,
    initialPickedResourceId = null,
}: {
    paper: ExegeticalPaper;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * El tipo que pide un requisito de la rúbrica, usado SÓLO para filtrar la
     * biblioteca y preseleccionar el desplegable. No decide nada: el
     * clasificador lo corrige en cuanto se elige un libro.
     */
    initialType: SourceType | null;
    /**
     * Recurso que el diálogo abre ya marcado. Lo usa la bibliografía del
     * curso: la obra ya se emparejó con un libro de la biblioteca, así que
     * pedirle al usuario que lo busque otra vez es hacerle repetir trabajo
     * que el sistema ya hizo.
     */
    initialPickedResourceId?: string | null;
}) {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const { addSource, classifySourceType } = useExegesisPapers();
    const attachLibrarySource = useAttachLibrarySource();
    // Suggestion from the classifier when the user single-picks a
    // library resource. Surfaces as a chip near the SourceType
    // dropdown — informational, not blocking. Reset every dialog open.
    const [classification, setClassification] = useState<{
        type: SourceType;
        confidence: 'high' | 'medium' | 'low';
        reasoning: string;
        sourceTitle: string;
    } | null>(null);

    // Two ways to add a source: upload a fresh file OR pick one
    // already in the user's library (e.g. they uploaded BDAG for a
    // previous paper and want to reuse it here).
    const [mode, setMode] = useState<'upload' | 'library'>('upload');

    const [file, setFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [sourceType, setSourceType] = useState<SourceType>('commentary-critical');
    // El rol que el pastor eligió, independiente del tipo. `null` = no se
    // pronunció y manda la sugerencia del tipo. Antes esto no existía: el
    // botón «Elegir el ancla» sólo pre-filtraba y la fuente terminaba donde
    // mandara su tipo, contradiciendo al pastor sin decírselo.
    const [chosenRole, setChosenRole] = useState<SourceRole | null>(null);
    const [citationKey, setCitationKey] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    // Library mode: multi-select. The Set holds the picked library
    // resource ids; an empty set means "nothing selected", a 1-set
    // means "single resource picked" (we still let the user customize
    // label + cite for that one), and a ≥2 set means "bulk attach"
    // (per-resource label + cite get auto-derived at submit).
    const [pickedResourceIds, setPickedResourceIds] = useState<Set<string>>(new Set());
    const [librarySearch, setLibrarySearch] = useState('');
    const [libraryTypeFilter, setLibraryTypeFilter] = useState<ResourceType | 'all'>('all');
    // Testament filter: when the paper has a clear NT or OT passage,
    // hide library resources that demonstrably belong to the other
    // testament (HALOT on a NT paper, BDAG on an OT paper). The
    // chip-toggle below lets the user disable this if they want a
    // resource the inferer might have classified incorrectly.
    const [testamentFilterEnabled, setTestamentFilterEnabled] = useState(true);

    const paperTestament: Testament | null = useMemo(() => {
        return getBookById(paper.passage.bookId)?.testament ?? null;
    }, [paper.passage.bookId]);

    // Reads from the globally synced library cache (`useLibrarySync`
    // mounted at the dashboard shell). First open is instant for any
    // user who's already loaded the dashboard — no per-modal fetch.
    const library = useLibrary();

    // Reset / pre-select on every open. The dialog is one-shot per
    // open: closing always discards the form so reopening starts
    // fresh. When the parent passes a type via the gap card click,
    // we honor it as the initial selection.
    // Cuántos recursos hay, en una referencia y no en las dependencias del
    // efecto. Puesto como dependencia, CUALQUIER cambio de la biblioteca con el
    // diálogo abierto vuelve a correr el reseteo y borra lo que el pastor lleva
    // hecho — y la propia subida agrega un recurso, así que el formulario se
    // limpiaba solo justo mientras se usaba.
    const cuantosRecursos = useRef(0);
    cuantosRecursos.current = library.resources.length;

    useEffect(() => {
        if (open) {
            // Quien ya tiene biblioteca casi siempre viene a buscar en ella;
            // subir un archivo nuevo es el caso raro. Antes el modo biblioteca
            // sólo se alcanzaba entrando por un botón de rol, así que la
            // puerta genérica caía en «subir archivo» y parecía otra cosa.
            const tieneBiblioteca = cuantosRecursos.current > 0;
            // El requisito de la rúbrica filtra la biblioteca cuando su tipo
            // corresponde a una sola categoría; si corresponde a varias, no
            // filtra: esconder el libro que se busca es peor que no filtrar.
            const seedFilter = initialType ? filtroDeBibliotecaPara(initialType) : 'all';
            setMode(initialPickedResourceId || tieneBiblioteca ? 'library' : 'upload');
            setFile(null);
            setDisplayName('');
            setSourceType(initialType ?? 'commentary-critical');
            // El rol arranca sin elegir: manda la sugerencia del tipo hasta
            // que el pastor diga otra cosa, ya con el libro a la vista.
            setChosenRole(null);
            setCitationKey('');
            setClassification(null);
            setPickedResourceIds(initialPickedResourceId ? new Set([initialPickedResourceId]) : new Set());
            setLibrarySearch('');
            setLibraryTypeFilter(seedFilter);
        }
    }, [open, initialType]);

    // Lo que el tipo sugeriría por su cuenta, y si la elección del pastor
    // lo contradice. La divergencia NO bloquea: dispara un aviso que deja
    // la decisión a la vista en vez de resolverla en silencio.
    const suggestedRole = useMemo(() => suggestRoleForType(sourceType), [sourceType]);
    const suggestedRoleLabel = suggestedRole
        ? t(`paperSetup.subSteps.corpus.roles.${suggestedRole}`)
        : t('paperSetup.subSteps.corpus.roles.none');
    const roleDivergent = Boolean(chosenRole && suggestedRole && chosenRole !== suggestedRole);


    const attachedCorpusIds = useMemo(
        () => new Set(paper.sources.map(s => s.corpusId)),
        [paper.sources],
    );

    // Resources visible to the type filter (after the attached-already
    // gate AND optional testament narrowing). Drives the filtered list
    // and the per-type count chips — counts reflect what the user can
    // actually pick, not the raw library size.
    const availableForPicker = useMemo(
        () => library.resources
            .filter(r => !attachedCorpusIds.has(r.id))
            .filter(r => !testamentFilterEnabled || !paperTestament
                ? true
                : resourceMatchesTestament(r, paperTestament)),
        [library.resources, attachedCorpusIds, testamentFilterEnabled, paperTestament],
    );

    // Count of resources EXCLUDED purely by the testament filter — drives
    // the toggle chip's secondary label so the user knows what they're
    // hiding.
    const excludedByTestament = useMemo(() => {
        if (!paperTestament) return 0;
        return library.resources
            .filter(r => !attachedCorpusIds.has(r.id))
            .filter(r => !resourceMatchesTestament(r, paperTestament))
            .length;
    }, [library.resources, attachedCorpusIds, paperTestament]);

    const filteredResources = useMemo(() => {
        // Se busca por palabras sueltas sobre título + autor: "burt jonas"
        // encuentra "Comentario Jonás" de David F. Burt aunque el orden no
        // coincida y falten los acentos. Antes era un único `includes` sensible
        // a mayúsculas y acentos, así que "jonas" no encontraba "Jonás".
        const terms = normalizeForSearch(librarySearch).split(/\s+/).filter(Boolean);
        return availableForPicker
            .filter(r => libraryTypeFilter === 'all' || r.type === libraryTypeFilter)
            .filter(r => {
                if (terms.length === 0) return true;
                const haystack = normalizeForSearch(`${r.title ?? ''} ${r.author ?? ''}`);
                return terms.every(term => haystack.includes(term));
            });
    }, [availableForPicker, libraryTypeFilter, librarySearch]);

    // Per-type counts for the chip row. Only types with ≥1 resource
    // get a chip — empty chips are noise.
    const typeCounts = useMemo(() => {
        const counts = new Map<ResourceType, number>();
        for (const r of availableForPicker) {
            counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
        }
        return counts;
    }, [availableForPicker]);

    const pickedCount = pickedResourceIds.size;
    const isBulkLibrary = mode === 'library' && pickedCount >= 2;
    // Single-pick label is the user-editable one; bulk skips it.
    const labelOk = displayName.trim().length >= 3;
    const canSubmit = mode === 'upload'
        ? !!file && labelOk && !!user?.uid && !uploading
        : isBulkLibrary
            ? pickedCount >= 2 && !!user?.uid && !uploading
            : pickedCount === 1 && labelOk && !!user?.uid && !uploading;

    const handleFile = (f: File | null) => {
        setFile(f);
        if (f && !displayName) {
            setDisplayName(f.name.replace(/\.[^/.]+$/, ''));
        }
    };

    const handlePickResource = (resource: LibraryResource) => {
        setPickedResourceIds(prev => {
            const next = new Set(prev);
            if (next.has(resource.id)) {
                next.delete(resource.id);
            } else {
                next.add(resource.id);
            }
            return next;
        });
        // When the user lands on a single selection, pre-fill the
        // editable label + cite from THAT resource so the form acts
        // like the original single-pick UX. Toggling away from single
        // (back to zero, or up to 2+) clears them so we don't leak
        // stale data into a subsequent submit.
        const willBeSingle = !pickedResourceIds.has(resource.id) && pickedResourceIds.size === 0;
        if (willBeSingle) {
            setDisplayName(resource.title || resource.id);
            if (resource.author) {
                const key = deriveCitationKeyFromAuthor(resource.author);
                if (key) setCitationKey(key);
            }
            // Auto-classify in the background. Best-effort: failures
            // (no extracted text yet, Gemini overload) leave the
            // dropdown at its current selection, no toast — the user
            // still sees the manual control. Resource without text
            // (textContent is null on legacy entries) short-circuits
            // before the LLM call.
            void runClassification(resource);
        } else {
            // Multi-select or deselect → clear the per-row fields so
            // the bulk path can autoderive cleanly. Also reset the
            // sourceType back to the role-driven `initialType` (or
            // `'commentary-critical'` when no role is set), otherwise
            // a stale auto-classification from the previous single-
            // pick leaks into the bulk submit and every selected
            // resource lands with the wrong type. Surfaced as a bug
            // when the user clicked "Agregar técnica" → single-picked
            // a Tuggy lexicon (auto-classified to `'other'`) →
            // additional picks → bulk save → all rows ended up under
            // "SIN ROL ASIGNADO" instead of the technical bucket.
            setDisplayName('');
            setCitationKey('');
            setClassification(null);
            setSourceType(initialType ?? 'commentary-critical');
        }
    };

    const runClassification = async (resource: LibraryResource) => {
        try {
            const fresh = await libraryService.getResource(resource.id);
            const text = fresh?.textContent;
            if (!text || text.trim().length < 50) return;
            const result = await classifySourceType.mutateAsync({
                rawText: text,
                title: resource.title || null,
                author: resource.author || null,
                language: paper.displayLanguage,
            });
            setSourceType(result.sourceType);
            setClassification({
                type: result.sourceType,
                confidence: result.confidence,
                reasoning: result.reasoning,
                sourceTitle: resource.title || resource.id,
            });
        } catch (err) {
            console.warn('[exegesis] source-type classification failed:', err);
            setClassification(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || !user?.uid) return;
        setUploading(true);
        setProgress(0);
        try {
            if (mode === 'upload') {
                if (!file) return;
                // Upload through the library pipeline. `type: 'other'`
                // is a pragmatic default; the real source-type signal
                // lives on the ProjectSource link, not on the
                // library_resource.
                const resource = await libraryService.uploadResource(
                    user.uid,
                    file,
                    {
                        title: displayName.trim(),
                        author: '',
                        type: 'other',
                    },
                    (p) => setProgress(p),
                );
                await addSource.mutateAsync({
                    paperId: paper.id,
                    corpusId: resource.id,
                    sourceType,
                    chosenRole,
                    displayLabel: displayName.trim(),
                    citationKey: citationKey.trim() || undefined,
                });
            } else if (isBulkLibrary) {
                // Bulk attach: loop the selections, autoderive
                // displayLabel and citationKey from each resource.
                // Sequential to avoid concurrent updates fighting on
                // the paper's `sources` array (the repo writes the
                // whole array per addSource).
                const picked = Array.from(pickedResourceIds)
                    .map(id => library.resources.find(r => r.id === id))
                    .filter((r): r is LibraryResource => !!r);
                for (const r of picked) {
                    const autoCite = r.author ? deriveCitationKeyFromAuthor(r.author) : '';
                    // Ya no se adjunta el libro entero: se calcula la sección
                    // que trata el pasaje y se adjunta esa. El selector queda a
                    // un click en "Ajustar páginas" para corregirla.
                    await attachLibrarySource.attach({
                        paperId: paper.id,
                        libraryResourceId: r.id,
                        sourceType,
                        chosenRole,
                        displayLabel: r.title || r.id,
                        citationKey: autoCite || undefined,
                        passage: paper.passage,
                        assignmentBrief: paper.assignmentBrief,
                        language: paper.displayLanguage,
                    });
                }
            } else {
                // Single library pick — keep the editable label/cite
                // path so the user can override what was pre-filled.
                const onlyId = pickedResourceIds.values().next().value;
                if (!onlyId) return;
                const outcome = await attachLibrarySource.attach({
                    paperId: paper.id,
                    libraryResourceId: onlyId,
                    sourceType,
                    chosenRole,
                    displayLabel: displayName.trim(),
                    citationKey: citationKey.trim() || undefined,
                    passage: paper.passage,
                    assignmentBrief: paper.assignmentBrief,
                    language: paper.displayLanguage,
                });
                // Se le dice al usuario QUÉ se llevó y con cuánta confianza: una
                // sección exacta y una coincidencia aproximada piden acciones
                // distintas de su parte.
                if (outcome.kind === 'structural') {
                    toast.success(t('paperSetup.subSteps.corpus.picker.toast.attachedStructural', { count: outcome.sheetCount }));
                } else if (outcome.kind === 'semantic') {
                    toast.warning(t('paperSetup.subSteps.corpus.picker.toast.attachedSemantic', { count: outcome.sheetCount }));
                } else {
                    toast.warning(t('paperSetup.subSteps.corpus.picker.toast.attachedWhole'));
                }
            }
            const successKey = isBulkLibrary
                ? 'paperSetup.subSteps.corpus.toast.bulkAdded'
                : 'paperSetup.subSteps.corpus.toast.added';
            toast.success(t(successKey, { count: pickedCount || 1 }));
            // Close the dialog on success. The open-effect resets
            // the form on the next open, so we don't need to clear
            // state here.
            onOpenChange(false);
        } catch (err) {
            console.error('[exegesis] add source failed:', err);
            toast.error(t('paperSetup.subSteps.corpus.toast.addFailed'));
        } finally {
            setUploading(false);
            setProgress(null);
        }
    };

    const isCitable = CITABLE_SOURCE_TYPES.has(sourceType);

    const availableInLibrary = library.resources.length - attachedCorpusIds.size;

    return (
        <Dialog open={open} onOpenChange={(next) => {
            // Block closing while the upload is in flight so the
            // student can't accidentally cancel a half-finished
            // upload.
            if (uploading && !next) return;
            onOpenChange(next);
        }}>
            <DialogContent className="sm:max-w-5xl p-0 gap-0 overflow-hidden h-[min(88vh,720px)] flex flex-col">
                <DialogHeader className="px-6 py-4 border-b border-border">
                    <DialogTitle className="text-base">
                        {t('paperSetup.subSteps.corpus.upload.title')}
                    </DialogTitle>
                    <DialogDescription className="text-[12px] leading-snug">
                        {t('paperSetup.subSteps.corpus.upload.dialogSubtitle')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    {/* El modo va en pestañas y no en una columna: eran dos
                        botones ocupando 220 px de ancho completo, con el resto
                        de la columna vacío. Ese ancho le sirve más a la lista. */}
                    <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/20 px-6 py-2">
                        <ModeTab
                            active={mode === 'upload'}
                            onClick={() => setMode('upload')}
                            icon={<Upload className="h-3.5 w-3.5" />}
                            label={t('paperSetup.subSteps.corpus.upload.modeUpload')}
                        />
                        <ModeTab
                            active={mode === 'library'}
                            onClick={() => setMode('library')}
                            icon={<Library className="h-3.5 w-3.5" />}
                            label={t('paperSetup.subSteps.corpus.upload.modeLibrary')}
                            badge={availableInLibrary > 0 ? String(availableInLibrary) : undefined}
                        />
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {/* Main pane */}
                        {/* Maestro-detalle: la lista se lleva el alto disponible y los
                            campos viven al lado, siempre visibles. Un asistente de dos
                            pasos habría cobrado un click extra justo en el caso común,
                            donde los valores derivados ya sirven. */}
                        <div className={cn(
                            'min-h-0 flex-1 gap-5 px-6 py-5',
                            mode === 'upload'
                                ? 'flex flex-col overflow-y-auto'
                                : 'grid grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]',
                        )}>
                            {mode === 'upload' ? (
                                <FileDropzone
                                    accept=".pdf,.epub"
                                    value={file}
                                    onChange={handleFile}
                                    disabled={uploading}
                                    hint="PDF o EPUB · hasta 250 MB"
                                    emptyLabel={t('common:fileDropzone.empty')}
                                    clearLabel={t('common:fileDropzone.clear')}
                                />
                            ) : (
                                <LibraryPicker
                                    isLoading={library.isLoading}
                                    resources={filteredResources}
                                    pickedResourceIds={pickedResourceIds}
                                    onPick={handlePickResource}
                                    searchTerm={librarySearch}
                                    onSearchChange={setLibrarySearch}
                                    totalAttached={attachedCorpusIds.size}
                                    totalAvailable={library.resources.length}
                                    typeFilter={libraryTypeFilter}
                                    onTypeFilterChange={setLibraryTypeFilter}
                                    typeCounts={typeCounts}
                                    paperTestament={paperTestament}
                                    testamentFilterEnabled={testamentFilterEnabled}
                                    onToggleTestamentFilter={() => setTestamentFilterEnabled(v => !v)}
                                    excludedByTestament={excludedByTestament}
                                />
                            )}

                            {/* Columna de detalles. Scrollea sola: si el usuario abre
                                el selector de tipo académico, la lista no se mueve. */}
                            <div className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto lg:border-l lg:border-border lg:pl-5">

                            {/* In bulk-library mode the per-source label
                                and citation key are auto-derived at submit
                                from each resource's title + author. The
                                form collapses to a single shared "type"
                                picker plus an explicit autoderivation
                                hint so the user knows what's happening. */}
                            {!isBulkLibrary && (
                                <FieldGroup>
                                    <FieldLabel htmlFor="addsource-label">
                                        {t('paperSetup.subSteps.corpus.upload.displayNameLabel')}
                                    </FieldLabel>
                                    <input
                                        id="addsource-label"
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        disabled={uploading}
                                        placeholder={t('paperSetup.subSteps.corpus.upload.displayNamePlaceholder')}
                                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                    />
                                </FieldGroup>
                            )}

                            <FieldGroup>
                                <FieldLabel htmlFor="addsource-type">
                                    {isBulkLibrary
                                        ? t('paperSetup.subSteps.corpus.upload.typeLabelBulk', { count: pickedCount })
                                        : t('paperSetup.subSteps.corpus.upload.typeLabel')}
                                </FieldLabel>
                                <SourceTypePicker
                                    id="addsource-type"
                                    value={sourceType}
                                    onChange={(next) => {
                                        setSourceType(next);
                                        // Manual override clears the
                                        // suggestion chip so it doesn't
                                        // misleadingly say "verified" when
                                        // the user just disagreed with it.
                                        setClassification(null);
                                    }}
                                    disabled={uploading}
                                    className="w-full !py-2 !text-sm"
                                />
                                {classifySourceType.isPending && (
                                    <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 mt-1">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        {t('paperSetup.subSteps.corpus.upload.classifying')}
                                    </p>
                                )}
                                {classification && classification.type === sourceType && (
                                    <ClassificationChip classification={classification} />
                                )}
                                <FieldHint>
                                    {isBulkLibrary
                                        ? t('paperSetup.subSteps.corpus.upload.typeDescriptionBulk')
                                        : t('paperSetup.subSteps.corpus.upload.typeDescription')}
                                </FieldHint>
                                {!isCitable && (
                                    <p className="text-[11px] text-warning-subtle-foreground inline-flex items-start gap-1.5 mt-0.5">
                                        <BookOpenText className="h-3 w-3 mt-0.5 shrink-0" />
                                        {t('paperSetup.subSteps.corpus.upload.modelPaperHint')}
                                    </p>
                                )}
                            </FieldGroup>

                            {/* El rol es una pregunta DISTINTA del tipo. El
                                tipo dice qué clase de obra es —y con eso se
                                mide la rúbrica—; el rol dice qué trabajo hace
                                en el argumento del pastor, y eso sólo lo sabe
                                él. McComiskey es «exegético Y expositivo»: no
                                hay mapa que decida por él. */}
                            {isCitable && (
                                <FieldGroup>
                                    <FieldLabel htmlFor="addsource-role">
                                        {t('paperSetup.subSteps.corpus.upload.roleLabel')}
                                    </FieldLabel>
                                    <select
                                        id="addsource-role"
                                        value={chosenRole ?? ''}
                                        onChange={(e) => setChosenRole((e.target.value || null) as SourceRole | null)}
                                        disabled={uploading}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="">
                                            {t('paperSetup.subSteps.corpus.upload.roleFollowType', {
                                                role: suggestedRoleLabel,
                                            })}
                                        </option>
                                        <option value="anchor">{t('paperSetup.subSteps.corpus.roles.anchor')}</option>
                                        <option value="contrast">{t('paperSetup.subSteps.corpus.roles.contrast')}</option>
                                        <option value="technical">{t('paperSetup.subSteps.corpus.roles.technical')}</option>
                                    </select>
                                    {roleDivergent && (
                                        <RoleDivergenceNote
                                            suggested={suggestedRoleLabel}
                                            chosen={t(`paperSetup.subSteps.corpus.roles.${chosenRole}`)}
                                            t={t}
                                        />
                                    )}
                                </FieldGroup>
                            )}

                            {isCitable && !isBulkLibrary && (
                                <FieldGroup>
                                    <FieldLabel htmlFor="addsource-cite">
                                        {t('paperSetup.subSteps.corpus.upload.citationKeyLabel')}
                                        <span className="text-muted-foreground font-normal ml-1">· opcional</span>
                                    </FieldLabel>
                                    <input
                                        id="addsource-cite"
                                        type="text"
                                        value={citationKey}
                                        onChange={(e) => setCitationKey(e.target.value)}
                                        disabled={uploading}
                                        placeholder={t('paperSetup.subSteps.corpus.upload.citationKeyPlaceholder')}
                                        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                                    />
                                    <FieldHint>
                                        {t('paperSetup.subSteps.corpus.upload.citationKeyHint')}
                                    </FieldHint>
                                </FieldGroup>
                            )}

                            {isBulkLibrary && isCitable && (
                                <FieldHint>
                                    {t('paperSetup.subSteps.corpus.upload.citationKeyAutoderiveHint')}
                                </FieldHint>
                            )}
                            </div>
                        </div>
                    </div>

                    {/* Sticky-feeling footer: separated by top border */}
                    <div className="border-t border-border px-6 py-3 flex items-center gap-3 bg-muted/20">
                        {uploading && progress !== null && mode === 'upload' && (
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t('paperSetup.subSteps.corpus.upload.uploading', { progress })}
                            </p>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={uploading}
                                className="text-sm"
                            >
                                {t('setup.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                disabled={!canSubmit}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm gap-1.5"
                            >
                                {uploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : mode === 'upload' ? (
                                    <Upload className="h-4 w-4" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                {mode === 'upload'
                                    ? t('paperSetup.subSteps.corpus.upload.submit')
                                    : isBulkLibrary
                                        ? t('paperSetup.subSteps.corpus.upload.submitBulkFromLibrary', { count: pickedCount })
                                        : t('paperSetup.subSteps.corpus.upload.submitFromLibrary')}
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Field primitives ───────────────────────────────────────────────────

function FieldGroup({ children }: { children: React.ReactNode }) {
    return <div className="space-y-1.5">{children}</div>;
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
    return (
        <label
            htmlFor={htmlFor}
            className="block text-[12.5px] font-medium text-foreground"
        >
            {children}
        </label>
    );
}

function FieldHint({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] text-muted-foreground leading-snug">
            {children}
        </p>
    );
}

// ── Sidebar mode tab (vertical card) ───────────────────────────────────

/**
 * Pestaña de modo del diálogo: subir un archivo nuevo, o reusar la biblioteca.
 *
 * Era una tarjeta a lo ancho de una columna de 220 px. Con dos opciones y una
 * línea de ayuda cada una, esa columna quedaba casi entera vacía y le robaba
 * ancho a la lista, que es lo que el usuario mira.
 */
function ModeTab({
    active,
    onClick,
    icon,
    label,
    badge,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    badge?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors',
                active
                    ? 'border-primary bg-primary/5 font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground',
            )}
        >
            <span className={active ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
            {label}
            {badge && (
                <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                    {badge}
                </span>
            )}
        </button>
    );
}

// ── Library picker ─────────────────────────────────────────────────────

function LibraryPicker({
    isLoading,
    resources,
    pickedResourceIds,
    onPick,
    searchTerm,
    onSearchChange,
    totalAttached,
    totalAvailable,
    typeFilter,
    onTypeFilterChange,
    typeCounts,
    paperTestament,
    testamentFilterEnabled,
    onToggleTestamentFilter,
    excludedByTestament,
}: {
    isLoading: boolean;
    resources: ReadonlyArray<LibraryResource>;
    pickedResourceIds: Set<string>;
    onPick: (resource: LibraryResource) => void;
    searchTerm: string;
    onSearchChange: (next: string) => void;
    totalAttached: number;
    totalAvailable: number;
    typeFilter: ResourceType | 'all';
    onTypeFilterChange: (next: ResourceType | 'all') => void;
    typeCounts: Map<ResourceType, number>;
    paperTestament: Testament | null;
    testamentFilterEnabled: boolean;
    onToggleTestamentFilter: () => void;
    excludedByTestament: number;
}) {
    const { t } = useTranslation('exegesis');

    // Stable order: most common exegesis-relevant types first, then
    // the long tail. Skip types with zero items — empty chips are noise.
    const orderedTypes: ResourceType[] = ([
        'commentary', 'exegetical-commentary', 'theological-dictionary',
        'bible-dictionary', 'theology', 'grammar', 'critical-text',
        'historical-context', 'biblical-survey', 'article', 'other',
    ] as ResourceType[]).filter(t => (typeCounts.get(t) ?? 0) > 0);
    const totalAvailableForFilter = Array.from(typeCounts.values()).reduce((s, n) => s + n, 0);

    return (
        // Columna propia: buscador y filtros arriba, lista abajo llevándose lo
        // que sobre. Antes la lista estaba capada a 320 px y dejaba aire muerto
        // dentro de un modal que llega al 92% de la ventana.
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('paperSetup.subSteps.corpus.upload.librarySearchPlaceholder')}
                    className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
            </div>

            {/* Testament filter pill — visible only when the paper has
                a clear testament AND there's something to hide. The
                pill toggles on/off; "off" reveals everything (escape
                hatch when the user knows the inferer mis-classified). */}
            {paperTestament && excludedByTestament > 0 && (
                <button
                    type="button"
                    onClick={onToggleTestamentFilter}
                    aria-pressed={testamentFilterEnabled}
                    className={[
                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-colors',
                        testamentFilterEnabled
                            ? 'border-success/40 bg-success-subtle/40 text-success-subtle-foreground hover:bg-success-subtle/60'
                            : 'border-border bg-card text-muted-foreground hover:bg-accent/40',
                    ].join(' ')}
                    title={testamentFilterEnabled
                        ? t('paperSetup.subSteps.corpus.libraryFilter.testamentTooltipOff', { count: excludedByTestament })
                        : t('paperSetup.subSteps.corpus.libraryFilter.testamentTooltipOn')}
                >
                    {testamentFilterEnabled ? <Check className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>
                        {testamentFilterEnabled
                            ? t(`paperSetup.subSteps.corpus.libraryFilter.testamentActive.${paperTestament}`, { count: excludedByTestament })
                            : t('paperSetup.subSteps.corpus.libraryFilter.testamentInactive')}
                    </span>
                </button>
            )}

            {/* Type filter chips — show only when there are ≥2 distinct
                types in the available pool (one type = no choice to
                make). Horizontal scroll on overflow so we don't wrap a
                wall of chips on narrow viewports. */}
            {orderedTypes.length >= 2 && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 pb-1 -mx-0.5 px-0.5">
                    <FilterChip
                        active={typeFilter === 'all'}
                        onClick={() => onTypeFilterChange('all')}
                        label={t('paperSetup.subSteps.corpus.libraryFilter.all')}
                        count={totalAvailableForFilter}
                    />
                    {orderedTypes.map(type => (
                        <FilterChip
                            key={type}
                            active={typeFilter === type}
                            onClick={() => onTypeFilterChange(type)}
                            label={t(`paperSetup.subSteps.corpus.libraryFilter.types.${type}`)}
                            count={typeCounts.get(type) ?? 0}
                        />
                    ))}
                </div>
            )}

            {isLoading ? (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2">
                        {t('paperSetup.subSteps.corpus.upload.libraryLoading')}
                    </p>
                </div>
            ) : resources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                        {totalAvailable === 0
                            ? t('paperSetup.subSteps.corpus.upload.libraryEmpty')
                            : totalAttached >= totalAvailable
                                ? t('paperSetup.subSteps.corpus.upload.libraryAllAttached')
                                : t('paperSetup.subSteps.corpus.upload.librarySearchEmpty')}
                    </p>
                </div>
            ) : (
                <ul className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border">
                    {resources.map(r => {
                        const status = libraryService.getResourceIndexStatus(r);
                        const picked = pickedResourceIds.has(r.id);
                        return (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(r)}
                                    aria-pressed={picked}
                                    className={[
                                        'w-full text-left px-3.5 py-2.5 flex items-start gap-3 transition-colors',
                                        picked
                                            ? 'bg-success-subtle/60'
                                            : 'hover:bg-accent/40',
                                    ].join(' ')}
                                >
                                    {/* Checkbox-style indicator so the
                                        multi-select intent is visible
                                        before any toggle. Clicking
                                        anywhere on the row toggles. */}
                                    <span
                                        aria-hidden
                                        className={[
                                            'h-4 w-4 mt-0.5 shrink-0 rounded border-2 flex items-center justify-center transition-colors',
                                            picked
                                                ? 'bg-primary border-primary text-primary-foreground'
                                                : 'border-border bg-card',
                                        ].join(' ')}
                                    >
                                        {picked && <CheckCircle2 className="h-3 w-3" />}
                                    </span>
                                    <FileText className={[
                                        'h-4 w-4 mt-0.5 shrink-0',
                                        picked ? 'text-success' : 'text-muted-foreground',
                                    ].join(' ')} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-foreground truncate">
                                            {r.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            {r.author && (
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    {r.author}
                                                </p>
                                            )}
                                            <ResourceReadinessBadge status={status} />
                                            {/* Qué vale el libro, en una
                                                palabra. Acá el pastor elige
                                                sin más señal que el título, y
                                                un comentario expositivo y uno
                                                crítico se llaman igual en el
                                                lomo. */}
                                            <PesoDeFuente peso={pesoDeRecurso(r)} />
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

/**
 * El peso académico de un libro, en una palabra.
 *
 * Texto y no color: el peso no es un semáforo —una fuente «de apoyo» no está
 * mal elegida, un trabajo las necesita— y pintarla de rojo empujaría a
 * descartarla.
 */
function PesoDeFuente({ peso }: { peso: PesoAcademico }) {
    const { t } = useTranslation('exegesis');
    return (
        <span
            className="text-[11px] text-muted-foreground shrink-0"
            title={`${t(`paperSetup.subSteps.corpus.extract.peso.hint_${peso}`)} ${t('paperSetup.subSteps.corpus.extract.dosEjes')}`}
        >
            {t(`paperSetup.subSteps.corpus.extract.peso.${peso}`)}
        </span>
    );
}

/**
 * Toggle pill for the resource-type filter strip. Uses the `aria-pressed`
 * pattern instead of native radios so the chip row can scroll
 * horizontally without being broken up by form-control semantics.
 */
function FilterChip({
    active,
    onClick,
    label,
    count,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={[
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition-colors shrink-0',
                active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground',
            ].join(' ')}
        >
            <span>{label}</span>
            <span className={[
                'tabular-nums text-[10.5px] rounded-full px-1.5 py-0',
                active ? 'bg-primary/20' : 'bg-muted text-muted-foreground/80',
            ].join(' ')}>
                {count}
            </span>
        </button>
    );
}

/**
 * Compact pill that surfaces whether a library resource is ready to be
 * queried for excerpts (commit 3 of v1.5). Today the badge is purely
 * informational — the user can still pick any resource for the
 * `'full-document'` flow regardless of indexing state. Once the
 * extraction step lands, the same `status` will gate the "extract
 * excerpts" toggle: only `'indexed'` resources allow excerpt mode.
 *
 * Statuses follow the lifecycle:
 *   needs-extraction → extracting → needs-indexing|indexing → indexed
 *                                                          ↘ failed
 */
function ResourceReadinessBadge({ status }: { status: ResourceIndexStatus }) {
    const { t } = useTranslation('exegesis');
    const config: Record<ResourceIndexStatus, { label: string; cls: string }> = {
        'indexed': {
            label: t('paperSetup.subSteps.corpus.readiness.indexed'),
            cls: 'bg-success-subtle text-success-subtle-foreground border-success/30',
        },
        'extracting': {
            label: t('paperSetup.subSteps.corpus.readiness.extracting'),
            cls: 'bg-info-subtle text-info-subtle-foreground border-info/30',
        },
        'indexing': {
            label: t('paperSetup.subSteps.corpus.readiness.indexing'),
            cls: 'bg-info-subtle text-info-subtle-foreground border-info/30',
        },
        'needs-extraction': {
            label: t('paperSetup.subSteps.corpus.readiness.needsExtraction'),
            cls: 'bg-muted text-muted-foreground border-border',
        },
        'needs-indexing': {
            label: t('paperSetup.subSteps.corpus.readiness.needsIndexing'),
            cls: 'bg-warning-subtle text-warning-subtle-foreground border-warning/30',
        },
        'failed': {
            label: t('paperSetup.subSteps.corpus.readiness.failed'),
            cls: 'bg-destructive/10 text-destructive border-destructive/30',
        },
    };
    const { label, cls } = config[status];
    return (
        <span
            className={[
                'inline-flex items-center text-[10px] font-medium rounded-full border px-1.5 py-0 leading-tight whitespace-nowrap shrink-0',
                cls,
            ].join(' ')}
            title={label}
        >
            {label}
        </span>
    );
}

/**
 * Extracts a citation key (typical surname) from a resource's author
 * field. Used to pre-fill the corpus dialog when the student picks an
 * existing library resource. Heuristic, not authoritative — the
 * student can always tweak the result before submitting.
 *
 * Cases handled:
 *   "Daniel B. Wallace"     → "Wallace"   (last token wins)
 *   "John MacArthur"        → "MacArthur"
 *   "Bauckham, Richard"     → "Bauckham"  (before-comma wins)
 *   "Lane, William L."      → "Lane"
 *   "Barrick & Busenitz"    → "Barrick"   (first author of multi)
 *   "Watson and Callan"     → "Watson"
 *   "deSilva"               → "deSilva"
 *   ""                      → ""          (caller skips)
 */
function deriveCitationKeyFromAuthor(author: string): string {
    const trimmed = author.trim();
    if (!trimmed) return '';
    // Multi-author work: take the first author (citations conventionally
    // use first author or "first et al.").
    const firstAuthor = trimmed.split(/\s+(?:&|and|y)\s+/i)[0]!.trim();
    // "Surname, Given" form is common in academic citations — take
    // what's before the comma.
    if (firstAuthor.includes(',')) {
        const beforeComma = firstAuthor.split(',')[0]!.trim();
        if (beforeComma) return beforeComma;
    }
    // Otherwise the LAST token is conventionally the surname.
    const tokens = firstAuthor.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return firstAuthor;
    return tokens[tokens.length - 1]!;
}

/**
 * Inline chip surfaced under the SourceType picker after the
 * classifier has run on a single-picked library resource. Fades into
 * the dropdown's helper area; clears as soon as the user manually
 * overrides the type.
 */
/**
 * Aviso de divergencia entre el rol que eligió el pastor y el que sugiere
 * el tipo de la obra.
 *
 * NO bloquea, y esa es la mitad importante. Elegir un comentario crítico
 * como ancla es una decisión legítima —McComiskey se llama «exegético Y
 * expositivo», así que ningún mapa puede decidir por él—; lo que no puede
 * pasar es que el sistema la revierta en silencio, que es lo que hacía
 * antes. El aviso deja la decisión a la vista y sigue de largo.
 */
function RoleDivergenceNote({
    suggested,
    chosen,
    t,
}: {
    suggested: string;
    chosen: string;
    t: (key: string, opts?: Record<string, unknown>) => string;
}) {
    return (
        <p className="text-[11px] leading-relaxed text-info inline-flex items-start gap-1.5 mt-1">
            <Sparkles className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />
            <span>{t('paperSetup.subSteps.corpus.upload.roleDivergence', { suggested, chosen })}</span>
        </p>
    );
}


function ClassificationChip({
    classification,
}: {
    classification: { type: SourceType; confidence: 'high' | 'medium' | 'low'; reasoning: string; sourceTitle: string };
}) {
    const { t } = useTranslation('exegesis');
    const tone = classification.confidence === 'high'
        ? 'border-success/40 bg-success-subtle text-success-subtle-foreground'
        : classification.confidence === 'medium'
            ? 'border-info/40 bg-info-subtle text-info-subtle-foreground'
            : 'border-warning/40 bg-warning-subtle text-warning-subtle-foreground';
    return (
        <div className={`mt-1 rounded-md border ${tone} px-2 py-1 text-[11px] inline-flex items-start gap-1.5`}>
            <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="leading-snug">
                <strong>{t('paperSetup.subSteps.corpus.upload.classifierSuggested')}</strong>
                {' · '}
                {t(`paperSetup.subSteps.corpus.upload.classifierConfidence.${classification.confidence}`)}
                {classification.reasoning && (
                    <span className="block opacity-80 italic mt-0.5">
                        {classification.reasoning}
                    </span>
                )}
            </span>
        </div>
    );
}

/**
 * Normaliza texto para buscar: minúsculas y sin acentos.
 *
 * `NFD` separa la letra de su tilde y el rango `\u0300-\u036f` borra las
 * tildes sueltas, así que "Jonás" y "jonas" quedan iguales. Tolera `null`
 * porque la biblioteca tiene recursos viejos sin autor.
 */
function normalizeForSearch(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
