import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SpeechView } from '../hooks/useEstructuraHebrea';

/**
 * En la ficha de una palabra en 2.ª persona dentro de un discurso: es a quien
 * se habla, no quien habla (Rut 1:16 «תֵּלְכִי»: habla Rut, se dirige a Noemí).
 * Lo decide el texto (MACULA: el sujeto del verbo de habla), no el asistente:
 * por eso dice «Regla» y lo dice sin rodeos, aunque la función guardada diga
 * otra cosa («con Rut como sujeto», prueba del fundador).
 */
export const SpeechNote: React.FC<{ speech?: SpeechView }> = ({ speech }) => {
  const { t } = useTranslation('hebrewTutor');
  if (!speech) return null;
  const speaker = speech.speakerName ?? speech.speaker;
  const addressee = speech.addresseeName ?? speech.addressee;
  const clave = speech.kind === 'verb' ? 'verb' : 'suffix';
  return (
    <div className="rounded-md border border-info/40 bg-info/10 px-2.5 py-1.5 text-[12px] leading-snug text-foreground" data-testid="speech-note">
      <p className="mb-0.5 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t('verseAnalyzer.speech.title')}</span>
        <span className="rounded border border-success/40 bg-success/10 px-1 text-[9.5px] font-semibold uppercase tracking-wider text-success">{t('verseAnalyzer.speech.rule')}</span>
      </p>
      {addressee
        ? t(`verseAnalyzer.speech.${clave}To`, { speaker, addressee })
        : t(`verseAnalyzer.speech.${clave}`, { speaker })}
    </div>
  );
};
