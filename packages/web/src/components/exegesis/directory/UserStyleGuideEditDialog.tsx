import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
    hasManifestValidationErrors,
    validateStyleGuideManifest,
    type StyleGuideManifest,
    type StyleManifestValidationIssue,
    type UserStyleGuide,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n';
import { useUserStyleGuides } from '@/hooks/exegesis/useUserStyleGuides';
import { FootnotesTab } from '../style-guide-editor/FootnotesTab';
import { BibliographyTab } from '../style-guide-editor/BibliographyTab';
import { QuotationsTab } from '../style-guide-editor/QuotationsTab';
import { TransliterationTab } from '../style-guide-editor/TransliterationTab';
import { CoverTab } from '../style-guide-editor/CoverTab';
import { AdditionalRulesTab } from '../style-guide-editor/AdditionalRulesTab';

/**
 * v1.7 — Modal editor for a `UserStyleGuide`.
 *
 * Six tabs:
 *   - **Datos** — displayName + version (existing)
 *   - **Footnotes** — first/subsequent templates + ibid rules
 *   - **Bibliography** — entry template + sort + dash for repeats
 *   - **Quotations** — block threshold + quote marks + ellipsis + brackets
 *   - **Transliteration** — toggle + scheme + diacritics + body required
 *   - **Reglas adicionales** — free-form rules list
 *
 * Persistence is split:
 *   - displayName + version → `updateGuide` mutation (existing)
 *   - manifest → `updateManifest` mutation (new in v1.7)
 *
 * Both fire on Save when their respective state has changed. Save is
 * disabled when the manifest has validation errors (severity 'error').
 * Warnings are surfaced inline but don't block save.
 *
 * Cancel discards all in-flight edits without confirmation — it's a
 * dialog, the user can re-open and try again.
 */
export interface UserStyleGuideEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    guide: UserStyleGuide;
}

type TabKey = 'datos' | 'footnotes' | 'bibliography' | 'quotations' | 'transliteration' | 'cover' | 'additional';

const TABS: ReadonlyArray<TabKey> = [
    'datos',
    'footnotes',
    'bibliography',
    'quotations',
    'transliteration',
    'cover',
    'additional',
];

