import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ExegeticalPaper } from '@dosfilos/domain';
import { hasCover } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useSaveWorkProfile, useWorkProfiles } from '@/hooks/exegesis/useWorkProfiles';

/**
 * Después de guardar la portada, ofrece guardarla en un perfil para los
 * trabajos que vienen. Sólo cuando ningún perfil la tiene todavía: el
 * fundador no sabía que los perfiles existían, y nunca creó uno.
 *
 * El perfil nace por defecto si es el primero, para que el trabajo siguiente
 * nazca ya con la portada.
 */
export function SaveCoverAsProfileOffer({ paper, onDone }: { paper: ExegeticalPaper; onDone: () => void }) {
    const { t } = useTranslation('exegesis');
    const { profiles } = useWorkProfiles();
    const save = useSaveWorkProfile();

    if (!hasCover(paper.cover) || profiles.some(p => hasCover(p.cover))) return null;

    const guardar = async () => {
        try {
            await save.mutateAsync({
                paperId: paper.id,
                displayName: paper.cover?.institution?.trim() || t('paperSetup.cover.profileDefaultName'),
                makeDefault: profiles.length === 0,
            });
            toast.success(t('paperSetup.cover.profileSaved'));
            onDone();
        } catch (err) {
            console.error('[exegesis] no se pudo guardar el perfil desde la portada:', err);
            toast.error(t('paperSetup.cover.profileSaveFailed'));
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
            <span className="flex-1 min-w-0">{t('paperSetup.cover.offerProfile')}</span>
            <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={save.isPending}>
                {t('paperSetup.cover.offerProfileDismiss')}
            </Button>
            <Button type="button" size="sm" onClick={guardar} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {t('paperSetup.cover.offerProfileCta')}
            </Button>
        </div>
    );
}
