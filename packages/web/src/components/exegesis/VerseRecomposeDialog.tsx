import { useEffect, useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { estimateLength, type PaperFormatting } from '@dosfilos/domain';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Rótulo del verso, para que el diálogo diga cuál se recompone. */
    verseLabel: string;
    /** Prosa actual del verso; de ahí sale cuánto lleva escrito. */
    currentProse: string;
    /**
     * Palabras que le tocan a este verso según la rúbrica, repartidas
     * entre los versos del trabajo. `null` cuando el curso no declara
     * extensión: entonces no se propone ningún número.
     */
    suggestedWords: number | null;
    /**
     * El formato de la entrega. Decide cuántas palabras entran en la página,
     * y sin él el diálogo anunciaba el doble de páginas en un trabajo a
     * espacio simple.
     */
    formatting: PaperFormatting | null;
    isComposing: boolean;
    onRecompose: (guidance: string, targetWords: number | null) => void;
}

/**
 * Recomponer UN verso con instrucciones, sin tocar los demás.
 *
 * Nace de 23:2 y 23:3, que salieron como fichas mecánicas: la única
 * salida era recomponer el trabajo entero —caro, y reescribe lo que ya
 * estaba bien— o arreglarlo a mano fuera del producto. La instrucción es
 * obligatoria: sin decirle qué falta, el compositor devuelve lo mismo.
 */
export function VerseRecomposeDialog({ open, onOpenChange, verseLabel, currentProse, suggestedWords, formatting, isComposing, onRecompose }: Props) {
    const { t } = useTranslation('exegesis');
    const [guidance, setGuidance] = useState('');
    const [target, setTarget] = useState<string>('');

    useEffect(() => {
        if (!open) return;
        setGuidance('');
        setTarget(suggestedWords ? String(suggestedWords) : '');
    }, [open, suggestedWords]);

    const current = estimateLength(currentProse, formatting);
    const targetNumber = Number(target.trim());
    const validTarget = Number.isFinite(targetNumber) && targetNumber > 0 ? Math.round(targetNumber) : null;
    const ready = guidance.trim().length >= 10;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('canonical.recompose.title', { verse: verseLabel })}</DialogTitle>
                    <DialogDescription>{t('canonical.recompose.description')}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                        {t('canonical.recompose.current', { words: current.words, pages: current.estimatedPages })}
                    </p>

                    <div className="space-y-1">
                        <label htmlFor="recompose-guidance" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                            {t('canonical.recompose.guidanceLabel')}
                        </label>
                        <textarea
                            id="recompose-guidance"
                            value={guidance}
                            onChange={e => setGuidance(e.target.value)}
                            rows={4}
                            disabled={isComposing}
                            placeholder={t('canonical.recompose.guidancePlaceholder')}
                            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="recompose-target" className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                            {t('canonical.recompose.targetLabel')}
                        </label>
                        <input
                            id="recompose-target"
                            type="text"
                            inputMode="numeric"
                            value={target}
                            onChange={e => setTarget(e.target.value)}
                            disabled={isComposing}
                            placeholder={t('canonical.recompose.targetPlaceholder')}
                            className="w-28 rounded-md border border-border bg-card px-3 py-1.5 text-sm tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        />
                        <p className="text-[11px] text-muted-foreground">{t('canonical.recompose.targetHint')}</p>
                    </div>

                    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                        {t('canonical.recompose.safety')}
                    </p>
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isComposing}>
                        {t('canonical.recompose.cancel')}
                    </Button>
                    <Button type="button" onClick={() => onRecompose(guidance.trim(), validTarget)} disabled={!ready || isComposing}>
                        {isComposing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                        {t('canonical.recompose.submit')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
