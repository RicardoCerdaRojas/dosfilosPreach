import { useState } from 'react';
import {
    BookOpen,
    BookText,
    ChevronDown,
    ChevronRight,
    FileText,
    Highlighter,
    Library,
    ListTree,
    NotebookText,
    Quote,
    ScrollText,
    Sparkles,
    Tag,
} from 'lucide-react';
import {
    formatPassageReference,
    type CanonicalVerseAnalysis,
    type SourceCitation,
} from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

/**
 * Read-only "study mode" view for a `CanonicalVerseAnalysis`.
 *
 * Renders each canonical step as its own collapsible section with
 * the structured data from the analysis. The student inspects /
 * critiques the atomic exegetical work BEFORE composing it into a
 * paper — pedagogically the right level for learning.
 *
 * Sections (per the methodology):
 *   1. Greek text + initial/final translation banner
 *   2. Argumentative role (verse's contribution to the pericope)
 *   3. Syntactic analysis (main verb + key constructions + particles)
 *   4. Lexical analyses (term-by-term, separating range from loading)
 *   5. Textual criticism (always present per Differentiator 4)
 *   6. Historical context (when applicable)
 *   7. OT intertextual links (when applicable)
 *   8. Commentator engagement (anchor / contrast / technical)
 *   9. Translation cruxes (with commitments)
 *  10. Verse thesis (closing)
 *  11. Theological hooks (for non-academic composers)
 *  12. Confidence flags (calibration metadata)
 *  13. Footnote extensions (anchor-text-sources)
 *
 * The component is purely presentational; it does NOT mutate. The
 * caller decides where to mount it (verse card body, dialog, dedicated
 * "study" tab).
 */
/** Abrir el documento original en la página de una cita. */
type OpenCitation = (citation: {
    sourceKey: string;
    page: number;
    verbatimQuote?: string | null;
}) => void;

interface CanonicalAnalysisStudyViewProps {
    analysis: CanonicalVerseAnalysis;
    /**
     * Sin él las citas se muestran como texto, que es como venían.
     */
    onOpenCitation?: OpenCitation;
}

/**
 * Clave y página de una cita, pulsable cuando hay a dónde ir.
 *
 * Comprobar una cita costaba cinco pasos y un cambio de contexto, así que
 * nadie los daba: por eso una atribución invertida sobrevivió meses en un
 * paper. Esto lo vuelve un clic.
 */
function CitationChip({
    sourceKey,
    page,
    verbatimQuote,
    onOpen,
}: {
    sourceKey: string;
    page: number;
    verbatimQuote?: string | null;
    onOpen?: OpenCitation;
}) {
    const { t } = useTranslation('exegesis');
    const label = `${sourceKey} p. ${page}`;
    if (!onOpen) {
        return (
            <>
                <span className="text-xs font-semibold text-foreground">{sourceKey}</span>
                <span className="text-[11px] text-muted-foreground">p. {page}</span>
            </>
        );
    }
    return (
        <button
            type="button"
            onClick={() => onOpen({ sourceKey, page, verbatimQuote })}
            title={t('citationViewer.openSource')}
            className="inline-flex items-baseline gap-1 rounded px-1 -mx-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
            <span className="text-xs font-semibold text-foreground underline decoration-dotted underline-offset-2">{sourceKey}</span>
            <span className="text-[11px] text-muted-foreground">p. {page}</span>
            <span className="sr-only">{t('citationViewer.openSource', { label })}</span>
        </button>
    );
}

