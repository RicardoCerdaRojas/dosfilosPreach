import React from 'react';
import { useTranslation } from 'react-i18next';
import { hebrewInfinitiveSources, type HebrewInfinitiveView } from '@dosfilos/domain';
import { SourceNote } from '@/components/language-structure/SourceNote';

/**
 * R4 — la función del infinitivo (Arnold y Choi §3.4). Con una sola opción,
 * «Regla · medida»: la PROPONE el texto, probada contra los ejemplos del libro
 * y un conjunto de control, pero sin la muestra del profesor (fase «reglas
 * desde gramáticas»). Si el asistente lee otra, se muestran las dos. Con
 * varias, la que eligió el asistente («Asistente»); si leyó una fuera de la
 * lista, las opciones y su lectura al lado; si el análisis es anterior, las
 * opciones que deja el texto.
 */
export const HebrewInfinitiveNote: React.FC<{ view?: HebrewInfinitiveView }> = ({ view }) => {
  const { t } = useTranslation('hebrewTutor');
  if (!view) return null;
  const { candidate, fn, by } = view;
  const etiqueta = (clase: string, texto: string, titulo: string) => (
    <span title={titulo} className={`rounded border px-1 text-[9.5px] font-semibold uppercase tracking-wider ${clase}`}>{texto}</span>
  );
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[12px] leading-snug text-foreground" data-testid="infinitive-note">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t(`verseAnalyzer.infinitive.title.${candidate.form}`)}
        </span>
        {fn ? <span className="font-medium">{t(`verseAnalyzer.infinitive.functions.${fn}`)}</span> : null}
        {by === 'rule' && etiqueta('border-warning/40 bg-warning/10 text-warning', t('verseAnalyzer.infinitive.ruleMeasured'), t('verseAnalyzer.infinitive.ruleMeasuredTitle'))}
        {by === 'assistant' && etiqueta('border-info/40 bg-info/10 text-info', t('verseAnalyzer.infinitive.assistant'), t('verseAnalyzer.infinitive.assistantTitle'))}
      </p>
      {view.assistantReading && (
        <p className="text-muted-foreground" data-testid="infinitive-disagreement">
          {t('verseAnalyzer.infinitive.assistantReads', { fn: t(`verseAnalyzer.infinitive.functions.${view.assistantReading}`) })}
        </p>
      )}
      {!fn && (
        <p className="text-muted-foreground">
          {t('verseAnalyzer.infinitive.options', { list: candidate.allowed.map((f) => t(`verseAnalyzer.infinitive.functions.${f}`)).join(' · ') })}
          {/* Sólo si el asistente no leyó nada: si leyó otra función, re-analizar no cambia nada. */}
          {!view.assistantReading && <> {t('verseAnalyzer.infinitive.reanalyze')}</>}
        </p>
      )}
      <SourceNote sources={fn ? hebrewInfinitiveSources(fn, candidate.form) : candidate.allowed.flatMap((f) => hebrewInfinitiveSources(f, candidate.form))} compact />
    </div>
  );
};
