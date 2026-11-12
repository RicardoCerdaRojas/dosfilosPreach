import { AArrowDown, AArrowUp, Copy, Eye, EyeOff, Printer, RefreshCw, Loader2, Check, Underline } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type GreekFontScale = 0 | 1 | 2;
/** Capa de color de la banda: apagada, por categoría, o por morfema. */
export type GreekColorMode = 'off' | 'pos' | 'morph';

interface Props {
    colorMode: GreekColorMode;
    onColorMode: (m: GreekColorMode) => void;
    fontScale: GreekFontScale;
    onFontScale: (s: GreekFontScale) => void;
    showTranslit: boolean;
    onToggleTranslit: () => void;
    /** U11b (Stg 2:16, 2:21): subrayar las frases preposicionales. Sin datos de estructura no se ofrece. */
    showPhrases?: boolean;
    onTogglePhrases?: () => void;
    /** Texto griego del versículo, para copiar. */
    greekText: string;
    /** Transliteración corrida, para copiar. */
    translitText: string;
    /** Regenerar el análisis (sobreescribe el caché — mejora para todos). */
    onReanalyze?: () => void;
    reanalyzing?: boolean;
}

/**
 * Las herramientas de la banda del versículo — la estación de trabajo que la
 * banda hebrea ya tiene y a la del griego le faltaba: tamaño de letra, copiar
 * griego / transliteración, re-analizar e imprimir. Y una pedagógica propia:
 * OCULTAR la transliteración — la muleta se suelta a voluntad, que es como se
 * aprende a leer el alfabeto de verdad.
 */
export function GreekVerseTools({
    colorMode,
    onColorMode,
    fontScale,
    onFontScale,
    showTranslit,
    onToggleTranslit,
    showPhrases,
    onTogglePhrases,
    greekText,
    translitText,
    onReanalyze,
    reanalyzing,
}: Props) {
    const { t } = useTranslation('greekTutor');
    const [copiado, setCopiado] = useState<'greek' | 'translit' | null>(null);

    const copiar = (que: 'greek' | 'translit') => {
        void navigator.clipboard.writeText(que === 'greek' ? greekText : translitText).then(() => {
            setCopiado(que);
            setTimeout(() => setCopiado(null), 1500);
        });
    };

    const chip =
        'inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-border';

    const MODOS: { id: GreekColorMode; labelKey: string }[] = [
        { id: 'off', labelKey: 'analyzer.tools.colorOff' },
        { id: 'pos', labelKey: 'analyzer.tools.colorPos' },
        { id: 'morph', labelKey: 'analyzer.tools.colorMorph' },
    ];

    return (
        // TRES GRUPOS SEPARADOS, no una fila de ocho botones sueltos: CÓMO SE
        // VE el texto, QUÉ ME LLEVO de él, y QUÉ HAGO con el análisis. La fila
        // plana obligaba a leer cada etiqueta para saber qué hacía cada cosa.
        //
        // Y "Translit." aparecía DOS VECES con sentidos distintos —mostrar y
        // copiar—: ahora el interruptor lleva el ojo (ver/ocultar) y la copia
        // el ícono de copiar, así el ícono desambigua lo que la palabra no.
        <div className="flex flex-wrap items-center gap-2 print:hidden">
            {/* ── CÓMO SE VE ────────────────────────────────────────── */}
            <Grupo>
            <span className="inline-flex items-center rounded-md border border-border/60 bg-background">
                {MODOS.map(({ id, labelKey }, i) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onColorMode(id)}
                        className={cn(
                            'px-2 py-1 text-xs transition-colors',
                            i > 0 && 'border-l border-border/60',
                            colorMode === id
                                ? 'text-foreground bg-muted/60 font-medium'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {t(labelKey)}
                    </button>
                ))}
            </span>

            <button
                type="button"
                onClick={onToggleTranslit}
                className={cn(chip, showTranslit && 'text-foreground bg-muted/60')}
                title={t('analyzer.tools.translitToggle')}
                aria-pressed={showTranslit}
            >
                {showTranslit ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {t('analyzer.tools.translit')}
            </button>

            {onTogglePhrases && (
                <button
                    type="button"
                    onClick={onTogglePhrases}
                    className={cn(chip, showPhrases && 'text-foreground bg-muted/60')}
                    title={t('analyzer.tools.phrasesToggle')}
                    aria-pressed={!!showPhrases}
                >
                    <Underline className="h-3 w-3" />
                    {t('analyzer.tools.phrases')}
                </button>
            )}

            <span className="inline-flex items-center rounded-md border border-border/60 bg-background">
                <button
                    type="button"
                    onClick={() => onFontScale(Math.max(0, fontScale - 1) as GreekFontScale)}
                    disabled={fontScale === 0}
                    className="px-1.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label={t('analyzer.tools.smaller')}
                >
                    <AArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => onFontScale(Math.min(2, fontScale + 1) as GreekFontScale)}
                    disabled={fontScale === 2}
                    className="border-l border-border/60 px-1.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                    aria-label={t('analyzer.tools.larger')}
                >
                    <AArrowUp className="h-3.5 w-3.5" />
                </button>
            </span>
            </Grupo>

            {/* ── QUÉ ME LLEVO ──────────────────────────────────────── */}
            <Grupo>
            <span className="pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('analyzer.tools.copyGroup')}
            </span>
            <button type="button" onClick={() => copiar('greek')} className={chip}>
                {copiado === 'greek' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {t('analyzer.tools.copyGreek')}
            </button>
            <button type="button" onClick={() => copiar('translit')} className={chip}>
                {copiado === 'translit' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {t('analyzer.tools.copyTranslit')}
            </button>
            </Grupo>

            {/* ── QUÉ HAGO CON EL ANÁLISIS ──────────────────────────── */}
            <Grupo>
            {onReanalyze && (
                <button
                    type="button"
                    onClick={onReanalyze}
                    disabled={reanalyzing}
                    className={chip}
                    title={t('analyzer.tools.reanalyzeHint')}
                >
                    {reanalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    {t('analyzer.tools.reanalyze')}
                </button>
            )}

            <button type="button" onClick={() => window.print()} className={chip}>
                <Printer className="h-3 w-3" />
                {t('analyzer.tools.print')}
            </button>
            </Grupo>
        </div>
    );

}

/**
 * Un grupo del toolbar: fondo tenue y espacio propio.
 *
 * La primera versión los separaba con una línea de 1px y el fundador apenas
 * la veía — con razón: la línea COMPETÍA con los bordes de los chips, que ya
 * son líneas del mismo peso. Entre elementos que ya están delineados, lo que
 * agrupa no es más línea sino FONDO y AIRE: el ojo lee "estas cosas comparten
 * superficie" antes que "hay una raya entre ellas".
 */
function Grupo({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/50 px-1.5 py-1">
            {children}
        </span>
    );
}