export function CanonicalAnalysisStudyView({ analysis, onOpenCitation }: CanonicalAnalysisStudyViewProps) {
    const { t, i18n } = useTranslation('exegesis');
    const lang = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';
    const refLabel = formatPassageReference(analysis.reference, lang);

    return (
        <article className="space-y-4 text-sm">
            {/* Greek text + translations banner */}
            <header className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    <BookText className="h-3.5 w-3.5" aria-hidden />
                    {t('canonical.study.headerLabel')}
                    <span className="text-foreground/70 normal-case tracking-normal font-normal">· {refLabel}</span>
                </div>
                <p className="font-serif text-base leading-relaxed text-foreground">
                    {analysis.originalText || <em className="text-muted-foreground">{t('canonical.study.empty.greek')}</em>}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <TranslationCell
                        label={t('canonical.study.initialTranslation')}
                        value={analysis.initialTranslation}
                    />
                    <TranslationCell
                        label={t('canonical.study.finalTranslation')}
                        value={analysis.finalTranslation}
                        emphasized
                    />
                </div>
            </header>

            {/* Argumentative role */}
            <Section
                icon={<Sparkles className="h-4 w-4" aria-hidden />}
                title={t('canonical.study.argumentativeRole')}
                hint={t('canonical.study.argumentativeRoleHint')}
            >
                <ProseField value={analysis.argumentativeRole} />
            </Section>

            {/* Syntactic analysis */}
            <Section
                icon={<ListTree className="h-4 w-4" aria-hidden />}
                title={t('canonical.study.syntaxTitle')}
                hint={t('canonical.study.syntaxHint')}
                defaultOpen
            >
                <SyntaxBlock analysis={analysis} />
            </Section>

            {/* Lexical analyses */}
            <Section
                icon={<Highlighter className="h-4 w-4" aria-hidden />}
                title={t('canonical.study.lexisTitle')}
                hint={t('canonical.study.lexisHint')}
                count={analysis.lexicalAnalyses.length}
            >
                {analysis.lexicalAnalyses.length === 0 ? (
                    <EmptyHint text={t('canonical.study.empty.lexis')} />
                ) : (
                    <ul className="space-y-3">
                        {analysis.lexicalAnalyses.map((la, idx) => (
                            <li key={`${la.term}-${idx}`} className="rounded-md border border-border bg-card p-3 space-y-2">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="font-serif text-base text-foreground">{la.term}</span>
                                    <span className="text-[11px] text-muted-foreground italic">{la.lemma}</span>
                                    {la.gloss && <span className="text-xs text-foreground/70">"{la.gloss}"</span>}
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                                        {t('canonical.study.lexis.range')}
                                    </p>
                                    {la.generalSemanticRange.glosses.length > 0 ? (
                                        <p className="text-xs text-foreground/85 leading-relaxed">
                                            {la.generalSemanticRange.glosses.join(' / ')}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">—</p>
                                    )}
                                    {la.generalSemanticRange.sources.length > 0 && (
                                        <SourceList onOpenCitation={onOpenCitation} citations={la.generalSemanticRange.sources} />
                                    )}
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                                        {t('canonical.study.lexis.loading')}
                                    </p>
                                    <p className="text-xs text-foreground/85 leading-relaxed">{la.verseSpecificLoading}</p>
                                    {la.loadingSources.length > 0 && (
                                        <SourceList onOpenCitation={onOpenCitation} citations={la.loadingSources} />
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* Textual criticism */}
            <Section
                icon={<ScrollText className="h-4 w-4" aria-hidden />}
                title={t('canonical.study.textualCriticism')}
                hint={t('canonical.study.textualCriticismHint')}
                count={analysis.textualCriticism.variants.length}
            >
                <p className="text-xs italic text-foreground/85 leading-relaxed mb-2">
                    {analysis.textualCriticism.note || <em className="text-muted-foreground">—</em>}
                </p>
                {analysis.textualCriticism.variants.length > 0 && (
                    <ul className="space-y-3">
                        {analysis.textualCriticism.variants.map((v, idx) => (
                            <li key={`${v.lemma}-${idx}`} className="rounded-md border border-warning/30 bg-warning-subtle/30 p-3 space-y-1.5">
                                <p className="text-xs">
                                    <span className="font-serif font-semibold">{v.lemma}</span> →{' '}
                                    <span className="font-serif">{v.adoptedReading}</span>
                                </p>
                                {v.readings.map((r, ridx) => (
                                    <div key={ridx} className="text-[11px] text-foreground/80">
                                        <span className="font-serif">"{r.text}"</span>{' '}
                                        <span className="text-muted-foreground">— {r.witnesses.join(', ')}</span>
                                    </div>
                                ))}
                                <p className="text-[11px] italic text-foreground/85">{v.rationale}</p>
                                {v.apparatusReference && (
                                    <p className="text-[10px] text-muted-foreground">[{v.apparatusReference}]</p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* Historical context (only when populated) */}
            {analysis.historicalContext.length > 0 && (
                <Section
                    icon={<Library className="h-4 w-4" aria-hidden />}
                    title={t('canonical.study.historicalContext')}
                    count={analysis.historicalContext.length}
                >
                    <ul className="space-y-2">
                        {analysis.historicalContext.map((h, idx) => (
                            <li key={idx} className="rounded-md border border-border bg-card p-3">
                                <p className="text-xs font-semibold text-foreground">{h.aspect}</p>
                                <p className="text-xs text-foreground/85 leading-relaxed mt-1">{h.relevance}</p>
                                {h.sources.length > 0 && <SourceList onOpenCitation={onOpenCitation} citations={h.sources} />}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* OT links (only when populated) */}
            {analysis.oldTestamentLinks.length > 0 && (
                <Section
                    icon={<BookOpen className="h-4 w-4" aria-hidden />}
                    title={t('canonical.study.oldTestamentLinks')}
                    count={analysis.oldTestamentLinks.length}
                >
                    <ul className="space-y-2">
                        {analysis.oldTestamentLinks.map((l, idx) => (
                            <li key={idx} className="rounded-md border border-border bg-card p-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] uppercase tracking-wide font-semibold rounded-full bg-info-subtle text-info-subtle-foreground px-1.5 py-0">
                                        {l.type}
                                    </span>
                                    <span className="text-xs font-semibold text-foreground">{l.sourcePassage}</span>
                                    {l.citationFormula && (
                                        <span className="font-serif text-[11px] text-muted-foreground">{l.citationFormula}</span>
                                    )}
                                </div>
                                <p className="text-xs text-foreground/85 leading-relaxed mt-1">{l.interpretiveBearing}</p>
                                {l.sources.length > 0 && <SourceList onOpenCitation={onOpenCitation} citations={l.sources} />}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Commentator engagement */}
            <Section
                icon={<Quote className="h-4 w-4" aria-hidden />}
                title={t('canonical.study.commentators')}
                hint={t('canonical.study.commentatorsHint')}
                count={analysis.commentatorEngagement.length}
                defaultOpen
            >
                {analysis.commentatorEngagement.length === 0 ? (
                    <EmptyHint text={t('canonical.study.empty.commentators')} />
                ) : (
                    <ul className="space-y-2">
                        {analysis.commentatorEngagement.map((c, idx) => (
                            <li key={idx} className="rounded-md border border-border bg-card p-3 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <RoleBadge role={c.role} />
                                    <CitationChip
                                        sourceKey={c.sourceKey}
                                        page={c.page}
                                        verbatimQuote={c.verbatimQuote}
                                        onOpen={onOpenCitation}
                                    />
                                </div>
                                <p className="text-xs text-foreground/85 leading-relaxed">{c.position}</p>
                                {c.verbatimQuote && (
                                    <p className="text-[11px] italic text-foreground/70 border-l-2 border-border pl-2 mt-1">
                                        "{c.verbatimQuote}"
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* Translation cruxes */}
            <Section
                icon={<NotebookText className="h-4 w-4" aria-hidden />}
                title={t('canonical.study.cruxesTitle')}
                hint={t('canonical.study.cruxesHint')}
                count={analysis.translationCruxes.length}
                defaultOpen
            >
                {analysis.translationCruxes.length === 0 ? (
                    <EmptyHint text={t('canonical.study.empty.cruxes')} />
                ) : (
                    <ul className="space-y-3">
                        {analysis.translationCruxes.map((cx, idx) => (
                            <li key={idx} className="rounded-md border border-border bg-card p-3 space-y-2">
                                <p className="font-serif text-sm text-foreground">{cx.phrase}</p>
                                <p className="text-xs italic text-foreground/85">{cx.description}</p>
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                                        {t('canonical.study.cruxes.options')}
                                    </p>
                                    <ul className="space-y-0.5">
                                        {cx.options.map((o, oidx) => (
                                            <li key={oidx} className="text-[11px]">
                                                <span className="text-foreground">"{o.translation}"</span>{' '}
                                                <span className="text-muted-foreground italic">— {o.characterization}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                {cx.commentatorPositions.length > 0 && (
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                                            {t('canonical.study.cruxes.positions')}
                                        </p>
                                        <ul className="space-y-0.5">
                                            {cx.commentatorPositions.map((p, pidx) => (
                                                <li key={pidx} className="text-[11px] text-foreground/85">
                                                    <CitationChip
                                                        sourceKey={p.sourceKey}
                                                        page={p.page}
                                                        verbatimQuote={p.verbatimQuote}
                                                        onOpen={onOpenCitation}
                                                    />
                                                    {' → '}
                                                    <span>opt {p.supports}: {p.summary}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <div className="rounded bg-success-subtle/40 border border-success/30 p-2">
                                    <p className="text-[11px] uppercase tracking-wide font-semibold text-success-subtle-foreground mb-0.5">
                                        {t('canonical.study.cruxes.commitment')}
                                    </p>
                                    <p className="text-xs font-semibold text-foreground">"{cx.commitment.chosen}"</p>
                                    <p className="text-[11px] italic text-foreground/85 mt-1">{cx.commitment.rationale}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* Verse thesis */}
            <Section
                icon={<FileText className="h-4 w-4" aria-hidden />}
                title={t('canonical.study.verseThesis')}
                hint={t('canonical.study.verseThesisHint')}
                defaultOpen
            >
                <ProseField value={analysis.verseThesis} emphasized />
            </Section>

            {/* Theological hooks */}
            {analysis.theologicalHooks.length > 0 && (
                <Section
                    icon={<Tag className="h-4 w-4" aria-hidden />}
                    title={t('canonical.study.theologicalHooks')}
                    hint={t('canonical.study.theologicalHooksHint')}
                    count={analysis.theologicalHooks.length}
                >
                    <ul className="space-y-1.5">
                        {analysis.theologicalHooks.map((th, idx) => (
                            <li key={idx} className="text-xs">
                                <span className="inline-block px-1.5 py-0 rounded bg-muted text-muted-foreground text-[10px] uppercase tracking-wide mr-2 align-middle">
                                    {th.locus === 'otro' ? th.customLocus : th.locus}
                                </span>
                                <span className="text-foreground/85">{th.contribution}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Confidence flags */}
            {analysis.confidenceFlags.length > 0 && (
                <Section
                    icon={<Sparkles className="h-4 w-4" aria-hidden />}
                    title={t('canonical.study.confidence')}
                    hint={t('canonical.study.confidenceHint')}
                    count={analysis.confidenceFlags.length}
                >
                    <ul className="space-y-1.5">
                        {analysis.confidenceFlags.map((f, idx) => (
                            <li key={idx} className="text-xs">
                                <ConfidenceBadge level={f.level} />
                                <span className="ml-2 text-foreground/85">{f.claim}</span>
                                {f.preferredHedges.length > 0 && (
                                    <span className="text-[11px] italic text-muted-foreground ml-2">
                                        ({f.preferredHedges.join(', ')})
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* Footnote extensions */}
            {analysis.footnoteExtensions.length > 0 && (
                <Section
                    icon={<FileText className="h-4 w-4" aria-hidden />}
                    title={t('canonical.study.footnotes')}
                    hint={t('canonical.study.footnotesHint')}
                    count={analysis.footnoteExtensions.length}
                >
                    <ul className="space-y-2">
                        {analysis.footnoteExtensions.map((fn, idx) => (
                            <li key={idx} className="text-xs space-y-1">
                                <p className="text-foreground italic">"{fn.anchorPhrase}"</p>
                                <p className="text-foreground/85 pl-3 border-l border-border">{fn.text}</p>
                                {fn.sources.length > 0 && <SourceList onOpenCitation={onOpenCitation} citations={fn.sources} />}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
        </article>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Section({
    icon,
    title,
    hint,
    count,
    defaultOpen = false,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    hint?: string;
    count?: number;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section className="rounded-lg border border-border bg-card">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
                <span className="text-muted-foreground shrink-0">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</span>
                <span className="text-success shrink-0">{icon}</span>
                <span className="text-xs font-semibold text-foreground flex-1">
                    {title}
                    {typeof count === 'number' && (
                        <span className="ml-1.5 text-muted-foreground/70 font-normal">({count})</span>
                    )}
                </span>
            </button>
            {open && (
                <div className="border-t border-border px-3 py-3 space-y-2">
                    {hint && <p className="text-[11px] italic text-muted-foreground">{hint}</p>}
                    {children}
                </div>
            )}
        </section>
    );
}

function TranslationCell({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
    return (
        <div className={[
            'rounded-md p-2',
            emphasized ? 'border border-success/30 bg-success-subtle/30' : 'border border-border bg-card',
        ].join(' ')}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">{label}</p>
            <p className={[
                'text-xs leading-relaxed',
                emphasized ? 'text-foreground font-medium' : 'text-foreground/85',
            ].join(' ')}>
                {value || <em className="text-muted-foreground">—</em>}
            </p>
        </div>
    );
}

function ProseField({ value, emphasized = false }: { value: string; emphasized?: boolean }) {
    if (!value) {
        return <p className="text-xs italic text-muted-foreground">—</p>;
    }
    return (
        <p className={[
            'text-xs leading-relaxed',
            emphasized ? 'text-foreground font-medium' : 'text-foreground/85',
        ].join(' ')}>
            {value}
        </p>
    );
}

function EmptyHint({ text }: { text: string }) {
    return <p className="text-xs italic text-muted-foreground">{text}</p>;
}

function SyntaxBlock({ analysis }: { analysis: CanonicalVerseAnalysis }) {
    const { t } = useTranslation('exegesis');
    const sa = analysis.syntacticAnalysis;
    const hasMain = !!sa.mainVerb;
    const hasNote = !hasMain && !!sa.mainVerbNote;
    const hasConstructions = sa.keyConstructions.length > 0;
    const hasParticles = sa.discourseParticles.length > 0;

    if (!hasMain && !hasNote && !hasConstructions && !hasParticles) {
        return <EmptyHint text={t('canonical.study.empty.syntax')} />;
    }

    return (
        <div className="space-y-3">
            {hasMain && (
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                        {t('canonical.study.syntax.mainVerb')}
                    </p>
                    <SyntacticElementRow element={sa.mainVerb!} />
                </div>
            )}
            {hasNote && (
                <p className="text-[11px] italic text-muted-foreground">
                    {t('canonical.study.syntax.noMainVerb')}{' '}
                    {sa.mainVerbNote}
                </p>
            )}
            {hasConstructions && (
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                        {t('canonical.study.syntax.constructions')}
                    </p>
                    <ul className="space-y-2">
                        {sa.keyConstructions.map((kc, idx) => (
                            <SyntacticElementRow key={idx} element={kc} />
                        ))}
                    </ul>
                </div>
            )}
            {hasParticles && (
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                        {t('canonical.study.syntax.particles')}
                    </p>
                    <ul className="space-y-1">
                        {sa.discourseParticles.map((p, idx) => (
                            <li key={idx} className="text-xs">
                                <span className="font-serif text-foreground">{p.particle}</span>{' '}
                                <span className="text-muted-foreground italic">— {p.function}</span>
                                <p className="text-[11px] text-foreground/80 mt-0.5">{p.note}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function SyntacticElementRow({ element }: { element: CanonicalVerseAnalysis['syntacticAnalysis']['keyConstructions'][number] }) {
    return (
        <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
            <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-serif text-foreground">{element.text}</span>
                <span className="text-[11px] text-muted-foreground italic">{element.morphology}</span>
            </div>
            <p className="text-[11px] text-foreground/85">
                <span className="font-semibold">{element.syntacticFunction}.</span>{' '}
                {element.interpretiveSignificance}
            </p>
        </div>
    );
}

function RoleBadge({ role }: { role: 'anchor' | 'contrast' | 'technical' }) {
    const palette = role === 'anchor'
        ? 'bg-success text-success-foreground'
        : role === 'contrast'
            ? 'bg-info text-info-foreground'
            : 'bg-warning text-warning-foreground';
    const label = role === 'anchor' ? 'ANCLA' : role === 'contrast' ? 'CONTRASTE' : 'TÉCNICA';
    return (
        <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wide leading-tight ${palette}`}>
            {label}
        </span>
    );
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'tentative' }) {
    const palette = level === 'high'
        ? 'bg-success-subtle text-success-subtle-foreground border-success/30'
        : level === 'medium'
            ? 'bg-info-subtle text-info-subtle-foreground border-info/30'
            : 'bg-warning-subtle text-warning-subtle-foreground border-warning/30';
    const label = level === 'high' ? 'high' : level === 'medium' ? 'medium' : 'tentative';
    return (
        <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9.5px] font-semibold uppercase tracking-wide leading-tight ${palette}`}>
            {label}
        </span>
    );
}

/**
 * Las fuentes que respaldan un dato: rango léxico, carga en el verso,
 * trasfondo histórico, intertextualidad y notas al pie.
 *
 * Estas citas son `SourceCitation`, que no tiene campo de cita textual —
 * el visor abre la página y lo dice, en vez de prometer una frase que
 * nunca se guardó.
 */
function SourceList({
    citations,
    onOpenCitation,
}: {
    citations: ReadonlyArray<SourceCitation>;
    onOpenCitation?: OpenCitation;
}) {
    const { t } = useTranslation('exegesis');
    if (citations.length === 0) return null;
    return (
        <p className="text-[10.5px] text-muted-foreground italic mt-1">
            {citations.map((c, i) => (
                <span key={i}>
                    {i > 0 && '; '}
                    {onOpenCitation ? (
                        <button
                            type="button"
                            onClick={() => onOpenCitation({ sourceKey: c.sourceKey, page: c.page })}
                            title={t('citationViewer.openSource')}
                            className="rounded px-0.5 -mx-0.5 underline decoration-dotted underline-offset-2 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            {c.sourceKey} p. {c.page}
                        </button>
                    ) : (
                        <>{c.sourceKey} p. {c.page}</>
                    )}
                    {c.locator ? ` (${c.locator})` : ''}
                </span>
            ))}
        </p>
    );
}
