/**
 * WordTooltipContent — el tooltip de una palabra hebrea: el RESUMEN de su
 * ficha (palabra, traducción, forma en una línea, función con su origen).
 * Lo usan el versículo, el encabezado fijo y la «Estructura». La ficha
 * completa se abre al hacer clic (`FichaPanelHebreo`): el tooltip no tiene
 * nada para tocar, porque se cierra al mover el mouse.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { TooltipContent } from '@/components/ui/tooltip';
import type { HebrewInfinitiveView, HebrewKiView, HebrewParticipleView, WordAnalysis } from '@dosfilos/domain';
import type { FrontedInfo } from '@/components/language-structure/FrontedNote';
import { FichaResumen } from '@/components/word-ficha/Ficha';
import type { SpeechView } from '../hooks/useEstructuraHebrea';
import { BLOQUES_HEBREO } from '../ficha/bloquesHebreo';

interface WordTooltipContentProps {
  word: WordAnalysis;
  side?: 'top' | 'bottom';
  /** Antepuesta al verbo (dato de MACULA, vista «Estructura»). */
  fronted?: FrontedInfo;
  speech?: SpeechView;
  /** R4: la función del infinitivo. */
  infinitive?: HebrewInfinitiveView;
  /** R4: la función del participio (Arnold y Choi §3.4.3). */
  participle?: HebrewParticipleView;
  /** R4: la función de כִּי (Arnold y Choi §4.3.4). */
  ki?: HebrewKiView;
}

export const WordTooltipContent: React.FC<WordTooltipContentProps> = ({ word, side = 'bottom', fronted, speech, infinitive, participle, ki }) => {
  const { t } = useTranslation('languageStructure');
  return (
    <TooltipContent
      side={side}
      sideOffset={8}
      collisionPadding={16}
      className="z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-2xl [&>svg]:bg-card [&>svg]:fill-card"
    >
      <FichaResumen registro={BLOQUES_HEBREO} d={{ word, fronted, speech, infinitive, participle, ki }} pie={t('wordFicha.openFicha')} />
    </TooltipContent>
  );
};
