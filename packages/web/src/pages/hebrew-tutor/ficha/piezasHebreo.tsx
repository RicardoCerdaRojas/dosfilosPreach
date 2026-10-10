import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    HEBREW_KI_SOURCES, HEBREW_PARTICIPLE_SOURCES, hebrewInfinitiveSources,
    type HebrewInfinitiveFunction, type HebrewKiFunction, type HebrewParticipleFunction, type RuleSource, type WordAnalysis,
} from '@dosfilos/domain';
import type { FrontedInfo } from '@/components/language-structure/FrontedNote';
import { FichaCaja, FichaFuncion, FichaOrigenRotulo, type OrigenFuncion } from '@/components/word-ficha/FichaPiezas';
import type { HebrewInfinitiveView, HebrewKiView, HebrewParticipleView } from '@dosfilos/domain';
import { cn } from '@/lib/utils';
import type { SpeechView } from '../hooks/useEstructuraHebrea';
import { MorphemeSpan, MORPHEME_BADGE_STYLES, getMorphemeCategory } from '../components/MorphemeSpan';
import { WeakVerbDetective } from '../components/WeakVerbDetective';
import { COLORES_MORFEMAS } from './coloresMorfemas';

/** Las piezas de la ficha hebrea que usa el registro (`bloquesHebreo.tsx`). */

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

export const he = (s: string, tam = 'text-[1.15em]') => <span dir="rtl" lang="he" className={cn('font-hebrew', tam)}>{s}</span>;
export const vm = (d: DatosHebreo) => d.word.verbMorphology;
export const nm = (d: DatosHebreo) => d.word.nominalMorphology;
export const tiposDeVerbo = (d: DatosHebreo): string[] => {
    const v = vm(d)?.verbType;
    if (!v) return [];
    return (Array.isArray(v) ? v : String(v).split(',')).map(x => x.trim()).filter(Boolean);
};
export const esDebil = (d: DatosHebreo) => tiposDeVerbo(d).some(x => !['STRONG', 'FUERTE'].includes(x.toUpperCase()));
/** וַיְהִי: marca de apertura narrativa (la misma detección de la tarjeta de antes). */
export const esApertura = (d: DatosHebreo) => {
    const w = d.word;
    return w.category === 'VERB' && vm(d)?.verbForm?.toUpperCase() === 'WAYYIQTOL'
        && (w.root === 'היה' || w.root === 'הָיָה' || !!w.hebrewText?.includes('וַיְהִי') || !!w.lemmaGloss?.toLowerCase().includes('ser') || /wayh[iî]/i.test(w.transliteration ?? ''));
};
/** Traducción con respaldo: la cadena del tooltip de antes. */
export const traduccion = (w: WordAnalysis) => w.translation || w.lemmaGloss || w.rootMeaning || w.root || w.hebrewText || '';
export const investigable = (d: DatosHebreo) => {
    const c = d.word.category?.toUpperCase() ?? '';
    return !!d.onInvestigate && (c === 'VERB' || ['NOUN', 'PROPER_NOUN', 'ADJECTIVE', 'PRONOUN', 'PERSONAL_PRONOUN', 'DEMONSTRATIVE_PRONOUN', 'RELATIVE_PRONOUN'].includes(c));
};
export const funcionDeRegla = (d: DatosHebreo) => !!(d.infinitive || d.participle || d.ki);

/**
 * Un rótulo traducido o, si el asistente devolvió un valor fuera del catálogo, el valor tal cual — en vez de
 * la clave cruda (la tarjeta de antes lo hacía con `defaultValue`, que la regla de i18n ya no permite).
 */
export function useRotulo() {
    const { t, i18n } = useTranslation('hebrewTutor');
    return React.useCallback((clave: string, crudo: string) => (i18n?.exists && !i18n.exists(clave, { ns: 'hebrewTutor' }) ? crudo : t(clave)), [t, i18n]);
}

