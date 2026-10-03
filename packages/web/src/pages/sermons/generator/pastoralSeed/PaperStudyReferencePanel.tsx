import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { PaperReferenceItem, PaperStudyReference, PastoralSeedStepKey, WordStudy } from '@dosfilos/domain';
import { AdaptWordStudyDialog } from './wordStudy/AdaptWordStudyDialog';

interface Props {
    reference: PaperStudyReference;
    stepKey: PastoralSeedStepKey;
    /** En el estudio de palabras: la palabra del paper abre el modal para adaptarla. */
    onAddWordStudy?: (study: WordStudy) => Promise<void>;
}

/**
 * Muestra, al lado del paso actual, lo que el paper exegético del pastor
 * ya estableció sobre este pasaje.
 *
 * Tres decisiones que definen el componente:
 *
 *   1. **Es consulta, no relleno.** Ningún texto de aquí se copia tal
 *      cual a los campos de la semilla. El pastor lo lee y escribe lo
 *      suyo — que es de lo que vive la métrica de autoría verbatim y,
 *      antes que eso, el sentido del estudio. La única puerta es el
 *      estudio de palabras (#28 del ejercicio de Jonás): la palabra abre
 *      un modal con la explicación entera para ADAPTARLA, y sólo pasa si
 *      el pastor la cambió (`adaptedDiscoveryState`).
 *
 *   2. **Empieza plegado.** Si el material se abriera solo, el paso
 *      arrancaría con la respuesta a la vista y la pregunta abajo. El
 *      pastor decide cuándo consultarlo, igual que decidiría abrir un
 *      comentario.
 *
 *   3. **No se renderiza cuando no hay nada.** Un panel vacío que dice
 *      "tu paper no aportó nada a este paso" es ruido; los pasos
 *      `function`, `timelessPrinciple` e `insight` nunca reciben
 *      material a propósito, y ahí el silencio es la respuesta correcta.
 */
export function PaperStudyReferencePanel({ reference, stepKey, onAddWordStudy }: Props) {
    const { t } = useTranslation('generator');
    const { t: tw } = useTranslation('wordStudy');
    const [open, setOpen] = useState(false);
    const [adapting, setAdapting] = useState<NonNullable<PaperReferenceItem['wordStudySeed']> | null>(null);

    const items = reference.byStep[stepKey] ?? [];
    if (items.length === 0) return null;

    return (
        <div className="rounded-lg border border-warning/30 bg-warning/5 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-warning/10 transition-colors"
            >
                <FileText className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                <span className="flex-1 text-sm font-medium text-foreground">
                    {t('paperReference.title', {
                        paperTitle: reference.paperTitle,
                        count: items.length,
                    })}
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-warning transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>

            {open && (
                <div className="px-3 pb-3 space-y-3">
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {t('paperReference.disclaimer')}
                    </p>
                    <ul className="space-y-2.5">
                        {items.map((item, i) => (
                            <li
                                key={`${item.verseLabel}-${item.label}-${i}`}
                                className="rounded-md bg-background/70 border border-warning/20 px-3 py-2"
                            >
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    {item.wordStudySeed && onAddWordStudy ? (
                                        <button
                                            type="button"
                                            onClick={() => setAdapting(item.wordStudySeed!)}
                                            title={tw('fromPaper.wordHint', { word: item.wordStudySeed.word })}
                                            className="text-xs font-semibold text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
                                        >
                                            {item.label}
                                        </button>
                                    ) : (
                                        <span className="text-xs font-semibold text-foreground">
                                            {item.label}
                                        </span>
                                    )}
                                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {item.verseLabel}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                                    {item.detail}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {adapting && onAddWordStudy && (
                <AdaptWordStudyDialog seed={adapting} onClose={() => setAdapting(null)} onAdd={onAddWordStudy} />
            )}
        </div>
    );
}
