import { greekRecognitionClues, prepositionUsage, translationBridge, type GreekKeyInsight, type GreekWordInsight, type GreekWordToken } from '@dosfilos/domain';
import { FrontedNote, type FrontedInfo } from '@/components/language-structure/FrontedNote';
import { GreekVerbFunctionBlock } from './GreekVerbFunctionBlock';
import { GreekAgencyBlock, GreekAnaphoraRuleNote } from './GreekNominalRuleBlock';
import { Star, BookmarkPlus, Check } from 'lucide-react';
import { useNtLemmaFrequency } from './useLemmaFrequency';
import { GreekCompositionBlock } from './GreekCompositionBlock';
import { GreekParticleBlock } from './GreekParticleBlock';
import { GreekPrepositionBlock } from './GreekPrepositionBlock';
import { useMorphCells } from './useMorphCells';
import { GreekMorphCells } from './GreekMorphCells';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Props {
    token: GreekWordToken;
    /** El aporte del modelo (fase 2): rango, función, traducción. Opcional. */
    insight?: GreekWordInsight;
    /** La significancia homilética, si esta palabra es una de las claves. */
    keyInsight?: GreekKeyInsight;
    /**
     * El caso del TÉRMINO de la preposición (la palabra que rige) — lo pone
     * quien conoce el versículo. Sin él no se sabe qué sentido toma.
     */
    objectCase?: string;
    /** Relaciones de ESTA palabra con otras, ya resueltas a texto. */
    relations?: { type: string; note: string; otherText: string }[];
    /** Frecuencia del lema en el libro actual (runtime, determinista). */
    bookCount?: number;
    /** Nombre del libro, para la línea de frecuencia. */
    bookName?: string;
    /** Antepuesta al verbo (dato de MACULA, vista «Estructura»). */
    fronted?: FrontedInfo;
    /** Guardar el hallazgo para el sermón. Presente sólo con insight. */
    onSaveFinding?: () => void;
    saved?: boolean;
    highlighted?: boolean;
    onClick?: () => void;
}

/** Color de la insignia por categoría — misma paleta semántica del hebreo. */
const POS_BADGE: Record<string, string> = {
    V: 'bg-primary/10 text-primary',
    N: 'bg-info/10 text-info',
    A: 'bg-warning/10 text-warning',
    RA: 'bg-muted text-muted-foreground',
    RP: 'bg-muted text-muted-foreground',
    RR: 'bg-muted text-muted-foreground',
    RD: 'bg-muted text-muted-foreground',
    RI: 'bg-muted text-muted-foreground',
};

/**
 * Una palabra griega con su morfología de MorphGNT — el espejo de la
 * `WordCard` del hebreo, con la gramática del griego (caso/tiempo/voz/modo
 * en vez de binyan/forma/estado).
 *
 * TODO EL CONTENIDO ES DETERMINISTA: viene del dataset, no de un modelo. Las
 * celdas ausentes no se muestran — un rótulo sobre un guion no informa nada.
 */
