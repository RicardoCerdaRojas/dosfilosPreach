import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import type { GreekVerseInsight, GreekVerseTokens } from '@dosfilos/domain';
import { FirestoreGreekInsightRepository, SBLGNTBibleProvider } from '@dosfilos/infrastructure';
import type { BibleBookId } from '@dosfilos/domain';
import { GreekWordTooltip } from './GreekVerseBoard';
import { FichaPanelGriego } from './FichasGriego';
import type { DatosGriego } from './ficha/bloquesGriego';

interface Props {
    provider: SBLGNTBibleProvider;
    book: BibleBookId;
    bookName: string;
    chapter: number;
    versesInChapter: number;
    /** Saltar al análisis de un versículo concreto. */
    onOpenVerse: (verse: number) => void;
}

/**
 * EL PASAJE COMPLETO, no el versículo suelto — un pastor estudia perícopas
 * ("necesito estudiar Santiago 1:1-8"). Rango dentro del capítulo, cada
 * versículo con su griego + transliteración (el popover sigue palabra a
 * palabra) y su traducción fluida SI YA ESTÁ EN CACHÉ: esta vista no genera
 * análisis — leer corrido no pide pagar ocho llamadas; para analizar un verso
 * se salta a su vista.
 *
 * IMPRIMIBLE: el estudio se lleva al escritorio. `window.print()` con las
 * utilidades print de la página.
 */
export function GreekPassageView({ provider, book, bookName, chapter, versesInChapter, onOpenVerse }: Props) {
    const { t } = useTranslation('greekTutor');
    const [desde, setDesde] = useState(1);
    const [hasta, setHasta] = useState(Math.min(8, versesInChapter));
    const [versos, setVersos] = useState<{ tokens: GreekVerseTokens; insight: GreekVerseInsight | null }[]>([]);
    const [loading, setLoading] = useState(false);
    /** La palabra cuya ficha completa está abierta: versículo y posición. */
    const [ficha, setFicha] = useState<{ verse: number; i: number } | null>(null);
    /** Los datos de la ficha de una palabra del pasaje: la palabra clave se empata por texto (como antes). */
    const datosDe = (tokens: GreekVerseTokens, insight: GreekVerseInsight | null) => (i: number): DatosGriego | null => {
        const tok = tokens.tokens[i];
        if (!tok) return null;
        const limpio = (x: string) => x.replace(/[.,·;]+$/u, '');
        return { token: tok, insight: insight?.words[i], keyInsight: insight?.keyInsights?.find((k) => limpio(k.text) === limpio(tok.text)) };
    };
    const abierto = ficha ? versos.find((v) => v.tokens.reference.verse === ficha.verse) : undefined;

    useEffect(() => {
        setDesde(1);
        setHasta(Math.min(8, versesInChapter));
    }, [book, chapter, versesInChapter]);

    useEffect(() => {
        let vivo = true;
        setLoading(true);
        const repo = new FirestoreGreekInsightRepository();
        (async () => {
            const rango = Array.from({ length: Math.max(0, hasta - desde + 1) }, (_, i) => desde + i);
            const out = await Promise.all(
                rango.map(async (v) => {
                    const tokens = await provider.getVerseTokens(book, chapter, v);
                    if (!tokens) return null;
                    const cached = await repo.get(`${book} ${chapter}:${v}`);
                    // 'unavailable' (sin sesión, red) se trata como "sin
                    // traducción" en esta vista: leer corrido no ofrece
                    // generar nada, así que no hay decisión que informar.
                    const insight = cached === 'unavailable' ? null : cached;
                    return {
                        tokens,
                        insight: insight && insight.words.length === tokens.tokens.length ? insight : null,
                    };
                }),
            );
            if (vivo) {
                setVersos(out.filter((x): x is NonNullable<typeof x> => x !== null));
                setLoading(false);
            }
        })();
        return () => {
            vivo = false;
        };
    }, [provider, book, chapter, desde, hasta]);

    const numeros = Array.from({ length: versesInChapter }, (_, i) => i + 1);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 print:hidden">
                <span className="text-sm text-muted-foreground">{t('analyzer.passage.range')}</span>
                <Select value={String(desde)} onValueChange={(v) => setDesde(Number(v))}>
                    <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {numeros.map((n) => (
                            <SelectItem key={n} value={String(n)}>{t('analyzer.verseShort', { n })}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">—</span>
                <Select value={String(hasta)} onValueChange={(v) => setHasta(Number(v))}>
                    <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {numeros.filter((n) => n >= desde).map((n) => (
                            <SelectItem key={n} value={String(n)}>{t('analyzer.verseShort', { n })}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" />
                    {t('analyzer.passage.print')}
                </Button>
            </div>

            <h2 className="hidden print:block text-lg font-bold">
                {bookName} {chapter}:{desde}-{hasta}
            </h2>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-5">
                    {versos.map(({ tokens, insight }) => (
                        <div key={tokens.reference.verse} className="rounded-lg border border-border p-4 space-y-3 print:border-0 print:p-0 print:break-inside-avoid">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                    {bookName} {chapter}:{tokens.reference.verse}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs print:hidden"
                                    onClick={() => onOpenVerse(tokens.reference.verse)}
                                >
                                    {t('analyzer.passage.openVerse')}
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-3" lang="grc">
                                {tokens.tokens.map((tok, i) => (
                                    <Tooltip key={i} delayDuration={200}>
                                        <TooltipTrigger asChild>
                                            {/* Tocarla abre su ficha completa (el pie del tooltip lo promete). */}
                                            <button
                                                type="button"
                                                onClick={() => setFicha({ verse: tokens.reference.verse, i })}
                                                className="flex flex-col items-center rounded px-1 py-0.5 hover:bg-primary/10"
                                            >
                                                <span className="text-2xl leading-tight">{tok.text}</span>
                                                <span className="text-[10px] text-muted-foreground italic print:text-[9px]" lang="en">
                                                    {tok.transliteration}
                                                </span>
                                            </button>
                                        </TooltipTrigger>
                                        <GreekWordTooltip {...datosDe(tokens, insight)(i)!} />
                                    </Tooltip>
                                ))}
                            </div>
                            {insight && (
                                <p className="text-sm text-muted-foreground border-t border-border/60 pt-2">
                                    {insight.fluidTranslation}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {/* La ficha completa de la palabra tocada, en el panel lateral. */}
            <FichaPanelGriego
                titulo={abierto ? `${bookName} ${chapter}:${abierto.tokens.reference.verse}` : ''}
                total={abierto?.tokens.tokens.length ?? 0}
                datos={abierto ? datosDe(abierto.tokens, abierto.insight) : () => null}
                abierta={abierto ? ficha!.i : null}
                onAbrir={(i) => setFicha(i === null || !ficha ? null : { verse: ficha.verse, i })}
            />
        </div>
    );
}
