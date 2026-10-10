import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    prepositionUsage, tenseUseSources, translationBridge, VERB_RULE_SOURCES, verbFunctionSources,
    type GreekCase, type GreekKeyInsight, type GreekVerbForm, type GreekWordInsight, type GreekWordToken,
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
    return (
        <FichaFuncion
            titulo={t('analyzer.verbFn.tenseTitle')}
            nombre={t(`analyzer.verbFn.tenseUses.${i.tenseUse}`)}
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
    return (
        <FichaFuncion
            titulo={t('analyzer.fields.caseFunction')}
            nombre={t(`analyzer.caseFn.${d.token.tag.case}.${i.caseFunction}`)}
            origen="eleccion"
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
