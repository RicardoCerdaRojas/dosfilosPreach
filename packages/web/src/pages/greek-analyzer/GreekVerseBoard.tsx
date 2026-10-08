import type React from 'react';
import type { GreekKeyInsight, GreekVerseInsight, GreekVerseTokens } from '@dosfilos/domain';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { GreekWordHoverContent } from './GreekWordHoverContent';
import type { FrontedInfo } from '@/components/language-structure/FrontedNote';
import { pintarPalabraGriega } from './pintarPalabraGriega';
import { GreekVerseTools, type GreekColorMode, type GreekFontScale } from './GreekVerseTools';

interface Props {
    colorMode: GreekColorMode;
    onColorMode: (m: GreekColorMode) => void;
    title: string;
    data: GreekVerseTokens;
    insight: GreekVerseInsight | null;
    claveDe: (texto: string, i?: number) => GreekKeyInsight | undefined;
    relacionesDe: (i: number) => { type: string; note: string; otherText: string }[];
    casoDelTermino: (i: number) => string | undefined;
    lemmaCounts: Record<string, number>;
    bookName: string;
    fontScale: GreekFontScale;
    onFontScale: (s: GreekFontScale) => void;
    showTranslit: boolean;
    onToggleTranslit: () => void;
    onReanalyze?: () => void;
    reanalyzing?: boolean;
    seleccion: number | null;
    onSeleccion: (i: number | null) => void;
    /** Rol con que la palabra va antepuesta al verbo (vista «Estructura»). */
    frontedDe?: (i: number) => FrontedInfo | undefined;
}

const FUENTE: Record<GreekFontScale, string> = { 0: 'text-2xl', 1: 'text-3xl', 2: 'text-4xl' };

const LEYENDA: Record<Exclude<GreekColorMode, 'off'>, { key: string; className: string }[]> = {
    pos: [
        { key: 'legendVerb', className: 'bg-primary' },
        { key: 'legendNoun', className: 'bg-info' },
        { key: 'legendAdj', className: 'bg-warning' },
        { key: 'legendPron', className: 'bg-success' },
        { key: 'legendArticle', className: 'bg-muted-foreground' },
        { key: 'legendConj', className: 'bg-destructive' },
        { key: 'legendPrep', className: 'bg-accent-foreground' },
        { key: 'legendAdv', className: 'bg-foreground/70' },
    ],
    morph: [
        { key: 'legendCase', className: 'bg-info' },
        { key: 'legendTense', className: 'bg-warning' },
        { key: 'legendMood', className: 'bg-success' },
        { key: 'legendAugment', className: 'bg-primary' },
    ],
};

/**
 * La ficha de una palabra en un tooltip. La usan el versículo y la vista
 * «Estructura»: la misma información en los dos lugares.
 */
export function GreekWordTooltip(props: React.ComponentProps<typeof GreekWordHoverContent>) {
    return (
        <TooltipContent
            // `p-0` y `text-sm`: el tooltip base trae `px-3 py-1.5 text-xs`
            // para etiquetas cortas y pelea con el encabezado fijo del
            // contenido, que pone su propio espaciado por sección.
            className="bg-card text-card-foreground border border-border shadow-xl rounded-lg p-0 text-sm max-w-none [&>svg]:bg-card [&>svg]:fill-card"
            sideOffset={6}
            // Con 40rem de ancho el popover llega a los bordes: Radix lo
            // reubica solo, pero hay que decirle cuánto margen respetar.
            collisionPadding={16}
        >
            <GreekWordHoverContent {...props} />
        </TooltipContent>
    );
}

/**
 * La banda del versículo: título + herramientas + las palabras griegas con su
 * transliteración (a voluntad) y el popover completo por palabra. Extraída de
 * la página para que ésta se quede en orquestar.
 */
export function GreekVerseBoard({
    colorMode,
    onColorMode,
    title,
    data,
    insight,
    claveDe,
    relacionesDe,
    casoDelTermino,
    lemmaCounts,
    bookName,
    fontScale,
    onFontScale,
    showTranslit,
    onToggleTranslit,
    onReanalyze,
    reanalyzing,
    seleccion,
    onSeleccion,
    frontedDe,
}: Props) {
    const { t } = useTranslation('greekTutor');

    return (
        <div className="rounded-lg border border-border bg-primary/[0.03] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{title}</span>
                <GreekVerseTools
                    colorMode={colorMode}
                    onColorMode={onColorMode}
                    fontScale={fontScale}
                    onFontScale={onFontScale}
                    showTranslit={showTranslit}
                    onToggleTranslit={onToggleTranslit}
                    greekText={data.text}
                    translitText={data.tokens.map((tk) => tk.transliteration).join(' ')}
                    onReanalyze={onReanalyze}
                    reanalyzing={reanalyzing}
                />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-5" lang="grc">
                {data.tokens.map((tok, i) => (
                    <Tooltip key={i} delayDuration={200}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => onSeleccion(seleccion === i ? null : i)}
                                className={cn(
                                    'group flex flex-col items-center rounded px-1.5 py-1 transition-colors hover:bg-primary/10',
                                    seleccion === i && 'bg-primary/10 ring-1 ring-primary/40',
                                )}
                            >
                                <span className={cn('leading-tight', FUENTE[fontScale])}>{pintarPalabraGriega(tok, colorMode)}</span>
                                {showTranslit && (
                                    <span className="text-[11px] text-muted-foreground italic" lang="en">
                                        {tok.transliteration}
                                    </span>
                                )}
                            </button>
                        </TooltipTrigger>
                        {/* Mismo patrón que el hebreo: tooltip con contenido rico. */}
                        <GreekWordTooltip
                            token={tok}
                            insight={insight?.words[i]}
                            keyInsight={claveDe(tok.text, i)}
                            relations={relacionesDe(i)}
                            objectCase={casoDelTermino(i)}
                            bookCount={lemmaCounts[tok.lemma]}
                            bookName={bookName}
                            fronted={frontedDe?.(i)}
                        />
                    </Tooltip>
                ))}
            </div>

            {/* SISTEMA DE COLORES — la leyenda del hebreo, para la capa activa. */}
            {colorMode !== 'off' && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 print:hidden">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('analyzer.legend.title')}
                    </span>
                    {LEYENDA[colorMode].map(({ key, className }) => (
                        <span key={key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={cn('h-2 w-2 rounded-full', className)} />
                            {t(`analyzer.legend.${key}`)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
