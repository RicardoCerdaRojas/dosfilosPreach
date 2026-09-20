import { useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileCheck2, FileStack, ListTree, BookOpen, Loader2, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';
import { RubricSubStep } from '@/components/exegesis/setup/RubricSubStep';
import { StyleManifestSubStep } from '@/components/exegesis/setup/StyleManifestSubStep';
import { CorpusSubStep } from '@/components/exegesis/setup/CorpusSubStep';
import { StructuralPlanSubStep } from '@/components/exegesis/setup/StructuralPlanSubStep';
import { PaperBriefPanel } from '@/components/exegesis/setup/PaperBriefPanel';
import { PaperCoverPanel } from '@/components/exegesis/setup/PaperCoverPanel';
import { SaveWorkProfileCard } from '@/components/exegesis/setup/SaveWorkProfileCard';
import { CorpusUsagePlanSubStep } from '@/components/exegesis/corpus-plan/CorpusUsagePlanSubStep';
import { formatPassageReference, type SupportedLanguage } from '@dosfilos/domain';

/**
 * Rich academic-configuration page for an exegetical paper.
 *
 * Lives at `/dashboard/exegesis/{paperId}/setup`. Reached automatically
 * after `ExegesisCreatePage` saves a new paper, but also accessible
 * later from the paper detail page so the student can iterate on
 * configuration as the work progresses.
 *
 * Four sub-steps, each in its own sub-component:
 *   1. Rubric — upload the seminary's grading sheet OR use the system
 *      default; result is structured + editable. Sets the bar for
 *      what the corpus has to satisfy.
 *   2. Style guide manifest — visual verification of the structured
 *      rules extracted from the user's active style guide. Lets the
 *      student correct mis-extractions before they reach the
 *      orchestrator.
 *   3. Corpus — granular SourceType picker per upload + gap detection
 *      vs the rubric's minimums.
 *   4. Structural plan — per-step source-emphasis with academic
 *      justification, defaulted from the rubric's structural
 *      expectations.
 *
 * Sub-steps are independent; the student can jump between them. The
 * "Generate" CTA at the bottom of step 4 redirects to the paper
 * detail page where the wizard runs.
 */
type SubStepKey = 'rubric' | 'manifest' | 'corpus' | 'corpus-plan' | 'plan';

const SUB_STEPS: ReadonlyArray<{ key: SubStepKey; iconKey: string }> = [
    { key: 'rubric', iconKey: 'FileCheck2' },
    { key: 'manifest', iconKey: 'BookOpen' },
    { key: 'corpus', iconKey: 'FileStack' },
    { key: 'corpus-plan', iconKey: 'Sparkles' },
    { key: 'plan', iconKey: 'ListTree' },
];

const VALID_KEYS: ReadonlySet<SubStepKey> = new Set(SUB_STEPS.map(s => s.key));

function parseTab(raw: string | null): SubStepKey {
    return raw && VALID_KEYS.has(raw as SubStepKey) ? (raw as SubStepKey) : 'rubric';
}

export function ExegesisPaperSetupPage() {
    const { paperId } = useParams<{ paperId: string }>();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('exegesis');
    const activeLanguage: SupportedLanguage = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';
    const { paper, isLoading, error } = useExegesisPaper(paperId);

    // Tab state lives in the URL (`?tab=corpus`) so deep-links from
    // the paper detail page's "Editar en configuración" buttons land
    // on the right sub-step, and back/refresh preserve the tab.
    const [searchParams, setSearchParams] = useSearchParams();
    const activeKey = parseTab(searchParams.get('tab'));
    const setActiveKey = useCallback((next: SubStepKey) => {
        setSearchParams(prev => {
            const updated = new URLSearchParams(prev);
            if (next === 'rubric') updated.delete('tab');
            else updated.set('tab', next);
            return updated;
        }, { replace: true });
    }, [setSearchParams]);

    if (!paperId) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('paperSetup.loading')}
            </div>
        );
    }

    if (error || !paper) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-12 text-center">
                <h2 className="text-lg font-semibold text-foreground mb-1">
                    {t('paperSetup.notFound.title')}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('paperSetup.notFound.body')}
                </p>
                <Button onClick={() => navigate('/dashboard/exegesis')}>
                    {t('paperSetup.notFound.backCta')}
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-y-auto">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <Link
                        to={`/dashboard/exegesis/${paperId}`}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={t('paperSetup.backToPaper')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        {/* Same fallback as the directory list and the
                            paper detail page: explicit title wins,
                            otherwise show the formatted passage. The
                            old "Trabajo sin título" string is gone —
                            it implied the paper had no identity even
                            though the passage IS the identity. */}
                        <h1 className="text-lg font-semibold text-foreground font-serif truncate">
                            {paper.title || formatPassageReference(paper.passage, activeLanguage)}
                        </h1>
                        {/* Mirror the paper detail page: passage + phase
                            so orientation survives the navigation back-
                            and-forth. The previous "Configuración
                            académica..." subtitle was redundant — the
                            tab strip below already names the four
                            configuration surfaces, but the passage is
                            the one fact the user needs at-a-glance and
                            it was missing here. */}
                        <p className="text-xs text-muted-foreground">
                            {formatPassageReference(paper.passage, activeLanguage)} · {t(`list.phase.${paper.phase}`)}
                        </p>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl w-full mx-auto px-6 py-6">
                {/* La key descarta un borrador a medio escribir si la ruta
                    cambia a otro trabajo sin desmontar la página. */}
                <PaperBriefPanel key={paper.id} paper={paper} />
                <PaperCoverPanel key={`cover-${paper.id}`} paper={paper} />
                <SaveWorkProfileCard key={`profile-${paper.id}`} paper={paper} />

                <nav className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                    {SUB_STEPS.map((s, idx) => (
                        <SubStepTab
                            key={s.key}
                            index={idx + 1}
                            label={t(`paperSetup.subSteps.${s.key}.tab`)}
                            iconKey={s.iconKey}
                            active={activeKey === s.key}
                            onClick={() => setActiveKey(s.key)}
                        />
                    ))}
                </nav>

                <main className="rounded-2xl border border-border bg-card p-6 space-y-6">
                    {activeKey === 'rubric' && <RubricSubStep paper={paper} />}
                    {activeKey === 'manifest' && <StyleManifestSubStep paper={paper} />}
                    {activeKey === 'corpus' && <CorpusSubStep paper={paper} />}
                    {activeKey === 'corpus-plan' && <CorpusUsagePlanSubStep paper={paper} />}
                    {activeKey === 'plan' && <StructuralPlanSubStep paper={paper} />}
                </main>

                <footer className="flex items-center justify-end pt-6">
                    <Button
                        onClick={() => navigate(`/dashboard/exegesis/${paperId}`)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {t('paperSetup.goToPaper')}
                    </Button>
                </footer>
            </div>
        </div>
    );
}

