import React from 'react';
import { useTranslation } from 'react-i18next';
import { HEBREW_PARTICIPLE_SOURCES, type HebrewParticipleFunction, type HebrewParticipleView } from '@dosfilos/domain';
import { HebrewRuleChoiceNote } from './HebrewRuleChoiceNote';

/** R4 — la función del participio (Arnold y Choi §3.4.3). */
export const HebrewParticipleNote: React.FC<{ view?: HebrewParticipleView }> = ({ view }) => {
  const { t } = useTranslation('hebrewTutor');
  if (!view) return null;
  return (
    <HebrewRuleChoiceNote<HebrewParticipleFunction>
      view={view}
      title={t('verseAnalyzer.participle.title')}
      label={(f) => t(`verseAnalyzer.participle.functions.${f}`)}
      sources={(f) => HEBREW_PARTICIPLE_SOURCES[f]}
      testId="participle"
    />
  );
};
