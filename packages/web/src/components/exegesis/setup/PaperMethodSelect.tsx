import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exegesisService } from '@dosfilos/application';
import type { ExegeticalMethod, ExegeticalPaper } from '@dosfilos/domain';
import { useFirebase } from '@/context/firebase-context';
import { useTranslation } from '@/i18n';
import { MethodPicker } from '../MethodPicker';

/**
 * El método de un trabajo ya creado, desde la cabecera del setup. Rige para
 * los análisis que se generen desde ahora; los aceptados no cambian.
 */
export function PaperMethodSelect({ paper }: { paper: ExegeticalPaper }) {
    const { t } = useTranslation('exegesis');
    const { user } = useFirebase();
    const queryClient = useQueryClient();
    const cambiar = useMutation({
        mutationFn: async (method: ExegeticalMethod | null) => {
            if (!user) throw new Error('No authenticated user');
            return exegesisService.updatePaperMethod.execute({ ownerId: user.uid, paperId: paper.id, method });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exegesis', 'papers', user?.uid] }),
        onError: err => {
            console.error('[exegesis] update method failed:', err);
            toast.error(t('method.saveFailed'));
        },
    });
    return (
        <MethodPicker
            id={`paper-method-${paper.id}`}
            compact
            value={paper.exegeticalMethod}
            disabled={cambiar.isPending}
            onChange={m => cambiar.mutate(m)}
        />
    );
}
