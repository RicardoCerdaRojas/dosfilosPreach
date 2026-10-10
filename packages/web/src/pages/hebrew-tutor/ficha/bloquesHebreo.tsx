import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search } from 'lucide-react';
import {
    HEBREW_KI_SOURCES, HEBREW_PARTICIPLE_SOURCES, hebrewInfinitiveSources,
    type HebrewInfinitiveView, type HebrewKiView, type HebrewParticipleView, type RuleChoiceView, type RuleSource, type WordAnalysis,
} from '@dosfilos/domain';
import { FrontedNote, type FrontedInfo } from '@/components/language-structure/FrontedNote';
import type { FichaBloque, FichaRegistro } from '@/components/word-ficha/fichaRegistro';
import { FichaCaja, FichaCeldas, FichaFilas, FichaFuncion, FichaOrigenRotulo, FichaPistas } from '@/components/word-ficha/FichaPiezas';
import { cn } from '@/lib/utils';
import type { SpeechView } from '../hooks/useEstructuraHebrea';
import { SpeechNote } from '../components/SpeechNote';
import { MorphemeSpan, MORPHEME_BADGE_STYLES, getMorphemeCategory } from '../components/MorphemeSpan';
import { OshbValidationBadge } from '../components/OshbValidationBadge';
import { OshbCorrectionsList } from '../components/OshbCorrectionsList';
import { WeakVerbDetective } from '../components/WeakVerbDetective';
import { COLORES_MORFEMAS } from './coloresMorfemas';

/**
 * LA FICHA DE UNA PALABRA HEBREA: sus bloques, en el orden de lectura.
 * Reúne lo que antes estaba repartido en la tarjeta (`WordCard`), el tooltip
 * (`WordTooltipContent`) y el panel «Tutor interactivo» (`WordTutorSheet`).
 * La tabla de destino (`docs/FICHA_DE_PALABRA.md`) sale de esta lista.
 */

export interface DatosHebreo {
    readonly word: WordAnalysis;
    readonly fronted?: FrontedInfo;
    readonly speech?: SpeechView;
    readonly infinitive?: HebrewInfinitiveView;
    readonly participle?: HebrewParticipleView;
    readonly ki?: HebrewKiView;
    /** Abre el detective (verbos y nombres). */
    readonly onInvestigate?: () => void;
}

const he = (s: string, tam = 'text-[1.15em]') => <span dir="rtl" lang="he" className={cn('font-hebrew', tam)}>{s}</span>;
const vm = (d: DatosHebreo) => d.word.verbMorphology;
const nm = (d: DatosHebreo) => d.word.nominalMorphology;
const tiposDeVerbo = (d: DatosHebreo): string[] => {
    const v = vm(d)?.verbType;
    if (!v) return [];
    return (Array.isArray(v) ? v : String(v).split(',')).map(x => x.trim()).filter(Boolean);
};
const esDebil = (d: DatosHebreo) => tiposDeVerbo(d).some(x => !['STRONG', 'FUERTE'].includes(x.toUpperCase()));
/** וַיְהִי: marca de apertura narrativa (la detección que ya hacía la tarjeta). */
const esApertura = (d: DatosHebreo) => {
    const w = d.word;
    return w.category === 'VERB' && vm(d)?.verbForm?.toUpperCase() === 'WAYYIQTOL'
        && (w.root === 'היה' || w.root === 'הָיָה' || !!w.hebrewText?.includes('וַיְהִי') || /wayh[iî]/i.test(w.transliteration ?? ''));
};
/** Traducción con respaldo: lo que hacía el tooltip. */
const traduccion = (w: WordAnalysis) => w.translation || w.lemmaGloss || w.rootMeaning || w.root || w.hebrewText || '';
const investigable = (d: DatosHebreo) => {
    const c = d.word.category?.toUpperCase() ?? '';
    return !!d.onInvestigate && (c === 'VERB' || ['NOUN', 'PROPER_NOUN', 'ADJECTIVE', 'PRONOUN', 'PERSONAL_PRONOUN', 'DEMONSTRATIVE_PRONOUN', 'RELATIVE_PRONOUN'].includes(c));
};
const funcionDeRegla = (d: DatosHebreo) => !!(d.infinitive || d.participle || d.ki);

