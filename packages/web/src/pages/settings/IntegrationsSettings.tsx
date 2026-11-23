import { useState, useEffect } from 'react';
import { useFirebase } from '@/context/firebase-context';
import { userIntegrationsService } from '@dosfilos/application';
import type { WordpressIntegration } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Globe, Loader2, CheckCircle2, AlertCircle, Trash2, Activity, Mail, Rss } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { useConfirm } from '@/hooks/useConfirm';
import { AplicacionesConectadas } from '@/components/settings/AplicacionesConectadas';

/**
 * Settings panel for 3rd-party integrations. v1 ships WordPress; the page is
 * structured so future integrations (Mailchimp, Substack, Beehiiv) drop in as
 * additional cards beside the placeholders below.
 *
 * WordPress card flow:
 *   1. Site URL
 *   2. WP username (or email)
 *   3. App password (generated in WP admin → Profile → Application Passwords).
 *      Stored per-user-Firestore-doc; revocable from WP side at any time.
 *   4. Default post status (draft = safest, recommended)
 *
 * Status pill shows last-publish or last-error so the user immediately knows
 * if the connection is healthy without sending a real post.
 */
export function IntegrationsSettings() {
    const { user } = useFirebase();
    const { t } = useTranslation('settings');
    const { confirm, confirmDialog } = useConfirm();
    const [config, setConfig] = useState<WordpressIntegration | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [siteUrl, setSiteUrl] = useState('');
    const [username, setUsername] = useState('');
    const [appPassword, setAppPassword] = useState('');
    const [defaultStatus, setDefaultStatus] = useState<'draft' | 'publish'>('draft');
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{
        ok: boolean;
        roles?: string[];
        canEditPosts?: boolean;
        message: string;
    } | null>(null);

    useEffect(() => {
        if (!user?.uid) return;
        let cancelled = false;
        userIntegrationsService.getWordpress(user.uid)
            .then(c => {
                if (cancelled) return;
                setConfig(c);
                if (c) {
                    setSiteUrl(c.siteUrl);
                    setUsername(c.username);
                    setAppPassword(c.appPassword);
                    setDefaultStatus(c.defaultStatus);
                }
            })
            .catch(err => {
                if (cancelled) return;
                toast.error(`Couldn't load WordPress config: ${err?.message ?? err}`);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [user?.uid]);

    const handleSave = async () => {
        if (!user?.uid) return;
        setSaving(true);
        try {
            await userIntegrationsService.saveWordpress(user.uid, {
                siteUrl: siteUrl.trim(),
                username: username.trim(),
                appPassword: appPassword.trim(),
                defaultStatus,
            });
            const fresh = await userIntegrationsService.getWordpress(user.uid);
            setConfig(fresh);
            toast.success(t('integrations.wordpress.saved'));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(t('integrations.wordpress.saveError', { message: msg }));
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const r = await userIntegrationsService.testWordpressConnection();
            if (r.ok && r.resolvedUser) {
                setTestResult({
                    ok: r.resolvedUser.canEditPosts,
                    roles: r.resolvedUser.roles,
                    canEditPosts: r.resolvedUser.canEditPosts,
                    message: r.resolvedUser.canEditPosts
                        ? `OK — autenticado como "${r.resolvedUser.name}" (${(r.resolvedUser.roles || []).join(', ')}). Puede crear posts.`
                        : `Auth OK pero el rol "${(r.resolvedUser.roles || []).join(', ')}" no puede crear posts. Asigna Author o superior en WP.`,
                });
            } else {
                setTestResult({
                    ok: false,
                    message: `${r.code ?? 'Error'}: ${r.message ?? 'Sin detalle'}`,
                });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setTestResult({ ok: false, message: msg });
        } finally {
            setTesting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!user?.uid) return;
        if (!await confirm({ body: t('integrations.wordpress.disconnectConfirm') })) return;
        try {
            await userIntegrationsService.deleteWordpress(user.uid);
            setConfig(null);
            setSiteUrl('');
            setUsername('');
            setAppPassword('');
            setDefaultStatus('draft');
            toast.success(t('integrations.wordpress.disconnected'));
        } catch (err) {
            toast.error(`Disconnect failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Intro — no duplicated H1; the parent Settings page already owns the page title.
                A short caption sets context for this tab specifically. */}
            <p className="text-sm text-muted-foreground">
                {t('integrations.subtitle')}
            </p>

            <AplicacionesConectadas />

            <Card className="overflow-hidden">
                {/* Card header strip — integration identity + status, no per-tab color tint */}
                <div className="flex items-start gap-3 p-5 border-b">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-semibold text-base">{t('integrations.wordpress.title')}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {t('integrations.wordpress.description')}
                        </p>
                    </div>
                    {config && <ConnectionStatusBadge config={config} />}
                </div>

                <div className="p-5 space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="wp-site">{t('integrations.wordpress.siteUrlLabel')}</Label>
                        <Input
                            id="wp-site"
                            type="url"
                            placeholder="https://miblog.com"
                            value={siteUrl}
                            onChange={e => setSiteUrl(e.target.value)}
                            disabled={saving}
                        />
                        <p className="text-xs text-muted-foreground">{t('integrations.wordpress.siteUrlHint')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="wp-user">{t('integrations.wordpress.usernameLabel')}</Label>
                            <Input
                                id="wp-user"
                                type="text"
                                placeholder="pastor.cerda"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                disabled={saving}
                                autoComplete="username"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="wp-status">{t('integrations.wordpress.defaultStatusLabel')}</Label>
                            <Select value={defaultStatus} onValueChange={v => setDefaultStatus(v as 'draft' | 'publish')}>
                                <SelectTrigger id="wp-status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">{t('integrations.wordpress.statusDraft')}</SelectItem>
                                    <SelectItem value="publish">{t('integrations.wordpress.statusPublish')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="wp-pass">{t('integrations.wordpress.appPasswordLabel')}</Label>
                        <Input
                            id="wp-pass"
                            type="password"
                            placeholder="aaaa bbbb cccc dddd eeee ffff"
                            value={appPassword}
                            onChange={e => setAppPassword(e.target.value)}
                            disabled={saving}
                            autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground">
                            {t('integrations.wordpress.appPasswordHint')}{' '}
                            <a
                                href="https://wordpress.org/documentation/article/application-passwords/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary/80"
                            >
                                {t('integrations.wordpress.howToGenerate')}
                            </a>
                        </p>
                    </div>

                    {config && (
                        <div className="space-y-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTest}
                                disabled={testing}
                                className="w-full"
                            >
                                {testing ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-2" />}
                                Probar conexión
                            </Button>
                            {testResult && (
                                <div className={cn(
                                    'text-xs p-3 rounded border',
                                    testResult.ok
                                        ? 'bg-success-subtle border-success/30 text-success-subtle-foreground'
                                        : 'bg-destructive/10 border-destructive/30 text-destructive'
                                )}>
                                    {testResult.message}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between p-4 border-t bg-muted/30">
                    {config ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={handleDisconnect}
                            disabled={saving}
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            {t('integrations.wordpress.disconnect')}
                        </Button>
                    ) : (
                        <span className="text-xs text-muted-foreground">{t('integrations.wordpress.notConnected')}</span>
                    )}
                    <Button onClick={handleSave} disabled={saving || !siteUrl.trim() || !username.trim() || !appPassword.trim()}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {config ? t('integrations.wordpress.saveChanges') : t('integrations.wordpress.connect')}
                    </Button>
                </div>
            </Card>

            {/* Future-integrations placeholders communicate roadmap without faking
                a button. Visually muted so they don't compete with the active WP card. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ComingSoonCard
                    icon={<Mail className="w-5 h-5 text-muted-foreground" />}
                    title="Mailchimp"
                    description={t('integrations.comingSoon.mailchimp')}
                />
                <ComingSoonCard
                    icon={<Rss className="w-5 h-5 text-muted-foreground" />}
                    title="Substack"
                    description={t('integrations.comingSoon.substack')}
                />
            </div>

            {confirmDialog}
        </div>
    );
}

function ConnectionStatusBadge({ config }: { config: WordpressIntegration }) {
    const { t } = useTranslation('settings');
    if (config.lastError) {
        return (
            <div className="inline-flex items-center gap-1.5 text-xs text-destructive shrink-0 px-2 py-1 rounded-full bg-destructive/10" title={config.lastError}>
                <AlertCircle className="w-3.5 h-3.5" />
                {t('integrations.wordpress.lastError')}
            </div>
        );
    }
    if (config.lastPublishedAt) {
        return (
            <div className="inline-flex items-center gap-1.5 text-xs text-success-subtle-foreground shrink-0 px-2 py-1 rounded-full bg-success-subtle">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('integrations.wordpress.connected')}
            </div>
        );
    }
    return (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 px-2 py-1 rounded-full bg-muted">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('integrations.wordpress.connectedNoPublishYet')}
        </div>
    );
}

function ComingSoonCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
    const { t } = useTranslation('settings');
    return (
        <Card className="p-4 bg-muted/30 border-dashed">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{title}</h3>
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-background border">
                            {t('integrations.comingSoon.badge')}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </div>
            </div>
        </Card>
    );
}
