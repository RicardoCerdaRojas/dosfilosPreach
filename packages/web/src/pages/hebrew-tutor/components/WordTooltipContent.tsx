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
import { FichaResumen } from '@/components/word-ficha/Ficha';
import { BLOQUES_HEBREO, type DatosHebreo } from '../ficha/bloquesHebreo';

/**
 * Los MISMOS datos que la ficha y la tarjeta (`useDatosHebreo`): el tooltip no
 * arma su propio subconjunto. Antes le faltaban el verbo y la preposición
 * (revisión adversarial, 2026-11-12) y decía otra cosa que la tarjeta.
 */
type WordTooltipContentProps = DatosHebreo & { side?: 'top' | 'bottom' };

export const WordTooltipContent: React.FC<WordTooltipContentProps> = ({ side = 'bottom', ...d }) => {
  const { t } = useTranslation('languageStructure');
  return (
    <TooltipContent
      side={side}
      sideOffset={8}
      collisionPadding={16}
      className="z-50 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-2xl [&>svg]:bg-card [&>svg]:fill-card"
    >
      <FichaResumen registro={BLOQUES_HEBREO} d={d} pie={t('wordFicha.openFicha')} />
    </TooltipContent>
  );
};
