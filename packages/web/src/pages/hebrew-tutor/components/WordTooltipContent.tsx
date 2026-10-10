/**
 * WordTooltipContent
 *
 * Unified rich tooltip for Hebrew words in both the static and sticky verse headers.
 *
 * Shows:
 *  - Grammatical category (colored badge)
 *  - Gloss / translation (with robust fallback chain)
 *  - For verbs: binyan, verb form, temporal value, and P-G-N
 *  - For nominals: gender, number, state (when present)
 */

import React from 'react';
import { TooltipContent } from '@/components/ui/tooltip';
import type { WordAnalysis } from '@dosfilos/domain';
import { FrontedNote, type FrontedInfo } from '@/components/language-structure/FrontedNote';
import type { SpeechView } from '../hooks/useEstructuraHebrea';
import { SpeechNote } from './SpeechNote';
import { HebrewInfinitiveNote } from './HebrewInfinitiveNote';
import { HebrewParticipleNote } from './HebrewParticipleNote';
import { HebrewKiNote } from './HebrewKiNote';
import type { HebrewInfinitiveView, HebrewKiView, HebrewParticipleView } from '@dosfilos/domain';
import { useTranslation } from 'react-i18next';
import { OshbCorrectionsList } from './OshbCorrectionsList';

// ── Category badge colors (mirrors WordCard) ─────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  verb:        'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  noun:        'bg-violet-100/80 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  pronoun:     'bg-pink-100/80 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  preposition: 'bg-orange-100/80 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  conjunction: 'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  article:     'bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  particle:    'bg-slate-100/80 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  adverb:      'bg-green-100/80 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  interjection:'bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  proper_noun: 'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  numeral:     'bg-cyan-100/80 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

const getCatColor = (cat?: string | null) =>
  CATEGORY_COLORS[(cat ?? '').toLowerCase()] ?? CATEGORY_COLORS.particle;

/** Robust gloss: tries multiple fields before giving up. */
const resolveGloss = (w: WordAnalysis): string =>
  w.translation || w.lemmaGloss || w.rootMeaning || w.root || w.hebrewText || '';

// ── Small display helpers ────────────────────────────────────────────────────

const MorphPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col items-start min-w-[44px]">
    <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold leading-none mb-1.5" title={label}>
      {label}
    </span>
    <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 leading-none" title={value}>
      {value}
    </span>
  </div>
);

const pgnLabel = (person?: number, gender?: string, number?: string): string => {
  // Person is a numeric enum: 1 = 1st, 2 = 2nd, 3 = 3rd
  const p = person != null ? String(person).charAt(0) : '';
  // Gender and GrammaticalNumber are already single-char strings ('M','F','C' / 'S','P','D')
  const g = gender != null ? String(gender).charAt(0) : '';
  const n = number != null ? String(number).charAt(0) : '';
  return `${p}${g}${n}`.toUpperCase();
};


// ── Component ────────────────────────────────────────────────────────────────

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

