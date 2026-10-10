import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RuleChoiceView, RuleSource } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';

/**
 * R4 — la función de una forma del hebreo (infinitivo, participio) según una
 * regla «medida» de Arnold y Choi. Con una sola opción, «Regla · medida»: la
 * PROPONE el texto, probada contra los ejemplos del libro y un control, pero
 * sin la muestra del profesor. Si el asistente lee otra, se muestran las dos.
 * Con varias, la que eligió el asistente («Asistente»); si leyó una fuera de la
 * lista, las opciones y su lectura al lado; si el análisis es anterior, las
 * opciones que deja el texto.
 */
export function HebrewRuleChoiceNote<F extends string>({ view, title, label, sources, testId }: {
  view: RuleChoiceView<{ readonly allowed: readonly F[] }, F>;
  title: string;
  label: (f: F) => string;
  sources: (f: F) => readonly RuleSource[];
  testId: string;
}): React.ReactElement {
  const { t } = useTranslation('hebrewTutor');
  const { candidate, fn, by } = view;
  const etiqueta = (clase: string, texto: string, titulo: string) => (
    <span title={titulo} className={`rounded border px-1 text-[9.5px] font-semibold uppercase tracking-wider ${clase}`}>{texto}</span>
  );
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[12px] leading-snug text-foreground" data-testid={`${testId}-note`}>
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        {fn ? <span className="font-medium">{label(fn)}</span> : null}
        {by === 'rule' && etiqueta('border-warning/40 bg-warning/10 text-warning', t('verseAnalyzer.ruleChoice.ruleMeasured'), t('verseAnalyzer.ruleChoice.ruleMeasuredTitle'))}
        {by === 'assistant' && etiqueta('border-info/40 bg-info/10 text-info', t('verseAnalyzer.ruleChoice.assistant'), t('verseAnalyzer.ruleChoice.assistantTitle'))}
      </p>
      {view.assistantReading && (
        <p className="text-muted-foreground" data-testid={`${testId}-disagreement`}>
          {t('verseAnalyzer.ruleChoice.assistantReads', { fn: label(view.assistantReading) })}
        </p>
      )}
      {!fn && (
        <p className="text-muted-foreground">
          {t('verseAnalyzer.ruleChoice.options', { list: candidate.allowed.map(label).join(' · ') })}
          {/* Sólo si el asistente no leyó nada: si leyó otra función, re-analizar no cambia nada. */}
          {!view.assistantReading && <> {t('verseAnalyzer.ruleChoice.reanalyze')}</>}
        </p>
      )}
      <SourceNote sources={fn ? sources(fn) : candidate.allowed.flatMap(sources)} compact />
    </div>
  );
}
