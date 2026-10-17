import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    ArrowRight,
    BookOpen,
    LayoutDashboard,
    Sparkles,
    Lightbulb,
    MessageCircle,
    Bookmark,
    Network,
    Key,
    Zap,
    Library as LibraryIcon,
    BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BiblePassageSelector } from '@/components/sermons/BiblePassageSelector';
import { PassagePreview } from './PassagePreview';
import { FeatureModal } from './FeatureModal';

/**
 * Idle / passage-selection landing screen for the Greek Tutor.
 *
 * Redesigned 2026-05-15 (fix/ux-iteration-batch-3) to:
 *  - drop the hardcoded blue/purple/pink gradient hero (not brand,
 *    not theme-aware)
 *  - drop the multi-color cascade across each feature card (every
 *    one had its own pastel palette — visual chaos, no hierarchy)
 *  - drop the inline hover-expand mini-previews (FeatureModal
 *    already serves the same purpose with real screenshots)
 *  - consolidate to a single-column layout: hero → action zone →
 *    showcase grouped by methodology phase
 *  - use semantic tokens + brand primary throughout
 *
 * The 9-feature methodology narrative is preserved (memory:
 * `feature_greek_tutor_methodology_narrative`). FeatureModal
 * integrations untouched.
 */

interface GreekTutorIntroViewProps {
    passage: string;
    setPassage: (p: string) => void;
    recentPassages: string[];
    handleStart: () => void;
    openFeatureModal: string | null;
    setOpenFeatureModal: (id: string | null) => void;
    setShowInsightsDialog: (open: boolean) => void;
}

type FeatureSection = 'overview' | 'wordStudy' | 'reinforcement';

interface FeatureCard {
    id: string;
    icon: React.ElementType;
    key: string;
    section: FeatureSection;
    /** When set, the card ignores `openFeatureModal` and runs this
     *  custom handler instead. Used for "Mis insights" which opens
     *  a separate dialog rather than a screenshot modal. */
    customAction?: 'showInsights';
}

const FEATURES: FeatureCard[] = [
    { id: 'lectura-pasaje',         icon: BookOpen,     key: 'readPassage',      section: 'overview' },
    { id: 'estructura-sintactica',  icon: Network,      key: 'syntax',           section: 'overview' },

    { id: 'analisis-morfologico',   icon: Sparkles,     key: 'morphology',       section: 'wordStudy' },
    { id: 'claves-reconocimiento',  icon: Key,          key: 'recognitionKeys',  section: 'wordStudy' },
    { id: 'funcion-contexto',       icon: Zap,          key: 'contextFunction',  section: 'wordStudy' },
    { id: 'insight-experto',        icon: Lightbulb,    key: 'expertInsight',    section: 'wordStudy' },

    { id: 'conceptos-generales',    icon: LibraryIcon,  key: 'generalConcepts',  section: 'reinforcement' },
    { id: 'preguntas-tutor',        icon: MessageCircle,key: 'tutorQuestions',   section: 'reinforcement' },
    { id: 'quiz-comprension',       icon: BadgeCheck,   key: 'quiz',             section: 'reinforcement' },
    { id: 'mis-insights',           icon: Bookmark,     key: 'myInsights',       section: 'reinforcement', customAction: 'showInsights' },
];

const SECTION_I18N_KEY: Record<FeatureSection, string> = {
    overview: 'sections.overview',
    wordStudy: 'sections.wordStudy',
    reinforcement: 'sections.learningReinforcement',
};