/** Los colores de la categoría, como en la tarjeta de antes. */
const CATEGORIA: Readonly<Record<string, string>> = {
    verb: 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    noun: 'bg-violet-100/80 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    pronoun: 'bg-pink-100/80 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    preposition: 'bg-orange-100/80 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    conjunction: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    article: 'bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    particle: 'bg-slate-100/80 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
    adverb: 'bg-green-100/80 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    interjection: 'bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    proper_noun: 'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    numeral: 'bg-cyan-100/80 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

export function Insignia({ children, tono = 'primary', title, clase }: { children: React.ReactNode; tono?: 'primary' | 'destructive' | 'warning'; title?: string; clase?: string }) {
    const tonos = { primary: 'bg-primary/10 text-primary', destructive: 'bg-destructive/10 text-destructive', warning: 'bg-warning-subtle text-warning-subtle-foreground' };
    return <span title={title} className={cn('rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider', clase ?? tonos[tono])}>{children}</span>;
}

/** La categoría con su color; sin categoría, «partícula» (como antes). */
export function Categoria({ d }: { d: DatosHebreo }) {
    const rotulo = useRotulo();
    const cat = d.word.category ?? 'PARTICLE';
    return <Insignia clase={CATEGORIA[cat.toLowerCase()] ?? CATEGORIA.particle}>{rotulo(`verseAnalyzer.categories.${cat.toUpperCase()}`, cat)}</Insignia>;
}

/** Las celdas de la forma, traducidas. Las ausentes no se muestran. */
export function useCeldas(d: DatosHebreo) {
    const { t } = useTranslation('hebrewTutor');
    const rotulo = useRotulo();
    const celdas: { label: string; value: string; ancha?: boolean; title?: string }[] = [];
    const v = vm(d), n = nm(d);
    if (v?.binyan) celdas.push({ label: t('verseAnalyzer.ficha.cells.binyan'), value: String(v.binyan) });
    if (v?.verbForm) celdas.push({ label: t('verseAnalyzer.ficha.cells.form'), value: rotulo(`verseAnalyzer.verbForms.${v.verbForm}`, String(v.verbForm)) });
    const tipos = tiposDeVerbo(d).map(x => rotulo(`verseAnalyzer.verbTypes.${x}`, x)).join(', ');
    const clase = (v as { rootClassification?: string | null } | undefined)?.rootClassification;
    // Con clasificación de la raíz, esa va en la celda y el comportamiento en el título (como antes).
    if (clase || tipos) celdas.push({ label: t('verseAnalyzer.ficha.cells.rootType'), value: clase || tipos, ...(clase && tipos ? { title: t('verseAnalyzer.ficha.rootBehaviour', { root: clase, behaviour: tipos }) } : {}) });
    const persona = v?.person ?? n?.person;
    if (persona) celdas.push({ label: t('verseAnalyzer.ficha.cells.person'), value: String(persona) });
    const g = v?.gender ?? n?.gender, num = v?.number ?? n?.number;
    if (g) celdas.push({ label: t('verseAnalyzer.ficha.cells.gender'), value: rotulo(`verseAnalyzer.morphology.gender.${String(g).toUpperCase()}`, String(g)) });
    if (num) celdas.push({ label: t('verseAnalyzer.ficha.cells.number'), value: rotulo(`verseAnalyzer.morphology.number.${String(num).toUpperCase()}`, String(num)) });
    if (n?.state) celdas.push({ label: t('verseAnalyzer.ficha.cells.state'), value: rotulo(`verseAnalyzer.morphology.state.${String(n.state).toUpperCase()}`, String(n.state)) });
    if (v?.temporalValue) celdas.push({ label: t('verseAnalyzer.ficha.cells.temporalValue'), value: v.temporalValue, ancha: true });
    return celdas;
}

/** P-G-N compacto («2MS»), como el tooltip de antes. */
export const pgn = (d: DatosHebreo) => {
    const v = vm(d);
    if (!v) return '';
    return `${v.person != null ? String(v.person).charAt(0) : ''}${v.gender != null ? String(v.gender).charAt(0) : ''}${v.number != null ? String(v.number).charAt(0) : ''}`.toUpperCase();
};

/** La línea de la forma en el resumen. */
export function LineaForma({ d }: { d: DatosHebreo }) {
    const rotulo = useRotulo();
    const v = vm(d), n = nm(d);
    const partes = v
        ? [v.binyan, v.verbForm && rotulo(`verseAnalyzer.verbForms.${v.verbForm}`, String(v.verbForm)), pgn(d)]
        : [n?.gender && rotulo(`verseAnalyzer.morphology.gender.${String(n.gender).toUpperCase()}`, String(n.gender)), n?.number && rotulo(`verseAnalyzer.morphology.number.${String(n.number).toUpperCase()}`, String(n.number)), n?.state && rotulo(`verseAnalyzer.morphology.state.${String(n.state).toUpperCase()}`, String(n.state))];
    const linea = partes.filter(Boolean).join(' · ');
    return linea ? <p className="m-0 font-medium text-foreground/85">{linea}</p> : null;
}

// ── La función con regla (infinitivo, participio, כִּי) ─────────────────────

type Vista<F extends string> = {
    readonly candidate: { readonly allowed: readonly F[]; readonly rule: string };
    readonly fn?: F;
    readonly by?: 'rule' | 'assistant';
    readonly assistantReading?: F;
};
interface FuncionDeRegla<F extends string> {
    view: Vista<F>;
    titulo: string;
    nombre: (f: F) => string;
    fuentes: (f: F) => readonly RuleSource[];
    testId: string;
}

/** Regla que decide, elección del asistente o, si nadie eligió, las opciones (sin atribuirlas a nadie). */
const origenDe = <F extends string>(v: Vista<F>): OrigenFuncion => (v.by === 'rule' ? 'regla' : v.by === 'assistant' ? 'eleccion' : 'opciones');

function BloqueRegla<F extends string>({ d, f }: { d: DatosHebreo; f: FuncionDeRegla<F> }) {
    const { t } = useTranslation('hebrewTutor');
    const { candidate, fn, by, assistantReading } = f.view;
    return (
        <FichaFuncion
            titulo={f.titulo}
            nombre={fn ? f.nombre(fn) : undefined}
            origen={origenDe(f.view)}
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
    const { candidate, fn } = f.view;
    return (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <FichaOrigenRotulo origen={origenDe(f.view)} />
            <span><strong className="font-bold">{fn ? f.nombre(fn) : candidate.allowed.map(f.nombre).join(' · ')}</strong> <span className="text-muted-foreground">· {f.titulo}</span></span>
        </p>
    );
}

function useInfinitivo(d: DatosHebreo): FuncionDeRegla<HebrewInfinitiveFunction> | null {
    const { t } = useTranslation('hebrewTutor');
    const v = d.infinitive;
    if (!v) return null;
    return {
        view: v, titulo: t(`verseAnalyzer.infinitive.title.${v.candidate.form}`), testId: 'infinitive-note',
        nombre: (f) => t(`verseAnalyzer.infinitive.functions.${f}`),
        fuentes: (f) => hebrewInfinitiveSources(f, v.candidate.form),
    };
}
function useParticipio(d: DatosHebreo): FuncionDeRegla<HebrewParticipleFunction> | null {
    const { t } = useTranslation('hebrewTutor');
    const v = d.participle;
    if (!v) return null;
    return { view: v, titulo: t('verseAnalyzer.participle.title'), testId: 'participle-note', nombre: (f) => t(`verseAnalyzer.participle.functions.${f}`), fuentes: (f) => HEBREW_PARTICIPLE_SOURCES[f] };
}
function useKi(d: DatosHebreo): FuncionDeRegla<HebrewKiFunction> | null {
    const { t } = useTranslation('hebrewTutor');
    const v = d.ki;
    if (!v) return null;
    return { view: v, titulo: t('verseAnalyzer.ki.title'), testId: 'ki-note', nombre: (f) => t(`verseAnalyzer.ki.functions.${f}`), fuentes: (f) => HEBREW_KI_SOURCES[f] };
}

export const InfinitivoCompleto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useInfinitivo(d); return f ? <BloqueRegla d={d} f={f} /> : null; };
export const InfinitivoCorto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useInfinitivo(d); return f ? <CortoRegla f={f} /> : null; };
export const ParticipioCompleto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useParticipio(d); return f ? <BloqueRegla d={d} f={f} /> : null; };
export const ParticipioCorto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useParticipio(d); return f ? <CortoRegla f={f} /> : null; };
export const KiCompleto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useKi(d); return f ? <BloqueRegla d={d} f={f} /> : null; };
export const KiCorto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useKi(d); return f ? <CortoRegla f={f} /> : null; };

