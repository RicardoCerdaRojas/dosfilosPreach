import React from 'react';
import { useTranslation } from 'react-i18next';
import type { VerseClause, WordAnalysis } from '@dosfilos/domain';

/**
 * Las cláusulas del versículo y cómo se une cada una a lo anterior.
 *
 * El análisis era sólo por palabra: una waw disyuntiva («וְרוּת» = «pero
 * Rut», Rut 1:14) se leía como «y», y un asíndeton («עַמֵּךְ עַמִּי», Rut 1:16)
 * no se nombraba (bitácora del módulo de hebreo #2 y #4). Un análisis guardado
 * antes de esto no trae cláusulas: se avisa y se ofrece re-analizar.
 */
export const ClausesSection: React.FC<{
  clauses?: readonly VerseClause[];
  words: readonly WordAnalysis[];
  /** Un análisis viejo no trae cláusulas: se dice por qué y se ofrece re-analizar. */
  onReanalyze?: () => void;
}> = ({ clauses, words, onReanalyze }) => {
  const { t } = useTranslation('hebrewTutor');
  if (!clauses || clauses.length === 0) {
    if (!onReanalyze) return null;
    return (
      <section className="rounded-xl border border-dashed border-border bg-card p-5 print:hidden" data-testid="clauses-missing">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {t('verseAnalyzer.clauses.title')}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12.5px] text-muted-foreground">{t('verseAnalyzer.clauses.missing')}</p>
          <button
            type="button"
            onClick={onReanalyze}
            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            {t('verseAnalyzer.clauses.reanalyze')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 print:break-inside-avoid">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {t('verseAnalyzer.clauses.title')}
      </h3>
      <ol className="space-y-3">
        {clauses.map((c, i) => (
          <li key={`${c.firstWord}-${c.lastWord}`} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
              <span dir="rtl" lang="he" className="font-hebrew text-lg text-foreground">
                {words.slice(c.firstWord, c.lastWord + 1).map(w => w.hebrewText).join(' ')}
              </span>
              <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10.5px] font-semibold text-foreground">
                {t(`verseAnalyzer.clauses.connections.${c.connection}`)}
              </span>
              <span className="text-[10.5px] text-muted-foreground">{t(`verseAnalyzer.clauses.types.${c.type}`)}</span>
              {c.value && <span className="text-[11px] italic text-primary">{c.value}</span>}
            </div>
            {c.explanation && <p className="text-[12.5px] text-foreground/80 leading-snug pl-5">{c.explanation}</p>}
            {c.adjusted && <p className="text-[10.5px] text-muted-foreground pl-5">{t('verseAnalyzer.clauses.adjusted')}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
};
