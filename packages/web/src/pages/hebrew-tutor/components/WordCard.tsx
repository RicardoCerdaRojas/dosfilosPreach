import React, { useState } from 'react';
import { FrontedNote, type FrontedInfo } from '@/components/language-structure/FrontedNote';
import { useTranslation } from 'react-i18next';
import type { WordAnalysis } from '@dosfilos/domain';
import { MorphemeSpan, MORPHEME_BADGE_STYLES, getMorphemeCategory } from './MorphemeSpan';
import { OshbValidationBadge } from './OshbValidationBadge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SearchIcon, BookOpenIcon, LightbulbIcon, PuzzleIcon, ChevronRightIcon, ChevronDownIcon, BookmarkIcon } from 'lucide-react';

interface WordCardProps {
  word: WordAnalysis;
  index: number;
  onFocus?: () => void;
  /** Launches the Verb Detective investigation panel for this word */
  onInvestigate?: (word: WordAnalysis) => void;
  /** True when this card's word is highlighted from the verse header */
  isActive?: boolean;
  /** Fires true on mouseenter, false on mouseleave — lets parent highlight the verse header */
  onHover?: (hovered: boolean) => void;
  /** Ref forwarded to the card root div for scroll-into-view */
  cardRef?: React.Ref<HTMLDivElement>;
  /** Antepuesta al verbo (dato de MACULA, vista «Estructura»). */
  fronted?: FrontedInfo;
}

