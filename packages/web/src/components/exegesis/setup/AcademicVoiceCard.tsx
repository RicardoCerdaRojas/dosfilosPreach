import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PenLine, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { useLibrary } from '@/hooks/library';
import {
    useAcademicVoiceProfile,
    useSetAcademicVoiceResource,
    useSetUseSermons,
} from '@/hooks/exegesis/useAcademicVoiceProfile';
import { useUploadOwnText } from '@/hooks/exegesis/useUploadOwnText';
import { Button } from '@/components/ui/button';

/**
 * De qué texto propio aprende el sistema a escribir como el autor.
 *
 * Es configuración DE LA PERSONA y no del trabajo —su registro es el
 * mismo en todas sus entregas—, y por eso vive en los ajustes. La primera
 * versión la puso dentro de la configuración de un trabajo, y desde ahí
 * parecía que había que repetirla en cada uno.
 *
 * El selector sólo ofrece textos que el autor marcó como escritos por él.
 * Antes ofrecía la biblioteca entera —comentarios, léxicos, gramáticas—,
 * que es justo lo que NO debe entrar: aprender de Ross devuelve prosa de
 * Ross con la firma del estudiante.
 */
export function AcademicVoiceCard() {
    const { t } = useTranslation('exegesis');
    const { resources } = useLibrary();
    const { profile } = useAcademicVoiceProfile();
    const setResource = useSetAcademicVoiceResource();
    const setSermons = useSetUseSermons();
    const subir = useUploadOwnText();
    const inputArchivo = useRef<HTMLInputElement>(null);

    const propios = resources.filter(r => (r as { authoredByUser?: boolean }).authoredByUser === true);
    const elegido = resources.find(r => r.id === profile?.resourceId) ?? null;
    const guardando = setResource.isPending || setSermons.isPending || subir.isUploading;

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

    /**
     * Sube el texto y lo deja elegido de una vez. Se avisa que hay que
     * esperar la extracción: hasta que termine no hay prosa que muestrear,
     * y sin decirlo el usuario creería que ya está aprendiendo de él.
     */
    const subirYElegir = async (file: File) => {
        try {
            const recurso = await subir.upload(file);
            await setResource.mutateAsync({ resourceId: recurso.id, resourceTitle: recurso.title });
            toast.success(t('paperSetup.voice.uploaded'));
        } catch (err) {
            console.error('[exegesis] no se pudo subir el texto propio:', err);
            toast.error(t('paperSetup.voice.uploadFailed'));
        }
    };

    const alternarSermones = async (usar: boolean) => {
        try {
            await setSermons.mutateAsync(usar);
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el perfil de voz:', err);
            toast.error(t('paperSetup.voice.saveFailed'));
        }
    };

    return (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <header className="flex items-start gap-3">
                <PenLine className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{t('paperSetup.voice.heading')}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('paperSetup.voice.description')}</p>
                </div>
                {guardando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </header>

            <div className="pl-7 space-y-3">
                <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {t('paperSetup.voice.ownTextLabel')}
                    </p>
                    {elegido ? (
                        <p className="flex items-center gap-2 text-xs text-foreground">
                            <span className="truncate">{elegido.title}</span>
                            <button
                                type="button"
                                onClick={() => cambiar('')}
                                disabled={guardando}
                                aria-label={t('paperSetup.voice.clear')}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </p>
                    ) : propios.length > 0 ? (
                        <select
                            value=""
                            onChange={e => cambiar(e.target.value)}
                            disabled={guardando}
                            aria-label={t('paperSetup.voice.ownTextLabel')}
                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="">{t('paperSetup.voice.pick')}</option>
                            {propios.map(r => (
                                <option key={r.id} value={r.id}>{r.title}</option>
                            ))}
                        </select>
                    ) : (
                        <p className="text-xs text-muted-foreground">{t('paperSetup.voice.noOwnTexts')}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                            ref={inputArchivo}
                            type="file"
                            accept=".pdf,.docx,.txt,.md"
                            className="hidden"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (file) void subirYElegir(file);
                            }}
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => inputArchivo.current?.click()}
                            disabled={guardando}
                        >
                            {subir.isUploading
                                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                            {subir.isUploading
                                ? t('paperSetup.voice.uploading', { percent: Math.round(subir.progress ?? 0) })
                                : t('paperSetup.voice.upload')}
                        </Button>
                        <Link to="/dashboard/library" className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground">
                            {t('paperSetup.voice.goToLibrary')}
                        </Link>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t('paperSetup.voice.uploadHint')}</p>
                </div>

                <label className="flex items-start gap-2 text-xs text-foreground">
                    <input
                        type="checkbox"
                        checked={profile?.useSermons === true}
                        onChange={e => alternarSermones(e.target.checked)}
                        disabled={guardando}
                        className="mt-0.5"
                    />
                    <span>
                        {t('paperSetup.voice.useSermons')}
                        <span className="block text-[11px] text-muted-foreground">{t('paperSetup.voice.useSermonsHint')}</span>
                    </span>
                </label>

                <p className="text-[11px] text-muted-foreground">{t('paperSetup.voice.warning')}</p>
            </div>
        </section>
    );
}
