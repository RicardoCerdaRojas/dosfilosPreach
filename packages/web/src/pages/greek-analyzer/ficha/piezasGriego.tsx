import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    NOMINAL_RULE_SOURCES,
    prepositionUsage, TENSE_RULE_SOURCES, tenseUseSources, translationBridge, VERB_RULE_SOURCES, verbFunctionSources,
    type ConditionalFact, type GreekCase, type GreekKeyInsight, type GreekVerbForm, type GreekWordInsight, type GreekWordToken,
} from '@dosfilos/domain';
import type { FrontedInfo } from '@/components/language-structure/FrontedNote';
import { FichaFuncion } from '@/components/word-ficha/FichaPiezas';
import { cn } from '@/lib/utils';

/** Las piezas de la ficha griega que usa el registro (`bloquesGriego.tsx`). */

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
    /** En εἰ/ἐάN: la clase de la condicional y, en la 3.ª, su valor (Wallace p. 696). */
    readonly conditional?: ConditionalFact;
    /** U3c: el código de Louw-Nida de la preposición (MACULA), p. ej. «89.5»; a veces dos. */
    readonly ln?: string;
    /** U9: este vocativo abre el versículo con un imperativo (su texto) o una pregunta: señal de apertura. */
    readonly opening?: { readonly question: boolean; readonly imperative?: string };
    /** Guardar el hallazgo para el sermón. */
    readonly onSaveFinding?: () => void;
    readonly saved?: boolean;
}

/** Modo de MorphGNT → forma, para citar la sección de ESE modo. */
export const FORMA_DEL_MODO: Readonly<Record<string, GreekVerbForm>> = { P: 'participle', N: 'infinitive', S: 'subjunctive', D: 'imperative', O: 'optative' };
export const regimenDe = (d: DatosGriego) => (d.token.pos === 'P' ? prepositionUsage(d.token.lemma, d.objectCase as GreekCase | undefined) : null);
export const grc = (s: string) => <span lang="grc" className="font-medium">{s}</span>;

export function Insignia({ children, tono = 'muted' }: { children: React.ReactNode; tono?: 'muted' | 'primary' }) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider', tono === 'primary' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            {children}
        </span>
    );
}

/** La función del verbo (G2, Wallace): una regla que decide o la elección del asistente. */
export function FuncionVerbo({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const i = d.insight!;
    const fuentes = i.verbRule ? VERB_RULE_SOURCES[i.verbRule] : verbFunctionSources(i.verbFunction!, FORMA_DEL_MODO[d.token.tag.mood ?? ''] ?? 'other');
    return (
        <FichaFuncion
            titulo={t('analyzer.verbFn.title')}
            nombre={t(`analyzer.verbFn.functions.${i.verbFunction}`)}
            origen={i.verbRule ? 'regla' : 'eleccion'}
            texto={i.verbNote}
            reconoce={i.verbRule ? t(`analyzer.verbFn.rules.${i.verbRule}`) : undefined}
            fuentes={fuentes}
            testId="verb-function"
        />
    );
}

/** El uso del tiempo en el indicativo (lo elige el asistente). */
export function UsoTiempo({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const i = d.insight!;
    const uso = (u: string) => t(`analyzer.verbFn.tenseUses.${u}`);
    // Una regla acota el uso (perfecto proléptico, Wallace p. 581; revisión del profesor, Stg 2:10):
    // dice por qué, cita su fuente y, si el asistente no eligió entre las opciones, las muestra.
    if (i.tenseRule) {
        return (
            <FichaFuncion
                titulo={t('analyzer.verbFn.tenseTitle')}
                {...(i.tenseUse ? { nombre: uso(i.tenseUse) } : {})}
                origen={i.tenseUse ? 'eleccion' : 'opciones'}
                reconoce={t(`analyzer.verbFn.tenseRules.${i.tenseRule}`)}
                {...(i.tenseUseOptions ? { opciones: { lista: i.tenseUseOptions.map(uso), reanalizar: true } } : {})}
                {...(i.tenseUseOutside ? { otra: uso(i.tenseUseOutside) } : {})}
                texto={i.verbFunction ? undefined : i.verbNote}
                fuentes={TENSE_RULE_SOURCES[i.tenseRule]}
                testId="tense-use"
            />
        );
    }
    return (
        <FichaFuncion
            titulo={t('analyzer.verbFn.tenseTitle')}
            nombre={uso(i.tenseUse!)}
            origen="eleccion"
            texto={i.verbFunction ? undefined : i.verbNote}
            fuentes={tenseUseSources(i.tenseUse!, d.token.tag.tense)}
            testId="tense-use"
        />
    );
}

/** La función del caso, con su puente de traducción y la función sintáctica del asistente. */
export function FuncionCaso({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const i = d.insight!;
    const puente = translationBridge(d.token);
    // U3b (revisión del profesor, Stg 2:16): el partitivo con ἐκ/ἀπό lo decide la regla, no el asistente.
    const regla = i.nominalRule === 'partitiveEk';
    return (
        <FichaFuncion
            titulo={t('analyzer.fields.caseFunction')}
            nombre={t(`analyzer.caseFn.${d.token.tag.case}.${i.caseFunction}`)}
            origen={regla ? 'regla' : 'eleccion'}
            {...(regla ? { reconoce: t('analyzer.caseRule.partitiveEk'), fuentes: NOMINAL_RULE_SOURCES.partitiveEk } : {})}
            texto={<>{t(`analyzer.caseFnHint.${i.caseFunction}`)}{i.syntacticFunction && <span className="mt-1 block">{i.syntacticFunction}</span>}</>}
            extra={puente ? <><dt className="text-info-subtle-foreground">{t('analyzer.fichaBridge')}</dt><dd className="m-0 italic">{t(`analyzer.bridge.${puente}`)}</dd></> : undefined}
            testId="case-function"
        />
    );
}

/** El puente de traducción, cuando no hay bloque del caso que lo lleve (palabras sin función del caso). */
export function PuenteSuelto({ d }: { d: DatosGriego }) {
    const { t } = useTranslation('greekTutor');
    const puente = translationBridge(d.token);
    return puente ? <span className="mt-1 block text-[13px] italic text-muted-foreground">{t(`analyzer.bridge.${puente}`)}</span> : null;
}
