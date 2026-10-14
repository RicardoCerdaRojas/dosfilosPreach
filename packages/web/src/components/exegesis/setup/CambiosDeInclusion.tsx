import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPassageReference, type InclusionChange } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useExegesisPapers } from '@/hooks/exegesis/useExegesisPapers';

/**
 * Después de guardar el encuadre: qué secciones entran o salen del documento
 * por lo que cambió. Lo decide el estudiante; nada se mueve solo (TP #7, #14
 * y #16).
 */
export function CambiosDeInclusion({ paperId, cambios, onDone }: {
    paperId: string;
    cambios: ReadonlyArray<InclusionChange>;
    onDone: () => void;
}) {
    const { t, i18n } = useTranslation('exegesis');
    const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
    const { setStepInclusion } = useExegesisPapers();
    const [aplicando, setAplicando] = useState(false);

    const nombre = (c: InclusionChange) => c.verseRef
        ? formatPassageReference(c.verseRef, lang)
        : t(`detail.steps.kind.${c.kind}`);

    const aplicar = async () => {
        setAplicando(true);
        try {
            for (const c of cambios) {
                await setStepInclusion.mutateAsync({ paperId, stepId: c.stepId, include: c.include });
            }
            toast.success(t('paperSetup.brief.inclusion.applied', { count: cambios.length }));
            onDone();
        } catch (err) {
            console.error('[exegesis] no se pudo cambiar la inclusión:', err);
            toast.error(t('paperSetup.brief.inclusion.failed'));
        } finally {
            setAplicando(false);
        }
    };

    return (
        <div className="space-y-3" role="region" aria-label={t('paperSetup.brief.inclusion.title')}>
            <p className="text-sm font-medium text-foreground">{t('paperSetup.brief.inclusion.title')}</p>
            <ul className="space-y-1.5">
                {cambios.map(c => (
                    <li key={c.stepId} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                        {t(c.include ? 'paperSetup.brief.inclusion.enters' : 'paperSetup.brief.inclusion.leaves', { name: nombre(c) })}
                    </li>
                ))}
            </ul>
            <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={aplicando}>
                    {t('paperSetup.brief.inclusion.keep')}
                </Button>
                <Button type="button" size="sm" onClick={aplicar} disabled={aplicando}>
                    {aplicando && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                    {t('paperSetup.brief.inclusion.apply')}
                </Button>
            </div>
        </div>
    );
}