// ── Morfemas, verbo y explicación ───────────────────────────────────────────

/** Los morfemas uno por uno (el dagesh forte como ◌ּ, en rojo) y qué significa cada color. */
export function Morfemas({ d }: { d: DatosHebreo }) {
    const { t } = useTranslation('hebrewTutor');
    const rotulo = useRotulo();
    const categorias = [...new Set(d.word.morphemes!.map(m => getMorphemeCategory(m.role)).filter(c => c !== 'neutral'))];
    return (
        <FichaCaja titulo={t('verseAnalyzer.ficha.morphemes')} plegable abiertaAlInicio={false} testId="ficha-morfemas">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2" dir="rtl">
                    {d.word.morphemes!.map((seg, i) => {
                        const forte = seg.role === 'DAGESH_FORTE';
                        const papel = rotulo(`verseAnalyzer.morphemeRoles.${seg.role}`, String(seg.role));
                        return (
                            <div key={i} className={cn('flex min-w-10 flex-col items-center rounded-lg border px-2 py-1', MORPHEME_BADGE_STYLES[getMorphemeCategory(seg.role)] ?? MORPHEME_BADGE_STYLES.neutral)}>
                                <span dir="rtl" className={cn('font-hebrew text-lg leading-none', forte && 'text-destructive')}>{forte ? '◌ּ' : <MorphemeSpan segments={[seg]} />}</span>
                                <span dir="ltr" className="mt-1 text-center text-[10px] text-muted-foreground">{seg.label || papel}{seg.label && seg.label !== papel && <span className="block opacity-80">{papel}</span>}</span>
                            </div>
                        );
                    })}
                </div>
                {categorias.length > 0 && (
                    <dl className="m-0 flex flex-col gap-1.5 text-[12.5px] leading-snug">
                        {categorias.map(c => COLORES_MORFEMAS[c] && (
                            <div key={c}><dt className="inline font-semibold">{COLORES_MORFEMAS[c]!.label}: </dt><dd className="m-0 inline text-muted-foreground">{COLORES_MORFEMAS[c]!.desc}</dd></div>
                        ))}
                    </dl>
                )}
            </div>
        </FichaCaja>
    );
}

