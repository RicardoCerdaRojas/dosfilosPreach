import React from 'react';
import { useTranslation } from 'react-i18next';
import { HEBREW_PREPOSITIONS, hebrewPrepositionSources, hebrewVerbSources, isCohortativeByFunction, type HebrewVerbFunction } from '@dosfilos/domain';
import { FichaFuncion, FichaOrigenRotulo } from '@/components/word-ficha/FichaPiezas';
import { BloqueRegla, CortoRegla, type DatosHebreo, type FuncionDeRegla } from './piezasHebreo';

/**
 * U5 (revisión del profesor, Rut 3:5 אֶעֱשֶׂה): la función del verbo finito, de
 * la lista de su forma (Arnold y Choi cap. 3). Un yiqtol con función de
 * cohortativo se nombra «Cohortativo por función»: la forma no lo muestra
 * (Putnam §2.2.4a), la función sí.
 */
function useVerbo(d: DatosHebreo): FuncionDeRegla<HebrewVerbFunction> | null {
    const { t } = useTranslation('hebrewTutor');
    const v = d.verb;
    if (!v) return null;
    const porFuncion = isCohortativeByFunction(v);
    return {
        view: v,
        titulo: t(`verseAnalyzer.verb.title.${v.candidate.form}`),
        testId: 'verb-function-note',
        nombre: (f) => (porFuncion && f === v.fn
            ? t('verseAnalyzer.verb.cohortativeByFunction', { fn: t(`verseAnalyzer.verb.functions.${f}`) })
            : t(`verseAnalyzer.verb.functions.${f}`)),
        fuentes: (f) => hebrewVerbSources(f, v.candidate.form),
    };
}

export const VerboCompleto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useVerbo(d); return f ? <BloqueRegla d={d} f={f} /> : null; };
export const VerboCorto: React.FC<{ d: DatosHebreo }> = ({ d }) => { const f = useVerbo(d); return f ? <CortoRegla f={f} /> : null; };

/**
 * U3a (revisión del profesor, Rut 2:1 y 2:7): la función de la preposición, elegida por el asistente
 * de la lista de Arnold y Choi §4.1. Es una elección (azul), no una regla: como regla, la ל de
 * posesión acertaba 3 o 4 de 20.
 */
export function PreposicionCompleta({ d }: { d: DatosHebreo }) {
    const { t } = useTranslation('hebrewTutor');
    const v = d.preposition!;
    return (
        <FichaFuncion
            titulo={t('verseAnalyzer.preposition.title', { p: HEBREW_PREPOSITIONS[v.candidate.preposition].forma })}
            nombre={t(`verseAnalyzer.preposition.functions.${v.fn}`)}
            origen="eleccion"
            fuentes={hebrewPrepositionSources(v.candidate.preposition)}
            testId="preposition-function-note"
        />
    );
}
export function PreposicionCorta({ d }: { d: DatosHebreo }) {
    const { t } = useTranslation('hebrewTutor');
    const v = d.preposition!;
    return (
        <p className="m-0 flex flex-wrap items-center gap-x-2">
            <FichaOrigenRotulo origen="eleccion" />
            <span><strong className="font-bold">{t(`verseAnalyzer.preposition.functions.${v.fn}`)}</strong> <span className="text-muted-foreground">· {t('verseAnalyzer.preposition.title', { p: HEBREW_PREPOSITIONS[v.candidate.preposition].forma })}</span></span>
        </p>
    );
}