function Insignia({ children, tono = 'primary', title }: { children: React.ReactNode; tono?: 'primary' | 'destructive' | 'warning'; title?: string }) {
    const tonos = {
        primary: 'bg-primary/10 text-primary',
        destructive: 'bg-destructive/10 text-destructive',
        warning: 'bg-warning-subtle text-warning-subtle-foreground',
    };
    return <span title={title} className={cn('rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider', tonos[tono])}>{children}</span>;
}

/** Las celdas de la forma, traducidas. Las ausentes no se muestran. */
function useCeldas(d: DatosHebreo) {
    const { t } = useTranslation('hebrewTutor');
    const celdas: { label: string; value: string; ancha?: boolean }[] = [];
    const v = vm(d), n = nm(d);
    if (v?.binyan) celdas.push({ label: t('verseAnalyzer.ficha.cells.binyan'), value: String(v.binyan) });
    if (v?.verbForm) celdas.push({ label: t('verseAnalyzer.ficha.cells.form'), value: t(`verseAnalyzer.verbForms.${v.verbForm}`) });
    const tipos = tiposDeVerbo(d);
    const clase = (v as { rootClassification?: string | null } | undefined)?.rootClassification;
    if (clase || tipos.length) celdas.push({ label: t('verseAnalyzer.ficha.cells.rootType'), value: clase || tipos.map(x => t(`verseAnalyzer.verbTypes.${x}`)).join(', ') });
    const persona = v?.person ?? n?.person;
    if (persona) celdas.push({ label: t('verseAnalyzer.ficha.cells.person'), value: String(persona) });
    const g = v?.gender ?? n?.gender, num = v?.number ?? n?.number;
    if (g) celdas.push({ label: t('verseAnalyzer.ficha.cells.gender'), value: t(`verseAnalyzer.morphology.gender.${String(g).toUpperCase()}`) });
    if (num) celdas.push({ label: t('verseAnalyzer.ficha.cells.number'), value: t(`verseAnalyzer.morphology.number.${String(num).toUpperCase()}`) });
    if (n?.state) celdas.push({ label: t('verseAnalyzer.ficha.cells.state'), value: t(`verseAnalyzer.morphology.state.${String(n.state).toUpperCase()}`) });
    if (v?.temporalValue) celdas.push({ label: t('verseAnalyzer.ficha.cells.temporalValue'), value: v.temporalValue, ancha: true });
    return celdas;
}

/** P-G-N compacto («2MS»), como el tooltip de antes. */
const pgn = (d: DatosHebreo) => {
    const v = vm(d);
    if (!v) return '';
    return `${v.person != null ? String(v.person).charAt(0) : ''}${v.gender != null ? String(v.gender).charAt(0) : ''}${v.number != null ? String(v.number).charAt(0) : ''}`.toUpperCase();
};

// ── La función: un bloque por forma con regla (infinitivo, participio, כִּי) ──

interface FuncionDeRegla<F extends string> {
    view: RuleChoiceView<{ readonly allowed: readonly F[]; readonly rule: string }, F>;
    titulo: string;
    nombre: (f: F) => string;
    fuentes: (f: F) => readonly RuleSource[];
    testId: string;
}

function BloqueRegla<F extends string>({ d, f }: { d: DatosHebreo; f: FuncionDeRegla<F> }) {
    const { t } = useTranslation('hebrewTutor');
    const { candidate, fn, by, assistantReading } = f.view;
    return (
        <FichaFuncion
            titulo={f.titulo}
            nombre={fn ? f.nombre(fn) : undefined}
            origen={by === 'rule' ? 'regla' : 'asistente'}
            texto={d.word.syntacticFunction}
            reconoce={t(`verseAnalyzer.ficha.recognizedBy.${candidate.rule}`)}
            opciones={fn ? undefined : { lista: candidate.allowed.map(f.nombre), reanalizar: !assistantReading }}
            fuentes={fn ? f.fuentes(fn) : candidate.allowed.flatMap(f.fuentes)}
            porValidar={by === 'rule'}
            otra={assistantReading ? f.nombre(assistantReading) : undefined}
            testId={f.testId}
        />
    );
}

function CortoRegla<F extends string>({ f }: { f: FuncionDeRegla<F> }) {
    const { candidate, fn, by } = f.view;
    return (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <FichaOrigenRotulo origen={by === 'rule' ? 'regla' : 'asistente'} />
            <span><strong className="font-bold">{fn ? f.nombre(fn) : candidate.allowed.map(f.nombre).join(' · ')}</strong> <span className="text-muted-foreground">· {f.titulo}</span></span>
        </p>
    );
}

