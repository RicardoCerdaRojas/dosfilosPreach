import React from 'react';
import { useTranslation } from 'react-i18next';
import { hebrewInfinitiveSources, type HebrewInfinitiveFunction, type HebrewInfinitiveView } from '@dosfilos/domain';
import { HebrewRuleChoiceNote } from './HebrewRuleChoiceNote';

/** R4 — la función del infinitivo (Arnold y Choi §3.4.1–3.4.2). */
export const HebrewInfinitiveNote: React.FC<{ view?: HebrewInfinitiveView }> = ({ view }) => {
  const { t } = useTranslation('hebrewTutor');
  if (!view) return null;
  const form = view.candidate.form;
  return (
    <HebrewRuleChoiceNote<HebrewInfinitiveFunction>
      view={view}
      title={t(`verseAnalyzer.infinitive.title.${form}`)}
      label={(f) => t(`verseAnalyzer.infinitive.functions.${f}`)}
      sources={(f) => hebrewInfinitiveSources(f, form)}
      testId="infinitive"
    />
  );
};
