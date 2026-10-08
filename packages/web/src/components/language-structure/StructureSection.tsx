import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
    readingFor,
    STRUCTURE_RULE_SOURCES,
    type ClauseReading,
    type ClauseRelation,
    type RuleSource,
    type StructureLanguage,
    type StructureNode,
    type StructureRuleKey,
    type StructureWord,
} from '@dosfilos/domain';
import { SourceNote } from './SourceNote';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import type { VerseStructureState } from './useVerseStructure';

/** Las relaciones que llevan una nota de la regla (`notes.*` en el locale). */
const CON_NOTA: ReadonlySet<ClauseRelation> = new Set([
    'development', 'purposeOrResult', 'groundOrContent', 'negativePurpose', 'question', 'exception',
    'chain', 'conjunctive', 'disjunctive', 'asyndetic', 'speech',
]);

/** Las fuentes de las reglas que dieron las notas de la fila (para citar). */
function fuentesDe(n: StructureNode): RuleSource[] {
    const claves: StructureRuleKey[] = [];
    if (n.conditionalClass) claves.push(`class${n.conditionalClass}` as StructureRuleKey);
    if (n.relation in STRUCTURE_RULE_SOURCES) claves.push(n.relation as StructureRuleKey);
    if (n.fronted.length) claves.push('fronted');
    return claves.flatMap(k => STRUCTURE_RULE_SOURCES[k]);
}

/** Más sangría que esto no cabe en un teléfono; la jerarquía se sigue leyendo. */
const MAX_SANGRIA = 5;

/** Las mismas clases en la palabra y en la leyenda: lo que se explica es lo que se ve. */
const CHIP = 'inline-flex flex-col items-center rounded-md bg-muted/50 px-2 pb-0.5 pt-0.5';
const CHIP_CONECTOR = 'bg-transparent outline-dashed outline-[1.5px] outline-primary/70';
const CHIP_ANTEPUESTO = 'outline outline-2 outline-warning bg-warning/10';

/**
 * Cómo se enlaza cada palabra con el resto de la página: el índice de la
 * palabra en la página (tarjetas, versículo), su texto pintado con la capa de
 * color activa, su tooltip y qué pasa al tocarla. En griego el índice es la
 * posición en el versículo; en hebreo, la palabra del análisis que la cubre.
 */
export interface StructureWordLinks {
    /** Ordinal (posición en el versículo) → índice de la página. Sin esto, el mismo ordinal. */
    toPageIndex?: (verseWords: readonly StructureWord[]) => ReadonlyArray<number | undefined>;
    renderText?: (pageIndex: number) => React.ReactNode;
    /** Un `TooltipContent` con la ficha de la palabra. */
    renderTooltip?: (pageIndex: number) => React.ReactNode;
    onSelect?: (pageIndex: number) => void;
    selected?: number | null;
}

interface FlowProps {
    lang: StructureLanguage;
    nodes: readonly StructureNode[];
    /** Referencia → ordinal; sin él, las palabras no se enlazan con la página. */
    ordinal?: ReadonlyMap<string, number>;
    pageIndex?: ReadonlyArray<number | undefined>;
    links?: StructureWordLinks;
    /** La lectura del asistente, por fila (validada contra las filas al generarse). */
    readings?: readonly ClauseReading[];
}

/** Marca lo que viene del asistente: lo demás de la fila sale del texto. */
const EtiquetaAsistente: React.FC = () => {
    const { t } = useTranslation('languageStructure');
    return (
        <span
            title={t('readingTagTitle')}
            className="rounded border border-info/40 bg-info/10 px-1 py-px text-[9.5px] font-semibold uppercase tracking-wider text-info"
        >
            {t('readingTag')}
        </span>
    );
};

/**
 * Las cláusulas del versículo en *sentence flow* (Fee): cada una sangrada bajo
 * la que la contiene, con el rol de cada palabra, el conector punteado, lo
 * antepuesto al verbo resaltado y la relación a la vista. Las relaciones que
 * el texto no decide («propósito o resultado») se nombran como tales.
 */
