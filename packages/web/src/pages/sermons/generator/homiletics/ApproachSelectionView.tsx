/**
 * Paso 2a de Homilética: elegir el enfoque.
 *
 * Rediseño de #31 (ejercicio de Jonás 4:5-11, «todo muy apretado y mal
 * diseñado»): los enfoques iban en una columna angosta con scroll propio y una
 * ayuda genérica fija ocupaba el 60% de la pantalla. Ahora:
 *
 *   - Las tarjetas van en grilla, a todo el ancho, para compararlas.
 *   - La idea central del pastor va arriba UNA vez: los enfoques cambian el
 *     camino, no la tesis, y la tesis no la origina el asistente (P2).
 *   - La ayuda se abre a pedido en «¿Cómo elegir?».
 *   - El enfoque elegido y «Desarrollar» quedan en una barra fija abajo.
 */

import { useState } from 'react';
import type { HomileticalApproachPreview } from '@dosfilos/domain';
import { ChevronDown, Loader2, Quote, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApproachCard } from '@/components/homiletics/ApproachCard';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ApproachSelectionHelp } from './ApproachSelectionHelp';

interface ApproachSelectionViewProps {
    previews: HomileticalApproachPreview[];
    selectedId: string | undefined;
    onSelect: (id: string) => void;
    onConfirm: () => void;
    onRegenerate: () => void;
    developing: boolean;
    regenerating: boolean;
    /** La idea central que el pastor escribió en el Insight, si la hay. */
    thesis?: string;
}

export function ApproachSelectionView({
    previews,
    selectedId,
    onSelect,
    onConfirm,
    onRegenerate,
    developing,
    regenerating,
    thesis,
}: ApproachSelectionViewProps) {
    const { t } = useTranslation('generator');
    const [helpOpen, setHelpOpen] = useState(false);
    const selected = previews.find(p => p.id === selectedId);
    const k = (key: string) => `homiletics.selection.${key}`;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="mx-auto max-w-6xl px-1 pb-6 space-y-5">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <h2 className="flex items-center gap-2 text-2xl font-semibold">
                                <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                                {t(k('title'))}
                            </h2>
                            <p className="text-sm text-muted-foreground">{t(k('desc'), { count: previews.length })}</p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" disabled={developing || regenerating}>
                                    {regenerating ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                    )}
                                    {t(k(regenerating ? 'regenerating' : 'regenerate'))}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t(k('regenerateConfirmTitle'))}</AlertDialogTitle>
                                    <AlertDialogDescription>{t(k('regenerateConfirmDesc'))}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t(k('cancel'))}</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={onRegenerate}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {t(k('confirm'))}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </header>

                    {thesis?.trim() && (
                        <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                                <Quote className="h-3.5 w-3.5" aria-hidden />
                                {t(k('thesisLabel'))}
                            </p>
                            <p className="mt-1.5 font-serif text-base leading-relaxed">{thesis.trim()}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{t(k('thesisNote'))}</p>
                        </section>
                    )}

                    <div>
                        <button
                            type="button"
                            onClick={() => setHelpOpen(v => !v)}
                            aria-expanded={helpOpen}
                            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                            <ChevronDown className={cn('h-4 w-4 transition-transform', helpOpen && 'rotate-180')} />
                            {t(k('helpToggle'))}
                        </button>
                        {helpOpen && <ApproachSelectionHelp />}
                    </div>

                    <div
                        role="radiogroup"
                        aria-label={t(k('groupLabel'))}
                        className="grid grid-cols-1 gap-4 md:grid-cols-2"
                    >
                        {previews.map(preview => (
                            <ApproachCard
                                key={preview.id}
                                approach={preview}
                                isSelected={selectedId === preview.id}
                                onSelect={() => onSelect(preview.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-1 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 text-sm" aria-live="polite">
                        {selected ? (
                            <p className="truncate">
                                <span className="text-muted-foreground">{t(k('chosen'))}: </span>
                                <span className="font-medium capitalize">{selected.type}</span>
                                <span className="text-muted-foreground"> · {selected.direction}</span>
                            </p>
                        ) : (
                            <p className="text-muted-foreground">{t(k('none'))}</p>
                        )}
                    </div>
                    <Button onClick={onConfirm} disabled={!selected || developing} className="sm:w-auto w-full">
                        {developing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {t(k(developing ? 'developing' : 'develop'))}
                    </Button>
                </div>
            </div>
        </div>
    );
}
