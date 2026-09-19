import { Loader2, PenLine, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { useLibrary } from '@/hooks/library';
import { useAcademicVoiceProfile, useSetAcademicVoiceResource } from '@/hooks/exegesis/useAcademicVoiceProfile';

/**
 * Qué texto propio enseña cómo escribe el autor.
 *
 * El trabajo de Salmo 23:1–3 salió correcto y ajeno: su autor lo leyó y
 * fue cambiando palabras que no eran suyas. El glosario cierra las peores
 * una a una; esto ataca el registro —largo de frase, conectores, cuánto
 * matiza—, y para eso hace falta prosa suya.
 *
 * Lo pide explícitamente porque el sistema NO puede saber quién escribió
 * un PDF. Si se eligiera el comentario de Ross, el trabajo saldría
 * sonando a Ross y con su firma: por eso el texto de la tarjeta dice «un
 * texto escrito por ti» y no «un texto de referencia».
 */
export function AcademicVoiceCard() {
    const { t } = useTranslation('exegesis');
    const { resources } = useLibrary();
    const { profile } = useAcademicVoiceProfile();
    const setResource = useSetAcademicVoiceResource();

    const elegido = resources.find(r => r.id === profile?.resourceId) ?? null;

    const cambiar = async (resourceId: string) => {
        const recurso = resources.find(r => r.id === resourceId);
        try {
            await setResource.mutateAsync({ resourceId: resourceId || null, resourceTitle: recurso?.title });
            toast.success(resourceId ? t('paperSetup.voice.saved') : t('paperSetup.voice.cleared'));
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el perfil de voz:', err);
            toast.error(t('paperSetup.voice.saveFailed'));
        }
    };

    return (
        <section className="rounded-2xl border border-border bg-card p-4 mb-6 space-y-3">
            <header className="flex items-start gap-3">
                <PenLine className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{t('paperSetup.voice.heading')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('paperSetup.voice.description')}</p>
                </div>
                {setResource.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </header>

            <div className="pl-7 space-y-2">
                {elegido ? (
                    <p className="flex items-center gap-2 text-xs text-foreground">
                        <span className="truncate">{elegido.title}</span>
                        <button
                            type="button"
                            onClick={() => cambiar('')}
                            disabled={setResource.isPending}
                            aria-label={t('paperSetup.voice.clear')}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </p>
                ) : (
                    <select
                        value=""
                        onChange={e => cambiar(e.target.value)}
                        disabled={setResource.isPending || resources.length === 0}
                        aria-label={t('paperSetup.voice.heading')}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                        <option value="">{t('paperSetup.voice.pick')}</option>
                        {resources.map(r => (
                            <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                    </select>
                )}
                <p className="text-[11px] text-muted-foreground">{t('paperSetup.voice.warning')}</p>
            </div>
        </section>
    );
}
