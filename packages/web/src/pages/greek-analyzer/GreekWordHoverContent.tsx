import {
    greekRecognitionClues,
    prepositionUsage,
    translationBridge,
    type GreekKeyInsight,
    type GreekWordInsight,
    type GreekWordToken,
} from '@dosfilos/domain';
import { FrontedNote, type FrontedInfo } from '@/components/language-structure/FrontedNote';
import { GreekVerbFunctionBlock } from './GreekVerbFunctionBlock';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNtLemmaFrequency } from './useLemmaFrequency';
import { GreekCompositionBlock } from './GreekCompositionBlock';
import { GreekParticleBlock } from './GreekParticleBlock';
import { GreekPrepositionBlock } from './GreekPrepositionBlock';
import { useMorphCells } from './useMorphCells';
import { GreekMorphCells } from './GreekMorphCells';

interface Props {
    token: GreekWordToken;
    insight?: GreekWordInsight;
    keyInsight?: GreekKeyInsight;
    relations?: { type: string; note: string; otherText: string }[];
    /** Caso del término de la preposición, para su régimen. */
    objectCase?: string;
    bookCount?: number;
    bookName?: string;
    /** Antepuesta al verbo (dato de MACULA, vista «Estructura»). */
    fronted?: FrontedInfo;
}

/** Una sección del popover: rótulo pequeño + cuerpo. Da el ritmo vertical. */
function Bloque({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <section className="space-y-0.5">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
            <div className="text-sm leading-snug">{children}</div>
        </section>
    );
}

/**
 * El popover de una palabra — REDISEÑADO CON JERARQUÍA, no por acumulación.
 *
 * Creció campo a campo hasta ser una lista plana donde el dato importante
 * pesaba lo mismo que el accesorio; el fundador lo comparó con las tarjetas y
 * tenía razón. El orden ahora es el de la lectura real:
 *
 *   1. IDENTIDAD — la palabra, su transliteración, categoría y lema.
 *   2. QUÉ SIGNIFICA AQUÍ — la traducción, en grande. Es lo que se viene a
 *      buscar al pasar el mouse.
 *   3. POR QUÉ ASÍ — el puente del caso y la función sintáctica: lo que
 *      explica esa traducción.
 *   4. LA FORMA — morfología en celdas (como en la tarjeta) y las pistas.
 *   5. CONTEXTO — rango semántico, relaciones, frecuencia.
 *   6. SIGNIFICANCIA — el "¿y qué?", cerrando, sólo si es palabra clave.
 *
 * Encabezado FIJO: al desplazarse por un análisis largo, la palabra que se
 * está mirando no debe salirse de la vista.
 */
