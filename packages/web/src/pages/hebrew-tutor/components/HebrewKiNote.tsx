import React from 'react';
import { useTranslation } from 'react-i18next';
import { HEBREW_KI_SOURCES, type HebrewKiFunction, type HebrewKiView } from '@dosfilos/domain';
import { HebrewRuleChoiceNote } from './HebrewRuleChoiceNote';

/** R4 — la función de כִּי (Arnold y Choi §4.3.4). */
export const HebrewKiNote: React.FC<{ view?: HebrewKiView }> = ({ view }) => {
  const { t } = useTranslation('hebrewTutor');
  if (!view) return null;
  return (
    <HebrewRuleChoiceNote<HebrewKiFunction>
      view={view}
      title={t('verseAnalyzer.ki.title')}
      label={(f) => t(`verseAnalyzer.ki.functions.${f}`)}
      sources={(f) => HEBREW_KI_SOURCES[f]}
      testId="ki"
    />
  );
};