export const StructureFlow: React.FC<FlowProps> = ({ lang, nodes, ordinal, pageIndex, links, readings }) => {
    const { t } = useTranslation('languageStructure');
    const base = Math.min(...nodes.map(n => n.depth));
    const indiceDe = (r: string) => {
        const o = ordinal?.get(r);
        return o === undefined ? undefined : pageIndex ? pageIndex[o] : o;
    };
    return (
        <ol className="space-y-2">
            {nodes.map(n => {
                const sangria = Math.min(n.depth - base, MAX_SANGRIA);
                const adelantados = new Set(n.fronted.flatMap(f => f.rs));
                const lectura = readingFor(n, readings);
                const roles = n.fronted.map(f => t(`roleNames.${f.role}`)).join(', ');
                const notas = [
                    n.conditionalClass ? t(`classNotes.${n.conditionalClass}`) : null,
                    // Si el asistente eligió, la nota de la ambigüedad ya no hace falta: la dice la elección.
                    CON_NOTA.has(n.relation) && !lectura?.resolved ? t(`notes.${n.relation}`) : null,
                    n.fronted.length && !lectura?.fronting ? `${t('fronted', { roles })} ${t('frontedNote')}` : null,
                ].filter(Boolean);
                return (
                    <li
                        key={n.index}
                        data-testid="structure-row"
                        // El hebreo se lee desde la derecha: la sangría va de ese lado
                        // (antes iba a la izquierda y no se veía, Rut 1:1).
                        style={lang === 'he' ? { marginRight: `${sangria * 1.5}rem` } : { marginLeft: `${sangria * 1.5}rem` }}
                        className="rounded-lg border border-border bg-card px-3 py-2 print:break-inside-avoid"
                    >
                        <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5', lang === 'he' && 'flex-row-reverse')}>
                            <div className="flex flex-wrap gap-1.5" dir={lang === 'he' ? 'rtl' : 'ltr'}>
                                {n.words.map(w => {
                                    const i = indiceDe(w.r);
                                    const enlazada = i !== undefined;
                                    const Tag = enlazada && links?.onSelect ? 'button' : 'span';
                                    const chip = (
                                        <Tag
                                            key={w.r}
                                            {...(Tag === 'button' ? { type: 'button' as const, onClick: () => links!.onSelect!(i!) } : {})}
                                            title={!links?.renderTooltip && w.role ? t(`roleNames.${w.role}`) : undefined}
                                            className={cn(
                                                CHIP,
                                                w.r === n.connector && CHIP_CONECTOR,
                                                adelantados.has(w.r) && CHIP_ANTEPUESTO,
                                                enlazada && links?.selected === i && 'ring-2 ring-primary',
                                            )}
                                        >
                                            <span
                                                lang={lang === 'he' ? 'he' : 'grc'}
                                                className={cn('leading-snug text-foreground', lang === 'he' ? 'font-hebrew text-xl' : 'text-lg')}
                                            >
                                                {enlazada && links?.renderText ? links.renderText(i) : w.t}
                                            </span>
                                            <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground" dir="ltr">
                                                {w.role ? t(`roles.${w.role}`) : '\u00A0'}
                                            </span>
                                        </Tag>
                                    );
                                    return enlazada && links?.renderTooltip ? (
                                        <Tooltip key={w.r} delayDuration={200}>
                                            <TooltipTrigger asChild>{chip}</TooltipTrigger>
                                            {links.renderTooltip(i)}
                                        </Tooltip>
                                    ) : chip;
                                })}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                {n.relation === 'condition' && (
                                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary">
                                        {t('protasis')}
                                        {n.conditionalClass ? ` · ${t(`classLabel.${n.conditionalClass}`)}` : ''}
                                    </span>
                                )}
                                {n.isApodosis && (
                                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-primary">{t('apodosis')}</span>
                                )}
                                <span
                                    className="rounded-full border border-border bg-muted/40 px-2 py-0.5 font-semibold text-foreground"
                                    title={lectura?.resolved ? t('resolvedNote', { open: t(`relations.${n.relation}`), choice: t(`resolved.${lectura.resolved}`) }) : undefined}
                                >
                                    {lectura?.resolved ? t(`resolved.${lectura.resolved}`) : t(`relations.${n.relation}`)}
                                </span>
                                {n.verbless && <span className="text-muted-foreground">{t('verbless')}</span>}
                            </div>
                        </div>
                        {notas.length > 0 && (
                            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{notas.join(' ')}</p>
                        )}
                        <SourceNote sources={fuentesDe(n)} compact />
                        {lectura && (
                            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px] leading-snug" data-testid="clause-reading">
                                <EtiquetaAsistente />
                                {lectura.value && <span className="font-medium italic text-primary">{lectura.value}</span>}
                                {lectura.explanation && <span className="text-foreground/80">{lectura.explanation}</span>}
                                {(lectura.resolved || lectura.fronting) && (
                                    // Una sola línea debajo, con un espacio normal entre frases.
                                    <span className="basis-full text-muted-foreground">
                                        {[
                                            lectura.resolved
                                                ? t('resolvedNote', { open: t(`relations.${n.relation}`), choice: t(`resolved.${lectura.resolved}`).toLowerCase() })
                                                : '',
                                            lectura.fronting ? t('frontedChosen', { roles, fronting: t(`fronting.${lectura.fronting}`) }) : '',
                                        ].filter(Boolean).join(' ')}
                                    </span>
                                )}
                            </div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
};

/** La leyenda con las mismas marcas que las palabras (pedido del fundador: «no entiendo los colores»). */
const Leyenda: React.FC = () => {
    const { t } = useTranslation('languageStructure');
    return (
        <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground" data-testid="structure-legend">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="inline-flex items-center gap-1.5">
                    <span className={cn(CHIP, CHIP_CONECTOR, 'h-4 w-6')} />
                    {t('legendConnector')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className={cn(CHIP, CHIP_ANTEPUESTO, 'h-4 w-6')} />
                    {t('legendFronted')}
                </span>
                <span>{t('legendIndent')}</span>
            </div>
            <p>{t('legend')}</p>
        </div>
    );
};

interface SectionProps {
    lang: StructureLanguage;
    structure: VerseStructureState;
    links?: StructureWordLinks;
    readings?: readonly ClauseReading[];
    /** Por qué no hay lectura del asistente (sin análisis, o análisis viejo) y cómo pedirla. */
    readingNotice?: { message: string; action?: { label: string; onClick: () => void; disabled?: boolean } };
}

/** La sección «Estructura» de las páginas de griego y de hebreo. */
export const StructureSection: React.FC<SectionProps> = ({ lang, structure, links, readings, readingNotice }) => {
    const { t } = useTranslation('languageStructure');
    const { loading, unavailable, nodes, ordinal, words } = structure;
    const mapear = links?.toPageIndex;
    const pageIndex = React.useMemo(() => (mapear ? mapear(words) : undefined), [mapear, words]);

    return (
        <section className="rounded-xl border border-border bg-card p-5 print:break-inside-avoid">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('title')}</h3>
            <p className="mb-3 text-[12.5px] text-muted-foreground">{t('intro')}</p>
            {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
                </div>
            ) : unavailable || !nodes ? (
                <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
            ) : nodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noClauses')}</p>
            ) : (
                <>
                    {readingNotice && (
                        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2 print:hidden" data-testid="reading-notice">
                            <p className="text-[12.5px] text-muted-foreground">{readingNotice.message}</p>
                            {readingNotice.action && (
                                <button
                                    type="button"
                                    onClick={readingNotice.action.onClick}
                                    disabled={readingNotice.action.disabled}
                                    className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
                                >
                                    {readingNotice.action.label}
                                </button>
                            )}
                        </div>
                    )}
                    <StructureFlow lang={lang} nodes={nodes} ordinal={ordinal} pageIndex={pageIndex} links={links} readings={readings} />
                    <Leyenda />
                </>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
                {t('attribution', { lang: lang === 'he' ? 'Hebrew' : 'Greek' })}
            </p>
        </section>
    );
};
