/**
 * OshbValidationBadge
 *
 * Si el análisis del verbo coincidía con OSHB o se corrigió con OSHB, que
 * decide la morfología verbal (ver `applyOshbMorphology`). Al tocarla muestra
 * el código y qué se corrigió.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OshbReference } from '@dosfilos/domain';
import { OshbCorrectionsList } from './OshbCorrectionsList';

interface OshbValidationBadgeProps {
  oshb?: OshbReference;
}

export const OshbValidationBadge: React.FC<OshbValidationBadgeProps> = ({ oshb }) => {
  const { t } = useTranslation('hebrewTutor');
  const [open, setOpen] = useState(false);

  if (!oshb) return null;

  const coincide = oshb.agreesWithAnalysis;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={coincide ? t('verseAnalyzer.oshb.confirmed') : t('verseAnalyzer.oshb.differs')}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border cursor-pointer transition-all ${
          coincide
            ? 'bg-success-subtle text-success-subtle-foreground border-success/30'
            : 'bg-warning-subtle text-warning-subtle-foreground border-warning/30'
        }`}
      >
        {coincide ? '✓' : '~'} OSHB
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1.5 z-20 w-60 rounded-lg bg-popover border border-border shadow-lg p-3 text-xs space-y-1.5"
          role="tooltip"
        >
          <div>
            <span className="font-medium text-muted-foreground">{t('verseAnalyzer.oshb.code')}: </span>
            <span className="font-mono text-foreground">{oshb.morphCode}</span>
          </div>
          <OshbCorrectionsList oshb={oshb} />
        </div>
      )}
    </div>
  );
};