export const WordTooltipContent: React.FC<WordTooltipContentProps> = ({
  word,
  side = 'bottom',
  fronted,
  speech,
  infinitive,
  participle,
  ki,
}) => {
  const { t } = useTranslation('hebrewTutor');
  const gloss = resolveGloss(word);
  const vm = word.verbMorphology;
  const nm = word.nominalMorphology;
  const hasMorphemes = word.morphemes && word.morphemes.length > 0;

  return (
    <TooltipContent
      side={side}
      sideOffset={8}
      className="p-0 z-50 overflow-hidden min-w-[220px] max-w-[300px] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-2xl rounded-xl"
    >
      <div className="flex flex-col">
        {/* ── Top row: category + hebrew + root + lex + gloss ── */}
        <div className="flex flex-col gap-2 p-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col">
              <span
                dir="rtl"
                lang="he"
                className="text-[24px] font-hebrew font-medium text-slate-900 dark:text-slate-100 leading-none tracking-wide"
                style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}
              >
                {word.hebrewText}
              </span>
              {word.transliteration && (
                <span className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-1">
                  {word.transliteration}
                </span>
              )}
            </div>
            {word.category && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${getCatColor(word.category)}`}
              >
                {word.category ? t(`verseAnalyzer.categories.${word.category.toUpperCase()}`) : 'PARTICLE'}
              </span>
            )}
          </div>
          
          <div className="flex flex-col gap-1.5 mt-2">
            {word.root && (
               <div className="flex items-baseline gap-2 text-[12px]">
                 <span className="font-semibold text-slate-500 dark:text-slate-400 w-9 shrink-0">Raíz:</span>
                 <span dir="rtl" lang="he" className="font-hebrew text-[16px] text-slate-800 dark:text-slate-200 leading-none" style={{ fontFeatureSettings: '"mark" 1, "mkmk" 1' }}>{word.root}</span>
                 {word.rootTransliteration && (
                   <span className="text-[11px] italic text-slate-400 dark:text-slate-500 leading-none">
                     {word.rootTransliteration}
                   </span>
                 )}
               </div>
            )}
            {word.lemmaGloss && (
               <div className="flex items-baseline gap-2 text-[12px]">
                 <span className="font-semibold text-slate-500 dark:text-slate-400 w-9 shrink-0">Lex:</span>
                 <span className="text-slate-700 dark:text-slate-300 font-medium leading-snug">{word.lemmaGloss}</span>
               </div>
            )}
            {gloss && (
               <div className="flex items-baseline gap-2 text-[12px]">
                 <span className="font-semibold text-slate-500 dark:text-slate-400 w-9 shrink-0">Trad:</span>
                 <span className="text-slate-900 dark:text-slate-100 font-semibold leading-snug">{gloss}</span>
               </div>
            )}
            {fronted && <div className="mt-2"><FrontedNote fronted={fronted} /></div>}
            {speech && <div className="mt-2"><SpeechNote speech={speech} /></div>}
            {infinitive && <div className="mt-2"><HebrewInfinitiveNote view={infinitive} /></div>}
            {participle && <div className="mt-2"><HebrewParticipleNote view={participle} /></div>}
            {ki && <div className="mt-2"><HebrewKiNote view={ki} /></div>}
            {word.syntacticFunction && (
              <div className="mt-2 flex items-start gap-2 px-2 py-1.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50">
                <span className="text-[9px] uppercase tracking-widest font-bold text-indigo-500 dark:text-indigo-400 shrink-0 pt-0.5">Función</span>
                <span className="text-[11.5px] text-indigo-800 dark:text-indigo-200 font-medium leading-snug">{word.syntacticFunction}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Morphology ── */}
        {(vm || nm) && (
          <div className="flex flex-col gap-3.5 p-4 border-b border-slate-100 dark:border-slate-800/80">
            {vm && (
              <div className="flex items-start gap-x-5 gap-y-3 flex-wrap">
                {vm.binyan    && <MorphPill label="Binyan"  value={vm.binyan} />}
                {vm.verbForm  && <MorphPill label="Forma"   value={t(`verseAnalyzer.verbForms.${vm.verbForm}`)} />}
                {(vm.person || vm.gender || vm.number) && (
                  <MorphPill label="P-G-N" value={pgnLabel(vm.person, vm.gender, vm.number)} />
                )}
                {vm.temporalValue && (
                  <div className="w-full mt-1">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold leading-none block mb-1.5">
                      Valor temporal
                    </span>
                    <p className="text-[12px] text-slate-700 dark:text-slate-200 font-medium leading-snug">
                      {vm.temporalValue}
                    </p>
                  </div>
                )}
              </div>
            )}

            {vm && <OshbCorrectionsList oshb={word.oshbReference} />}

            {nm && (nm.gender || nm.number || nm.state) && (
              <div className="flex items-center gap-x-5 gap-y-3 flex-wrap">
                {nm.gender && <MorphPill label="Género"  value={t(`verseAnalyzer.morphology.gender.${nm.gender.toUpperCase()}`)} />}
                {nm.number && <MorphPill label="Número"  value={t(`verseAnalyzer.morphology.number.${nm.number.toUpperCase()}`)} />}
                {nm.state  && <MorphPill label="Estado"  value={t(`verseAnalyzer.morphology.state.${nm.state.toUpperCase()}`)} />}
              </div>
            )}
          </div>
        )}

        {/* ── Morphemes list (letter by letter context) ── */}
        {hasMorphemes && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold leading-none block mb-3">
              Análisis de morfemas
            </span>
            <div className="flex flex-col gap-2">
              {word.morphemes.map((m, idx) => {
                const isDageshForte = m.role === 'DAGESH_FORTE';
                const cleanText = m.text.replace(/[\u0591-\u05AF\u05BD]/g, '');
                const displayText = isDageshForte ? '\u25CC\u05BC' : cleanText;
                
                return (
                  <div key={idx} className="flex items-start gap-3 text-[12px]">
                    <span dir="rtl" className="font-hebrew text-[16px] font-bold min-w-[28px] text-center shrink-0 text-slate-800 dark:text-slate-200">
                      <span className={isDageshForte ? 'text-red-500 dark:text-red-400' : ''}>
                        {displayText}
                      </span>
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 leading-snug mt-0.5">
                      {m.label || m.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* ── Recognition Clues ── */}
        {vm && vm.recognitionClues && vm.recognitionClues.length > 0 && (
          <div className="p-3">
            <div className="p-3 bg-amber-50/80 dark:bg-amber-500/10 rounded-lg border border-amber-200/50 dark:border-amber-500/20">
              <span className="text-[9px] uppercase tracking-widest text-amber-700 dark:text-amber-500 font-bold leading-none block mb-2.5">
                Pistas de Reconocimiento
              </span>
              <ul className="flex flex-col gap-2">
                {vm.recognitionClues.map((clue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11.5px]">
                    <span className="text-amber-500 dark:text-amber-500/70 mt-[2px] shrink-0 font-bold text-[10px]">•</span>
                    <span className="text-amber-900 dark:text-amber-100/80 leading-relaxed">{clue}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </TooltipContent>
  );
};
