import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, BookText, Sparkles, Loader2, Lightbulb, Languages, FileCheck2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { PassagePicker } from '@/components/exegesis/PassagePicker';
import { RubricTemplatePicker } from '@/components/exegesis/setup/RubricTemplatePicker';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';
import { useUserRubrics } from '@/hooks/exegesis/useUserRubrics';
import { useUserAssignmentBriefs } from '@/hooks/exegesis/useUserAssignmentBriefs';
import { AssignmentBriefPicker } from '@/components/exegesis/setup/AssignmentBriefPicker';
import {
    ASSIGNMENT_BRIEF_MAX_CHARS,
    type ExegeticalStrategy,
    type PassageReference,
    type SupportedLanguage,
} from '@dosfilos/domain';

/**
 * Step 1 of the exegesis creation flow — minimal page.
 *
 * Only collects what's needed to OPEN the paper:
 *   - Passage (required)
 *   - Assignment brief (optional but encouraged) — the paper-level
 *     framing (professor's prompt + student's angle) that the
 *     orchestrator threads into every step's system prompt.
 *
 * Everything else (rubric, style guide, corpus, structural plan)
 * lives in the dedicated setup page at `/exegesis/{paperId}/setup`,
 * which this page redirects to on submit. The split exists because
 * those steps are too rich to live alongside "create" — each
 * deserves its own focused surface.
 */
