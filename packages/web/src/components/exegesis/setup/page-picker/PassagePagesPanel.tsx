import { Loader2, Plus, Quote } from 'lucide-react';
import { printedLabelIn, type PassagePageHit, type PageNumbering } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface Props {
    proposals: ReadonlyArray<PassagePageHit>;
    isLoading: boolean;
    /** Qué folio lleva impreso cada hoja, para nombrarla como el libro. */
    numbering: PageNumbering | null;
    /** Hojas ya elegidas, para no ofrecer lo que ya está. */
    selected: ReadonlySet<number>;
    onAdd: (sheet: number) => void;
    onAddAll: (sheets: ReadonlyArray<number>) => void;
}

/**
 * Dónde nombra este libro al pasaje del trabajo.
 *
 * Nace del defecto más caro de la semana del 2026-09-23. Wallace comenta
 * Santiago 2:9 por su nombre en dos hojas —la 515, donde dice que el
 * participio admite lectura de resultado, y la 578— y ninguna entró al
 * corpus: la consulta que se le hace a todos los libros es semántica y por
 * pasaje, y una gramática no está organizada por pasajes. Pero SÍ cita el
 * versículo, como ejemplo, y ese nombre es literal.
 *
 * Propone, no decide. Se ofrece para toda fuente, no sólo para las que
 * quedaron en cero: Wallace tenía trece fragmentos y le faltaban justo los
 * dos que contestaban la pregunta difícil.
 */
export function PassagePagesPanel({ proposals, isLoading, numbering, selected, onAdd, onAddAll }: Props) {
    const { t } = useTranslation('exegesis');

    const faltantes = proposals.map(p => p.sheet).filter(s => !selected.has(s));

    return (
        <section className="rounded-xl border border-border bg-card p-3 space-y-2">
            <header className="flex items-center gap-2">
                <Quote className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">
                    {t('paperSetup.subSteps.corpus.passagePages.title', { count: proposals.length })}
                </h3>
                {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {faltantes.length > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="ml-auto h-6 text-[11px]" onClick={() => onAddAll(faltantes)}>
                        {t('paperSetup.subSteps.corpus.passagePages.addAll', { count: faltantes.length })}
                    </Button>
                )}
            </header>

            {proposals.length === 0 && !isLoading ? (
                <p className="text-[11px] text-muted-foreground">{t('paperSetup.subSteps.corpus.passagePages.empty')}</p>
            ) : (
                <ul className="space-y-1">
                    {proposals.map(hit => {
                        const printed = numbering ? printedLabelIn(numbering, hit.sheet) : null;
                        const ya = selected.has(hit.sheet);
                        return (
                            <li key={hit.sheet} className="flex items-start gap-2">
                                <button
                                    type="button"
                                    onClick={() => onAdd(hit.sheet)}
                                    disabled={ya}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] tabular-nums text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                                >
                                    {!ya && <Plus className="h-2.5 w-2.5" />}
                                    {printed !== null
                                        ? t('paperSetup.subSteps.corpus.passagePages.page', { printed, sheet: hit.sheet })
                                        : t('paperSetup.subSteps.corpus.passagePages.sheet', { sheet: hit.sheet })}
                                </button>
                                <span className="min-w-0 flex-1">
                                    {/* Qué versículos nombra: es lo que separa la hoja que DISCUTE
                                        el pasaje de la que lo usa de ejemplo en una lista. */}
                                    <span className="text-[11px] font-medium text-foreground">
                                        {t('paperSetup.subSteps.corpus.passagePages.verses', { verses: hit.verses.join(', ') })}
                                    </span>
                                    {hit.snippet && (
                                        <span className="block truncate text-[11px] text-muted-foreground" title={hit.snippet}>
                                            {hit.snippet}
                                        </span>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <p className="text-[11px] text-muted-foreground">{t('paperSetup.subSteps.corpus.passagePages.hint')}</p>
        </section>
    );
}