const CATEGORY_STYLES: Record<string, string> = {
  verb:              'bg-blue-100/80 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  noun:              'bg-violet-100/80 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  pronoun:           'bg-pink-100/80 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  preposition:       'bg-orange-100/80 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  conjunction:       'bg-teal-100/80 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  article:           'bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  particle:          'bg-slate-100/80 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  adverb:            'bg-green-100/80 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  interjection:      'bg-red-100/80 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  proper_noun:       'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  numeral:           'bg-cyan-100/80 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

const getCategoryStyle = (cat?: string | null) => {
  if (!cat) return CATEGORY_STYLES.particle;
  return CATEGORY_STYLES[cat.toLowerCase()] ?? CATEGORY_STYLES.particle;
};

export const WordCard: React.FC<WordCardProps> = ({
  word, index, onFocus, onInvestigate, isActive = false, onHover, cardRef, fronted,
}) => {
  const { t } = useTranslation('hebrewTutor');
  const [expanded, setExpanded] = useState(false);

  const isVerb = word.category?.toUpperCase() === 'VERB';
  const isNominal = word.category ? ['NOUN', 'PROPER_NOUN', 'ADJECTIVE', 'PRONOUN', 'PERSONAL_PRONOUN', 'DEMONSTRATIVE_PRONOUN', 'RELATIVE_PRONOUN'].includes(word.category.toUpperCase()) : false;
  const isInvestigable = !!onInvestigate && (isVerb || isNominal);

  const morphology = word.verbMorphology || word.nominalMorphology;
  const hasMorphologyData = !!morphology;
  const hasMorphemes = word.morphemes && word.morphemes.length > 0;
  
  // Detective Logic: Marco-Syntactic Marker Detection (Wayhí)
  const isNarrativeMarker =
    word.category === 'VERB' &&
    morphology &&
    'verbForm' in morphology &&
    morphology.verbForm?.toUpperCase() === 'WAYYIQTOL' &&
    (word.root === 'היה' || word.root === 'הָיָה' || word.hebrewText?.includes('וַיְהִי') || word.lemmaGloss?.toLowerCase().includes('ser') || word.transliteration?.toLowerCase().includes('wayhi') || word.transliteration?.toLowerCase().includes('wayhî'));

  const hasDeepAnalysis = hasMorphemes || word.explanation || (morphology && 'recognitionClues' in morphology && morphology.recognitionClues?.length);

  return (
    <div
      ref={cardRef}
      id={`word-card-${index}`}
      onClick={onFocus}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`
        group relative bg-card border rounded-xl p-4 shadow-sm
        transition-all duration-150
        print:break-inside-avoid print:shadow-none print:mb-4
        ${onFocus ? 'cursor-pointer' : ''}
        ${isActive
          ? 'border-primary/70 ring-2 ring-primary/20 bg-primary/[0.03] shadow-md'
          : 'border-border hover:border-primary/50'
        }
      `}
    >
      {/* ── Header: top bar — category badge + Apertura + Investigar (icon-only) ── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Left: category + apertura marker */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md shadow-sm ${getCategoryStyle(word.category)}`}>
            {word.category ? t(`verseAnalyzer.categories.${word.category}`, { defaultValue: word.category }) : 'PARTICLE'}
          </span>
          
          {isVerb && word.verbMorphology?.verbType && (
            (() => {
              const types = Array.isArray(word.verbMorphology.verbType) ? word.verbMorphology.verbType : String(word.verbMorphology.verbType).split(',');
              const isWeak = types.some(t => t.trim().toUpperCase() !== 'STRONG' && t.trim().toUpperCase() !== 'FUERTE');
              if (isWeak) {
                return (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md shadow-sm bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    Verbo Débil
                  </span>
                );
              }
              return null;
            })()
          )}

          {isNarrativeMarker && (
            <span
              title="Marcador Macro-sintáctico de apertura narrativa"
              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 uppercase tracking-widest flex items-center gap-1 cursor-help shadow-sm"
            >
              <BookmarkIcon className="w-2.5 h-2.5" /> Apertura
            </span>
          )}
        </div>

        {/* Right: Investigar — icon-only ghost button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {word.oshbReference && <OshbValidationBadge oshb={word.oshbReference} />}
          {isInvestigable && (
            <button
              onClick={(e) => { e.stopPropagation(); onInvestigate!(word); }}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-primary hover:bg-primary/8 transition-colors print:hidden"
              title={t('detective.launchButton', { defaultValue: 'Investigar palabra' })}
            >
              <SearchIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Primary data layout ── */}
      <div className={`grid ${word.root ? 'grid-cols-2 sm:grid-cols-[1fr_1fr_1fr]' : 'grid-cols-[1fr_1fr]'} gap-x-4 gap-y-3 mb-4`}>
        {/* Left: Hebrew word + transliteration */}
        <div className="flex flex-col gap-1 min-w-0 items-center justify-center">
          <div dir="rtl" className="text-2xl font-hebrew text-foreground leading-tight">
            {hasMorphemes ? (
              <MorphemeSpan segments={word.morphemes!} variant="text" />
            ) : (
              <span>{word.hebrewText}</span>
            )}
          </div>
          <span className="text-[12px] text-muted-foreground italic truncate" title={word.transliteration}>{word.transliteration}</span>
        </div>

        {/* Middle (Optional): root + rootMeaning */}
        {word.root && (
          <div className="flex flex-col gap-1 justify-center min-w-0 border-l border-border/50 pl-3">
            <span className="text-[11px] text-muted-foreground/70 truncate flex items-center gap-1" title={`raíz: ${word.root}`}>
              raíz: <span dir="rtl" className="font-hebrew text-foreground/85 text-lg inline-block">{word.root}</span>
            </span>
            {word.rootMeaning && (
              <p className="text-sm font-medium text-foreground leading-snug truncate" title={word.rootMeaning}>
                {word.rootMeaning}
              </p>
            )}
          </div>
        )}

        {/* Right: lex form + translation */}
        <div className={`flex flex-col gap-1 justify-center min-w-0 ${word.root ? 'sm:border-l sm:border-border/50 sm:pl-3 col-span-2 sm:col-span-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/50' : 'border-l border-border/50 pl-3'}`}>
          {word.lemmaGloss && (
            <span className="text-[11px] text-muted-foreground/70 truncate" title={`lex: ${word.lemmaGloss}`}>
              lex: <span className="font-hebrew text-foreground/85">{word.lemmaGloss}</span>
            </span>
          )}
          <p className="text-sm font-medium text-foreground leading-snug truncate" title={word.translation}>
            {word.translation}
          </p>
        </div>
      </div>

      {fronted && <div className="mb-3"><FrontedNote fronted={fronted} /></div>}

      {/* Morphology table - Compact Grid */}
      {hasMorphologyData && morphology && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
          {'binyan' in morphology && morphology.binyan && (
            <MorphCell label="Binyan" value={`${morphology.binyan}`} />
          )}
          {'verbForm' in morphology && morphology.verbForm && (
            <MorphCell label="Forma" value={t(`verseAnalyzer.verbForms.${morphology.verbForm}`, { defaultValue: morphology.verbForm })} />
          )}
          {'verbType' in morphology && morphology.verbType && (
            (() => {
              const verbTypeLabel = (Array.isArray(morphology.verbType) ? morphology.verbType : String(morphology.verbType).split(','))
                .map(v => t(`verseAnalyzer.verbTypes.${v.trim()}`, { defaultValue: v.trim() }))
                .join(', ');

              // If rootClassification exists, it means the lexical identity differs from behavior
              const rootClass = 'rootClassification' in morphology
                ? (morphology as { rootClassification?: string | null }).rootClassification
                : null;

              if (rootClass) {
                return (
                  <div className="bg-muted/40 rounded-lg px-3 py-2 flex flex-col justify-center border border-border/40 shadow-sm" title={`Tipo Raíz: ${rootClass} (comportamiento: ${verbTypeLabel})`}>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">Tipo Raíz</div>
                    <div className="text-[12px] font-medium text-foreground truncate">{rootClass}</div>
                  </div>
                );
              }

              return <MorphCell label="Tipo Raíz" value={verbTypeLabel} />;
            })()
          )}
          {'person' in morphology && morphology.person && (
            <MorphCell label="Persona" value={`${morphology.person}`} />
          )}
          {'gender' in morphology && morphology.gender && (
            <MorphCell label="Género" value={t(`verseAnalyzer.morphology.gender.${morphology.gender}`, { defaultValue: `${morphology.gender}` })} />
          )}
          {'number' in morphology && morphology.number && (
            <MorphCell label="Número" value={t(`verseAnalyzer.morphology.number.${morphology.number}`, { defaultValue: `${morphology.number}` })} />
          )}
          {'state' in morphology && morphology.state && (
            <MorphCell label="Estado" value={t(`verseAnalyzer.morphology.state.${morphology.state}`, { defaultValue: `${morphology.state}` })} />
          )}
        </div>
      )}

      {/* Syntactic function */}
      {word.syntacticFunction && (
        <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/50 mb-3">
          <span className="text-[9px] uppercase tracking-widest font-bold text-indigo-500 dark:text-indigo-400 shrink-0 pt-0.5">Función</span>
          <span className="text-[12px] text-indigo-800 dark:text-indigo-200 font-medium leading-snug">{word.syntacticFunction}</span>
        </div>
      )}

      {/* Deep Analysis Toggler */}
      {hasDeepAnalysis && (
        <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 font-medium transition-colors"
          >
            {expanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
            {expanded ? 'Ocultar análisis profundo' : t('verseAnalyzer.analysis.deepAnalysis', { defaultValue: 'Ver análisis profundo' })}
          </button>
        </div>
      )}

      {/* Expanded Deep Analysis Content - Balanced Density Layout */}
      {hasDeepAnalysis && expanded && (
        <div className="mt-3 flex flex-col gap-3">
          
          {/* Recognition Clues */}
          {morphology && 'recognitionClues' in morphology && morphology.recognitionClues && morphology.recognitionClues.length > 0 && (
            <div className="bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg p-3.5 border border-yellow-200/50 dark:border-yellow-800/30">
              <h4 className="text-[11px] font-bold text-yellow-700 dark:text-yellow-500 uppercase tracking-widest flex items-center gap-2 mb-2 pb-1.5 border-b border-yellow-200/50 dark:border-yellow-800/30">
                <LightbulbIcon className="w-3.5 h-3.5" />
                {t('verseAnalyzer.analysis.recognitionClues', { defaultValue: 'Pistas de Reconocimiento' })}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {morphology.recognitionClues.map((clue, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-yellow-500 dark:text-yellow-600 text-[12px] mt-[1px] shrink-0">•</span>
                    <span className="text-[12.5px] text-foreground/80 leading-relaxed">{clue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Morphemes Breakdown */}
          {hasMorphemes && (
            <div className="bg-muted/30 rounded-lg p-3.5 border border-border/50">
              <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2.5 pb-1.5 border-b border-border/50">
                <PuzzleIcon className="w-3.5 h-3.5" />
                {t('verseAnalyzer.analysis.morphemes', { defaultValue: 'Estructura Morfológica' })}
              </h4>
              <div className="flex flex-wrap gap-2" dir="rtl">
                {word.morphemes!.map((seg, i) => {
                  const cat = getMorphemeCategory(seg.role);
                  return (
                    <div
                      key={i}
                      className={`text-[11px] rounded px-2 py-1 flex flex-col items-center min-w-[40px] border shadow-sm ${MORPHEME_BADGE_STYLES[cat] ?? MORPHEME_BADGE_STYLES.neutral} bg-opacity-40 dark:bg-opacity-20`}
                    >
                      <span dir="rtl" className="font-hebrew text-[15px] leading-none mb-1">
                        <MorphemeSpan segments={[seg]} />
                      </span>
                      <span className="text-[9px] text-muted-foreground text-center font-medium opacity-90 tracking-wider">
                        {t(`verseAnalyzer.morphemeRoles.${seg.role}`, { defaultValue: seg.role })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contextual / Pedagogical Explanation */}
          {word.explanation && (
            <div className="bg-primary/5 rounded-lg p-3.5 border border-primary/10 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 rounded-l-lg"></div>
              <h4 className="text-[11px] font-bold text-primary/90 uppercase tracking-widest flex items-center gap-2 mb-2.5 pb-1.5 border-b border-primary/10">
                <BookOpenIcon className="w-3.5 h-3.5" />
                {t('verseAnalyzer.analysis.explanation', { defaultValue: 'Contexto Pedagógico' })}
              </h4>
              <div className="text-[13px] text-foreground/90 leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-[15px] font-bold text-primary mt-3 mb-1.5 flex items-center gap-2 before:content-[''] before:block before:w-1.5 before:h-3.5 before:bg-primary/40 before:rounded-sm" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-[14px] font-bold text-primary/80 mt-2.5 mb-1" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-[13px] font-semibold text-foreground/90 mt-2 mb-1" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2.5 last:mb-0" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1 mb-2.5 last:mb-0 marker:text-primary/50" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1 mb-2.5 last:mb-0 marker:text-primary/50 font-medium" {...props} />,
                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-foreground bg-primary/10 px-1.5 py-0.5 rounded text-[12px]" {...props} />,
                    em: ({node, ...props}) => <em className="italic text-foreground/70" {...props} />,
                    blockquote: ({node, ...props}) => (
                      <blockquote className="border-l-2 border-primary/40 pl-3 py-1 my-2 bg-primary/5 italic text-foreground/80 rounded-r text-[12.5px]" {...props} />
                    )
                  }}
                >
                  {word.explanation}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* End of Card */}
    </div>
  );
};

const MorphCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-muted/40 rounded-lg px-3 py-2 flex flex-col justify-center border border-border/40 shadow-sm" title={`${label}: ${value}`}>
    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">{label}</div>
    <div className="text-[12px] font-medium text-foreground truncate">{value}</div>
  </div>
);
