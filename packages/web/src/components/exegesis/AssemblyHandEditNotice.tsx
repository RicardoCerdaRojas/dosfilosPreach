import { PencilLine } from 'lucide-react';
import { assemblyHandEdit } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';
import { useExegesisPaper } from '@/hooks/exegesis/useExegesisPaper';

/**
 * El ensamble tiene ediciones a mano (TP #9, B33). Volver a ensamblar las
 * pisaba sin aviso, y la edición no pasa por la verificación de citas: se
 * dice antes de que el autor vuelva a ensamblar, y mientras siga sin verificar.
 */
export function AssemblyHandEditNotice({ paperId }: { paperId: string }) {
    const { t } = useTranslation('exegesis');
    const { paper } = useExegesisPaper(paperId);
    const edicion = paper ? assemblyHandEdit(paper) : null;
    if (!edicion) return null;
    return (
        <div role="note" className="mb-3 rounded-lg border border-warning/40 bg-warning-subtle px-3 py-2.5 space-y-1">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-warning-subtle-foreground">
                <PencilLine className="h-3.5 w-3.5 text-warning" aria-hidden />
                {t('detail.steps.assembly.handEdit.title')}
            </p>
            <p className="text-[11px] leading-snug text-warning-subtle-foreground">{t('detail.steps.assembly.handEdit.body')}</p>
            {!edicion.verified && (
                <p className="text-[11px] font-medium leading-snug text-warning-subtle-foreground">{t('detail.steps.assembly.handEdit.unverified')}</p>
            )}
        </div>
    );
}