/** El detective del verbo (sistema de raíces de Farfán): fuerte o débil, para todo verbo, como el panel de antes. */
export function DetectiveVerbo({ d }: { d: DatosHebreo }) {
    const { t } = useTranslation('hebrewTutor');
    const debil = esDebil(d);
    const tipo = tiposDeVerbo(d).join(', ').replace(/_/g, ' ');
    return (
        <FichaCaja titulo={t(debil ? 'verseAnalyzer.ficha.weakVerbRules' : 'verseAnalyzer.ficha.strongVerb')} plegable abiertaAlInicio={false} testId="ficha-verbo-debil">
            {tipo && <p className="m-0 mb-2 text-[13px] leading-relaxed text-foreground/85">{t('verseAnalyzer.ficha.weakVerbClass', { type: tipo })}</p>}
            <WeakVerbDetective word={d.word} />
        </FichaCaja>
    );
}

/** Los estilos del markdown de la explicación (los de la tarjeta de antes). */
const MARKDOWN: Components = {
    h1: ({ node: _n, ...p }) => <h1 className="mb-1.5 mt-3 flex items-center gap-2 text-[15px] font-bold text-primary before:block before:h-3.5 before:w-1.5 before:rounded-sm before:bg-primary/40 before:content-['']" {...p} />,
    h2: ({ node: _n, ...p }) => <h2 className="mb-1 mt-2.5 text-[14px] font-bold text-primary/80" {...p} />,
    h3: ({ node: _n, ...p }) => <h3 className="mb-1 mt-2 text-[13px] font-semibold text-foreground/90" {...p} />,
    p: ({ node: _n, ...p }) => <p className="mb-2.5 last:mb-0" {...p} />,
    ul: ({ node: _n, ...p }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 marker:text-primary/50 last:mb-0" {...p} />,
    ol: ({ node: _n, ...p }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 font-medium marker:text-primary/50 last:mb-0" {...p} />,
    li: ({ node: _n, ...p }) => <li className="pl-1" {...p} />,
    strong: ({ node: _n, ...p }) => <strong className="rounded bg-primary/10 px-1.5 py-0.5 text-[12px] font-bold text-foreground" {...p} />,
    em: ({ node: _n, ...p }) => <em className="italic text-foreground/70" {...p} />,
    blockquote: ({ node: _n, ...p }) => <blockquote className="my-2 rounded-r border-l-2 border-primary/40 bg-primary/5 py-1 pl-3 text-[12.5px] italic text-foreground/80" {...p} />,
};
/** Más largo que esto, se muestra recortada con «Leer completa». */
const LARGA = 320;

export function Explicacion({ d }: { d: DatosHebreo }) {
    const { t } = useTranslation('hebrewTutor');
    const { t: tf } = useTranslation('languageStructure');
    const [completa, setCompleta] = React.useState(false);
    const larga = d.word.explanation!.length > LARGA;
    return (
        <FichaCaja titulo={t('verseAnalyzer.ficha.explanation')} testId="ficha-explicacion">
            <div className={cn('text-[13.5px] leading-relaxed text-foreground/90', larga && !completa && 'line-clamp-5 print:line-clamp-none')}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN}>{d.word.explanation!}</ReactMarkdown>
            </div>
            {larga && (
                <button type="button" onClick={() => setCompleta(v => !v)} aria-expanded={completa} className="mt-1 min-h-8 self-start text-[12.5px] font-semibold text-primary hover:underline print:hidden">
                    {completa ? tf('wordFicha.readLess') : tf('wordFicha.readMore')}
                </button>
            )}
        </FichaCaja>
    );
}