function useInfinitivo(d: DatosHebreo): FuncionDeRegla<string> | null {
    const { t } = useTranslation('hebrewTutor');
    const v = d.infinitive;
    if (!v) return null;
    return {
        view: v as never, titulo: t(`verseAnalyzer.infinitive.title.${v.candidate.form}`), testId: 'infinitive-note',
        nombre: (f) => t(`verseAnalyzer.infinitive.functions.${f}`),
        fuentes: (f) => hebrewInfinitiveSources(f as never, v.candidate.form),
    };
}
function useParticipio(d: DatosHebreo): FuncionDeRegla<string> | null {
    const { t } = useTranslation('hebrewTutor');
    const v = d.participle;
    if (!v) return null;
    return {
        view: v as never, titulo: t('verseAnalyzer.participle.title'), testId: 'participle-note',
        nombre: (f) => t(`verseAnalyzer.participle.functions.${f}`),
        fuentes: (f) => HEBREW_PARTICIPLE_SOURCES[f as keyof typeof HEBREW_PARTICIPLE_SOURCES],
    };
}
function useKi(d: DatosHebreo): FuncionDeRegla<string> | null {
    const { t } = useTranslation('hebrewTutor');
    const v = d.ki;
    if (!v) return null;
    return {
        view: v as never, titulo: t('verseAnalyzer.ki.title'), testId: 'ki-note',
        nombre: (f) => t(`verseAnalyzer.ki.functions.${f}`),
        fuentes: (f) => HEBREW_KI_SOURCES[f as keyof typeof HEBREW_KI_SOURCES],
    };
}

const reglaCompleta = (use: (d: DatosHebreo) => FuncionDeRegla<string> | null): React.FC<{ d: DatosHebreo }> =>
    function Completo({ d }) { const f = use(d); return f ? <BloqueRegla d={d} f={f} /> : null; };
const reglaCorta = (use: (d: DatosHebreo) => FuncionDeRegla<string> | null): React.FC<{ d: DatosHebreo }> =>
    function Corto({ d }) { const f = use(d); return f ? <CortoRegla f={f} /> : null; };

// ── El registro ──────────────────────────────────────────────────────────────