interface SubStepTabProps {
    index: number;
    label: string;
    iconKey: string;
    active: boolean;
    onClick: () => void;
}

function SubStepTab({ index, label, iconKey, active, onClick }: SubStepTabProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                'flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors text-left',
                active
                    ? 'border-success bg-success-subtle text-success-subtle-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent',
            ].join(' ')}
        >
            <span className={[
                'shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold',
                active
                    ? 'bg-success text-success-foreground'
                    : 'bg-muted text-muted-foreground',
            ].join(' ')}>
                {index}
            </span>
            <span className="text-sm font-medium truncate">{label}</span>
            <SubStepIcon iconKey={iconKey} active={active} />
        </button>
    );
}

function SubStepIcon({ iconKey, active }: { iconKey: string; active: boolean }) {
    const className = [
        'h-3.5 w-3.5 ml-auto shrink-0',
        active ? 'text-success-subtle-foreground' : 'text-muted-foreground',
    ].join(' ');
    switch (iconKey) {
        case 'FileCheck2': return <FileCheck2 className={className} />;
        case 'BookOpen': return <BookOpen className={className} />;
        case 'FileStack': return <FileStack className={className} />;
        case 'ListTree': return <ListTree className={className} />;
        case 'Sparkles': return <Sparkles className={className} />;
        default: return <Lock className={className} />;
    }
}
