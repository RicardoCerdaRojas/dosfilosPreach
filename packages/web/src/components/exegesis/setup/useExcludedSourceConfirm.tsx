import { useState, type ReactNode } from 'react';
import type { ExcludedSource } from '@dosfilos/domain';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTranslation } from '@/i18n';

/**
 * Agregar una fuente excluida pide confirmación, sin impedirlo: el sílabo
 * de otro curso podría permitirla, y quien decide es el estudiante.
 *
 * `guard(exclusiones, seguir)` corre `seguir` enseguida si no hay ninguna;
 * si hay, abre el diálogo y sólo sigue si se confirma.
 */
export function useExcludedSourceConfirm(): {
    guard: (hits: ReadonlyArray<ExcludedSource>, proceed: () => void) => void;
    dialog: ReactNode;
} {
    const { t } = useTranslation('exegesis');
    const [pending, setPending] = useState<{ hits: ReadonlyArray<ExcludedSource>; proceed: () => void } | null>(null);

    const guard = (hits: ReadonlyArray<ExcludedSource>, proceed: () => void) => {
        if (hits.length === 0) proceed();
        else setPending({ hits, proceed });
    };

    const dialog = (
        <ConfirmDialog
            open={pending !== null}
            onOpenChange={(open) => { if (!open) setPending(null); }}
            title={t('paperSetup.subSteps.corpus.excluded.confirmTitle')}
            body={t('paperSetup.subSteps.corpus.excluded.confirmBody', {
                count: pending?.hits.length ?? 1,
                sources: (pending?.hits ?? []).map(h => h.key).join(', '),
            })}
            confirmLabel={t('paperSetup.subSteps.corpus.excluded.confirmAdd')}
            cancelLabel={t('paperSetup.subSteps.corpus.excluded.confirmCancel')}
            destructive={false}
            onConfirm={() => {
                const p = pending;
                setPending(null);
                p?.proceed();
            }}
        />
    );

    return { guard, dialog };
}