export const BLOQUES_HEBREO: FichaRegistro<DatosHebreo> = [
    // ENCABEZADO
    {
        id: 'he.palabra', dato: 'La palabra (con morfemas en color) y su transliteración', seccion: 'encabezado', lugar: 'titulo', origen: 'datos', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: () => true,
        Completo: ({ d }) => (
            <>
                <span dir="rtl" lang="he" className="font-hebrew text-5xl leading-tight" style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}>
                    {d.word.morphemes?.length ? <MorphemeSpan segments={d.word.morphemes} variant="text" /> : d.word.hebrewText}
                </span>
                {d.word.transliteration && <span className="text-sm italic text-muted-foreground">{d.word.transliteration}</span>}
            </>
        ),
        Corto: ({ d }) => (
            <>
                <span dir="rtl" lang="he" className="font-hebrew text-3xl leading-tight" style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}>{d.word.hebrewText}</span>
                {d.word.transliteration && <span className="text-xs italic text-muted-foreground">{d.word.transliteration}</span>}
            </>
        ),
    },
    {
        id: 'he.categoria', dato: 'Categoría', seccion: 'encabezado', lugar: 'insignia', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.word.category,
        Completo: function Categoria({ d }) { const { t } = useTranslation('hebrewTutor'); return <Insignia>{t(`verseAnalyzer.categories.${d.word.category!.toUpperCase()}`)}</Insignia>; },
        Corto: function Categoria({ d }) { const { t } = useTranslation('hebrewTutor'); return <Insignia>{t(`verseAnalyzer.categories.${d.word.category!.toUpperCase()}`)}</Insignia>; },
    },
    {
        id: 'he.verboDebil', dato: '«Verbo débil»', seccion: 'encabezado', lugar: 'insignia', origen: 'asistente', antes: ['tarjeta'],
        hay: esDebil,
        Completo: function Debil() { const { t } = useTranslation('hebrewTutor'); return <Insignia tono="destructive">{t('verseAnalyzer.ficha.weakVerb')}</Insignia>; },
    },
    {
        id: 'he.apertura', dato: '«Apertura» narrativa (וַיְהִי)', seccion: 'encabezado', lugar: 'insignia', origen: 'regla', antes: ['tarjeta'],
        hay: esApertura,
        Completo: function Apertura() { const { t } = useTranslation('hebrewTutor'); return <Insignia tono="warning" title={t('verseAnalyzer.ficha.openingTitle')}>{t('verseAnalyzer.ficha.opening')}</Insignia>; },
    },
    {
        id: 'he.oshb', dato: 'Sello de validación con OSHB', seccion: 'encabezado', lugar: 'insignia', origen: 'datos', antes: ['tarjeta'],
        hay: (d) => !!d.word.oshbReference,
        Completo: ({ d }) => <OshbValidationBadge oshb={d.word.oshbReference} />,
    },
    {
        id: 'he.traduccion', dato: 'Traducción en contexto', seccion: 'encabezado', lugar: 'traduccion', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!traduccion(d.word),
        Completo: ({ d }) => <>«{traduccion(d.word)}»</>,
        Corto: ({ d }) => <>«{traduccion(d.word)}»</>,
    },

    // LA PALABRA
    {
        id: 'he.raiz', dato: 'Raíz, su transliteración y su significado', seccion: 'palabra', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.word.root,
        Completo: function Raiz({ d }) {
            const { t } = useTranslation('hebrewTutor');
            return <FichaFilas filas={[[t('verseAnalyzer.ficha.root'), <>{he(d.word.root!, 'text-lg')} {d.word.rootTransliteration && <span className="italic text-muted-foreground">{d.word.rootTransliteration}</span>}{d.word.rootMeaning && <> · <strong className="font-semibold">{d.word.rootMeaning}</strong></>}</>]]} />;
        },
    },
    {
        id: 'he.lexico', dato: 'Léxico (glosa)', seccion: 'palabra', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.word.lemmaGloss,
        Completo: function Lexico({ d }) { const { t } = useTranslation('hebrewTutor'); return <FichaFilas filas={[[t('verseAnalyzer.ficha.lexicon'), <strong className="font-semibold">{d.word.lemmaGloss}</strong>]]} />; },
    },

    // LA FORMA
    {
        id: 'he.celdas', dato: 'Binyan, forma, tipo de raíz, persona, género, número, estado y valor temporal', seccion: 'forma', origen: 'asistente', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!(vm(d) || nm(d)),
        Completo: function Celdas({ d }) { return <FichaCeldas celdas={useCeldas(d)} />; },
        Corto: function Linea({ d }) {
            const { t } = useTranslation('hebrewTutor');
            const v = vm(d), n = nm(d);
            const partes = v
                ? [v.binyan, v.verbForm && t(`verseAnalyzer.verbForms.${v.verbForm}`), pgn(d)]
                : [n?.gender && t(`verseAnalyzer.morphology.gender.${String(n.gender).toUpperCase()}`), n?.number && t(`verseAnalyzer.morphology.number.${String(n.number).toUpperCase()}`), n?.state && t(`verseAnalyzer.morphology.state.${String(n.state).toUpperCase()}`)];
            const linea = partes.filter(Boolean).join(' · ');
            return linea ? <p className="m-0 font-medium text-foreground/85">{linea}</p> : null;
        },
    },
    {
        id: 'he.correccionesOshb', dato: 'Correcciones de OSHB (cada diferencia)', seccion: 'forma', origen: 'datos', antes: ['tooltip'],
        hay: (d) => !!d.word.oshbReference?.corrections.length,
        Completo: ({ d }) => <div className="rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3"><OshbCorrectionsList oshb={d.word.oshbReference} /></div>,
    },
    {
        id: 'he.pistas', dato: 'Cómo se reconoce: la forma (pistas)', seccion: 'forma', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!vm(d)?.recognitionClues?.length,
        Completo: function Pistas({ d }) {
            const { t } = useTranslation('languageStructure');
            return <FichaCaja titulo={t('wordFicha.howRecognized')} plegable testId="ficha-pistas"><FichaPistas pistas={vm(d)!.recognitionClues!} /></FichaCaja>;
        },
    },
    {
        id: 'he.morfemas', dato: 'Morfemas, uno por uno, y la guía de colores', seccion: 'forma', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!d.word.morphemes?.length,
        Completo: function Morfemas({ d }) {
            const { t } = useTranslation('hebrewTutor');
            const categorias = [...new Set(d.word.morphemes!.map(m => getMorphemeCategory(m.role)).filter(c => c !== 'neutral'))];
            return (
                <FichaCaja titulo={t('verseAnalyzer.ficha.morphemes')} plegable abiertaAlInicio={false} testId="ficha-morfemas">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2" dir="rtl">
                            {d.word.morphemes!.map((seg, i) => (
                                <div key={i} className={cn('flex min-w-10 flex-col items-center rounded-lg border px-2 py-1', MORPHEME_BADGE_STYLES[getMorphemeCategory(seg.role)] ?? MORPHEME_BADGE_STYLES.neutral)}>
                                    <span dir="rtl" className="font-hebrew text-lg leading-none"><MorphemeSpan segments={[seg]} /></span>
                                    <span dir="ltr" className="mt-1 text-[10px] text-muted-foreground">{seg.label || t(`verseAnalyzer.morphemeRoles.${seg.role}`)}</span>
                                </div>
                            ))}
                        </div>
                        {categorias.length > 0 && (
                            <dl className="m-0 flex flex-col gap-1.5 text-[12.5px] leading-snug">
                                {categorias.map(c => COLORES_MORFEMAS[c] && (
                                    <div key={c}><dt className="inline font-semibold">{COLORES_MORFEMAS[c]!.label}: </dt><dd className="inline m-0 text-muted-foreground">{COLORES_MORFEMAS[c]!.desc}</dd></div>
                                ))}
                            </dl>
                        )}
                    </div>
                </FichaCaja>
            );
        },
    },
    {
        id: 'he.reglasVerboDebil', dato: 'Reglas de verbo débil (detective) y su clasificación', seccion: 'forma', origen: 'asistente', antes: ['panel'],
        hay: (d) => !!vm(d) && esDebil(d),
        Completo: function Debil({ d }) {
            const { t } = useTranslation('hebrewTutor');
            return (
                <FichaCaja titulo={t('verseAnalyzer.ficha.weakVerbRules')} plegable abiertaAlInicio={false} testId="ficha-verbo-debil">
                    <p className="m-0 mb-2 text-[13px] leading-relaxed text-foreground/85">{t('verseAnalyzer.ficha.weakVerbClass', { type: tiposDeVerbo(d).join(', ').replace(/_/g, ' ') })}</p>
                    <WeakVerbDetective word={d.word} />
                </FichaCaja>
            );
        },
    },

    // SU FUNCIÓN
    {
        id: 'he.funcionInfinitivo', dato: 'Función del infinitivo', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.infinitive, Completo: reglaCompleta(useInfinitivo), Corto: reglaCorta(useInfinitivo),
    },
    {
        id: 'he.funcionParticipio', dato: 'Función del participio', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.participle, Completo: reglaCompleta(useParticipio), Corto: reglaCorta(useParticipio),
    },
    {
        id: 'he.funcionKi', dato: 'Función de כִּי', seccion: 'funcion', origen: 'mixto', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.ki, Completo: reglaCompleta(useKi), Corto: reglaCorta(useKi),
    },
    {
        // Sin regla para esta palabra, la función la da el asistente (con regla, va dentro de su bloque).
        id: 'he.funcionSintactica', dato: 'Función sintáctica (texto del asistente)', seccion: 'funcion', origen: 'asistente', antes: ['tarjeta', 'tooltip', 'panel'],
        hay: (d) => !!d.word.syntacticFunction && !funcionDeRegla(d),
        Completo: ({ d }) => <FichaFuncion origen="asistente" texto={d.word.syntacticFunction} testId="ficha-funcion" />,
        Corto: ({ d }) => (
            <p className="m-0 flex items-start gap-2">
                <FichaOrigenRotulo origen="asistente" />
                <span className="line-clamp-2">{d.word.syntacticFunction}</span>
            </p>
        ),
    },

    // EN EL CONTEXTO
    {
        id: 'he.quienHabla', dato: 'Quién habla y a quién', seccion: 'contexto', origen: 'regla', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.speech, Completo: ({ d }) => <SpeechNote speech={d.speech} />,
    },
    {
        id: 'he.antepuesta', dato: 'Antepuesta al verbo', seccion: 'contexto', origen: 'datos', antes: ['tarjeta', 'tooltip'],
        hay: (d) => !!d.fronted, Completo: ({ d }) => <FrontedNote fronted={d.fronted} />,
    },

    // PARA ESTUDIAR
    {
        id: 'he.explicacion', dato: 'Explicación pedagógica (texto largo)', seccion: 'estudio', origen: 'asistente', antes: ['tarjeta', 'panel'],
        hay: (d) => !!d.word.explanation,
        Completo: function Explicacion({ d }) {
            const { t } = useTranslation('hebrewTutor');
            const { t: tf } = useTranslation('languageStructure');
            const [completa, setCompleta] = React.useState(false);
            return (
                <FichaCaja titulo={t('verseAnalyzer.ficha.explanation')} testId="ficha-explicacion">
                    <div className={cn('prose-sm max-w-none text-[13.5px] leading-relaxed text-foreground/90 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5', !completa && 'line-clamp-4 print:line-clamp-none')}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.word.explanation!}</ReactMarkdown>
                    </div>
                    <button type="button" onClick={() => setCompleta(v => !v)} aria-expanded={completa} className="mt-1 min-h-8 self-start text-[12.5px] font-semibold text-primary hover:underline print:hidden">
                        {completa ? tf('wordFicha.readLess') : tf('wordFicha.readMore')}
                    </button>
                </FichaCaja>
            );
        },
    },

    // ACCIONES
    {
        id: 'he.investigar', dato: 'Investigar la palabra paso a paso (detective)', seccion: 'acciones', origen: 'accion', antes: ['tarjeta'],
        hay: investigable,
        Completo: function Investigar({ d }) {
            const { t } = useTranslation('hebrewTutor');
            return (
                <button type="button" onClick={d.onInvestigate} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-[13.5px] font-bold text-primary hover:bg-primary/15 print:hidden">
                    <Search className="h-4 w-4" />{t('verseAnalyzer.ficha.investigate')}
                </button>
            );
        },
    },
];

