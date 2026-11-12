import React from 'react';
import { useTranslation } from 'react-i18next';
import { hebrewVerbSources, isCohortativeByFunction, type HebrewVerbFunction } from '@dosfilos/domain';
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
