import { useEffect, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import type { ExegeticalStep } from '@dosfilos/domain';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QuickHintChips } from '@/components/exegesis/QuickHintChips';
import { useTranslation } from '@/i18n';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Rótulo del paso, para que el diálogo diga cuál se regenera. */
    stepLabel: string;
    stepKind: ExegeticalStep['kind'];
    /**
     * `true` cuando lo que se va a rehacer es el ANÁLISIS canónico del
     * versículo, que es lo caro: la prosa compuesta y las citas verificadas
     * de la versión actual quedan atrás.
     */
    redoesAnalysis: boolean;
    isPending: boolean;
    onRegenerate: (hint: string | undefined) => void;
}

/**
 * Regenerar un paso, con indicación opcional.
 *
 * Reemplaza a dos botones hermanos —«Regenerar» y «Hint y regenerar»— que
 * llamaban a la MISMA función y se distinguían sólo por un argumento
 * opcional. El segundo además no regeneraba nada: abría un campo de texto, y
 * el botón que sí ejecutaba quedaba apagado hasta escribir en él. Un
 * parámetro opcional ascendido a acción hermana, y una acción que no actuaba.
 *
 * El patrón es el que la misma tarjeta ya usaba bien en «Recomponer prosa»:
 * una acción, y su variante adentro.
 *
 * La indicación es OPCIONAL a propósito. Regenerar sin decir nada no devuelve
 * lo mismo que la vez anterior: aplica las reglas vigentes de la entrega —la
 * extensión que reparte la rúbrica, la forma de cita que pide el encuadre y
 * la pregunta que le toca a esta sección—, que es justo lo que hay que hacer
 * después de cambiar cualquiera de las tres.
 */
export function RegenerateStepDialog({
    open, onOpenChange, stepLabel, stepKind, redoesAnalysis, isPending, onRegenerate,
}: Props) {
    const { t } = useTranslation('exegesis');
    const [hint, setHint] = useState('');

    useEffect(() => {
        if (open) setHint('');
    }, [open]);

    const lanzar = () => onRegenerate(hint.trim() || undefined);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('detail.steps.regenerate.title', { step: stepLabel })}</DialogTitle>
                    <DialogDescription>
                        {t(redoesAnalysis
                            ? 'detail.steps.regenerate.analysisWarning'
                            : 'detail.steps.regenerate.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <QuickHintChips stepKind={stepKind} onPick={setHint} disabled={isPending} />

                    <div className="space-y-1">
                        <label htmlFor="regen-hint" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                            {t('detail.steps.regenerate.hintLabel')}
                        </label>
                        <textarea
                            id="regen-hint"
                            value={hint}
                            onChange={e => setHint(e.target.value)}
                            rows={3}
                            disabled={isPending}
                            placeholder={t('detail.steps.hintPlaceholder')}
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                        />
                        <p className="text-[11px] text-muted-foreground">{t('detail.steps.regenerate.hintOptional')}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
                        {t('setup.cancel')}
                    </Button>
                    <Button type="button" onClick={lanzar} disabled={isPending}>
                        {isPending
                            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                        {t(isPending ? 'detail.steps.action.regenerating' : 'detail.steps.regenerate.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