export type BloqueHebreo = FichaBloque<DatosHebreo>;

/**
 * DÓNDE VA CADA CAMPO DEL ANÁLISIS. `Record<keyof …>` obliga a nombrar TODOS
 * los campos: si mañana el análisis trae uno nuevo, esto no compila hasta
 * decir en qué bloque se muestra (o por qué no va en la ficha). La prueba de
 * paridad comprueba que cada bloque nombrado exista en el registro.
 */
type Destino = string | { readonly fuera: string };
export const DESTINO_PALABRA: Readonly<Record<keyof WordAnalysis, Destino>> = {
    hebrewText: 'he.palabra',
    transliteration: 'he.palabra',
    root: 'he.raiz',
    rootTransliteration: 'he.raiz',
    rootMeaning: 'he.raiz',
    lemmaGloss: 'he.lexico',
    category: 'he.categoria',
    syntacticFunction: 'he.funcionSintactica',
    translation: 'he.traduccion',
    infinitiveFunction: 'he.funcionInfinitivo',
    participleFunction: 'he.funcionParticipio',
    kiFunction: 'he.funcionKi',
    explanation: 'he.explicacion',
    verbMorphology: 'he.celdas',
    nominalMorphology: 'he.celdas',
    morphemes: 'he.morfemas',
    clauseTag: { fuera: 'Se ve en el versículo (marcas de sintaxis), no en la ficha.' },
    oshbReference: 'he.oshb',
};
export const DESTINO_VERBO: Readonly<Record<keyof NonNullable<WordAnalysis['verbMorphology']>, Destino>> = {
    binyan: 'he.celdas', verbForm: 'he.celdas', verbType: 'he.celdas', rootClassification: 'he.celdas',
    person: 'he.celdas', gender: 'he.celdas', number: 'he.celdas', temporalValue: 'he.celdas',
    recognitionClues: 'he.pistas',
};
export const DESTINO_NOMBRE: Readonly<Record<keyof NonNullable<WordAnalysis['nominalMorphology']>, Destino>> = {
    gender: 'he.celdas', number: 'he.celdas', state: 'he.celdas', person: 'he.celdas',
    suffix: { fuera: 'Ni la tarjeta ni el tooltip lo mostraban; se agrega cuando haga falta.' },
};