export const GreekTutorIntroView: React.FC<GreekTutorIntroViewProps> = ({
    passage,
    setPassage,
    recentPassages,
    handleStart,
    openFeatureModal,
    setOpenFeatureModal,
    setShowInsightsDialog,
}) => {
    const { t } = useTranslation('greekTutor');
    const hasPassage = passage.trim().length > 0;

    const handleCardClick = (card: FeatureCard) => {
        if (card.customAction === 'showInsights') {
            setShowInsightsDialog(true);
            return;
        }
        setOpenFeatureModal(card.id);
    };

    return (
        <>
            <div className="h-full overflow-y-auto bg-background">
                <div className="container max-w-5xl mx-auto px-6 py-8 lg:py-10 space-y-8">

                    {/* ── Compact hero — theme-aware, brand primary ─────────────── */}
                    <header className="flex items-start justify-between gap-4 pb-6 border-b border-border">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground leading-tight tracking-tight">
                                    {t('title')}
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                                    {t('intro.heroSubtitle')}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            onClick={() => (window.location.href = '/dashboard/greek-tutor-dashboard')}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('mySessions')}</span>
                        </Button>
                    </header>

                    {/* ── Action zone — passage + start ──────────────────────────── */}
                    <section className="space-y-4">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                {t('intro.actionTitle')}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t('intro.actionSubtitle')}
                            </p>
                        </div>

                        <BiblePassageSelector
                            value={passage}
                            onChange={setPassage}
                            onValidPassage={() => {}}
                            hidePreview={hasPassage}
                            label={t('passageSelector.label')}
                            placeholder={t('passageSelector.placeholder')}
                        />

                        <Button
                            className="w-full h-12 text-base font-semibold bg-primary-solid hover:bg-primary-solid-hover text-primary-foreground gap-2 shadow-sm hover:shadow-md transition-all group"
                            onClick={handleStart}
                            disabled={!passage.trim()}
                        >
                            <Sparkles className="h-4 w-4" />
                            {t('startTraining')}
                            <ArrowRight className="h-4 w-4 ml-auto group-hover:translate-x-0.5 transition-transform" />
                        </Button>

                        <div className="space-y-2 pt-1">
                            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                                {t('frequentPassages')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {recentPassages.map((ref) => (
                                    <button
                                        key={ref}
                                        onClick={() => setPassage(ref)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-border bg-card hover:border-primary/50 hover:bg-muted transition-all font-medium text-foreground"
                                    >
                                        <BookOpen className="h-3 w-3 text-muted-foreground" />
                                        {ref}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* When user has typed a valid passage, surface the preview
                        inline so they can confirm before starting. Replaces
                        the previous right-column-only PassagePreview. */}
                    {hasPassage && (
                        <section>
                            <PassagePreview passage={passage} />
                        </section>
                    )}

                    {/* ── Showcase — 9 features grouped by methodology phase ────── */}
                    <section className="space-y-6 pt-4 border-t border-border">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">
                                {t('intro.showcaseTitle')}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t('intro.showcaseSubtitle')}
                            </p>
                        </div>

                        {(['overview', 'wordStudy', 'reinforcement'] as const).map((sectionKey) => {
                            const cards = FEATURES.filter((f) => f.section === sectionKey);
                            return (
                                <div key={sectionKey} className="space-y-3">
                                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {t(SECTION_I18N_KEY[sectionKey])}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {cards.map((card) => {
                                            const Icon = card.icon;
                                            return (
                                                <button
                                                    key={card.id}
                                                    onClick={() => handleCardClick(card)}
                                                    className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="shrink-0 p-1.5 rounded-md bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                                                            <Icon className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium text-sm text-foreground mb-0.5 leading-tight">
                                                                {t(`features.${card.key}.title`)}
                                                            </h4>
                                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                                {t(`features.${card.key}.description`)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                </div>
            </div>

            {/* FeatureModals — unchanged, preserve original screenshot-driven preview path */}
            <FeatureModal
                isOpen={openFeatureModal === 'lectura-pasaje'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.readPassage.title')}
                description={t('features.readPassage.description')}
                screenshotPath="/greek-tutor-previews/lectura_pasaje.png"
                details={t('features.readPassage.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'estructura-sintactica'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.syntax.title')}
                description={t('features.syntax.description')}
                screenshotPath="/greek-tutor-previews/estructura_sintactica.png"
                details={t('features.syntax.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'analisis-morfologico'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.morphology.title')}
                description={t('features.morphology.description')}
                screenshotPath="/greek-tutor-previews/analisis_morfologico.png"
                details={t('features.morphology.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'claves-reconocimiento'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.recognitionKeys.title')}
                description={t('features.recognitionKeys.description')}
                screenshotPath="/greek-tutor-previews/claves_reconocimiento.png"
                details={t('features.recognitionKeys.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'funcion-contexto'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.contextFunction.title')}
                description={t('features.contextFunction.description')}
                screenshotPath="/greek-tutor-previews/funcion_contexto.png"
                details={t('features.contextFunction.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'insight-experto'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.expertInsight.title')}
                description={t('features.expertInsight.description')}
                screenshotPath="/greek-tutor-previews/insight_experto.png"
                details={t('features.expertInsight.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'conceptos-generales'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.generalConcepts.title')}
                description={t('features.generalConcepts.description')}
                screenshotPath="/greek-tutor-previews/conceptos_generales.png"
                details={t('features.generalConcepts.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'preguntas-tutor'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.tutorQuestions.title')}
                description={t('features.tutorQuestions.description')}
                screenshotPath="/greek-tutor-previews/preguntas_tutor.png"
                details={t('features.tutorQuestions.details', { returnObjects: true }) as string[]}
            />
            <FeatureModal
                isOpen={openFeatureModal === 'quiz-comprension'}
                onClose={() => setOpenFeatureModal(null)}
                title={t('features.quiz.title')}
                description={t('features.quiz.description')}
                screenshotPath="/greek-tutor-previews/quiz_comprension.png"
                details={t('features.quiz.details', { returnObjects: true }) as string[]}
            />
        </>
    );
};
