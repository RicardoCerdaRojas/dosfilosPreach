import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wand2 } from 'lucide-react';
import {
    printedLabelForSheet,
    type LexiconSuggestion,
    type PageNumbering,
    type SuggestionReason,
} from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Props {
    suggestion: LexiconSuggestion;
    numbering: PageNumbering | null;
    printedPageOffset: number | null;
    onReplace: (sheets: ReadonlyArray<number>) => void;
    onAdd: (sheets: ReadonlyArray<number>) => void;
}

/**
 * «Selección sugerida»: qué hojas de un léxico o una gramática conviene
 * admitir para este pasaje, y POR QUÉ cada una.
 *
 * Pedido del fundador después de Jonás 4:5-11 («¿por qué el sistema no puede
 * hacer lo que tú hiciste?»). Propone y explica; quien firma el trabajo
 * decide: reemplazar, agregar o cerrar.
 */
export function SuggestedSelection({ suggestion, numbering, printedPageOffset, onReplace, onAdd }: Props) {
    const { t, i18n } = useTranslation('exegesis');
    const [open, setOpen] = useState(false);
    const n = (x: number) => x.toLocaleString(i18n.language);
    const corpus = t(`paperSetup.subSteps.corpus.suggestion.corpus.${suggestion.frequencyCorpus ?? 'bible'}`);
    const sheets = suggestion.picked.map(p => p.sheet);
    if (sheets.length === 0) return null;

    const motivo = (r: SuggestionReason): string => {
        switch (r.kind) {
            case 'rare': return t('paperSetup.subSteps.corpus.suggestion.reason.rare', { count: r.bibleCount, n: n(r.bibleCount), corpus: corpus });
            case 'repeated': return t('paperSetup.subSteps.corpus.suggestion.reason.repeated', { count: r.passageCount });
            case 'common': return t('paperSetup.subSteps.corpus.suggestion.reason.common', { n: n(r.bibleCount), corpus: corpus });
            case 'section': return t('paperSetup.subSteps.corpus.suggestion.reason.section', { title: r.title });
        }
    };
    const rotulo = (sheet: number) => {
        const printed = printedLabelForSheet(sheet, numbering, printedPageOffset);
        return printed !== null
            ? t('paperSetup.subSteps.corpus.lemmas.page', { sheet, printed })
            : t('paperSetup.subSteps.corpus.lemmas.sheet', { sheet });
    };
    const aplicar = (fn: (s: ReadonlyArray<number>) => void) => { fn(sheets); setOpen(false); };

    return (
        <>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setOpen(true)}>
                <Wand2 className="h-3 w-3 mr-1" aria-hidden="true" />
                {t('paperSetup.subSteps.corpus.suggestion.cta', { count: sheets.length })}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t('paperSetup.subSteps.corpus.suggestion.title')}</DialogTitle>
                        <DialogDescription>{t('paperSetup.subSteps.corpus.suggestion.body')}</DialogDescription>
                    </DialogHeader>
                    <ul className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                        {suggestion.picked.map(p => (
                            <li key={p.sheet} className="rounded-md border border-border px-3 py-2 text-xs">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="tabular-nums font-medium text-foreground">{rotulo(p.sheet)}</span>
                                    {p.lemmas.map(l => (
                                        <span key={l} className="text-sm text-foreground" dir={/[א-ת]/.test(l) ? 'rtl' : 'ltr'}>{l}</span>
                                    ))}
                                </div>
                                {p.reasons.length > 0 && (
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">{p.reasons.map(motivo).join(' · ')}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                    {(suggestion.leftOut.length > 0 || suggestion.notFound.length > 0) && (
                        <div className="space-y-0.5 text-[11px] text-muted-foreground">
                            {suggestion.leftOut.length > 0 && (
                                <p>{t('paperSetup.subSteps.corpus.suggestion.leftOut', { count: suggestion.leftOut.length, list: suggestion.leftOut.slice(0, 8).join(', ') })}</p>
                            )}
                            {suggestion.notFound.length > 0 && (
                                <p>{t('paperSetup.subSteps.corpus.suggestion.notFound', { count: suggestion.notFound.length, list: suggestion.notFound.slice(0, 8).join(', ') })}</p>
                            )}
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                            {t('paperSetup.subSteps.corpus.suggestion.cancel')}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => aplicar(onAdd)}>
                            {t('paperSetup.subSteps.corpus.suggestion.add')}
                        </Button>
                        <Button type="button" onClick={() => aplicar(onReplace)}>
                            {t('paperSetup.subSteps.corpus.suggestion.replace')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