export function GreekWordCard({
    token,
    insight,
    keyInsight,
    objectCase,
    relations,
    bookCount,
    bookName,
    fronted,
    onSaveFinding,
    saved,
    highlighted,
    onClick,
}: Props) {
    const { t } = useTranslation('greekTutor');
    const { tag } = token;
    const pistas = greekRecognitionClues(token);
    const ntCount = useNtLemmaFrequency(token.lemma);
    // La RAREZA es el dato que se cita en el púlpito: "δίψυχος aparece sólo
    // 2 veces en todo el NT". Se destaca cuando de verdad es raro.
    const esRara = ntCount !== null && ntCount > 0 && ntCount <= 5;
    const puente = translationBridge(token);
    const regimen = token.pos === 'P' ? prepositionUsage(token.lemma, objectCase as any) : null;

    const celdas = useMorphCells(tag);

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                // `flex-col` + `h-full`: un <button> CENTRA su contenido por
                // defecto — en el grid, las tarjetas cortas flotaban al medio
                // de la fila con aire arriba. El contenido arranca en el tope
                // y todas las tarjetas igualan la altura de su fila.
                'flex h-full flex-col items-stretch justify-start text-left rounded-lg border border-border bg-card p-4 space-y-3 transition-colors',
                onClick && 'hover:border-primary/40',
                highlighted && 'border-primary ring-1 ring-primary/30',
            )}
        >
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'rounded px-1.5 py-0.5 text-[11px] leading-none font-medium',
                        POS_BADGE[token.pos] ?? 'bg-muted text-muted-foreground',
                    )}
                >
                    {t(`analyzer.pos.${token.pos}`)}
                </span>
                {keyInsight && (
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] leading-none text-primary">
                        <Star className="h-3 w-3" />
                        {t('analyzer.keyWordBadge')}
                    </span>
                )}
                {onSaveFinding && (
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!saved) onSaveFinding();
                        }}
                        onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !saved) {
                                e.stopPropagation();
                                onSaveFinding();
                            }
                        }}
                        className={cn(
                            'ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-none transition-colors',
                            saved
                                ? 'bg-success/10 text-success cursor-default'
                                : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer',
                        )}
                        title={saved ? t('analyzer.findingSaved') : t('analyzer.saveFinding')}
                    >
                        {saved ? <Check className="h-3 w-3" /> : <BookmarkPlus className="h-3 w-3" />}
                        {saved ? t('analyzer.findingSavedShort') : t('analyzer.saveFindingShort')}
                    </span>
                )}
            </div>

            <div className="flex items-baseline justify-between gap-3">
                <div>
                    <div className="text-2xl leading-tight" lang="grc">
                        {token.text}
                    </div>
                    <div className="text-xs text-muted-foreground italic">{token.transliteration}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t('analyzer.fields.lemma')}
                    </div>
                    <div className="text-sm font-medium" lang="grc">
                        {token.lemma}
                    </div>
                </div>
            </div>

            {insight && (
                <div className="text-sm font-medium text-primary">{insight.translation}</div>
            )}

            <FrontedNote fronted={fronted} />
            <GreekVerbFunctionBlock insight={insight} mood={token.tag.mood} tense={token.tag.tense} />

            {puente && (
                <div className="text-xs italic text-muted-foreground">{t(`analyzer.bridge.${puente}`)}</div>
            )}

            {regimen && <GreekPrepositionBlock lemma={token.lemma} usage={regimen} />}
            <GreekAgencyBlock insight={insight} />

            {insight && <GreekParticleBlock insight={insight} />}

            {insight?.composition && <GreekCompositionBlock composition={insight.composition} />}

            {insight?.articleUse && (
                <div className="rounded-md border border-info/30 bg-info/5 p-2.5 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-info">
                        {t('analyzer.articleUse.title')}
                    </div>
                    <p className="text-xs">
                        <span className="font-semibold">{t(`analyzer.articleUse.${insight.articleUse}`)}</span>
                        {' — '}
                        <span className="text-muted-foreground">
                            {t(`analyzer.articleUseHint.${insight.articleUse}`)}
                        </span>
                    </p>
                    {insight.antecedent && (
                        <p className="text-xs">
                            <span className="text-muted-foreground">{t('analyzer.articleUse.pointsBack')}: </span>
                            <span className="font-medium" lang="grc">{insight.antecedent}</span>
                        </p>
                    )}
                    <GreekAnaphoraRuleNote insight={insight} />
                </div>
            )}

            {ntCount !== null && ntCount > 0 && (
                <div className={cn('text-xs', esRara ? 'font-medium text-warning' : 'text-muted-foreground')}>
                    {t('analyzer.frequency', { nt: ntCount })}
                    {bookCount !== undefined && bookName && (
                        <> · {t('analyzer.frequencyInBook', { n: bookCount, book: bookName })}</>
                    )}
                    {esRara && <> · {t('analyzer.rareWord')}</>}
                </div>
            )}

            <GreekMorphCells cells={celdas} />

            {pistas.length > 0 && (
                <div className="rounded-md bg-warning/10 p-2.5 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                        {t('analyzer.clues.title')}
                    </div>
                    <ul className="space-y-0.5 text-xs">
                        {pistas.map((p) => (
                            <li key={p.id}>• {t(`analyzer.clues.${p.id}`, { marker: p.marker })}</li>
                        ))}
                    </ul>
                </div>
            )}

            {insight?.nameNote && (
                <div className="rounded-md bg-muted/60 p-2.5 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('analyzer.fields.nameNote')}
                    </div>
                    <p className="text-xs leading-relaxed">{insight.nameNote}</p>
                </div>
            )}

            {insight && (
                <div className="space-y-1.5 border-t border-border/60 pt-2">
                    {/* LA FUNCIÓN DEL CASO — el nombre técnico que el profesor
                        evalúa, de la taxonomía cerrada: "nominativo absoluto",
                        no "sujeto del saludo implícito". */}
                    {insight.caseFunction && tag.case && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {t('analyzer.fields.caseFunction')}
                            </div>
                            <div className="text-sm font-medium text-info">
                                {t(`analyzer.caseFn.${tag.case}.${insight.caseFunction}`)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {t(`analyzer.caseFnHint.${insight.caseFunction}`)}
                            </div>
                        </div>
                    )}
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {t('analyzer.fields.semanticRange')}
                        </div>
                        <div className="text-sm">{insight.semanticRange}</div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {t('analyzer.fields.syntacticFunction')}
                        </div>
                        <div className="text-sm">{insight.syntacticFunction}</div>
                    </div>
                </div>
            )}

            {relations && relations.length > 0 && (
                <div className="space-y-1 border-t border-border/60 pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {t('analyzer.fields.relations')}
                    </div>
                    {relations.map((r, i) => (
                        <div key={i} className="text-xs">
                            <span className="font-medium text-info">{t(`analyzer.relation.${r.type}`)}</span>
                            {' · '}
                            <span lang="grc">{r.otherText}</span>
                            <div className="text-muted-foreground">{r.note}</div>
                        </div>
                    ))}
                </div>
            )}

            {keyInsight && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {t('analyzer.significance')}
                    </div>
                    <p className="text-sm leading-relaxed">{keyInsight.significance}</p>
                </div>
            )}
        </button>
    );
}
