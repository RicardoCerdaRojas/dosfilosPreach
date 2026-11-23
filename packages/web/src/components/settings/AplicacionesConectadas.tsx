import { Copy, Loader2, PlugZap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFirebase } from '@/context/firebase-context';
import { useConfirm } from '@/hooks/useConfirm';
import { useConexionesMcp, useRevocarConexionMcp } from '@/hooks/mcp/useConexionesMcp';
import { useTranslation } from '@/i18n';
import { DIRECCION_DEL_SERVIDOR_MCP } from '@/lib/conexionMcp';

/**
 * Las aplicaciones conectadas por MCP (A9): qué pueden hacer (solo leer),
 * desde cuándo, y desconectarlas —corta sus tokens de inmediato—. También
 * la dirección del servidor para conectar una nueva.
 */
export function AplicacionesConectadas() {
    const { t, i18n } = useTranslation('settings');
    const { user } = useFirebase();
    const { confirm, confirmDialog } = useConfirm();
    const conexiones = useConexionesMcp(!!user);
    const revocar = useRevocarConexionMcp();

    const copiar = async () => {
        try { await navigator.clipboard.writeText(DIRECCION_DEL_SERVIDOR_MCP); toast.success(t('mcp.connections.copied')); } catch { /* sin portapapeles: la dirección está a la vista */ }
    };
    const desconectar = async (id: string, cliente: string) => {
        if (!await confirm({ title: t('mcp.connections.revokeTitle', { cliente }), body: t('mcp.connections.revokeConfirm'), confirmLabel: t('mcp.connections.revoke'), destructive: true })) return;
        try {
            await revocar.mutateAsync(id);
            toast.success(t('mcp.connections.revoked'));
        } catch {
            toast.error(t('mcp.connections.revokeFailed'));
        }
    };
    const fecha = (ms: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(ms));

    return (
        <Card className="overflow-hidden">
            <div className="flex items-start gap-3 border-b p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <PlugZap className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">{t('mcp.connections.title')}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t('mcp.connections.description')}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 text-xs text-foreground">{DIRECCION_DEL_SERVIDOR_MCP}</code>
                        <Button variant="ghost" size="sm" onClick={() => void copiar()} aria-label={t('mcp.connections.copy')}>
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                    </div>
                </div>
            </div>
            <div className="p-5">
                {conexiones.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                ) : conexiones.isError ? (
                    <p className="text-sm text-destructive">{t('mcp.connections.loadFailed')}</p>
                ) : !conexiones.data?.length ? (
                    <p className="text-sm text-muted-foreground">{t('mcp.connections.empty')}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {conexiones.data.map(c => (
                            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">{c.cliente}{c.destino ? <span className="font-normal text-muted-foreground"> · {c.destino}</span> : null}</p>
                                    <p className="text-xs text-muted-foreground">{t('mcp.connections.since', { fecha: fecha(c.creado) })} · {t('mcp.connections.readOnly')}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => void desconectar(c.id, c.cliente)} disabled={revocar.isPending}>
                                    {t('mcp.connections.revoke')}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {confirmDialog}
        </Card>
    );
}
