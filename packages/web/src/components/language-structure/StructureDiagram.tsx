import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    diagramLines,
    readingFor,
    type ClauseReading,
    type DiagramLine,
    type MirrorPosition,
    type PhraseKind,
    type StructureLanguage,
    type StructureNode,
    type VersePhrase,
} from '@dosfilos/domain';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { SUBRAYADO_FRASE } from './frases';
import type { StructureWordLinks } from './StructureSection';

/** Más sangría que esto no cabe en un teléfono. */
const MAX_SANGRIA = 6;

interface Props {
    lang: StructureLanguage;
    nodes: readonly StructureNode[];
    phrases: readonly VersePhrase[];
    /** Palabra → clase de su frase, si el interruptor «Frases» está prendido (subraya también fuera de las líneas de frase). */
    underline?: ReadonlyMap<string, PhraseKind>;
    ordinal?: ReadonlyMap<string, number>;
    pageIndex?: ReadonlyArray<number | undefined>;
    links?: StructureWordLinks;
    readings?: readonly ClauseReading[];
    /** Palabra → su letra en la repetición en espejo (A B | B′ A′), como la anotó el profesor en Stg 2:18. */
    mirror?: ReadonlyMap<string, MirrorPosition>;
}

/** Un tramo del diagrama: líneas sueltas, o las de una prótasis de varios miembros (con su corchete). */
type Tramo = { grupo?: number; lineas: DiagramLine[] };

function tramos(lineas: readonly DiagramLine[], filas: ReadonlyMap<number, StructureNode>): Tramo[] {
    // Un grupo abarca de su primera a su última línea: lo más profundo que cae entre dos miembros (una
    // relativa, un infinitivo) va DENTRO del corchete, que no se parte (revisión adversarial, 1 Co 15:14, 1 S 17:9).
    const hasta = new Map<number, number>();
    lineas.forEach((l, k) => { const g = filas.get(l.row)?.conditionGroup; if (g !== undefined) hasta.set(g, k); });
    const out: Tramo[] = [];
    let abierto: { grupo: number; fin: number } | null = null;
    lineas.forEach((l, k) => {
        if (abierto && k <= abierto.fin) { out[out.length - 1]!.lineas.push(l); return; }
        abierto = null;
        const g = filas.get(l.row)?.conditionGroup;
        if (g !== undefined) { abierto = { grupo: g, fin: hasta.get(g)! }; out.push({ grupo: g, lineas: [l] }); }
        else out.push({ lineas: [l] });
    });
    return out;
}

/**
 * U11c (revisión del profesor 2026-11, p. 15 y 27): «Estructura» como DIAGRAMA, la forma en que el
 * profesor estructura Stg 2:14 y 2:18. Una línea por cláusula, sangrada según su nivel; la frase
 * preposicional que va con el verbo, en su propia línea; la prótasis de varios miembros, unida por un
 * corchete con su rótulo. Las palabras se enlazan con la página igual que en las tarjetas.
 */
