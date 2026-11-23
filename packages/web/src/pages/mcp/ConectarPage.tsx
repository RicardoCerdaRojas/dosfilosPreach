import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Search, BookOpen, FileText, X } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { guardarSolicitudPendiente } from '@/lib/conexionMcp';
import { useResolverSolicitud, useSolicitudDeConexion } from '@/hooks/mcp/useConexionesMcp';

/**
 * Consentimiento de una aplicación que se conecta por MCP (fase «Asistente
 * del corpus», A9). Llega aquí desde el servidor de autorización; si no hay
 * sesión, se recuerda la solicitud y se vuelve tras el login. Lo que se
 * concede es solo lectura, y se puede desconectar en Configuración.
 */
export function ConectarPage() {
    const { t } = useTranslation('settings');
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const solicitud = params.get('solicitud');
    const { user, loading } = useFirebase();
    const datos = useSolicitudDeConexion(solicitud, !!user);
    const resolver = useResolverSolicitud(solicitud);
    const [volviendo, setVolviendo] = useState(false);

    const decidir = async (aprobar: boolean) => {
        try {
            const destino = await resolver.mutateAsync(aprobar);
            setVolviendo(true);
            window.location.assign(destino);
        } catch {
            /* el mensaje sale de `resolver.isError` */
        }
    };

    if (!solicitud) return <AuthLayout title={t('mcp.consent.missing')}>{null}</AuthLayout>;
    if (loading || (user && datos.isLoading)) {
        return (
            <AuthLayout title={t('mcp.consent.loading')}>
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            </AuthLayout>
        );
    }
    if (!user) {
        return (
            <AuthLayout title={t('mcp.consent.loginTitle')} subtitle={t('mcp.consent.loginBody')}>
                <Button className="h-11 w-full" onClick={() => { guardarSolicitudPendiente(solicitud); navigate('/login'); }}>
                    {t('mcp.consent.login')}
                </Button>
            </AuthLayout>
        );
    }
    if (datos.isError || !datos.data) return <AuthLayout title={t('mcp.consent.expired')}>{null}</AuthLayout>;

    const { cliente, destino } = datos.data;
    if (volviendo) {
        return (
            <AuthLayout title={t('mcp.consent.returning', { destino })}>
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            </AuthLayout>
        );
    }
    const permisos = [
        { icono: Search, texto: t('mcp.consent.permSearch') },
        { icono: BookOpen, texto: t('mcp.consent.permRead') },
        { icono: FileText, texto: t('mcp.consent.permWorks') },
    ];
    return (
        <AuthLayout title={t('mcp.consent.title', { cliente })} subtitle={t('mcp.consent.subtitle', { cliente })}>
            <div className="space-y-6">
                {/* Quién recibe el acceso, antes que nada: un tercero puede registrarse con el nombre «Claude», no con su sitio. */}
                <div className="rounded-md border border-warning/40 bg-warning-subtle px-3 py-2.5 text-sm text-warning-subtle-foreground">
                    <p className="font-semibold">{t('mcp.consent.returnsTo', { destino })}</p>
                    <p className="mt-1">{t('mcp.consent.warning', { cliente, destino })}</p>
                </div>
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground">{t('mcp.consent.permissionsTitle')}</p>
                    <ul className="space-y-2.5">
                        {permisos.map(({ icono: Icono, texto }) => (
                            <li key={texto} className="flex gap-3 text-sm text-foreground">
                                <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                                <span>{texto}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">{t('mcp.consent.cannot')}</p>
                </div>
                {resolver.isError && <p role="alert" className="text-sm text-destructive">{t('mcp.consent.failed')}</p>}
                <div className="flex flex-col gap-2 sm:flex-row-reverse">
                    <Button className="h-11 flex-1" onClick={() => void decidir(true)} disabled={resolver.isPending}>
                        {resolver.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Check className="mr-2 h-4 w-4" aria-hidden />}
                        {t('mcp.consent.allow')}
                    </Button>
                    <Button variant="outline" className="h-11 flex-1" onClick={() => void decidir(false)} disabled={resolver.isPending}>
                        <X className="mr-2 h-4 w-4" aria-hidden />{t('mcp.consent.deny')}
                    </Button>
                </div>
            </div>
        </AuthLayout>
    );
}
