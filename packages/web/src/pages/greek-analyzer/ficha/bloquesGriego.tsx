import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkPlus, Check, Star } from 'lucide-react';
import {
    greekRecognitionClues, prepositionUsage, tenseUseSources, translationBridge, VERB_RULE_SOURCES, verbFunctionSources,
    type GreekCase, type GreekKeyInsight, type GreekVerbForm, type GreekWordInsight, type GreekWordToken,
} from '@dosfilos/domain';
import { FrontedNote, type FrontedInfo } from '@/components/language-structure/FrontedNote';
import type { FichaRegistro } from '@/components/word-ficha/fichaRegistro';
import { FichaCaja, FichaCeldas, FichaFilas, FichaFuncion, FichaOrigenRotulo, FichaPistas } from '@/components/word-ficha/FichaPiezas';
import { cn } from '@/lib/utils';
import { GreekAgencyBlock, GreekAnaphoraRuleNote, GreekAutosBlock } from '../GreekNominalRuleBlock';
import { GreekCompositionBlock } from '../GreekCompositionBlock';
import { GreekParticleBlock } from '../GreekParticleBlock';
import { GreekPrepositionBlock } from '../GreekPrepositionBlock';
import { useMorphCells } from '../useMorphCells';
import { useNtLemmaFrequency } from '../useLemmaFrequency';

/**
 * LA FICHA DE UNA PALABRA GRIEGA: sus bloques, en el mismo orden que la del
 * hebreo. Reúne lo que antes estaba en la tarjeta (`GreekWordCard`) y el
 * popover (`GreekWordHoverContent`).
 */

export interface DatosGriego {
    readonly token: GreekWordToken;
    readonly insight?: GreekWordInsight;
    readonly keyInsight?: GreekKeyInsight;
    readonly relations?: readonly { type: string; note: string; otherText: string }[];
    /** Caso del término de la preposición, para su régimen. */
    readonly objectCase?: string;
    readonly bookCount?: number;
    readonly bookName?: string;
    readonly fronted?: FrontedInfo;
    /** Guardar el hallazgo para el sermón. */
    readonly onSaveFinding?: () => void;
    readonly saved?: boolean;
}

/** Modo de MorphGNT → forma, para citar la sección de ESE modo. */
const FORMA_DEL_MODO: Readonly<Record<string, GreekVerbForm>> = { P: 'participle', N: 'infinitive', S: 'subjunctive', D: 'imperative', O: 'optative' };
const regimenDe = (d: DatosGriego) => (d.token.pos === 'P' ? prepositionUsage(d.token.lemma, d.objectCase as GreekCase | undefined) : null);
const grc = (s: string) => <span lang="grc" className="font-medium">{s}</span>;

function Insignia({ children, tono = 'muted' }: { children: React.ReactNode; tono?: 'muted' | 'primary' }) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider', tono === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            {children}
        </span>
    );
}