export function ExegesisCreatePage() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('exegesis');
    const { createPaper } = useExegesisPapers();
    const { rubrics, defaultRubric } = useUserRubrics();
    const { defaultBrief } = useUserAssignmentBriefs();

    const [passage, setPassage] = useState<PassageReference | null>(null);
    const [passageError, setPassageError] = useState<string | null>(null);
    const [assignmentBrief, setAssignmentBrief] = useState('');
    // Track whether the user has typed into the brief — once they have,
    // a default brief loaded from Firestore mustn't clobber their text.
    const [briefUserTyped, setBriefUserTyped] = useState(false);
    // El mismo tope que el panel de edición en la configuración: dos cifras
    // sueltas terminan discrepando, y lo creado aquí no se podría reeditar allá.
    const briefMaxChars = ASSIGNMENT_BRIEF_MAX_CHARS;
    // Rubric template choice. Three states:
    //   - undefined → "use default if any" (matches the use case's
    //     fallback). Initial value when the user hasn't touched the
    //     picker.
    //   - templateId string → apply that template.
    //   - null → "no template, use system default rubric".
    //
    // Strategy and rubric used to be coupled here (picking dialectical
    // auto-applied the strategy-only rubric). They are now independent:
    // strategy drives how the corpus is built; rubric is the
    // professor's grading instrument. A student can have a dialectical
    // corpus AND a custom seminary rubric.
    const [rubricTemplateId, setRubricTemplateId] = useState<string | null | undefined>(undefined);

    // Default the paper language to whatever the UI is set to, but
    // make it explicit + editable. The student may be using a Spanish
    // UI to write a paper in English (or vice versa). The choice is
    // sticky on the paper; it drives the orchestrator's output
    // language for every step.
    const initialLanguage: SupportedLanguage = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';
    const [displayLanguage, setDisplayLanguage] = useState<SupportedLanguage>(initialLanguage);
    // Methodology mode. Defaults to dialectical because that's the
    // differentiator we want users to land on; opting out is a
    // deliberate, named choice (`free`) — not the absence of one.
    const [exegeticalStrategy, setExegeticalStrategy] = useState<ExegeticalStrategy>('dialectical');

    // Auto-load the user's default brief once the hook resolves.
    // Skip when the user already typed something so we don't clobber.
    useEffect(() => {
        if (briefUserTyped) return;
        if (!defaultBrief) return;
        setAssignmentBrief(defaultBrief.body.slice(0, briefMaxChars));
    }, [defaultBrief, briefUserTyped]);

    const isCreating = createPaper.isPending;
    const canCreate = !!passage && !isCreating;
    const briefCharCount = assignmentBrief.length;

    const handleCreate = async () => {
        if (!passage) return;
        try {
            const paper = await createPaper.mutateAsync({
                passage,
                displayLanguage,
                exegeticalStrategy,
                styleGuideId: null,
                assignmentBrief: assignmentBrief.trim() || null,
                rubricTemplateId,
            });
            toast.success(t('create.toast.created'));
            navigate(`/dashboard/exegesis/${paper.id}/setup`);
        } catch (err) {
            console.error('[exegesis] create failed:', err);
            toast.error(t('create.toast.createFailed'));
        }
    };

    return (
        <div className="flex flex-col h-full bg-background font-sans overflow-y-auto">
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <Link
                        to="/dashboard/exegesis"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={t('create.backToList')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-semibold text-foreground font-serif">
                            {t('create.title')}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {t('create.subtitle')}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 space-y-6">
                <Step
                    number={1}
                    icon={<BookText className="h-4 w-4" />}
                    title={t('setup.passage.stepTitle')}
                    subtitle={t('setup.passage.stepSubtitle')}
                >
                    <PassagePicker
                        value={passage}
                        onChange={(ref, err) => {
                            setPassage(ref);
                            setPassageError(err?.hint ?? null);
                        }}
                    />
                </Step>

                <Step
                    number={2}
                    icon={<Languages className="h-4 w-4" />}
                    title={t('create.language.title')}
                    subtitle={t('create.language.subtitle')}
                >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex gap-2">
                            <LanguageOption
                                value="es"
                                label="Español"
                                selected={displayLanguage === 'es'}
                                onSelect={() => setDisplayLanguage('es')}
                            />
                            <LanguageOption
                                value="en"
                                label="English"
                                selected={displayLanguage === 'en'}
                                onSelect={() => setDisplayLanguage('en')}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground italic">
                            {t('create.language.hint')}
                        </p>
                    </div>
                </Step>

                <Step
                    number={3}
                    icon={<Compass className="h-4 w-4" />}
                    title={t('create.strategy.title')}
                    subtitle={t('create.strategy.subtitle')}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <StrategyOption
                            value="dialectical"
                            selected={exegeticalStrategy === 'dialectical'}
                            onSelect={() => setExegeticalStrategy('dialectical')}
                            recommended
                            title={t('create.strategy.dialectical.title')}
                            body={t('create.strategy.dialectical.body')}
                        />
                        <StrategyOption
                            value="free"
                            selected={exegeticalStrategy === 'free'}
                            onSelect={() => setExegeticalStrategy('free')}
                            title={t('create.strategy.free.title')}
                            body={t('create.strategy.free.body')}
                        />
                    </div>
                    <p className="text-[11px] text-muted-foreground italic mt-2">
                        {t('create.strategy.hint')}
                    </p>
                </Step>

                <Step
                    number={4}
                    icon={<FileCheck2 className="h-4 w-4" />}
                    title={t('create.rubric.title')}
                    subtitle={t('create.rubric.subtitle')}
                >
                    <div className="space-y-2">
                        <RubricTemplatePicker
                            value={rubricTemplateId}
                            onChange={setRubricTemplateId}
                            rubrics={rubrics}
                            defaultRubric={defaultRubric}
                        />
                        <p className="text-[11px] text-muted-foreground italic">
                            {t('create.rubric.hint')}
                        </p>
                    </div>
                </Step>

                <Step
                    number={5}
                    icon={<Lightbulb className="h-4 w-4" />}
                    title={t('create.brief.title')}
                    subtitle={t('create.brief.subtitle')}
                >
                    <div className="space-y-2">
                        <AssignmentBriefPicker
                            currentBody={assignmentBrief}
                            onApply={(body) => {
                                setAssignmentBrief(body.slice(0, briefMaxChars));
                                setBriefUserTyped(true);
                            }}
                        />
                        <textarea
                            value={assignmentBrief}
                            onChange={(e) => {
                                setAssignmentBrief(e.target.value.slice(0, briefMaxChars));
                                setBriefUserTyped(true);
                            }}
                            placeholder={t('create.brief.placeholder')}
                            rows={6}
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                        />
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{t('create.brief.optional')}</span>
                            <span>{t('create.brief.characterCount', { count: briefCharCount, max: briefMaxChars })}</span>
                        </div>
                        <div className="rounded-md bg-success-subtle border border-success/30 px-3 py-2 flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                            <p className="text-[11px] text-success-subtle-foreground leading-relaxed">
                                {t('create.brief.tip')}
                            </p>
                        </div>
                    </div>
                </Step>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                    <Button variant="ghost" onClick={() => navigate('/dashboard/exegesis')}>
                        {t('create.cancel')}
                    </Button>
                    <Button
                        disabled={!canCreate}
                        onClick={handleCreate}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {isCreating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                        {t('create.submit')}
                    </Button>
                </div>

                {passageError && !passage && (
                    <p className="text-xs text-destructive -mt-3">
                        {passageError}
                    </p>
                )}
            </main>
        </div>
    );
}

interface StepProps {
    number: number;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

function Step({ number, icon, title, subtitle, children }: StepProps) {
    return (
        <section className="rounded-2xl border border-border bg-card p-5">
            <header className="flex items-start gap-3 mb-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-success-subtle text-success-subtle-foreground flex items-center justify-center text-xs font-semibold">
                    {number}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{icon}</span>
                        <h2 className="text-base font-semibold text-foreground">
                            {title}
                        </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
            </header>
            <div>
                {children}
            </div>
        </section>
    );
}

function LanguageOption({
    value,
    label,
    selected,
    onSelect,
}: {
    value: 'es' | 'en';
    label: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={[
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                selected
                    ? 'border-success bg-success-subtle text-success-subtle-foreground'
                    : 'border-border bg-card text-foreground hover:bg-accent',
            ].join(' ')}
            aria-pressed={selected}
        >
            <span className="text-[10px] uppercase tracking-wide opacity-70 mr-2">{value}</span>
            {label}
        </button>
    );
}

function StrategyOption({
    value,
    selected,
    onSelect,
    title,
    body,
    recommended = false,
}: {
    value: ExegeticalStrategy;
    selected: boolean;
    onSelect: () => void;
    title: string;
    body: string;
    recommended?: boolean;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            data-strategy={value}
            className={[
                'text-left rounded-lg border-2 p-3 transition-colors space-y-1',
                selected
                    ? 'border-primary bg-primary/5 text-foreground shadow-sm'
                    : 'border-border bg-card text-foreground hover:border-foreground/30',
            ].join(' ')}
        >
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{title}</span>
                {recommended && (
                    <span className="text-[10px] uppercase tracking-wide font-medium rounded-full border border-success/40 bg-success-subtle text-success-subtle-foreground px-1.5 py-0">
                        {t('create.strategy.recommended')}
                    </span>
                )}
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
                {body}
            </p>
        </button>
    );
}