export const StructureDiagram: React.FC<Props> = ({ lang, nodes, phrases, underline, ordinal, pageIndex, links, readings, mirror }) => {
    const { t } = useTranslation('languageStructure');
    const filas = React.useMemo(() => new Map(nodes.map(n => [n.index, n])), [nodes]);
    const lineas = React.useMemo(() => diagramLines(nodes, phrases), [nodes, phrases]);
    const fraseDe = React.useMemo(() => new Map(phrases.flatMap(f => f.rs.map(r => [r, f.kind] as const))), [phrases]);
    const base = Math.min(...nodes.map(n => n.depth));
    const he = lang === 'he';
    /** La apódosis de un grupo: la fila de apódosis más cercana a su condición (puede ir antes o después). */
    const apodosisDe = (grupo: number) => {
        const pos = nodes.findIndex(n => n.conditionGroup === grupo);
        return nodes.map((n, i) => ({ n, d: Math.abs(i - pos) })).filter(x => x.n.isApodosis).sort((a, b) => a.d - b.d)[0]?.n;
    };
    const indiceDe = (r: string) => {
        const o = ordinal?.get(r);
        return o === undefined ? undefined : pageIndex ? pageIndex[o] : o;
    };

    const rotulo = (n: StructureNode): string => {
        if (n.relation === 'condition') return `${t('protasis')}${n.conditionalClass ? ` · ${t(`classLabel.${n.conditionalClass}`)}` : ''}`;
        if (n.conditionGroup !== undefined) return t('protasisMember');
        const lectura = readingFor(n, readings);
        const rel = lectura?.resolved ? t(`resolved.${lectura.resolved}`) : t(`relations.${n.relation}`);
        return n.isApodosis ? `${t('apodosis')} · ${rel}` : rel;
    };

    const palabra = (w: StructureNode['words'][number], n: StructureNode, enFrase: boolean) => {
        const i = indiceDe(w.r);
        const enlazada = i !== undefined;
        const kind = enFrase ? fraseDe.get(w.r) : underline?.get(w.r);
        const Tag = enlazada && links?.onSelect ? 'button' : 'span';
        const el = (
            <Tag
                key={w.r}
                {...(Tag === 'button' ? { type: 'button' as const, onClick: () => links!.onSelect!(i!) } : {})}
                data-frase={kind}
                className={cn(
                    'rounded px-0.5 leading-snug',
                    Tag === 'button' && 'hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                    w.r === n.connector && 'font-semibold text-primary',
                    n.fronted.some(f => f.rs.includes(w.r)) && 'bg-warning/15',
                    kind && SUBRAYADO_FRASE[kind],
                    enlazada && links?.selected === i && 'ring-2 ring-primary',
                )}
            >
                {enlazada && links?.renderText ? links.renderText(i) : w.t}
            </Tag>
        );
        const nodo = enlazada && links?.renderTooltip ? (
            <Tooltip key={w.r} delayDuration={200}>
                <TooltipTrigger asChild>{el}</TooltipTrigger>
                {links.renderTooltip(i)}
            </Tooltip>
        ) : el;
        const letra = mirror?.get(w.r);
        return letra ? (
            <span key={w.r} className="inline-flex items-baseline">
                {nodo}
                <sup className="ml-0.5 text-[10px] font-bold text-primary" data-testid="mirror-letter" dir="ltr">{t(`mirrorLetter.${letra}`)}</sup>
            </span>
        ) : nodo;
    };

    const linea = (l: DiagramLine, k: number) => {
        const n = filas.get(l.row)!;
        const sangria = Math.min(l.depth - base, MAX_SANGRIA) * 1.75;
        const frase = l.kind === 'phrase';
        return (
            <div
                key={k}
                data-testid="diagram-line"
                data-kind={l.kind}
                style={he ? { marginRight: `${sangria}rem` } : { marginLeft: `${sangria}rem` }}
                className={cn('flex flex-wrap items-baseline justify-between gap-x-3', he && 'flex-row-reverse')}
            >
                <span
                    lang={he ? 'he' : 'grc'}
                    dir={he ? 'rtl' : 'ltr'}
                    className={cn('flex flex-wrap items-baseline gap-x-1 text-foreground', he ? 'font-hebrew text-xl' : 'text-lg')}
                >
                    {/* La línea de frase lleva su marca: no es una cláusula aunque quede a la misma sangría. */}
                    {frase && <span aria-hidden className="select-none text-muted-foreground">{he ? '┘' : '└'}</span>}
                    {/* Con espacios entre palabras: al copiar o con lector de pantalla, la línea se lee como texto. */}
                    {l.words.map((w, j) => <React.Fragment key={w.r}>{j > 0 && ' '}{palabra(w, n, frase)}</React.Fragment>)}
                </span>
                {l.kind === 'clause' && (
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground" dir="ltr">{rotulo(n)}</span>
                )}
            </div>
        );
    };

    let k = 0;
    return (
        <>
        <div className="space-y-1" data-testid="structure-diagram">
            {tramos(lineas, filas).map(tr =>
                tr.grupo === undefined ? (
                    tr.lineas.map(l => linea(l, k++))
                ) : (
                    <div
                        key={`g${tr.grupo}`}
                        data-testid="diagram-protasis"
                        className={cn('space-y-1 rounded-sm border-primary/60 py-0.5', he ? 'border-r-2 pr-2' : 'border-l-2 pl-2')}
                    >
                        {tr.lineas.map(l => linea(l, k++))}
                        {(() => {
                            const ap = apodosisDe(tr.grupo!);
                            return ap ? (
                                <p className="m-0 text-[11px] text-muted-foreground" dir="ltr">
                                    {t('diagramToApodosis')}{' '}
                                    {/* El texto griego o hebreo con su dirección propia dentro de la frase en español. */}
                                    <span lang={he ? 'he' : 'grc'} dir={he ? 'rtl' : 'ltr'} className={he ? 'font-hebrew' : undefined}>
                                        {ap.words.slice(0, 3).map(w => w.t).join(' ')}…
                                    </span>
                                </p>
                            ) : null;
                        })()}
                    </div>
                ),
            )}
        </div>
        {/* Las marcas del diagrama, con las mismas clases que las palabras (revisión adversarial: no tenía leyenda). */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground" data-testid="diagram-legend">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />{t('legendConnector')}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-3.5 w-6 rounded bg-warning/15 outline outline-1 outline-warning/40" />{t('legendFronted')}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-muted-foreground">{he ? '┘' : '└'}</span>{t('legendPhraseLine')}</span>
        </div>
        </>
    );
};