/** La función del verbo (G2, Wallace): una regla que decide o la elección del asistente. */
function FuncionVerbo({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const i = d.insight!;
    const fuentes = i.verbRule ? VERB_RULE_SOURCES[i.verbRule] : verbFunctionSources(i.verbFunction!, FORMA_DEL_MODO[d.token.tag.mood ?? ''] ?? 'other');
    return (
        <FichaFuncion
            titulo={t('analyzer.verbFn.title')}
            nombre={t(`analyzer.verbFn.functions.${i.verbFunction}`)}
            origen={i.verbRule ? 'regla' : 'asistente'}
            texto={i.verbNote}
            reconoce={i.verbRule ? t(`analyzer.verbFn.rules.${i.verbRule}`) : undefined}
            fuentes={fuentes}
            porValidar={!!i.verbRule}
            testId="verb-function"
        />
    );
}

/** El uso del tiempo en el indicativo (lo elige el asistente). */
function UsoTiempo({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const i = d.insight!;
    return (
        <FichaFuncion
            titulo={t('analyzer.verbFn.tenseTitle')}
            nombre={t(`analyzer.verbFn.tenseUses.${i.tenseUse}`)}
            origen="asistente"
            texto={i.verbFunction ? undefined : i.verbNote}
            fuentes={tenseUseSources(i.tenseUse!, d.token.tag.tense)}
            testId="tense-use"
        />
    );
}

/** La función del caso, con su puente de traducción y la función sintáctica del asistente. */
function FuncionCaso({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const i = d.insight!;
    const puente = translationBridge(d.token);
    return (
        <FichaFuncion
            titulo={t('analyzer.fields.caseFunction')}
            nombre={t(`analyzer.caseFn.${d.token.tag.case}.${i.caseFunction}`)}
            origen="asistente"
            texto={<>{t(`analyzer.caseFnHint.${i.caseFunction}`)}{i.syntacticFunction && <span className="mt-1 block">{i.syntacticFunction}</span>}</>}
            extra={puente ? <><dt className="text-info-subtle-foreground">{t('analyzer.fichaBridge')}</dt><dd className="m-0 italic">{t(`analyzer.bridge.${puente}`)}</dd></> : undefined}
            testId="case-function"
        />
    );
}

export const BLOQUES_GRIEGO: FichaRegistro<DatosGriego> = [
    // ENCABEZADO
    {
        id: 'gr.palabra', dato: 'La palabra, su transliteración y su lema', seccion: 'encabezado', lugar: 'titulo', origen: 'datos', antes: ['tarjeta', 'tooltip'],
        hay: () => true,
        Completo: function Palabra({ d }) {
            const { t } = useTranslation('greekTutor');
            return (
                <>
                    <span lang="grc" className="text-4xl font-medium leading-tight">{d.token.text}</span>
                    <span className="text-sm italic text-muted-foreground">{d.token.transliteration}<span className="not-italic"> · {t('analyzer.fields.lemma')} </span>{grc(d.token.lemma)}</span>
                </>
            );
        },
        Corto: function Palabra({ d }) {
            const { t } = useTranslation('greekTutor');
            return (
                <>
                    <span lang="grc" className="text-2xl font-medium leading-tight">{d.token.text}</span>
                    <span className="text-xs italic text-muted-foreground">{d.token.transliteration}<span className="not-italic"> · {t('analyzer.fields.lemma')} </span>{grc(d.token.lemma)}</span>
                </>
            );
        },
    },
    {
        id: 'gr.categoria', dato: 'Categoría', seccion: 'encabezado', lugar: 'insignia', origen: 'datos', antes: ['tarjeta', 'tooltip'],
        hay: () => true,
        Completo: function Categoria({ d }) { const { t } = useTranslation('greekTutor'); return <Insignia>{t(`analyzer.pos.${d.token.pos}`)}</Insignia>; },
        Corto: function Categoria({ d }) { const { t } = useTranslation('greekTutor'); return <Insignia>{t(`analyzer.pos.${d.token.pos}`)}</Insignia>; },
    },
    {
        id: 'gr.palabraClave', dato: 'Insignia «Palabra clave»', seccion: 'encabezado', lugar: 'insignia', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.keyInsight,
        Completo: function Clave() { const { t } = useTranslation('greekTutor'); return <Insignia tono="primary"><Star className="h-3 w-3" />{t('analyzer.keyWordBadge')}</Insignia>; },
        Corto: function Clave() { const { t } = useTranslation('greekTutor'); return <Insignia tono="primary"><Star className="h-3 w-3" />{t('analyzer.keyWordBadge')}</Insignia>; },
    },
    {
        id: 'gr.traduccion', dato: 'Traducción en contexto', seccion: 'encabezado', lugar: 'traduccion', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.translation,
        Completo: ({ d }) => <>«{d.insight!.translation}»</>,
        Corto: ({ d }) => <>«{d.insight!.translation}»</>,
    },

    // LA PALABRA
    {
        id: 'gr.rango', dato: 'Rango semántico', seccion: 'palabra', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.semanticRange,
        Completo: function Rango({ d }) { const { t } = useTranslation('greekTutor'); return <FichaFilas filas={[[t('analyzer.fields.semanticRange'), d.insight!.semanticRange]]} />; },
    },
    {
        id: 'gr.frecuencia', dato: 'Frecuencia (NT, libro, palabra rara)', seccion: 'palabra', origen: 'datos', antes: ['tarjeta', 'tooltip'],
        hay: () => true,
        Completo: function Frecuencia({ d }) {
            const { t } = useTranslation('greekTutor');
            const nt = useNtLemmaFrequency(d.token.lemma);
            if (nt === null || nt <= 0) return null;
            const rara = nt <= 5;
            return (
                <FichaFilas filas={[[t('analyzer.fichaFrequency'), (
                    <span className={cn(rara && 'font-semibold text-warning-subtle-foreground')}>
                        {t('analyzer.frequency', { nt })}
                        {d.bookCount !== undefined && d.bookName && <> · {t('analyzer.frequencyInBook', { n: d.bookCount, book: d.bookName })}</>}
                        {rara && <> · {t('analyzer.rareWord')}</>}
                    </span>
                )]]} />
            );
        },
    },
    {
        id: 'gr.composicion', dato: 'Composición de la palabra', seccion: 'palabra', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.composition,
        Completo: ({ d }) => <GreekCompositionBlock composition={d.insight!.composition!} />,
    },
    {
        id: 'gr.nombre', dato: 'Nota sobre el nombre', seccion: 'palabra', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.nameNote,
        Completo: function Nombre({ d }) { const { t } = useTranslation('greekTutor'); return <FichaCaja titulo={t('analyzer.fields.nameNote')}><p className="m-0 text-[13.5px] leading-relaxed">{d.insight!.nameNote}</p></FichaCaja>; },
    },

    // LA FORMA
    {
        id: 'gr.celdas', dato: 'Tiempo, voz, modo, persona, caso, número, género, grado', seccion: 'forma', origen: 'datos', antes: ['tarjeta', 'tooltip'],
        hay: () => true,
        Completo: function Celdas({ d }) { return <FichaCeldas celdas={useMorphCells(d.token.tag)} />; },
        Corto: function Linea({ d }) {
            const celdas = useMorphCells(d.token.tag);
            return celdas.length ? <p className="m-0 font-medium text-foreground/85">{celdas.map(c => c.value).join(' · ')}</p> : null;
        },
    },
    {
        id: 'gr.pistas', dato: 'Cómo se reconoce: la forma (pistas y su fuente)', seccion: 'forma', origen: 'regla', antes: ['tarjeta', 'tooltip'],
        hay: (d) => greekRecognitionClues(d.token).length > 0,
        Completo: function Pistas({ d }) {
            const { t } = useTranslation('greekTutor');
            const { t: tf } = useTranslation('languageStructure');
            const pistas = greekRecognitionClues(d.token);
            return (
                <FichaCaja titulo={tf('wordFicha.howRecognized')} plegable pie={t('analyzer.clues.source')} testId="ficha-pistas">
                    <FichaPistas pistas={pistas.map(p => t(`analyzer.clues.${p.id}`, { marker: p.marker }))} />
                </FichaCaja>
            );
        },
    },

    // SU FUNCIÓN
    {
        id: 'gr.funcionVerbo', dato: 'Función del verbo', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.verbFunction, Completo: FuncionVerbo,
        Corto: function Corto({ d }) {
            const { t } = useTranslation('greekTutor');
            return <p className="m-0 flex flex-wrap items-center gap-x-2"><FichaOrigenRotulo origen={d.insight!.verbRule ? 'regla' : 'asistente'} /><strong className="font-bold">{t(`analyzer.verbFn.functions.${d.insight!.verbFunction}`)}</strong></p>;
        },
    },
    {
        id: 'gr.usoTiempo', dato: 'Uso del tiempo (indicativo)', seccion: 'funcion', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.tenseUse, Completo: UsoTiempo,
    },
    {
        id: 'gr.caso', dato: 'Función del caso, su puente de traducción y la función sintáctica', seccion: 'funcion', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!(d.insight?.caseFunction && d.token.tag.case), Completo: FuncionCaso,
        Corto: function Corto({ d }) {
            const { t } = useTranslation('greekTutor');
            return <p className="m-0 flex flex-wrap items-center gap-x-2"><FichaOrigenRotulo origen="asistente" /><strong className="font-bold">{t(`analyzer.caseFn.${d.token.tag.case}.${d.insight!.caseFunction}`)}</strong></p>;
        },
    },
    {
        // Sin función del caso, la sintáctica (y el puente de traducción) va sola; con caso, dentro de su bloque.
        // El puente sale del dato: se muestra aunque no haya análisis del asistente, como antes.
        id: 'gr.funcionSintactica', dato: 'Función sintáctica (texto del asistente) y puente de traducción', seccion: 'funcion', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => (!!d.insight?.syntacticFunction || !!translationBridge(d.token)) && !(d.insight?.caseFunction && d.token.tag.case),
        Completo: ({ d }) => <FichaFuncion origen="asistente" texto={<>{d.insight?.syntacticFunction}<PuenteSuelto d={d} /></>} testId="ficha-funcion" />,
        Corto: ({ d }) => (d.insight?.syntacticFunction
            ? <p className="m-0 flex items-start gap-2"><FichaOrigenRotulo origen="asistente" /><span className="line-clamp-2">{d.insight.syntacticFunction}</span></p>
            : null),
    },
    {
        id: 'gr.preposicion', dato: 'Régimen de la preposición', seccion: 'funcion', origen: 'regla', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!regimenDe(d), Completo: ({ d }) => <GreekPrepositionBlock lemma={d.token.lemma} usage={regimenDe(d)!} />,
    },
    {
        id: 'gr.articulo', dato: 'Uso del artículo, su antecedente y la regla de anáfora', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.articleUse,
        Completo: function Articulo({ d }) {
            const { t } = useTranslation('greekTutor');
            const i = d.insight!;
            return (
                <div className="flex flex-col gap-1 rounded-2xl border border-info/30 bg-info-subtle px-4 py-3" data-testid="article-use">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('analyzer.articleUse.title')}</span>
                    <p className="m-0 text-[13.5px]"><strong className="font-bold">{t(`analyzer.articleUse.${i.articleUse}`)}</strong> — <span className="text-foreground/80">{t(`analyzer.articleUseHint.${i.articleUse}`)}</span></p>
                    {i.antecedent && <p className="m-0 text-[13px]"><span className="text-muted-foreground">{t('analyzer.articleUse.pointsBack')}: </span>{grc(i.antecedent)}</p>}
                    <GreekAnaphoraRuleNote insight={i} />
                </div>
            );
        },
    },
    {
        id: 'gr.particulas', dato: 'Partículas y pronombre explícito', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight && (!!d.insight.discourseFunction || d.insight.discourseRule === 'overtPronoun'),
        Completo: ({ d }) => <GreekParticleBlock insight={d.insight!} />,
    },
    {
        id: 'gr.agencia', dato: 'Agencia (agente de la pasiva)', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.agency, Completo: ({ d }) => <GreekAgencyBlock insight={d.insight} />,
    },
    {
        id: 'gr.autos', dato: 'Uso de αὐτός', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.insight?.autosUse, Completo: ({ d }) => <GreekAutosBlock insight={d.insight} />,
    },

    // EN EL CONTEXTO
    {
        id: 'gr.antepuesta', dato: 'Antepuesta al verbo', seccion: 'contexto', origen: 'datos', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.fronted, Completo: ({ d }) => <FrontedNote fronted={d.fronted} />,
    },
    {
        id: 'gr.relaciones', dato: 'Relaciones con otras palabras', seccion: 'contexto', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.relations?.length,
        Completo: function Relaciones({ d }) {
            const { t } = useTranslation('greekTutor');
            return (
                <FichaCaja titulo={t('analyzer.fields.relations')}>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                        {d.relations!.map((r, k) => (
                            <li key={k}><span className="font-semibold text-info-subtle-foreground">{t(`analyzer.relation.${r.type}`)}</span> · {grc(r.otherText)}<span className="block text-muted-foreground">{r.note}</span></li>
                        ))}
                    </ul>
                </FichaCaja>
            );
        },
    },

    // PARA ESTUDIAR
    {
        id: 'gr.significancia', dato: 'Significancia (palabra clave)', seccion: 'estudio', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.keyInsight,
        Completo: function Significancia({ d }) {
            const { t } = useTranslation('greekTutor');
            return <FichaCaja titulo={t('analyzer.significance')} testId="ficha-significancia"><p className="m-0 text-[13.5px] leading-relaxed">{d.keyInsight!.significance}</p></FichaCaja>;
        },
    },

    // ACCIONES
    {
        id: 'gr.guardar', dato: 'Guardar hallazgo para el sermón', seccion: 'acciones', origen: 'accion', antes: ['tarjeta'],
        hay: (d) => !!d.onSaveFinding,
        Completo: function Guardar({ d }) {
            const { t } = useTranslation('greekTutor');
            return (
                <button
                    type="button"
                    onClick={() => !d.saved && d.onSaveFinding!()}
                    disabled={d.saved}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-[13.5px] font-bold text-primary hover:bg-primary/15 disabled:cursor-default disabled:opacity-80 print:hidden"
                >
                    {d.saved ? <Check className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                    {d.saved ? t('analyzer.findingSaved') : t('analyzer.saveFinding')}
                </button>
            );
        },
    },
];

/** El puente de traducción, cuando no hay bloque del caso que lo lleve (palabras sin función del caso). */
function PuenteSuelto({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const puente = translationBridge(d.token);
    return puente ? <span className="mt-1 block text-[13px] italic text-muted-foreground">{t(`analyzer.bridge.${puente}`)}</span> : null;
}

/**
 * DÓNDE VA CADA CAMPO. Como en el hebreo: `Record<keyof …>` obliga a nombrar
 * todos; la prueba de paridad comprueba que cada bloque exista.
 */
type Destino = string | { readonly fuera: string };
export const DESTINO_TOKEN: Readonly<Record<keyof GreekWordToken, Destino>> = {
    text: 'gr.palabra', lemma: 'gr.palabra', transliteration: 'gr.palabra', pos: 'gr.categoria', tag: 'gr.celdas',
};
export const DESTINO_INSIGHT: Readonly<Record<keyof GreekWordInsight, Destino>> = {
    text: { fuera: 'La palabra se muestra desde el token de MorphGNT; este texto sólo alinea el análisis.' },
    semanticRange: 'gr.rango',
    syntacticFunction: 'gr.funcionSintactica',
    caseFunction: 'gr.caso',
    nameNote: 'gr.nombre',
    articleUse: 'gr.articulo',
    antecedent: 'gr.articulo',
    discourseFunction: 'gr.particulas',
    connects: 'gr.particulas',
    composition: 'gr.composicion',
    translation: 'gr.traduccion',
    verbFunction: 'gr.funcionVerbo',
    verbRule: 'gr.funcionVerbo',
    tenseUse: 'gr.usoTiempo',
    verbNote: 'gr.funcionVerbo',
    agency: 'gr.agencia',
    nominalRule: 'gr.agencia',
    autosUse: 'gr.autos',
    autosHeadText: 'gr.autos',
    autosTogether: 'gr.autos',
    autosHeadTranslation: 'gr.autos',
    discourseRule: 'gr.particulas',
    overtPronounVerb: { fuera: 'Índice interno del verbo; el texto se muestra con overtPronounVerbText.' },
    overtPronounVerbText: 'gr.particulas',
};
export const DESTINO_CLAVE: Readonly<Record<keyof GreekKeyInsight, Destino>> = {
    index: { fuera: 'Índice interno para ubicar la palabra clave.' },
    text: { fuera: 'Alinea la palabra clave con el versículo.' },
    significance: 'gr.significancia',
};
