import { useState } from 'react';
import { ChevronDown, ChevronRight, ListTree, Plus } from 'lucide-react';
import { printedLabelIn, type PageNumbering, type SectionProposal } from '@dosfilos/domain';
import { useTranslation } from '@/i18n';

interface Props {
    proposals: ReadonlyArray<SectionProposal>;
    numbering: PageNumbering | null;
    selected: ReadonlySet<number>;
    onAdd: (sheet: number) => void;
}

/**
 * El índice de la gramática, filtrado por lo que el encuadre pregunta.
 *
 * Una gramática temática no está organizada por pasajes y por eso la consulta
 * por pasaje le devuelve cero: Porter quedó en 0 fragmentos teniendo 465
 * secciones indexadas. Lo que sí tiene es un índice por categorías, que es
 * exactamente el vocabulario que el encuadre del trabajo usa.
 *
 * Se agrupa por la clave que trajo cada sección y NO se ordena por la forma
 * del título. Se probó ordenar por qué fracción del título ocupa el término y
 * la medición lo desautorizó: «2.1.3. Third class conditional» quedaba última
 * de once por ser el título más largo, y es la que contesta la pregunta. En un
 * índice jerárquico el encabezado más específico es el más útil y
 * necesariamente el más largo.
 *
 * Tampoco se descarta nada. Un grupo son diez o cuarenta filas de índice
 * —revisables de un vistazo— contra las 465 del libro entero.
 */
export function GrammarSectionsPanel({ proposals, numbering, selected, onAdd }: Props) {
    const { t } = useTranslation('exegesis');
    const [abierto, setAbierto] = useState<string | null>(null);

    if (proposals.length === 0) return null;

    // Una sección puede venir por más de una clave; se agrupa por la primera,
    // que con las griegas primero es la más específica.
    const grupos = new Map<string, SectionProposal[]>();
    for (const p of proposals) {
        const clave = p.matched[0] ?? '';
        if (!grupos.has(clave)) grupos.set(clave, []);
        grupos.get(clave)!.push(p);
    }

    return (
        <section className="rounded-xl border border-border bg-card p-3 space-y-2">
            <header className="flex items-center gap-2">
                <ListTree className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">
                    {t('paperSetup.subSteps.corpus.grammarSections.title', { count: proposals.length })}
                </h3>
            </header>

            <ul className="space-y-1">
                {[...grupos].map(([clave, items]) => {
                    const desplegado = abierto === clave;
                    return (
                        <li key={clave}>
                            <button
                                type="button"
                                onClick={() => setAbierto(desplegado ? null : clave)}
                                className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] text-foreground hover:bg-accent"
                            >
                                {desplegado ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                <span className="font-medium">{clave}</span>
                                <span className="text-muted-foreground">
                                    {t('paperSetup.subSteps.corpus.grammarSections.count', { count: items.length })}
                                </span>
                                {items.some(i => i.corroborated) && (
                                    <span className="ml-auto rounded-full bg-success-subtle px-1.5 text-[10px] text-success-subtle-foreground">
                                        {t('paperSetup.subSteps.corpus.grammarSections.corroborated')}
                                    </span>
                                )}
                            </button>

                            {desplegado && (
                                <ul className="ml-4 mt-0.5 space-y-0.5">
                                    {items.map(p => {
                                        const printed = numbering ? printedLabelIn(numbering, p.sheet) : null;
                                        const ya = selected.has(p.sheet);
                                        return (
                                            <li key={p.section} className="flex items-start gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => onAdd(p.sheet)}
                                                    disabled={ya}
                                                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] tabular-nums text-foreground hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                                                >
                                                    {!ya && <Plus className="h-2.5 w-2.5" />}
                                                    {printed !== null
                                                        ? t('paperSetup.subSteps.corpus.grammarSections.page', { printed })
                                                        : t('paperSetup.subSteps.corpus.grammarSections.sheet', { sheet: p.sheet })}
                                                </button>
                                                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={p.section}>
                                                    {p.section}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
            <p className="text-[11px] text-muted-foreground">{t('paperSetup.subSteps.corpus.grammarSections.hint')}</p>
        </section>
    );
}
