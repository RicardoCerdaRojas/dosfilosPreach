import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exegesisService } from '@dosfilos/application';
import { readPaperProfileKind, type ExegeticalPaper, type PaperProfileKind } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { ProfileKindPicker } from '../ProfileKindPicker';

/**
 * El tipo de un trabajo ya creado, desde la cabecera del setup. En los
 * trabajos de antes de A4 el tipo se deduce y se marca «sin confirmar»: el
 * autor lo confirma una vez, o elige otro.
 */
export function PaperProfileKindSelect({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const lectura = readPaperProfileKind(paper);
    const guardar = useMutation({
        mutationFn: async (profileKind: PaperProfileKind) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.updatePaperProfileKind.execute({ ownerId: user.uid, paperId: paper.id, profileKind });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] }),
        onError: err => {
            console.error('[exegesis] update profile kind failed:', err);
            toast.error(t('profileKind.saveFailed'));
        },
    });
    return (
        <div className="inline-flex items-center gap-1.5" data-testid="paper-profile-kind">
            <ProfileKindPicker
                id={`paper-profile-kind-${paper.id}`}
                compact
                value={lectura.kind}
                inferredReason={lectura.reason}
                disabled={guardar.isPending}
                onChange={k => guardar.mutate(k)}
            />
            {lectura.inferred && (
                <button
                    type="button"
                    onClick={() => guardar.mutate(lectura.kind)}
                    disabled={guardar.isPending}
                    title={t(`profileKind.inferred.${lectura.reason}`)}
                    className="h-8 rounded-md border border-primary/40 bg-primary/10 px-2 text-xs font-medium text-foreground hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                >
                    {t('profileKind.confirm')}
                </button>
            )}
        </div>
    );
}
