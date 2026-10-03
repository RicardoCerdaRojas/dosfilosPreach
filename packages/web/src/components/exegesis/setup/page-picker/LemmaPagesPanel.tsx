import { BookA, Loader2, Plus } from 'lucide-react';
import { printedLabelForSheet, type LemmaPageProposal, type PageNumbering } from '@dosfilos/domain';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';

interface Props {
    proposals: ReadonlyArray<LemmaPageProposal>;
    isLoading: boolean;
    /** Qué folio lleva impreso cada hoja, para nombrarla como el libro. */
    numbering: PageNumbering | null;
    /** Respaldo cuando el recurso no tiene numeración (`printedLabelForSheet`). */
    printedPageOffset: number | null;
    /** Hojas ya elegidas, para no ofrecer lo que ya está. */
    selected: ReadonlySet<number>;
    onAdd: (sheet: number) => void;
    onAddAll: (sheets: ReadonlyArray<number>) => void;
    /** Reemplaza la selección por estas hojas (con deshacer). */
    onKeepOnly: (sheets: ReadonlyArray<number>) => void;
}

/**
 * Dónde está cada lema del pasaje dentro del léxico.
 *
 * Buscar siete entradas en un léxico de 807 páginas es el trabajo que
 * nadie hace bien: en el estudio de Salmo 23:1–3 hubo que corregir
 * después las páginas que quedaron mal, y una página mal elegida no se
 * nota hasta que el verificador marca como dudosa una cita correcta
 * —porque su página nunca entró al corpus—.
 *
 * Propone, no decide. La primera hoja es la que más veces nombra el
 * lema, que casi siempre es su entrada; el renglón de contexto está
 * para reconocerla sin abrir el libro.
 */
const HEBREO = /[\u05D0-\u05EA]/;

export function LemmaPagesPanel({ proposals, isLoading, numbering, printedPageOffset, selected, onAdd, onAddAll, onKeepOnly }: Props) {
    const { t } = useTranslation('exegesis');

    const primeras = [...new Set(proposals.map(p => p.sheets[0]?.sheet).filter((s): s is number => typeof s === 'number'))];
    const faltantes = primeras.filter(s => !selected.has(s));
    // Hojas elegidas que no son la entrada de ningún lema. Un léxico con 77
    // hojas cuando las entradas están en ~20 (Ortiz, Jonás 4:5-11) manda al
    // análisis páginas que no tratan ninguna palabra del pasaje.
    const entradas = new Set(primeras);
    const fuera = [...selected].filter(s => !entradas.has(s)).length;
    const excede = primeras.length > 0 && fuera > Math.max(10, 2 * primeras.length);

    return (
        <section className="rounded-xl border border-border bg-card p-3 space-y-2">
            <header className="flex items-center gap-2">
                <BookA className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">{t('paperSetup.subSteps.corpus.lemmas.title')}</h3>
                {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {faltantes.length > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="ml-auto h-6 text-[11px]" onClick={() => onAddAll(faltantes)}>
                        {t('paperSetup.subSteps.corpus.lemmas.addAll', { count: faltantes.length })}
                    </Button>
                )}
            </header>

            {fuera > 0 && primeras.length > 0 && (
                <div className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${excede ? 'bg-warning-subtle/50 text-warning-subtle-foreground' : 'text-muted-foreground'}`}>
                    {excede && (
                        <span className="flex-1 min-w-0">
                            {t('paperSetup.subSteps.corpus.lemmas.excess', { selected: selected.size, entries: primeras.length })}
                        </span>
                    )}
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => onKeepOnly(primeras)}>
                        {t('paperSetup.subSteps.corpus.lemmas.keepOnly', { count: primeras.length })}
                    </Button>
                </div>
            )}

            {proposals.length === 0 && !isLoading ? (
                <p className="text-[11px] text-muted-foreground">{t('paperSetup.subSteps.corpus.lemmas.empty')}</p>
            ) : (
                <ul className="space-y-1.5">
                    {proposals.map(p => (
                        <li key={p.lemma} className="flex items-start gap-2">
                            {/* La dirección según la lengua: con `rtl` fijo, un lema griego se
                                leía al revés. */}
                            <span
                                className="text-sm text-foreground shrink-0 w-20 truncate"
                                dir={HEBREO.test(p.lemma) ? 'rtl' : 'ltr'}
                                lang={HEBREO.test(p.lemma) ? 'he' : 'el'}
                            >
                                {p.lemma}
                            </span>
                            <span className="flex flex-wrap gap-1 flex-1 min-w-0">
                                {p.sheets.length === 0 ? (
                                    <span className="text-[11px] text-muted-foreground">{t('paperSetup.subSteps.corpus.lemmas.notFound')}</span>
                                ) : p.sheets.map(hit => {
                                    const printed = printedLabelForSheet(hit.sheet, numbering, printedPageOffset);
                                    const ya = selected.has(hit.sheet);
                                    return (
                                        <button
                                            key={hit.sheet}
                                            type="button"
                                            onClick={() => onAdd(hit.sheet)}
                                            disabled={ya}
                                            title={hit.snippet ?? undefined}
                                            className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] tabular-nums text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                                        >
                                            {!ya && <Plus className="h-2.5 w-2.5" />}
                                            {printed !== null
                                                ? t('paperSetup.subSteps.corpus.lemmas.page', { printed, sheet: hit.sheet })
                                                : t('paperSetup.subSteps.corpus.lemmas.sheet', { sheet: hit.sheet })}
                                            <span className="text-muted-foreground">·{hit.count}</span>
                                        </button>
                                    );
                                })}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-[11px] text-muted-foreground">{t('paperSetup.subSteps.corpus.lemmas.hint')}</p>
        </section>
    );
}
