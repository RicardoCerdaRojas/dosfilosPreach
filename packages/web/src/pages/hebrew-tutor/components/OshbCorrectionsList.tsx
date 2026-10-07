import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OshbCorrection, OshbReference } from '@dosfilos/domain';

/** El valor de un rasgo en palabras: «Yusivo», «2», «F»… */
function useValor() {
  const { t } = useTranslation('hebrewTutor');
  return (c: OshbCorrection, v: string) => (c.field === 'verbForm' && v ? t(`verseAnalyzer.verbForms.${v}`) : v || '—');
}

/**
 * Qué corrigió OSHB en el verbo, y el aviso de que la traducción guardada
 * puede no seguirlo (Rut 1:13: 3FP → 2FP, pero el versículo seguía diciendo
 * «se quedarían»). Nada si no hubo correcciones.
 */
export const OshbCorrectionsList: React.FC<{ oshb?: OshbReference }> = ({ oshb }) => {
  const { t } = useTranslation('hebrewTutor');
  const valor = useValor();
  if (!oshb || oshb.corrections.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider font-bold text-warning-subtle-foreground">
        {t('verseAnalyzer.oshb.corrected')} · <span className="font-mono normal-case">{oshb.morphCode}</span>
      </p>
      <ul className="space-y-0.5">
        {oshb.corrections.map((c) => (
          <li key={c.field} className="text-[11.5px] text-foreground">
            {t('verseAnalyzer.oshb.correction', {
              field: t(`verseAnalyzer.oshb.fields.${c.field}`),
              analysis: valor(c, c.analysis),
              oshb: valor(c, c.oshb),
            })}
          </li>
        ))}
      </ul>
      <p className="text-[10.5px] italic text-muted-foreground">{t('verseAnalyzer.oshb.translationNote')}</p>
    </div>
  );
};