export function UserStyleGuideEditDialog({ open, onOpenChange, guide }: UserStyleGuideEditDialogProps) {
    const { t } = useTranslation('exegesis');
    const { updateGuide, updateManifest } = useUserStyleGuides();
    const saving = updateGuide.isPending || updateManifest.isPending;

    // Display fields (existing v1.6 functionality).
    const [displayName, setDisplayName] = useState(guide.displayName);
    const [version, setVersion] = useState(guide.version ?? '');

    // Manifest draft. Null while the guide doesn't have a manifest
    // yet (LlamaParse extraction in flight or never triggered) — the
    // manifest tabs render an empty-state in that case.
    const [draft, setDraft] = useState<StyleGuideManifest | null>(guide.manifest);

    const [activeTab, setActiveTab] = useState<TabKey>('datos');

    useEffect(() => {
        if (!open) return;
        setDisplayName(guide.displayName);
        setVersion(guide.version ?? '');
        setDraft(guide.manifest);
        setActiveTab('datos');
    }, [open, guide]);

    const issues = useMemo<ReadonlyArray<StyleManifestValidationIssue>>(
        () => (draft ? validateStyleGuideManifest(draft) : []),
        [draft],
    );
    const hasErrors = hasManifestValidationErrors(issues);
    const errorTabs = useMemo(() => collectErrorTabs(issues), [issues]);

    const trimmedName = displayName.trim();
    const dataDirty = trimmedName !== guide.displayName || version.trim() !== (guide.version ?? '');
    const manifestDirty = draft !== null && draft !== guide.manifest;
    const canSubmit = trimmedName.length >= 3 && !saving && !hasErrors && (dataDirty || manifestDirty);

    const handleSave = async () => {
        if (!canSubmit) return;
        try {
            const tasks: Promise<unknown>[] = [];
            if (dataDirty) {
                tasks.push(
                    updateGuide.mutateAsync({
                        guideId: guide.id,
                        displayName: trimmedName,
                        version: version.trim() || undefined,
                    }),
                );
            }
            if (manifestDirty && draft) {
                tasks.push(
                    updateManifest.mutateAsync({ guideId: guide.id, manifest: draft }),
                );
            }
            await Promise.all(tasks);
            toast.success(t('directory.styleGuides.toast.updated'));
            onOpenChange(false);
        } catch (err) {
            console.error('[exegesis] update style guide failed:', err);
            toast.error(t('directory.styleGuides.toast.updateFailed'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('directory.styleGuides.edit.title')}</DialogTitle>
                    <DialogDescription>
                        {t('directory.styleGuides.editor.subtitle')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="mt-2">
                    <TabsList className="grid grid-cols-7 w-full text-[11px]">
                        {TABS.map(key => (
                            <TabsTrigger key={key} value={key} className="text-[11px] gap-1">
                                {errorTabs.has(key) && (
                                    <AlertTriangle className="h-2.5 w-2.5 text-destructive" aria-hidden />
                                )}
                                {t(`directory.styleGuides.editor.tabs.${key}`)}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="datos" className="mt-4">
                        <DatosTab
                            displayName={displayName}
                            version={version}
                            onDisplayName={setDisplayName}
                            onVersion={setVersion}
                            disabled={saving}
                        />
                    </TabsContent>

                    {!draft ? (
                        <ManifestEmpty guide={guide} />
                    ) : (
                        <>
                            <TabsContent value="footnotes" className="mt-4">
                                <FootnotesTab
                                    value={draft.footnotes}
                                    onChange={(footnotes) => setDraft({ ...draft, footnotes })}
                                    issues={issues}
                                    disabled={saving}
                                />
                            </TabsContent>
                            <TabsContent value="bibliography" className="mt-4">
                                <BibliographyTab
                                    value={draft.bibliography}
                                    onChange={(bibliography) => setDraft({ ...draft, bibliography })}
                                    issues={issues}
                                    disabled={saving}
                                />
                            </TabsContent>
                            <TabsContent value="quotations" className="mt-4">
                                <QuotationsTab
                                    value={draft.quotations}
                                    onChange={(quotations) => setDraft({ ...draft, quotations })}
                                    issues={issues}
                                    disabled={saving}
                                />
                            </TabsContent>
                            <TabsContent value="transliteration" className="mt-4">
                                <TransliterationTab
                                    value={draft.transliteration}
                                    onChange={(transliteration) => setDraft({ ...draft, transliteration })}
                                    issues={issues}
                                    disabled={saving}
                                />
                            </TabsContent>
                            <TabsContent value="cover" className="mt-4">
                                <CoverTab
                                    value={draft.cover ?? null}
                                    onChange={(cover) => setDraft({ ...draft, cover })}
                                    issues={issues}
                                    disabled={saving}
                                />
                            </TabsContent>
                            <TabsContent value="additional" className="mt-4">
                                <AdditionalRulesTab
                                    value={draft.additionalRules}
                                    onChange={(additionalRules) => setDraft({ ...draft, additionalRules })}
                                    issues={issues}
                                    disabled={saving}
                                />
                            </TabsContent>
                        </>
                    )}
                </Tabs>

                {hasErrors && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 mt-4">
                        <p className="text-[11px] text-destructive font-medium inline-flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            {t('directory.styleGuides.editor.hasErrors')}
                        </p>
                    </div>
                )}

                <footer className="flex items-center justify-between pt-4 mt-4 border-t border-border">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                        className="text-xs"
                    >
                        {t('setup.cancel')}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSubmit}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                    >
                        {saving ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden />
                        ) : (
                            <Save className="h-3 w-3 mr-1" aria-hidden />
                        )}
                        {t('directory.styleGuides.edit.save')}
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────

function DatosTab({
    displayName,
    version,
    onDisplayName,
    onVersion,
    disabled,
}: {
    displayName: string;
    version: string;
    onDisplayName: (v: string) => void;
    onVersion: (v: string) => void;
    disabled: boolean;
}) {
    const { t } = useTranslation('exegesis');
    return (
        <section className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                    {t('directory.styleGuides.edit.nameLabel')}
                </label>
                <input
                    type="text"
                    value={displayName}
                    onChange={(e) => onDisplayName(e.target.value)}
                    disabled={disabled}
                    className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                    {t('directory.styleGuides.edit.versionLabel')}
                </label>
                <input
                    type="text"
                    value={version}
                    onChange={(e) => onVersion(e.target.value)}
                    placeholder={t('directory.styleGuides.versionPlaceholder')}
                    disabled={disabled}
                    className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-50"
                />
            </div>
        </section>
    );
}

function ManifestEmpty({ guide }: { guide: UserStyleGuide }) {
    const { t, i18n } = useTranslation('exegesis');
    const { extractManifest } = useUserStyleGuides();

    const handleExtract = async () => {
        const language = i18n.language?.split('-')[0] === 'en' ? 'en' : 'es';
        try {
            await extractManifest.mutateAsync({ guideId: guide.id, language });
            toast.success(t('directory.styleGuides.toast.manifestExtracted'));
        } catch (err: any) {
            console.error('[exegesis] extract manifest failed:', err);
            const isOverload = err?.isExegesisOverload === true;
            const corpusEmpty = typeof err?.message === 'string' && err.message.includes('no extracted text');
            toast.error(
                isOverload
                    ? t('directory.styleGuides.toast.manifestExtractOverloaded')
                    : corpusEmpty
                        ? t('directory.styleGuides.toast.manifestExtractCorpusNotReady')
                        : t('directory.styleGuides.toast.manifestExtractFailed'),
            );
        }
    };

    return (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
                {t('directory.styleGuides.edit.manifestEmpty')}
            </p>
            <Button
                type="button"
                onClick={handleExtract}
                disabled={extractManifest.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
            >
                {extractManifest.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5" />}
                {extractManifest.isPending
                    ? t('directory.styleGuides.edit.extractingNow')
                    : t('directory.styleGuides.edit.extractNowCta')}
            </Button>
        </div>
    );
}

/**
 * Maps validation paths to the tab they belong to so the tab trigger
 * can show an alert glyph next to its label. Cheap heuristic — uses
 * the first segment of the path.
 */
function collectErrorTabs(issues: ReadonlyArray<StyleManifestValidationIssue>): Set<TabKey> {
    const out = new Set<TabKey>();
    for (const issue of issues) {
        if (issue.severity !== 'error') continue;
        const segment = issue.path.split('.')[0];
        switch (segment) {
            case 'footnotes': out.add('footnotes'); break;
            case 'bibliography': out.add('bibliography'); break;
            case 'quotations': out.add('quotations'); break;
            case 'transliteration': out.add('transliteration'); break;
            case 'cover': out.add('cover'); break;
            case 'additionalRules': out.add('additional'); break;
        }
    }
    return out;
}