export function GreekWordHoverContent({ token, insight, keyInsight, relations, objectCase, bookCount, bookName, fronted }: Props) {
    const { t } = useTranslation('greekTutor');
    const pistas = greekRecognitionClues(token);
    const ntCount = useNtLemmaFrequency(token.lemma);
    const esRara = ntCount !== null && ntCount > 0 && ntCount <= 5;
    const puente = translationBridge(token);
    const regimen = token.pos === 'P' ? prepositionUsage(token.lemma, objectCase as any) : null;
    const { tag } = token;

    const celdas = useMorphCells(tag);

    return (
        // ANCHO ANTES QUE ALTO — pero sólo sirve si el ancho se USA en dos
        // columnas: un popover más ancho de una sola columna sería igual de
        // largo y además taparía el versículo. En pantallas angostas (iPad
        // vertical, notebook con el panel abierto) el ancho no existe, así
        // que vuelve a una columna y lo que salva es el encabezado fijo.
        <div className="w-[22rem] sm:w-[40rem] max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto overflow-x-hidden text-left">
            {/* 1 · IDENTIDAD — fija al desplazarse. */}
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
                <div className="min-w-0">
                    <div className="text-2xl leading-tight" lang="grc">{token.text}</div>
                    <div className="text-xs text-muted-foreground italic">
                        {token.transliteration}
                        <span className="not-italic"> · {t('analyzer.fields.lemma')} </span>
                        <span className="not-italic font-medium text-foreground" lang="grc">{token.lemma}</span>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                        {t(`analyzer.pos.${token.pos}`)}
                    </span>
                    {keyInsight && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] leading-none text-primary">
                            <Star className="h-2.5 w-2.5" />
                            {t('analyzer.keyWordBadge')}
                        </span>
                    )}
                </div>
            </header>

            <div className="grid gap-x-4 gap-y-3 px-4 py-3 break-words sm:grid-cols-2 sm:items-start">
                {/* COLUMNA 1 — EL SENTIDO: qué significa y por qué. */}
                <div className="space-y-3">
                {/* 2 · QUÉ SIGNIFICA AQUÍ — lo que se viene a buscar. */}
                {insight && (
                    <p className="text-base font-medium leading-snug text-primary">{insight.translation}</p>
                )}

                {/* EL RANGO VA PEGADO AL LEMA, no en el bloque de contexto: el
                    lema ABRE la pregunta ("¿qué puede significar esta raíz?")
                    y el rango la RESPONDE. Separarlos obligaba a bajar y
                    volver para completar una sola idea. */}
                {insight?.semanticRange && (
                    <Bloque label={t('analyzer.fields.semanticRange')}>{insight.semanticRange}</Bloque>
                )}

                {/* 3 · POR QUÉ ASÍ. */}
                <FrontedNote fronted={fronted} />
                <GreekVerbFunctionBlock insight={insight} />
                {regimen && <GreekPrepositionBlock lemma={token.lemma} usage={regimen} />}

                {insight && <GreekParticleBlock insight={insight} />}

                {insight?.composition && <GreekCompositionBlock composition={insight.composition} compact />}

                {/* EL ARTÍCULO, EXPLICADO. Era nuestra palabra peor tratada:
                    paradigma y nada más. El uso anafórico es el que responde
                    "¿por qué este versículo empieza con un artículo?". */}
                {insight?.articleUse && (
                    <div className="rounded-md border border-info/30 bg-info/5 p-2.5 space-y-1">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-info">
                            {t('analyzer.articleUse.title')}
                        </h4>
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
                    </div>
                )}

                {(puente || insight?.caseFunction || insight?.syntacticFunction) && (
                    <div className="space-y-1.5 rounded-md bg-muted/50 p-2.5">
                        {insight?.caseFunction && tag.case && (
                            <div className="text-xs">
                                <span className="font-semibold text-info">
                                    {t(`analyzer.caseFn.${tag.case}.${insight.caseFunction}`)}
                                </span>
                                <span className="text-muted-foreground">
                                    {' — '}
                                    {t(`analyzer.caseFnHint.${insight.caseFunction}`)}
                                </span>
                            </div>
                        )}
                        {puente && (
                            <p className="text-xs italic text-muted-foreground">{t(`analyzer.bridge.${puente}`)}</p>
                        )}
                        {insight?.syntacticFunction && <p className="text-xs">{insight.syntacticFunction}</p>}
                    </div>
                )}

                {insight?.nameNote && (
                    <Bloque label={t('analyzer.fields.nameNote')}>
                        <p className="text-xs leading-relaxed">{insight.nameNote}</p>
                    </Bloque>
                )}
                </div>

                {/* COLUMNA 2 — LA FORMA Y SU CONTEXTO. */}
                <div className="space-y-3">

                {/* 4 · LA FORMA — mismas celdas que la tarjeta. */}
                {/* CELDAS QUE SE ADAPTAN, no una rejilla rígida: con `grid-cols-3`
                    un valor largo ("Imperativo", "Subjuntivo") desbordaba su
                    columna y el popover ganaba scroll HORIZONTAL — el peor en
                    un panel de lectura, porque esconde texto sin avisar.
                    `auto-fit` + `minmax` reparte las que quepan, y `min-w-0`
                    deja que el contenido se ajuste en vez de empujar. */}
                <GreekMorphCells cells={celdas} compact />

                {pistas.length > 0 && (
                    <div className="rounded-md bg-warning/10 p-2.5 space-y-1">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                            {t('analyzer.clues.title')}
                        </h4>
                        <ul className="space-y-0.5 text-xs">
                            {pistas.map((p) => (
                                <li key={p.id}>• {t(`analyzer.clues.${p.id}`, { marker: p.marker })}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 5 · CONTEXTO. */}
                {relations && relations.length > 0 && (
                    <Bloque label={t('analyzer.fields.relations')}>
                        {relations.map((r, i) => (
                            <div key={i} className="text-xs">
                                <span className="font-medium text-info">{t(`analyzer.relation.${r.type}`)}</span>{' '}
                                <span lang="grc">{r.otherText}</span>
                                <div className="text-muted-foreground">{r.note}</div>
                            </div>
                        ))}
                    </Bloque>
                )}

                {ntCount !== null && ntCount > 0 && (
                    <p className={cn('text-xs', esRara ? 'font-medium text-warning' : 'text-muted-foreground')}>
                        {t('analyzer.frequency', { nt: ntCount })}
                        {bookCount !== undefined && bookName && (
                            <> · {t('analyzer.frequencyInBook', { n: bookCount, book: bookName })}</>
                        )}
                        {esRara && <> · {t('analyzer.rareWord')}</>}
                    </p>
                )}

                </div>

                {/* 6 · SIGNIFICANCIA — a TODO EL ANCHO: es la prosa más larga,
                    y en una columna angosta se volvería una torre. */}
                <div className="sm:col-span-2 space-y-3">
                {keyInsight && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-1">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {t('analyzer.significance')}
                        </h4>
                        <p className="text-xs leading-relaxed">{keyInsight.significance}</p>
                    </div>
                )}

                {pistas.length > 0 && (
                    <p className="border-t border-border/60 pt-2 text-[10px] leading-relaxed text-muted-foreground">
                        {t('analyzer.clues.source')}
                    </p>
                )}
                </div>
            </div>
        </div>
    );
}
